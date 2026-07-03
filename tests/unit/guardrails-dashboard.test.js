import { describe, it, expect } from "vitest";
import {
  clusterSessions,
  parseRun,
  buildData,
  renderSessionExplorer,
  generate,
  computeTrends,
  renderTrendCard,
  computeGuardrailCatches,
  renderGuardrailCatchesCard,
} from "../../scripts/generate-guardrails-dashboard.js";

const MS = 1000;
const MIN = 60 * MS;
const HOUR = 60 * MIN;

function makeRun(offsetMs, status = "succeeded") {
  const base = new Date("2026-06-25T10:00:00Z").getTime();
  const startedAt = new Date(base + offsetMs).toISOString();
  return {
    id: `run-${offsetMs}`,
    status,
    startedAt,
    completedAt: new Date(base + offsetMs + 5 * MIN).toISOString(),
    blockingStep: status === "failed" ? "mutation" : null,
    metrics: { lint: null, knip: null, specCoverage: null, tests: null, denoExtTests: null, coverage: null, mutation: null, codescene: null, patchCoverage: null },
  };
}

function makeFullRun(offsetMs, overrides = {}) {
  const base = new Date("2026-06-25T10:00:00Z").getTime();
  return {
    id: `run-full-${offsetMs}`,
    workflowName: overrides.workflowName ?? "quality-gate",
    status: overrides.status ?? "succeeded",
    startedAt: new Date(base + offsetMs).toISOString(),
    completedAt: new Date(base + offsetMs + 5 * MIN).toISOString(),
    blockingStep: overrides.blockingStep ?? null,
    metrics: {
      lint: overrides.lint ?? { passed: true, issueCount: 0 },
      knip: overrides.knip ?? { passed: true, issueCount: 0 },
      specCoverage: overrides.specCoverage ?? { passed: true, pct: 100, covered: 42, total: 42 },
      tests: overrides.tests ?? { passed: true, total: 699, passing: 699, failing: 0 },
      denoExtTests: overrides.denoExtTests ?? { passed: true, total: 12, passing: 12, failing: 0 },
      coverage: overrides.coverage ?? { passed: true, lines: 100.0, functions: 98.7, branches: 90.8, statements: 98.5 },
      mutation: overrides.mutation ?? { passed: true, score: 81.0, files: [
        { path: "src/feed.js", score: 76.4 },
        { path: "src/slop.js", score: 91.0 },
      ]},
      codescene: overrides.codescene ?? { passed: true, failedFiles: 0, files: [] },
      patchCoverage: overrides.patchCoverage ?? { passed: true, uncoveredLines: 0 },
    },
  };
}

function makeSession(runs, succeeded = true) {
  return {
    sessionIndex: 0,
    attemptCount: runs.length,
    startedAt: runs[0].startedAt,
    completedAt: runs[runs.length - 1].completedAt,
    succeeded,
    runs,
  };
}

describe("clusterSessions", () => {
  it("returns empty array for no runs", () => {
    expect(clusterSessions([])).toEqual([]);
  });

  it("single run is one session with one attempt", () => {
    const sessions = clusterSessions([makeRun(0)]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].attemptCount).toBe(1);
    expect(sessions[0].sessionIndex).toBe(0);
  });

  it("two runs within 4 hours form one session", () => {
    const sessions = clusterSessions([makeRun(0), makeRun(3 * HOUR)]);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].attemptCount).toBe(2);
  });

  it("two runs more than 4 hours apart form two sessions", () => {
    const sessions = clusterSessions([makeRun(0), makeRun(5 * HOUR)]);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].attemptCount).toBe(1);
    expect(sessions[1].attemptCount).toBe(1);
  });

  it("failed then success within 4h = one session of 2 attempts", () => {
    const runs = [makeRun(0, "failed"), makeRun(30 * MIN, "succeeded")];
    const sessions = clusterSessions(runs);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].attemptCount).toBe(2);
    expect(sessions[0].succeeded).toBe(true);
  });

  it("running status treated as attempt", () => {
    const runs = [
      makeRun(0, "running"),
      makeRun(20 * MIN, "running"),
      makeRun(40 * MIN, "succeeded"),
    ];
    const sessions = clusterSessions(runs);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].attemptCount).toBe(3);
  });

  it("clusters quality-gate and quality-gate-fast runs together within the time window", () => {
    const runs = [makeRun(0), makeRun(HOUR)];
    const sessions = clusterSessions(runs);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].attemptCount).toBe(2);
  });

  it("sorts runs chronologically before clustering", () => {
    const runs = [makeRun(3 * HOUR), makeRun(0)]; // intentionally reversed
    const sessions = clusterSessions(runs);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].startedAt).toBe(runs[1].startedAt);
  });
});

