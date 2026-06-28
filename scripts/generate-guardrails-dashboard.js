/* eslint-env node */
/**
 * Generates reports/workflow-insights/index.html from telemetry/workflow-runs/.
 * All data is embedded as a JS constant; Chart.js is inlined — no external requests.
 *
 * Usage: node scripts/generate-guardrails-dashboard.js
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import jsYaml from "js-yaml";

const TELEMETRY_DIR = "telemetry/workflow-runs";
const OUTPUT_FILE = "reports/workflow-insights/index.html";
const QUALITY_GATE_WORKFLOW = "quality-gate";
const QUALITY_GATE_FAST_WORKFLOW = "quality-gate-fast";
const SESSION_WINDOW_MS = 4 * 60 * 60 * 1000;
const COVERAGE_THRESHOLD = 90;

const PAGE_CSS = `
  body{font-family:system-ui,sans-serif;max-width:1100px;margin:0 auto;padding:2rem;background:#0d1117;color:#e6edf3}
  h1{font-size:1.5rem;font-weight:700;margin-bottom:.25rem}
  .subtitle{color:#8b949e;font-size:.9rem;margin-bottom:2rem}
  .card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:1.5rem;margin-bottom:2rem}
  .card h2{font-size:1rem;font-weight:600;margin:0 0 1rem;color:#8b949e;text-transform:uppercase;letter-spacing:.05em}
  .chart-wrap{position:relative;height:260px}
  .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:2rem}
  .stat{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:1rem}
  .stat .value{font-size:2rem;font-weight:700;color:#58a6ff}
  .stat .label{font-size:.75rem;color:#8b949e;margin-top:.25rem}
  .stat .sub{font-size:.8rem;color:#e6edf3;margin-top:.25rem}
  .empty{color:#8b949e;font-size:.9rem;padding:2rem 0;text-align:center}
  a{color:#58a6ff}
  .session{background:#0d1117;border:1px solid #30363d;border-radius:6px;margin-bottom:.5rem;overflow:hidden}
  .session summary{padding:.65rem 1rem;cursor:pointer;list-style:none;display:flex;align-items:center;gap:.75rem;font-size:.88rem}
  .session summary::-webkit-details-marker{display:none}
  .s-label{color:#58a6ff;font-weight:700;min-width:2.5rem}
  .s-date{color:#8b949e}
  .s-badge{margin-left:auto;font-size:.78rem;padding:.15rem .5rem;border-radius:4px;background:#21262d}
  .s-pass{color:#3fb950}.s-fail{color:#f85149}
  .session-body{padding:.5rem 1rem 1rem;overflow-x:auto}
  .check-table{width:100%;border-collapse:collapse;font-size:.82rem;margin-top:.5rem}
  .check-table th{padding:.3rem .6rem;color:#8b949e;font-weight:600;border-bottom:1px solid #30363d;text-align:right}
  .check-table th:first-child{text-align:left}
  .check-table td{padding:.28rem .6rem;border-bottom:1px solid #21262d;text-align:right;white-space:nowrap}
  .check-table td:first-child{text-align:left;color:#8b949e}
  .check-table .ok{color:#3fb950}.check-table .bad{color:#f85149}
  .check-table tr.sub td:first-child{padding-left:1.5rem;font-size:.78rem;color:#6e7681}
  @media(max-width:700px){.summary{grid-template-columns:1fr 1fr}}
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
  // Failed steps store output as external dataArtifacts refs — no embedded attributes.
  // Synthesise a minimal attrs so the render shows ✗ rather than —.
  if (step.status === "failed") return { attrs: { passed: false }, status: "failed" };
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
  if (doc.workflowName !== QUALITY_GATE_WORKFLOW && doc.workflowName !== QUALITY_GATE_FAST_WORKFLOW) return null;
  const jobs = doc.jobs ?? [];
  const tests = getStepAttrs(jobs, "tests");
  const cov = getStepAttrs(jobs, "coverage");
  const mut = getStepAttrs(jobs, "mutation");
  const cs = getStepAttrs(jobs, "codescene-health");
  const patch = getStepAttrs(jobs, "patch-coverage");

  return {
    id: doc.id,
    status: doc.status,
    startedAt: doc.startedAt,
    completedAt: doc.completedAt ?? null,
    blockingStep: findBlockingStep(jobs),
    metrics: {
      tests: tests.attrs
        ? { passed: tests.attrs.passed, total: tests.attrs.total ?? null, passing: tests.attrs.passing ?? null, failing: tests.attrs.failing ?? null }
        : null,
      coverage: cov.attrs
        ? { passed: cov.attrs.passed, lines: cov.attrs.lines ?? null, functions: cov.attrs.functions ?? null, branches: cov.attrs.branches ?? null, statements: cov.attrs.statements ?? null }
        : null,
      mutation: mut.attrs
        ? { passed: mut.attrs.passed, score: mut.attrs.overallScore ?? null, files: mut.attrs.files ?? [] }
        : null,
      codescene: cs.attrs
        ? { passed: cs.attrs.passed, failedFiles: cs.attrs.failedFiles ?? 0, files: cs.attrs.files ?? [] }
        : null,
      patchCoverage: patch.attrs
        ? { passed: patch.attrs.passed, uncoveredLines: patch.attrs.uncoveredLines ?? null }
        : null,
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

// ── Load all telemetry runs ────────────────────────────────────────────────────

function loadDirRuns(dirPath) {
  return readdirSync(dirPath)
    .filter((f) => f.endsWith(".yaml"))
    .map((f) => jsYaml.load(readFileSync(join(dirPath, f), "utf8")))
    .map(parseRun)
    .filter(Boolean);
}

function loadRuns() {
  /* c8 ignore next */
  if (!existsSync(TELEMETRY_DIR)) return [];
  return readdirSync(TELEMETRY_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((e) => loadDirRuns(join(TELEMETRY_DIR, e.name)))
    .sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt));
}

