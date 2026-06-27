import { describe, it, expect } from "vitest";
import {
  clusterSessions,
  parseRun,
  buildData,
  renderSessionExplorer,
  generate,
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
    metrics: { tests: null, coverage: null, mutation: null, codescene: null, patchCoverage: null },
  };
}

function makeFullRun(offsetMs, overrides = {}) {
  const base = new Date("2026-06-25T10:00:00Z").getTime();
  return {
    id: `run-full-${offsetMs}`,
    status: overrides.status ?? "succeeded",
    startedAt: new Date(base + offsetMs).toISOString(),
    completedAt: new Date(base + offsetMs + 5 * MIN).toISOString(),
    blockingStep: overrides.blockingStep ?? null,
    metrics: {
      tests: overrides.tests ?? { passed: true, total: 699, passing: 699, failing: 0 },
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

  it("quality-gate-fast runs excluded (they would have different workflowName filtered at parse time)", () => {
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

describe("parseRun", () => {
  it("returns null for non-quality-gate workflows", () => {
    const doc = { workflowName: "quality-gate-fast", status: "succeeded", startedAt: "2026-06-25T10:00:00Z", jobs: [] };
    expect(parseRun(doc)).toBeNull();
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
    expect(html).toContain("<th>A1</th>");
    expect(html).toContain("<th>A2</th>");
  });

  it("falls back to total when tests.passing is undefined", () => {
    const run = makeFullRun(0, {
      tests: { passed: true, total: 42, passing: undefined, failing: 0 },
    });
    const html = renderSessionExplorer([makeSession([run])]);
    expect(html).toContain("42/42");
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