function makeCodesceneFailureDoc(id, workflowName, errorText) {
  return {
    id,
    workflowName,
    status: "failed",
    startedAt: "2026-06-25T10:00:00Z",
    jobs: [{ steps: [{ stepName: "codescene-health", status: "failed", error: errorText }] }],
  };
}

describe("parseRun", () => {
  it("returns null for unrecognised workflows", () => {
    const doc = { workflowName: "some-other-workflow", status: "succeeded", startedAt: "2026-06-25T10:00:00Z", jobs: [] };
    expect(parseRun(doc)).toBeNull();
  });

  it("parses a quality-gate-fast run with partial metrics", () => {
    const doc = {
      id: "run-fast-1",
      workflowName: "quality-gate-fast",
      status: "failed",
      startedAt: "2026-06-25T10:00:00Z",
      jobs: [{ steps: [{ stepName: "codescene-health", status: "failed", output: { resources: {} } }] }],
    };
    const run = parseRun(doc);
    expect(run).not.toBeNull();
    expect(run.blockingStep).toBe("codescene-health");
    expect(run.metrics.coverage).toBeNull();
    expect(run.metrics.mutation).toBeNull();
  });

  it.each([
    {
      name: "parses file count and path from codescene error message when no embedded output",
      workflowName: "quality-gate-fast",
      error: "CodeScene health gate failed — 1 file(s) introduced degradations:\n  /repo/src/slop-detector.js  (8.13/10)",
      expected: { passed: false, failedFiles: 1, files: [{ path: "/repo/src/slop-detector.js", score: 8.13, gapToTen: 1.87 }] },
    },
    {
      name: "parses score and gap-to-10 for multiple degraded files in one error message",
      workflowName: "quality-gate",
      error:
        "CodeScene health gate failed — 2 file(s) introduced degradations:\n" +
        "  /repo/src/feed.js  (9.68/10)\n" +
        "  /repo/extensions/models/tests.ts  (9.38/10)",
      expected: {
        passed: false,
        failedFiles: 2,
        files: [
          { path: "/repo/src/feed.js", score: 9.68, gapToTen: 0.32 },
          { path: "/repo/extensions/models/tests.ts", score: 9.38, gapToTen: 0.62 },
        ],
      },
    },
    {
      name: "counts a file with unparseable score without dropping it or throwing",
      workflowName: "quality-gate-fast",
      error: "CodeScene health gate failed — 1 file(s) introduced degradations:\n  /repo/src/weird.js  score unavailable",
      expected: { passed: false, failedFiles: 1, files: [{ path: "/repo/src/weird.js", score: null, gapToTen: null }] },
    },
  ])("$name", ({ workflowName, error, expected }) => {
    const doc = makeCodesceneFailureDoc("run-fast", workflowName, error);
    const run = parseRun(doc);
    expect(run.metrics.codescene).toEqual(expected);
  });

  it("defaults to 1 degraded when codescene error has no file count", () => {
    const doc = {
      id: "run-fast-4",
      workflowName: "quality-gate-fast",
      status: "failed",
      startedAt: "2026-06-25T10:00:00Z",
      jobs: [{ steps: [{ stepName: "codescene-health", status: "failed", error: "something went wrong" }] }],
    };
    const run = parseRun(doc);
    expect(run.metrics.codescene?.passed).toBe(false);
    expect(run.metrics.codescene?.failedFiles).toBe(1);
  });

  it("synthesises null numeric fields for all failed steps without embedded output", () => {
    const doc = {
      id: "run-fast-3",
      workflowName: "quality-gate-fast",
      status: "failed",
      startedAt: "2026-06-25T10:00:00Z",
      jobs: [{ steps: [
        { stepName: "lint", status: "failed" },
        { stepName: "knip", status: "failed" },
        { stepName: "spec-coverage", status: "failed" },
        { stepName: "tests", status: "failed" },
        { stepName: "deno-ext-tests", status: "failed" },
        { stepName: "coverage", status: "failed" },
        { stepName: "patch-coverage", status: "failed" },
      ]}],
    };
    const run = parseRun(doc);
    expect(run.metrics.lint).toEqual({ passed: false, issueCount: null });
    expect(run.metrics.knip).toEqual({ passed: false, issueCount: null });
    expect(run.metrics.specCoverage).toEqual({ passed: false, pct: null, covered: null, total: null });
    expect(run.metrics.tests).toEqual({ passed: false, total: null, passing: null, failing: null });
    expect(run.metrics.denoExtTests).toEqual({ passed: false, total: null, passing: null, failing: null });
    expect(run.metrics.coverage).toEqual({ passed: false, lines: null, functions: null, branches: null, statements: null });
    expect(run.metrics.patchCoverage).toEqual({ passed: false, uncoveredLines: null });
  });

  it("parses knip and lint metrics from a quality-gate run", () => {
    const doc = {
      id: "run-knip-1",
      workflowName: "quality-gate",
      status: "succeeded",
      startedAt: "2026-06-25T10:00:00Z",
      jobs: [{ steps: [
        {
          stepName: "knip",
          status: "succeeded",
          output: { resources: { knipResult: { current: { attributes: { passed: true, issueCount: 0, ranAt: "2026-06-25T10:00:01Z" } } } } },
        },
        {
          stepName: "lint",
          status: "succeeded",
          output: { resources: { lintResult: { current: { attributes: { passed: true, issueCount: 0, ranAt: "2026-06-25T10:00:01Z" } } } } },
        },
      ]}],
    };
    const run = parseRun(doc);
    expect(run.metrics.knip).toEqual({ passed: true, issueCount: 0 });
    expect(run.metrics.lint).toEqual({ passed: true, issueCount: 0 });
  });

  it("parses tests metrics from a quality-gate run", () => {
    const doc = {
      id: "run-1",
      workflowName: "quality-gate",
      status: "succeeded",
      startedAt: "2026-06-25T10:00:00Z",
      completedAt: "2026-06-25T10:05:00Z",
      jobs: [{
        jobName: "check",
        steps: [{
          stepName: "tests",
          status: "succeeded",
          output: {
            resources: {
              testResult: { current: { attributes: { passed: true, total: 699, passing: 699, failing: 0, durationMs: 2850 } } },
            },
          },
        }],
      }],
    };
    const run = parseRun(doc);
    expect(run).not.toBeNull();
    expect(run.id).toBe("run-1");
    expect(run.status).toBe("succeeded");
    expect(run.blockingStep).toBeNull();
    expect(run.metrics.tests).toEqual({ passed: true, total: 699, passing: 699, failing: 0 });
  });

  it("parses coverage thresholds from a quality-gate run", () => {
    const doc = {
      id: "run-cov",
      workflowName: "quality-gate",
      status: "succeeded",
      startedAt: "2026-06-25T10:00:00Z",
      jobs: [{
        jobName: "coverage",
        steps: [{
          stepName: "coverage",
          status: "succeeded",
          output: {
            resources: {
              coverageResult: { current: { attributes: { passed: true, lines: 95.2, functions: 92.1, branches: 91.0, statements: 94.8 } } },
            },
          },
        }],
      }],
    };
    const run = parseRun(doc);
    expect(run.metrics.coverage).toEqual({ passed: true, lines: 95.2, functions: 92.1, branches: 91.0, statements: 94.8 });
  });

  it("parses mutation per-file scores from a quality-gate run", () => {
    const doc = {
      id: "run-mut",
      workflowName: "quality-gate",
      status: "succeeded",
      startedAt: "2026-06-25T10:00:00Z",
      jobs: [{
        jobName: "mutation",
        steps: [{
          stepName: "mutation",
          status: "succeeded",
          output: {
            resources: {
              mutationResult: { current: { attributes: {
                passed: true, overallScore: 81.0, killed: 400, survived: 90, noCoverage: 10, total: 500,
                files: [
                  { path: "src/feed.js", score: 76.4, killed: 100, survived: 30, noCoverage: 1, total: 131 },
                  { path: "src/slop.js", score: 91.0, killed: 91, survived: 9, noCoverage: 0, total: 100 },
                ],
              }}},
            },
          },
        }],
      }],
    };
    const run = parseRun(doc);
    expect(run.metrics.mutation.passed).toBe(true);
    expect(run.metrics.mutation.score).toBeCloseTo(81.0);
    expect(run.metrics.mutation.files).toHaveLength(2);
    expect(run.metrics.mutation.files[0].path).toBe("src/feed.js");
    expect(run.metrics.mutation.files[0].score).toBeCloseTo(76.4);
  });

  it("parses codescene degraded files from a quality-gate run", () => {
    const doc = {
      id: "run-cs",
      workflowName: "quality-gate",
      status: "failed",
      startedAt: "2026-06-25T10:00:00Z",
      jobs: [{
        jobName: "check",
        steps: [{
          stepName: "codescene-health",
          status: "failed",
          output: {
            resources: {
              healthResult: { current: { attributes: { passed: false, failedFiles: 1, files: [{ path: "src/slop-detector.js", score: 6.8 }] } } },
            },
          },
        }],
      }],
    };
    const run = parseRun(doc);
    expect(run.metrics.codescene.passed).toBe(false);
    expect(run.metrics.codescene.failedFiles).toBe(1);
    expect(run.metrics.codescene.files[0].path).toBe("src/slop-detector.js");
    expect(run.blockingStep).toBe("codescene-health");
  });

  it("parses patch-coverage uncovered lines from a quality-gate run", () => {
    const doc = {
      id: "run-patch",
      workflowName: "quality-gate",
      status: "failed",
      startedAt: "2026-06-25T10:00:00Z",
      jobs: [{
        jobName: "patch-coverage",
        steps: [{
          stepName: "patch-coverage",
          status: "failed",
          output: {
            resources: {
              patchResult: { current: { attributes: { passed: false, uncoveredLines: 3 } } },
            },
          },
        }],
      }],
    };
    const run = parseRun(doc);
    expect(run.metrics.patchCoverage).toEqual({ passed: false, uncoveredLines: 3 });
    expect(run.blockingStep).toBe("patch-coverage");
  });

  it("returns null metrics for missing steps", () => {
    const doc = { id: "run-empty", workflowName: "quality-gate", status: "succeeded", startedAt: "2026-06-25T10:00:00Z", jobs: [] };
    const run = parseRun(doc);
    expect(run.metrics.tests).toBeNull();
    expect(run.metrics.coverage).toBeNull();
    expect(run.metrics.mutation).toBeNull();
    expect(run.metrics.codescene).toBeNull();
    expect(run.metrics.patchCoverage).toBeNull();
  });
});

