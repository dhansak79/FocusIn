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
const TREND_WINDOW = 10;
const TREND_THRESHOLD = 2;

const TREND_METRICS = {
  mutationScore: { path: ["mutation", "score"], badDirection: "down" },
  lineCoverage: { path: ["coverage", "lines"], badDirection: "down" },
  specCoverage: { path: ["specCoverage", "pct"], badDirection: "down" },
  codeHealthFailedFiles: { path: ["codescene", "failedFiles"], badDirection: "up" },
};

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
  .check-table .ok{color:#3fb950}.check-table .bad{color:#f85149}.check-table .trend-bad{color:#f85149;font-weight:600}
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

function findBlockingStep(jobs) {
  for (const job of jobs ?? []) {
    const failed = (job.steps ?? []).find((s) => s.status === "failed");
    if (failed) return failed.stepName;
  }
  return null;
}

// ── Per-step metric parsers ────────────────────────────────────────────────────

function parseIssueStep(step) {
  const { attrs } = extractStepAttrs(step);
  return attrs ? { passed: attrs.passed, issueCount: attrs.issueCount ?? null } : null;
}

function parseTestsStep(step) {
  const { attrs } = extractStepAttrs(step);
  return attrs
    ? { passed: attrs.passed, total: attrs.total ?? null, passing: attrs.passing ?? null, failing: attrs.failing ?? null }
    : null;
}

function parseSpecCovStep(step) {
  const { attrs } = extractStepAttrs(step);
  return attrs
    ? { passed: attrs.passed, pct: attrs.pct ?? null, covered: attrs.covered ?? null, total: attrs.total ?? null }
    : null;
}

function parseCovStep(step) {
  const { attrs } = extractStepAttrs(step);
  return attrs
    ? { passed: attrs.passed, lines: attrs.lines ?? null, functions: attrs.functions ?? null, branches: attrs.branches ?? null, statements: attrs.statements ?? null }
    : null;
}

function parseMutStep(step) {
  const { attrs } = extractStepAttrs(step);
  return attrs ? { passed: attrs.passed, score: attrs.overallScore ?? null, files: attrs.files ?? [] } : null;
}

function gapToTen(score) {
  return score === null ? null : Math.round((10 - score) * 100) / 100;
}

function parseCodeSceneStep(step) {
  const { attrs } = extractStepAttrs(step);
  if (!attrs) return null;
  if (attrs.failedFiles !== undefined) return { passed: attrs.passed, failedFiles: attrs.failedFiles, files: attrs.files ?? [] };
  // Synthesised failure — parse count, paths, and score from error message
  const error = step?.error ?? "";
  const countMatch = error.match(/(\d+) file\(s\)/);
  const fileMatches = [...error.matchAll(/^\s{2,}(\S+\.(?:js|ts))(?:\s+\(([\d.]+)\/10\))?/gm)];
  const files = fileMatches.map((m) => {
    const score = m[2] !== undefined ? parseFloat(m[2]) : null;
    return { path: m[1], score, gapToTen: gapToTen(score) };
  });
  return { passed: false, failedFiles: countMatch ? parseInt(countMatch[1], 10) : Math.max(files.length, 1), files };
}

function parsePatchStep(step) {
  const { attrs } = extractStepAttrs(step);
  return attrs ? { passed: attrs.passed, uncoveredLines: attrs.uncoveredLines ?? null } : null;
}

export function parseRun(doc) {
  if (doc.workflowName !== QUALITY_GATE_WORKFLOW && doc.workflowName !== QUALITY_GATE_FAST_WORKFLOW) return null;
  const jobs = doc.jobs ?? [];
  return {
    id: doc.id,
    workflowName: doc.workflowName,
    status: doc.status,
    startedAt: doc.startedAt,
    completedAt: doc.completedAt ?? null,
    blockingStep: findBlockingStep(jobs),
    metrics: {
      lint: parseIssueStep(findStep(jobs, "lint")),
      knip: parseIssueStep(findStep(jobs, "knip")),
      specCoverage: parseSpecCovStep(findStep(jobs, "spec-coverage")),
      tests: parseTestsStep(findStep(jobs, "tests")),
      denoExtTests: parseTestsStep(findStep(jobs, "deno-ext-tests")),
      coverage: parseCovStep(findStep(jobs, "coverage")),
      mutation: parseMutStep(findStep(jobs, "mutation")),
      codescene: parseCodeSceneStep(findStep(jobs, "codescene-health")),
      patchCoverage: parsePatchStep(findStep(jobs, "patch-coverage")),
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

// ── Trend computation ──────────────────────────────────────────────────────────

function readMetricPath(run, path) {
  let value = run.metrics;
  for (const key of path) {
    if (value == null) return null;
    value = value[key];
  }
  return value ?? null;
}

function findBaseline(window, path) {
  for (const run of window) {
    const value = readMetricPath(run, path);
    if (value !== null) return value;
  }
  return null;
}

function computeMetricTrend(window, { path, badDirection }) {
  const current = readMetricPath(window[window.length - 1], path);
  const baseline = findBaseline(window, path);
  if (current === null || baseline === null) return { available: false };

  const delta = current - baseline;
  const flagged = badDirection === "down" ? delta <= -TREND_THRESHOLD : delta >= TREND_THRESHOLD;
  return { available: true, current, baseline, delta, flagged };
}

export function computeTrends(runs) {
  const gateRuns = runs.filter((r) => r.workflowName === QUALITY_GATE_WORKFLOW);
  const window = gateRuns.slice(-TREND_WINDOW);

  const metrics = {};
  for (const [name, config] of Object.entries(TREND_METRICS)) {
    metrics[name] = window.length < 2 ? { available: false } : computeMetricTrend(window, config);
  }

  return { windowRuns: window.length, metrics };
}

// ── Guardrail catch aggregation ─────────────────────────────────────────────────

function tallyCatchesByWorkflow(catchRuns) {
  const byWorkflow = { [QUALITY_GATE_WORKFLOW]: 0, [QUALITY_GATE_FAST_WORKFLOW]: 0 };
  for (const run of catchRuns) {
    if (run.workflowName in byWorkflow) byWorkflow[run.workflowName] += 1;
  }
  return byWorkflow;
}

function tallyFileCatchesAndGaps(catchRuns) {
  const fileCounts = new Map();
  const gaps = [];
  const catchFiles = catchRuns.flatMap((run) => run.metrics.codescene.files ?? []);
  for (const file of catchFiles) {
    fileCounts.set(file.path, (fileCounts.get(file.path) ?? 0) + 1);
    if (file.gapToTen !== null && file.gapToTen !== undefined) gaps.push(file.gapToTen);
  }
  return { fileCounts, gaps };
}

function summarizeGaps(gaps) {
  if (gaps.length === 0) return { avgGap: null, worstGap: null };
  const avgGap = Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 100) / 100;
  return { avgGap, worstGap: Math.max(...gaps) };
}

export function computeGuardrailCatches(runs) {
  const catchRuns = runs.filter((r) => r.metrics.codescene && r.metrics.codescene.passed === false);
  const byWorkflow = tallyCatchesByWorkflow(catchRuns);
  const { fileCounts, gaps } = tallyFileCatchesAndGaps(catchRuns);
  const byFile = [...fileCounts.entries()].map(([path, count]) => ({ path, count }));

  return { totalCatches: catchRuns.length, byWorkflow, byFile, ...summarizeGaps(gaps) };
}

// ── Dashboard data assembly ────────────────────────────────────────────────────

export function buildData(runs, sessions) {
  const lastBlocked = [...runs].reverse().find((r) => r.blockingStep !== null);
  return {
    sessionLabels: sessions.map((_, i) => `S${i + 1}`),
    sessionAttempts: sessions.map((s) => s.attemptCount),
    trends: computeTrends(runs),
    guardrailCatches: computeGuardrailCatches(runs),
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

const TREND_LABELS = {
  mutationScore: "Mutation score",
  lineCoverage: "Line coverage",
  specCoverage: "Spec coverage",
  codeHealthFailedFiles: "Code health (degraded files)",
};

function isPercentTrendMetric(name) {
  return name !== "codeHealthFailedFiles";
}

function fmtTrendValue(name, value) {
  return isPercentTrendMetric(name) ? fmtPct(value) : `${value}`;
}

function renderTrendRow(name, trend) {
  const label = TREND_LABELS[name];
  if (!trend.available) {
    return `<tr><td>${label}</td><td colspan="2" class="empty">insufficient history</td></tr>`;
  }
  const sign = trend.delta > 0 ? "+" : "";
  const deltaText = `${sign}${isPercentTrendMetric(name) ? trend.delta.toFixed(1) : trend.delta}`;
  const cellClass = trend.flagged ? "trend-bad" : "ok";
  const marker = trend.flagged ? " ⚠" : "";
  return `<tr><td>${label}</td><td>${fmtTrendValue(name, trend.current)}</td><td class="${cellClass}">${deltaText}${marker}</td></tr>`;
}

export function renderTrendCard(trends) {
  if (trends.windowRuns < 2) {
    return `<div class="card"><h2>Quality Trends</h2><div class="empty">Insufficient history — need at least 2 quality-gate runs.</div></div>`;
  }
  const rows = Object.entries(trends.metrics).map(([name, trend]) => renderTrendRow(name, trend)).join("\n");
  return `<div class="card"><h2>Quality Trends</h2>
<table class="check-table"><thead><tr><th>Metric</th><th>Current</th><th>&Delta; over last ${trends.windowRuns} runs</th></tr></thead><tbody>
${rows}
</tbody></table>
</div>`;
}

function renderGuardrailCatchesFileRows(byFile) {
  if (byFile.length === 0) return "";
  const rows = [...byFile]
    .sort((a, b) => b.count - a.count)
    .map((f) => `<tr class="sub"><td>${f.path}</td><td>${f.count}</td></tr>`)
    .join("\n");
  return `<tr><td colspan="2"><table class="check-table"><thead><tr><th>File</th><th>Catches</th></tr></thead><tbody>
${rows}
</tbody></table></td></tr>`;
}

export function renderGuardrailCatchesCard(catches) {
  const gap = (v) => (v === null ? "—" : v.toFixed(2));
  return `<div class="card"><h2>Code Health Guardrail Catches</h2>
<table class="check-table"><tbody>
<tr><td>Total catches</td><td>${catches.totalCatches}</td></tr>
<tr><td>Pre-push (quality-gate)</td><td>${catches.byWorkflow[QUALITY_GATE_WORKFLOW]}</td></tr>
<tr><td>Pre-commit (quality-gate-fast)</td><td>${catches.byWorkflow[QUALITY_GATE_FAST_WORKFLOW]}</td></tr>
<tr><td>Average gap to 10</td><td>${gap(catches.avgGap)}</td></tr>
<tr><td>Worst gap to 10</td><td>${gap(catches.worstGap)}</td></tr>
${renderGuardrailCatchesFileRows(catches.byFile)}
</tbody></table>
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

function renderIssueCountRow(label, key, runs) {
  const cells = runs.map((r) => {
    const m = r.metrics[key];
    if (!m) return "<td>—</td>";
    if (m.issueCount === null) return renderCell("✗", false);
    return renderCell(m.issueCount === 0 ? "✓" : `${m.issueCount} issues`, m.passed);
  }).join("");
  return `<tr><td>${label}</td>${cells}</tr>`;
}

function renderSpecCoverageRow(runs) {
  const cells = runs.map((r) => {
    const m = r.metrics.specCoverage;
    if (!m) return "<td>—</td>";
    if (m.pct === null) return renderCell("✗", false);
    return renderCell(`${m.covered}/${m.total}`, m.passed);
  }).join("");
  return `<tr><td>spec-coverage</td>${cells}</tr>`;
}

function renderTestsRow(label, key, runs) {
  const cells = runs.map((r) => {
    const m = r.metrics[key];
    if (!m) return "<td>—</td>";
    if (m.total === null) return renderCell("✗", false);
    return renderCell(`${m.passing ?? m.total}/${m.total}`, m.passed);
  }).join("");
  return `<tr><td>${label}</td>${cells}</tr>`;
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
  const counters = { push: 0, commit: 0 };
  const headers = runs.map((r) => {
    if (r.workflowName === QUALITY_GATE_FAST_WORKFLOW) {
      counters.commit += 1;
      return `<th>commit${counters.commit > 1 ? ` ${counters.commit}` : ""}</th>`;
    }
    counters.push += 1;
    return `<th>push${counters.push > 1 ? ` ${counters.push}` : ""}</th>`;
  }).join("");
  return `<table class="check-table"><thead><tr><th>Check</th>${headers}</tr></thead><tbody>
${renderIssueCountRow("lint", "lint", runs)}
${renderIssueCountRow("knip", "knip", runs)}
${renderSpecCoverageRow(runs)}
${renderTestsRow("tests", "tests", runs)}
${renderTestsRow("deno-ext", "denoExtTests", runs)}
${renderCoverageRows(runs)}
${renderCodeSceneRow(runs)}
${renderMutationRows(runs)}
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
${renderTrendCard(data.trends)}
${renderGuardrailCatchesCard(data.guardrailCatches)}
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