// ── Dashboard data assembly ────────────────────────────────────────────────────

export function buildData(runs, sessions) {
  const lastBlocked = [...runs].reverse().find((r) => r.blockingStep !== null);
  return {
    sessionLabels: sessions.map((_, i) => `S${i + 1}`),
    sessionAttempts: sessions.map((s) => s.attemptCount),
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
  if(DATA.sessionLabels.length>0){
    new Chart(document.getElementById('sessionChart'),{type:'bar',data:{labels:DATA.sessionLabels,datasets:[{label:'Attempts',data:DATA.sessionAttempts,backgroundColor:DATA.sessionAttempts.map((n)=>n===1?'rgba(63,185,80,0.7)':n<=2?'rgba(240,136,62,0.7)':'rgba(248,81,73,0.7)'),borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:'#8b949e'},grid:{color:'#30363d'}},y:{ticks:{color:'#8b949e',stepSize:1},grid:{color:'#30363d'},min:0}}}});
  }
})();`;
}

// ── Session explorer ───────────────────────────────────────────────────────────

function fmtPct(v) {
  return `${Number(v).toFixed(1)}%`;
}

function renderCell(content, passed) {
  if (passed == null) return `<td>${content}</td>`;
  return `<td class="${passed ? "ok" : "bad"}">${content}</td>`;
}

function renderTestsRow(runs) {
  const cells = runs.map((r) => {
    const m = r.metrics.tests;
    if (!m) return "<td>—</td>";
    if (m.total === null) return renderCell("✗", false);
    return renderCell(`${m.passing ?? m.total}/${m.total}`, m.passed);
  }).join("");
  return `<tr><td>tests</td>${cells}</tr>`;
}

function renderCoverageSubRow(label, key, runs) {
  const cells = runs.map((r) => {
    const val = r.metrics.coverage?.[key] ?? null;
    const ok = val !== null ? val >= COVERAGE_THRESHOLD : null;
    return renderCell(val !== null ? `${val.toFixed(1)}%` : "—", ok);
  }).join("");
  return `<tr class="sub"><td>${label}</td>${cells}</tr>`;
}

function renderCoverageRows(runs) {
  const headerCells = runs.map((r) => {
    const m = r.metrics.coverage;
    return renderCell(m ? (m.passed ? "✓" : "✗") : "—", m?.passed ?? null);
  }).join("");
  return [
    `<tr><td>coverage</td>${headerCells}</tr>`,
    renderCoverageSubRow("lines", "lines", runs),
    renderCoverageSubRow("functions", "functions", runs),
    renderCoverageSubRow("branches", "branches", runs),
    renderCoverageSubRow("statements", "statements", runs),
  ].join("");
}

function renderMutationFileRow(filePath, runs) {
  const cells = runs.map((r) => {
    const file = (r.metrics.mutation?.files ?? []).find((f) => f.path === filePath);
    if (!file) return "<td>—</td>";
    return renderCell(fmtPct(file.score), file.score >= 80);
  }).join("");
  const name = filePath.split("/").pop();
  return `<tr class="sub"><td>${name}</td>${cells}</tr>`;
}

function renderMutationRows(runs) {
  const headerCells = runs.map((r) => {
    const m = r.metrics.mutation;
    if (!m) return "<td>—</td>";
    return renderCell(m.score !== null ? fmtPct(m.score) : "✗", m.passed);
  }).join("");
  const allFiles = [...new Set(runs.flatMap((r) => (r.metrics.mutation?.files ?? []).map((f) => f.path)))];
  const fileRows = allFiles.map((p) => renderMutationFileRow(p, runs));
  return [`<tr><td>mutation</td>${headerCells}</tr>`, ...fileRows].join("");
}

function renderCodeSceneRow(runs) {
  const cells = runs.map((r) => {
    const m = r.metrics.codescene;
    if (!m) return "<td>—</td>";
    const label = m.files.length > 0 ? m.files.map((f) => f.path?.split("/").pop() ?? f).join(", ") : `${m.failedFiles} degraded`;
    return renderCell(label, m.passed);
  }).join("");
  return `<tr><td>codescene</td>${cells}</tr>`;
}

function renderPatchCoverageRow(runs) {
  const cells = runs.map((r) => {
    const m = r.metrics.patchCoverage;
    if (!m) return "<td>—</td>";
    if (m.uncoveredLines === null) return renderCell("✗", false);
    return renderCell(`${m.uncoveredLines} uncov`, m.passed);
  }).join("");
  return `<tr><td>patch-coverage</td>${cells}</tr>`;
}

function renderSessionTable(runs) {
  const headers = runs.map((_, i) => `<th>A${i + 1}</th>`).join("");
  return `<table class="check-table"><thead><tr><th>Check</th>${headers}</tr></thead><tbody>