function trendsFrom(...overridesList) {
  const runs = overridesList.map((overrides, i) => {
    const run = makeFullRun(i * HOUR, overrides);
    for (const key of Object.keys(overrides)) {
      if (overrides[key] === null) run.metrics[key] = null;
    }
    return run;
  });
  return computeTrends(runs);
}

function expectFlaggedTrend(trends, metricName, expected) {
  expect(trends.metrics[metricName]).toEqual({ available: true, ...expected });
}

function renderTrendsFrom(...overridesList) {
  return renderTrendCard(trendsFrom(...overridesList));
}

describe("computeTrends", () => {
  it("marks every metric unavailable with fewer than 2 quality-gate runs", () => {
    const trends = computeTrends([makeFullRun(0)]);
    expect(trends.windowRuns).toBe(1);
    for (const metric of Object.values(trends.metrics)) {
      expect(metric).toEqual({ available: false });
    }
  });

  it("marks every metric unavailable with no runs", () => {
    const trends = computeTrends([]);
    expect(trends.windowRuns).toBe(0);
    for (const metric of Object.values(trends.metrics)) {
      expect(metric).toEqual({ available: false });
    }
  });

  it("flags a metric that declined by more than the threshold", () => {
    const trends = trendsFrom(
      { mutation: { passed: true, score: 91.0, files: [] } },
      { mutation: { passed: true, score: 84.0, files: [] } }
    );
    expectFlaggedTrend(trends, "mutationScore", { current: 84.0, baseline: 91.0, delta: -7, flagged: true });
  });

  it("does not flag a metric that stayed within the threshold", () => {
    const trends = trendsFrom(
      { mutation: { passed: true, score: 91.0, files: [] } },
      { mutation: { passed: true, score: 90.0, files: [] } }
    );
    expect(trends.metrics.mutationScore.flagged).toBe(false);
  });

  it("does not flag an improving metric", () => {
    const trends = trendsFrom(
      { mutation: { passed: true, score: 84.0, files: [] } },
      { mutation: { passed: true, score: 91.0, files: [] } }
    );
    expectFlaggedTrend(trends, "mutationScore", { current: 91.0, baseline: 84.0, delta: 7, flagged: false });
  });

  it("flags codeHealthFailedFiles when the count increases past the threshold", () => {
    const trends = trendsFrom(
      { codescene: { passed: true, failedFiles: 0, files: [] } },
      { codescene: { passed: false, failedFiles: 2, files: [] } }
    );
    expectFlaggedTrend(trends, "codeHealthFailedFiles", { current: 2, baseline: 0, delta: 2, flagged: true });
  });

  it("skips a run with a null metric value when finding the baseline", () => {
    const trends = trendsFrom(
      { mutation: null },
      { mutation: { passed: true, score: 91.0, files: [] } },
      { mutation: { passed: true, score: 88.0, files: [] } }
    );
    expectFlaggedTrend(trends, "mutationScore", {
      current: 88.0,
      baseline: 91.0,
      delta: -3,
      flagged: true,
    });
  });

  it("reports unavailable when every run in the window has a null value for a metric", () => {
    const trends = trendsFrom({ mutation: null }, { mutation: null });
    expect(trends.metrics.mutationScore).toEqual({ available: false });
  });

  it("ignores quality-gate-fast runs when building the trend window", () => {
    const fastRun = makeFullRun(HOUR, { workflowName: "quality-gate-fast" });
    fastRun.metrics.mutation = null;
    const runs = [
      makeFullRun(0, { mutation: { passed: true, score: 91.0, files: [] } }),
      fastRun,
      makeFullRun(2 * HOUR, { mutation: { passed: true, score: 84.0, files: [] } }),
    ];
    const trends = computeTrends(runs);
    expect(trends.windowRuns).toBe(2);
    expect(trends.metrics.mutationScore.baseline).toBe(91.0);
    expect(trends.metrics.mutationScore.current).toBe(84.0);
  });

  it("only considers the trailing 10 quality-gate runs", () => {
    const runs = [
      makeFullRun(0, { mutation: { passed: true, score: 50.0, files: [] } }),
      ...Array.from({ length: 10 }, (_, i) =>
        makeFullRun((i + 1) * HOUR, { mutation: { passed: true, score: 91.0, files: [] } })
      ),
    ];
    const trends = computeTrends(runs);
    expect(trends.windowRuns).toBe(10);
    expect(trends.metrics.mutationScore.baseline).toBe(91.0);
  });

  it("treats a metric object missing its target field as unavailable, not as zero", () => {
    const trends = trendsFrom({ mutation: {} }, { mutation: {} });
    expect(trends.metrics.mutationScore).toEqual({ available: false });
  });
});

