/* eslint-env node */
/**
 * Generates reports/workflow-insights/index.html from telemetry/workflow-runs/.
 * All data is embedded as a JS constant; Chart.js is inlined — no external requests.
 *
 * Usage: node scripts/generate-guardrails-dashboard.js
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import jsYaml from "js-yaml";

const TELEMETRY_DIR = "telemetry/workflow-runs";
const OUTPUT_FILE = "reports/workflow-insights/index.html";
const QUALITY_GATE_WORKFLOW = "quality-gate";
const SESSION_WINDOW_MS = 4 * 60 * 60 * 1000;

const PAGE_CSS = `
  body{font-family:system-ui,sans-serif;max-width:1100px;margin:0 auto;padding:2rem;background:#0d1117;color:#e6edf3}
  h1{font-size:1.5rem;font-weight:700;margin-bottom:.25rem}
  .subtitle{color:#8b949e;font-size:.9rem;margin-bottom:2rem}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:2rem;margin-bottom:2rem}
  .card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:1.5rem}
  .card h2{font-size:1rem;font-weight:600;margin:0 0 1rem;color:#8b949e;text-transform:uppercase;letter-spacing:.05em}
  .chart-wrap{position:relative;height:260px}
  .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:2rem}
  .stat{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:1rem}
  .stat .value{font-size:2rem;font-weight:700;color:#58a6ff}
  .stat .label{font-size:.75rem;color:#8b949e;margin-top:.25rem}
  .stat .sub{font-size:.8rem;color:#e6edf3;margin-top:.25rem}
  .empty{color:#8b949e;font-size:.9rem;padding:2rem 0;text-align:center}
  a{color:#58a6ff}
  @media(max-width:700px){.grid{grid-template-columns:1fr}.summary{grid-template-columns:1fr 1fr}}
`;

// ── Data extraction ────────────────────────────────────────────────────────────

function findStep(jobs, stepName) {
  for (const job of jobs ?? []) {
    const step = (job.steps ?? []).find((s) => s.stepName === stepName);
    if (step) return step;
  }
  return null;
}

function extractStepAttrs(step) {
  if (!step) return { attrs: null, status: "skipped" };
  for (const resource of Object.values(step.output?.resources ?? {})) {
    const instance = resource.current ?? Object.values(resource)[0];
    if (instance?.attributes) return { attrs: instance.attributes, status: step.status };
  }
  return { attrs: null, status: step.status };
}

function getStepAttrs(jobs, stepName) {
  return extractStepAttrs(findStep(jobs, stepName));
}

function findBlockingStep(jobs) {
  for (const job of jobs ?? []) {
    const failed = (job.steps ?? []).find((s) => s.status === "failed");
    if (failed) return failed.stepName;
  }
  return null;
}

export function parseRun(doc) {
  if (doc.workflowName !== QUALITY_GATE_WORKFLOW) return null;
  const jobs = doc.jobs ?? [];
  const spec = getStepAttrs(jobs, "spec-coverage");
  const tests = getStepAttrs(jobs, "tests");
  const coverage = getStepAttrs(jobs, "coverage");
  const mutation = getStepAttrs(jobs, "mutation");

  return {
    id: doc.id,
    status: doc.status,
    startedAt: doc.startedAt,
    completedAt: doc.completedAt ?? null,
    blockingStep: findBlockingStep(jobs),
    metrics: {
      specCoverage: spec.attrs ? { pct: spec.attrs.pct, passed: spec.attrs.passed } : null,
      tests: tests.attrs ? { total: tests.attrs.total, failing: tests.attrs.failing, passed: tests.attrs.passed } : null,
      coverage: coverage.attrs ? { lines: coverage.attrs.lines, passed: coverage.attrs.passed } : null,
      mutation: mutation.attrs ? { score: mutation.attrs.overallScore, passed: mutation.attrs.passed } : null,
    },
  };
}

// ── Session clustering ─────────────────────────────────────────────────────────

export function clusterSessions(runs) {
  if (runs.length === 0) return [];
  const sorted = [...runs].sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
  const groups = [[sorted[0]]];

  for (let i = 1; i < sorted.length; i++) {
    const gap = new Date(sorted[i].startedAt) - new Date(sorted[i - 1].startedAt);
    if (gap > SESSION_WINDOW_MS) groups.push([]);
    groups[groups.length - 1].push(sorted[i]);
  }

  return groups.map((group, idx) => {
    const last = group[group.length - 1];
    return {
      sessionIndex: idx,
      attemptCount: group.length,
      startedAt: group[0].startedAt,
      completedAt: last.completedAt ?? last.startedAt,
      succeeded: last.status === "succeeded",
      runs: group,
    };
  });
}

// ── Pre-hardening slope (linear regression) ────────────────────────────────────

export function computePreHardeningSlope(runs, hardeningDate) {
  const pre = runs.filter(
    (r) => r.metrics.specCoverage !== null && new Date(r.startedAt) < new Date(hardeningDate),
  );
  if (pre.length < 2) return null;

  const t0 = new Date(pre[0].startedAt).getTime();
  const pts = pre.map((r) => ({
    x: (new Date(r.startedAt).getTime() - t0) / 86400000,
    y: r.metrics.specCoverage.pct,
  }));

  const n = pts.length;
  const sx = pts.reduce((s, p) => s + p.x, 0);
  const sy = pts.reduce((s, p) => s + p.y, 0);
  const sxy = pts.reduce((s, p) => s + p.x * p.y, 0);
  const sx2 = pts.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sx2 - sx * sx;
  if (denom === 0) return null;

  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept, t0, firstDate: pre[0].startedAt };
}

export function projectSlope(slope, intercept, t0, atDate) {
  return slope * ((new Date(atDate).getTime() - t0) / 86400000) + intercept;
}

// ── Git hardening date ─────────────────────────────────────────────────────────

function getHardeningDate() {
  try {
    return execSync(
      "git log --format=%aI -1 -- workflows/workflow-adb5a2c2-eee7-4dbb-a708-86c7f53cd81a.yaml",
      { encoding: "utf8" },
    ).trim() || null;
  } catch {
    return null;
  }
}

// ── Load all telemetry runs ────────────────────────────────────────────────────

function loadDirRuns(dirPath) {
  return readdirSync(dirPath)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => jsYaml.load(readFileSync(join(dirPath, f), "utf8")))
    .map(parseRun)
    .filter(Boolean);
}

function loadRuns() {
  if (!existsSync(TELEMETRY_DIR)) return [];
  return readdirSync(TELEMETRY_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((e) => loadDirRuns(join(TELEMETRY_DIR, e.name)))
    .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
}

// ── Dashboard data assembly ────────────────────────────────────────────────────

function buildData(runs, sessions, hardeningDate, slope) {
  const specRuns = runs.filter((r) => r.metrics.specCoverage !== null);
  const specDates = specRuns.map((r) => r.startedAt.slice(0, 10));
  const specActual = specRuns.map((r) => r.metrics.specCoverage.pct);
  const specProjected = slope && hardeningDate
    ? specRuns.map((r) => parseFloat(projectSlope(slope.slope, slope.intercept, slope.t0, r.startedAt).toFixed(1)))
    : null;

  const lastBlocked = [...runs].reverse().find((r) => r.blockingStep !== null);
  return {
    specDates,
    specActual,
    specProjected,
    sessionLabels: sessions.map((_, i) => `S${i + 1}`),
    sessionAttempts: sessions.map((s) => s.attemptCount),
    hardeningDate: hardeningDate ?? null,
    summary: {
      totalRuns: runs.length,
      totalSessions: sessions.length,
      avgAttempts: sessions.length > 0 ? (runs.length / sessions.length).toFixed(1) : "0",
      lastBlockedDate: lastBlocked?.startedAt?.slice(0, 10) ?? null,
      lastBlockedStep: lastBlocked?.blockingStep ?? null,
    },
  };
}

// ── HTML rendering ─────────────────────────────────────────────────────────────

function renderSummary(s) {
  return `<div class="summary">
  <div class="stat"><div class="value">${s.totalRuns}</div><div class="label">Total gate runs</div></div>
  <div class="stat"><div class="value">${s.totalSessions}</div><div class="label">Sessions</div></div>
  <div class="stat"><div class="value">${s.avgAttempts}</div><div class="label">Avg attempts / session</div></div>
  <div class="stat"><div class="value">${s.lastBlockedStep ?? "—"}</div><div class="label">Last blocking step</div><div class="sub">${s.lastBlockedDate ?? ""}</div></div>
</div>`;
}

function renderChartInit() {
  return `(function(){
  if(DATA.specDates.length>=2){
    const ds=[{label:'Actual (gate enforced)',data:DATA.specActual,borderColor:'#58a6ff',backgroundColor:'rgba(88,166,255,0.08)',tension:0.3,pointRadius:3,fill:true}];
    if(DATA.specProjected)ds.push({label:'Pre-hardening trajectory',data:DATA.specProjected,borderColor:'#f0883e',borderDash:[6,4],pointRadius:0,tension:0,fill:false});
    new Chart(document.getElementById('specChart'),{type:'line',data:{labels:DATA.specDates,datasets:ds},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#e6edf3'}},tooltip:{callbacks:{label:(c)=>c.dataset.label+': '+c.parsed.y.toFixed(1)+(c.dataset.label==='Pre-hardening trajectory'?' (observed trend before gate hardened)':'%')}}},scales:{x:{ticks:{color:'#8b949e'},grid:{color:'#30363d'}},y:{ticks:{color:'#8b949e',callback:(v)=>v+'%'},grid:{color:'#30363d'},min:0,max:100}}}});
  }
  if(DATA.sessionLabels.length>0){
    new Chart(document.getElementById('sessionChart'),{type:'bar',data:{labels:DATA.sessionLabels,datasets:[{label:'Attempts',data:DATA.sessionAttempts,backgroundColor:DATA.sessionAttempts.map((n)=>n===1?'rgba(63,185,80,0.7)':n<=2?'rgba(240,136,62,0.7)':'rgba(248,81,73,0.7)'),borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#8b949e'},grid:{color:'#30363d'}},y:{ticks:{color:'#8b949e',stepSize:1},grid:{color:'#30363d'},min:0}}}});
  }
})();`;
}

function renderHtml(data, chartJsSrc) {
  const hasSpec = data.specDates.length >= 2;
  const hasSessions = data.sessionLabels.length > 0;
  const specCard = hasSpec
    ? `<div class="chart-wrap"><canvas id="specChart"></canvas></div>`
    : `<div class="empty">Not enough data yet.</div>`;
  const sessionCard = hasSessions
    ? `<div class="chart-wrap"><canvas id="sessionChart"></canvas></div>`
    : `<div class="empty">No sessions recorded yet.</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Guardrails Impact Dashboard</title>
<style>${PAGE_CSS}</style>
</head>
<body>
<h1>Guardrails Impact Dashboard</h1>
<p class="subtitle">Quality gate telemetry · <a href="/FocusIn/">Mutation Report</a></p>
${renderSummary(data.summary)}
<div class="grid">
  <div class="card"><h2>Spec Coverage Trend</h2>${specCard}</div>
  <div class="card"><h2>Agent Attempt Sessions</h2>${sessionCard}</div>
</div>
<script>const DATA=${JSON.stringify(data)};</script>
<script>${chartJsSrc}</script>
<script>${renderChartInit()}</script>
</body>
</html>`;
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function generate(opts = {}) {
  const runs = opts.runs ?? loadRuns();
  const hardeningDate = opts.hardeningDate ?? getHardeningDate();
  const sessions = clusterSessions(runs);
  const slope = hardeningDate ? computePreHardeningSlope(runs, hardeningDate) : null;
  const data = buildData(runs, sessions, hardeningDate, slope);
  const chartJsSrc = readFileSync(
    new URL("../node_modules/chart.js/dist/chart.umd.min.js", import.meta.url),
    "utf8",
  );
  const html = renderHtml(data, chartJsSrc);
  mkdirSync(new URL("../reports/workflow-insights", import.meta.url).pathname, { recursive: true });
  writeFileSync(new URL(`../${OUTPUT_FILE}`, import.meta.url).pathname, html, "utf8");
  return { runs: runs.length, sessions: sessions.length, outputFile: OUTPUT_FILE };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const result = generate();
  console.log(`Generated ${result.outputFile} (${result.runs} runs, ${result.sessions} sessions)`);
}