${renderTestsRow(runs)}
${renderCoverageRows(runs)}
${renderMutationRows(runs)}
${renderCodeSceneRow(runs)}
${renderPatchCoverageRow(runs)}
</tbody></table>`;
}

function renderSession(session, idx) {
  const openAttr = session.attemptCount > 1 ? " open" : "";
  const passed = session.succeeded;
  const icon = `<span class="${passed ? "s-pass" : "s-fail"}">${passed ? "✓" : "✗"}</span>`;
  const label = `${session.attemptCount} attempt${session.attemptCount === 1 ? "" : "s"}`;
  const date = session.startedAt.slice(0, 16).replace("T", " ");
  return `<details class="session"${openAttr}>
<summary><span class="s-label">S${idx + 1}</span><span class="s-date">${date}</span><span class="s-badge">${label} ${icon}</span></summary>
<div class="session-body">${renderSessionTable(session.runs)}</div>
</details>`;
}

export function renderSessionExplorer(sessions) {
  if (sessions.length === 0) return '<div class="empty">No sessions recorded yet.</div>';
  return sessions.map((s, i) => renderSession(s, i)).join("\n");
}

function renderHtml(data, sessions, chartJsSrc) {
  const hasSessions = data.sessionLabels.length > 0;
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
<div class="card"><h2>Agent Attempt Sessions</h2>${sessionCard}</div>
<div class="card"><h2>Session Explorer</h2>${renderSessionExplorer(sessions)}</div>
<script>const DATA=${JSON.stringify(data)};</script>
<script>${chartJsSrc}</script>
<script>${renderChartInit()}</script>
</body>
</html>`;
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function generate(opts = {}) {
  const runs = opts.runs ?? loadRuns();
  const sessions = clusterSessions(runs);
  const data = buildData(runs, sessions);
  const chartJsSrc = readFileSync(
    new URL("../node_modules/chart.js/dist/chart.umd.min.js", import.meta.url),
    "utf8",
  );
  const html = renderHtml(data, sessions, chartJsSrc);
  mkdirSync(new URL("../reports/workflow-insights", import.meta.url).pathname, { recursive: true });
  writeFileSync(new URL(`../${OUTPUT_FILE}`, import.meta.url).pathname, html, "utf8");
  return { runs: runs.length, sessions: sessions.length, outputFile: OUTPUT_FILE };
}

/* c8 ignore next 3 */
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const result = generate();
  console.log(`Generated ${result.outputFile} (${result.runs} runs, ${result.sessions} sessions)`);
}