describe("computeGuardrailCatches", () => {
  it("reports zero catches when every codescene-health run passed", () => {
    const runs = [makeFullRun(0), makeFullRun(HOUR)];
    const catches = computeGuardrailCatches(runs);
    expect(catches).toEqual({
      totalCatches: 0,
      byWorkflow: { "quality-gate": 0, "quality-gate-fast": 0 },
      byFile: [],
      avgGap: null,
      worstGap: null,
    });
  });

  it("counts total catches broken out by pre-commit and pre-push workflow", () => {
    const runs = [
      makeFullRun(0, {
        workflowName: "quality-gate",
        codescene: { passed: false, failedFiles: 1, files: [{ path: "/repo/src/a.js", score: 9.0, gapToTen: 1.0 }] },
      }),
      makeFullRun(HOUR, {
        workflowName: "quality-gate-fast",
        codescene: { passed: false, failedFiles: 1, files: [{ path: "/repo/src/b.js", score: 8.5, gapToTen: 1.5 }] },
      }),
      makeFullRun(2 * HOUR, {
        workflowName: "quality-gate-fast",
        codescene: { passed: false, failedFiles: 1, files: [{ path: "/repo/src/c.js", score: 9.5, gapToTen: 0.5 }] },
      }),
    ];
    const catches = computeGuardrailCatches(runs);
    expect(catches.totalCatches).toBe(3);
    expect(catches.byWorkflow).toEqual({ "quality-gate": 1, "quality-gate-fast": 2 });
  });

  it("ignores a catch from a workflow outside the known set when tallying byWorkflow", () => {
    const runs = [
      makeFullRun(0, {
        workflowName: "some-other-workflow",
        codescene: { passed: false, failedFiles: 1, files: [{ path: "/repo/src/a.js", score: 9.0, gapToTen: 1.0 }] },
      }),
    ];
    const catches = computeGuardrailCatches(runs);
    expect(catches.totalCatches).toBe(1);
    expect(catches.byWorkflow).toEqual({ "quality-gate": 0, "quality-gate-fast": 0 });
  });

  it("tolerates a caught run with no files list", () => {
    const runs = [makeFullRun(0, { codescene: { passed: false, failedFiles: 1 } })];
    const catches = computeGuardrailCatches(runs);
    expect(catches.totalCatches).toBe(1);
    expect(catches.byFile).toEqual([]);
  });

  it("counts a repeatedly-caught file once per catching run it appears in", () => {
    const runs = [
      makeFullRun(0, {
        codescene: { passed: false, failedFiles: 1, files: [{ path: "/repo/src/flaky.js", score: 9.0, gapToTen: 1.0 }] },
      }),
      makeFullRun(HOUR, {
        codescene: { passed: false, failedFiles: 1, files: [{ path: "/repo/src/flaky.js", score: 8.8, gapToTen: 1.2 }] },
      }),
      makeFullRun(2 * HOUR, {
        codescene: { passed: false, failedFiles: 1, files: [{ path: "/repo/src/other.js", score: 9.9, gapToTen: 0.1 }] },
      }),
    ];
    const catches = computeGuardrailCatches(runs);
    expect(catches.byFile).toEqual(
      expect.arrayContaining([
        { path: "/repo/src/flaky.js", count: 2 },
        { path: "/repo/src/other.js", count: 1 },
      ])
    );
  });

  it("computes average and worst gap-to-10 across all catches, ignoring nulls", () => {
    const runs = [
      makeFullRun(0, {
        codescene: {
          passed: false,
          failedFiles: 2,
          files: [
            { path: "/repo/src/a.js", score: 9.0, gapToTen: 1.0 },
            { path: "/repo/src/b.js", score: null, gapToTen: null },
          ],
        },
      }),
      makeFullRun(HOUR, {
        codescene: { passed: false, failedFiles: 1, files: [{ path: "/repo/src/c.js", score: 8.0, gapToTen: 2.0 }] },
      }),
    ];
    const catches = computeGuardrailCatches(runs);
    expect(catches.avgGap).toBe(1.5);
    expect(catches.worstGap).toBe(2.0);
  });
});

describe("renderGuardrailCatchesCard", () => {
  it("renders the card title and totals for a populated result", () => {
    const html = renderGuardrailCatchesCard({
      totalCatches: 2,
      byWorkflow: { "quality-gate": 1, "quality-gate-fast": 1 },
      byFile: [{ path: "/repo/src/a.js", count: 2 }],
      avgGap: 0.75,
      worstGap: 1.5,
    });
    expect(html).toContain("Code Health Guardrail Catches");
    expect(html).toContain("/repo/src/a.js");
    expect(html).toContain("0.75");
    expect(html).toContain("1.50");
  });

  it("renders a clean zero-state without dashes turning into errors", () => {
    const html = renderGuardrailCatchesCard({
      totalCatches: 0,
      byWorkflow: { "quality-gate": 0, "quality-gate-fast": 0 },
      byFile: [],
      avgGap: null,
      worstGap: null,
    });
    expect(html).toContain("Code Health Guardrail Catches");
    expect(html).toContain(">0<");
  });
});

describe("renderTrendCard", () => {
  it("shows an insufficient-history message for the whole card when windowRuns < 2", () => {
    const html = renderTrendCard(computeTrends([makeFullRun(0)]));
    expect(html).toContain("Insufficient history");
    expect(html).not.toContain("<table");
  });

  it("shows an insufficient-history row for a single metric with no data in an otherwise-populated window", () => {
    const html = renderTrendsFrom({ mutation: null }, { mutation: null });
    expect(html).toContain("insufficient history");
  });

  it("marks a flagged metric with the trend-bad class and a warning marker", () => {
    const html = renderTrendsFrom(
      { mutation: { passed: true, score: 91.0, files: [] } },
      { mutation: { passed: true, score: 84.0, files: [] } }
    );
    expect(html).toContain("trend-bad");
    expect(html).toContain("⚠");
    expect(html).toContain("-7.0");
  });

  it("does not mark a stable metric as flagged", () => {
    const html = renderTrendsFrom(
      { mutation: { passed: true, score: 90.0, files: [] } },
      { mutation: { passed: true, score: 91.0, files: [] } }
    );
    expect(html).not.toContain("trend-bad");
    expect(html).toContain("+1.0");
  });

  it("formats codeHealthFailedFiles as a plain integer, not a percentage", () => {
    const html = renderTrendsFrom(
      { codescene: { passed: true, failedFiles: 0, files: [] } },
      { codescene: { passed: false, failedFiles: 2, files: [] } }
    );
    expect(html).toContain(">2<");
  });
});

describe("buildData", () => {
  it("returns empty labels and zero summary for no runs", () => {
    const data = buildData([], []);
    expect(data.sessionLabels).toEqual([]);
    expect(data.sessionAttempts).toEqual([]);
    expect(data.summary.totalRuns).toBe(0);
    expect(data.summary.avgAttempts).toBe("0");
    expect(data.summary.lastBlockedStep).toBeNull();
    expect(data.summary.lastBlockedDate).toBeNull();
  });

  it("computes session labels and attempt counts", () => {
    const runs = [makeRun(0), makeRun(30 * MIN)];
    const sessions = clusterSessions(runs);
    const data = buildData(runs, sessions);
    expect(data.sessionLabels).toEqual(["S1"]);
    expect(data.sessionAttempts).toEqual([2]);
    expect(data.summary.totalRuns).toBe(2);
    expect(data.summary.totalSessions).toBe(1);
    expect(data.summary.avgAttempts).toBe("2.0");
  });

  it("identifies the last blocking step across all runs", () => {
    const blocked = { ...makeRun(0, "failed"), blockingStep: "codescene-health" };
    const passing = makeRun(30 * MIN);
    const sessions = clusterSessions([blocked, passing]);
    const data = buildData([blocked, passing], sessions);
    expect(data.summary.lastBlockedStep).toBe("codescene-health");
    expect(data.summary.lastBlockedDate).toBe("2026-06-25");
  });
});

describe("renderSessionExplorer", () => {
  it("renders empty message when no sessions", () => {
    const html = renderSessionExplorer([]);
    expect(html).toContain("No sessions recorded yet.");
  });

  it("renders a collapsed details element for a single-attempt session", () => {
    const html = renderSessionExplorer([makeSession([makeFullRun(0)])]);
    expect(html).toContain('<details class="session">');
    expect(html).not.toMatch(/details class="session" open/);
    expect(html).toContain("1 attempt ");
    expect(html).toContain("s-pass");
  });

  it("renders an open details element for a multi-attempt session", () => {
    const html = renderSessionExplorer([makeSession([makeFullRun(0), makeFullRun(30 * MIN)], false)]);
    expect(html).toContain("open");
    expect(html).toContain("2 attempts");
    expect(html).toContain("s-fail");
  });

  it("renders all five check rows in the table", () => {
    const html = renderSessionExplorer([makeSession([makeFullRun(0)])]);
    expect(html).toContain("<td>tests</td>");
    expect(html).toContain("<td>coverage</td>");
    expect(html).toContain("<td>mutation</td>");
    expect(html).toContain("<td>codescene</td>");
    expect(html).toContain("<td>patch-coverage</td>");
  });

  it("renders mutation per-file score sub-rows", () => {
    const html = renderSessionExplorer([makeSession([makeFullRun(0)])]);
    expect(html).toContain("feed.js");
    expect(html).toContain("76.4%");
    expect(html).toContain("slop.js");
  });

  it("renders — for null metrics", () => {
    const html = renderSessionExplorer([makeSession([makeRun(0)])]);
    expect(html).toContain("<td>—</td>");
  });

  it("highlights coverage below 90% threshold in red", () => {
    const run = makeFullRun(0, {
      coverage: { passed: false, lines: 100.0, functions: 98.7, branches: 89.5, statements: 98.5 },
    });
    const html = renderSessionExplorer([makeSession([run])]);
    expect(html).toContain("89.5%");
    expect(html).toContain('class="bad"');
  });

  it("shows codescene degraded filenames when files[] is non-empty", () => {
    const run = makeFullRun(0, {
      codescene: { passed: false, failedFiles: 1, files: [{ path: "src/slop-detector.js", score: 6.8 }] },
    });
    const html = renderSessionExplorer([makeSession([run])]);
    expect(html).toContain("slop-detector.js");
  });

  it("falls back to raw file entry when codescene file has no path", () => {
    const run = makeFullRun(0, {
      codescene: { passed: false, failedFiles: 1, files: [{ score: 6.8 }] },
    });
    const html = renderSessionExplorer([makeSession([run])]);
    expect(html).toContain('class="bad"');
  });

  it("shows failedFiles count when files[] is empty", () => {
    const run = makeFullRun(0, {
      codescene: { passed: false, failedFiles: 2, files: [] },
    });
    const html = renderSessionExplorer([makeSession([run])]);
    expect(html).toContain("2 degraded");
  });

  it("shows patch-coverage uncovered line count", () => {
    const run = makeFullRun(0, { patchCoverage: { passed: false, uncoveredLines: 5 } });
    const html = renderSessionExplorer([makeSession([run])]);
    expect(html).toContain("5 uncov");
  });

  it("renders column headers per attempt", () => {
    const html = renderSessionExplorer([makeSession([makeFullRun(0), makeFullRun(30 * MIN)])]);
    expect(html).toContain("<th>push</th>");
    expect(html).toContain("<th>push 2</th>");
  });

  it("renders commit header for quality-gate-fast runs", () => {
    const fastRun = { ...makeFullRun(0), workflowName: "quality-gate-fast" };
    const fastRun2 = { ...makeFullRun(5 * MIN), workflowName: "quality-gate-fast" };
    const html = renderSessionExplorer([makeSession([fastRun, fastRun2])]);
    expect(html).toContain("<th>commit</th>");
    expect(html).toContain("<th>commit 2</th>");
  });

  it("falls back to total when tests.passing is undefined", () => {
    const run = makeFullRun(0, {
      tests: { passed: true, total: 42, passing: undefined, failing: 0 },
    });
    const html = renderSessionExplorer([makeSession([run])]);
    expect(html).toContain("42/42");
  });

  it("shows ✗ for tests when total is null (failed step with no embedded data)", () => {
    const run = makeFullRun(0, { tests: { passed: false, total: null, passing: null, failing: null } });
    const html = renderSessionExplorer([makeSession([run])]);
    expect(html).toContain("✗");
  });

  it("shows ✗ for mutation when score is null (failed step with no embedded data)", () => {
    const run = makeFullRun(0, { mutation: { passed: false, score: null, files: [] } });
    const html = renderSessionExplorer([makeSession([run])]);
    expect(html).toContain("✗");
  });

  it("shows ✗ for patch-coverage when uncoveredLines is null (failed step with no embedded data)", () => {
    const run = makeFullRun(0, { patchCoverage: { passed: false, uncoveredLines: null } });
    const html = renderSessionExplorer([makeSession([run])]);
    expect(html).toContain("✗");
  });

  it("shows knip issue count when issues found", () => {
    const run = makeFullRun(0, { knip: { passed: false, issueCount: 3 } });
    const html = renderSessionExplorer([makeSession([run])]);
    expect(html).toContain("3 issues");
  });

  it("shows ✓ for knip when issueCount is 0", () => {
    const run = makeFullRun(0, { knip: { passed: true, issueCount: 0 } });
    const html = renderSessionExplorer([makeSession([run])]);
    expect(html).toContain(">✓<");
  });

  it("shows ✗ for knip when issueCount is null (failed step with no embedded data)", () => {
    const run = makeFullRun(0, { knip: { passed: false, issueCount: null } });
    const html = renderSessionExplorer([makeSession([run])]);
    expect(html).toContain("✗");
  });

  it("shows spec-coverage covered/total", () => {
    const run = makeFullRun(0, { specCoverage: { passed: true, pct: 95, covered: 38, total: 40 } });
    const html = renderSessionExplorer([makeSession([run])]);
    expect(html).toContain("38/40");
  });

  it("shows deno-ext test counts", () => {
    const run = makeFullRun(0, { denoExtTests: { passed: true, total: 15, passing: 15, failing: 0 } });
    const html = renderSessionExplorer([makeSession([run])]);
    expect(html).toContain("15/15");
  });
});

describe("generate", () => {
  it("returns run and session counts for given runs", () => {
    const runs = [makeFullRun(0), makeFullRun(30 * MIN)];
    const result = generate({ runs });
    expect(result.runs).toBe(2);
    expect(result.sessions).toBe(1);
    expect(result.outputFile).toContain("index.html");
  });

  it("handles empty runs gracefully", () => {
    const result = generate({ runs: [] });
    expect(result.runs).toBe(0);
    expect(result.sessions).toBe(0);
  });

  it("loads from telemetry directory when no opts provided", () => {
    const result = generate();
    expect(typeof result.runs).toBe("number");
    expect(typeof result.sessions).toBe("number");
    expect(result.outputFile).toContain("index.html");
  });
});
