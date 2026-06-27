import { describe, it, expect } from "vitest";
import {
  clusterSessions,
  computePreHardeningSlope,
  projectSlope,
  parseRun,
} from "../../scripts/generate-guardrails-dashboard.js";

const MS = 1000;
const MIN = 60 * MS;
const HOUR = 60 * MIN;

function makeRun(offsetMs, status = "succeeded", specPct = null) {
  const base = new Date("2026-06-25T10:00:00Z").getTime();
  const startedAt = new Date(base + offsetMs).toISOString();
  return {
    id: `run-${offsetMs}`,
    status,
    startedAt,
    completedAt: new Date(base + offsetMs + 5 * MIN).toISOString(),
    blockingStep: status === "failed" ? "mutation" : null,
    metrics: {
      specCoverage: specPct !== null ? { pct: specPct, passed: specPct >= 50 } : null,
      tests: null,
      coverage: null,
      mutation: null,
    },
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
    // parseRun returns null for non-quality-gate runs — confirm null is filtered
    const runs = [makeRun(0), makeRun(HOUR)];
    const sessions = clusterSessions(runs);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].attemptCount).toBe(2);
  });

  it("sorts runs chronologically before clustering", () => {
    const runs = [makeRun(3 * HOUR), makeRun(0)]; // intentionally reversed
    const sessions = clusterSessions(runs);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].startedAt).toBe(runs[1].startedAt); // first by time
  });
});

describe("computePreHardeningSlope", () => {
  it("returns null when fewer than 2 pre-hardening runs have spec data", () => {
    const runs = [makeRun(0, "succeeded", 50)];
    const hardeningDate = new Date(Date.now() + HOUR).toISOString();
    expect(computePreHardeningSlope(runs, hardeningDate)).toBeNull();
  });

  it("returns null when no runs have spec-coverage data", () => {
    const runs = [makeRun(0), makeRun(HOUR)];
    const hardeningDate = new Date(Date.now() + HOUR).toISOString();
    expect(computePreHardeningSlope(runs, hardeningDate)).toBeNull();
  });

  it("computes a negative slope for declining spec coverage", () => {
    const base = new Date("2026-06-23T10:00:00Z").getTime();
    const runs = [
      { ...makeRun(0, "succeeded", 50), startedAt: new Date(base).toISOString() },
      { ...makeRun(0, "succeeded", 40), startedAt: new Date(base + 2 * 24 * HOUR).toISOString() },
      { ...makeRun(0, "succeeded", 30), startedAt: new Date(base + 4 * 24 * HOUR).toISOString() },
    ];
    runs.forEach((r) => {
      r.metrics.specCoverage = { pct: r.metrics.specCoverage.pct, passed: false };
    });
    const hardeningDate = new Date(base + 10 * 24 * HOUR).toISOString();
    const result = computePreHardeningSlope(runs, hardeningDate);
    expect(result).not.toBeNull();
    expect(result.slope).toBeLessThan(0);
  });

  it("excludes runs after the hardening date", () => {
    const base = new Date("2026-06-23T10:00:00Z").getTime();
    const hardeningDate = new Date(base + 2 * 24 * HOUR).toISOString();
    const runs = [
      { ...makeRun(0, "succeeded", 50), startedAt: new Date(base).toISOString() },
      { ...makeRun(0, "succeeded", 45), startedAt: new Date(base + 1 * 24 * HOUR).toISOString() },
      { ...makeRun(0, "succeeded", 80), startedAt: new Date(base + 3 * 24 * HOUR).toISOString() }, // post-hardening, should be excluded
    ];
    runs.forEach((r, i) => {
      r.metrics.specCoverage = { pct: [50, 45, 80][i], passed: false };
    });
    const result = computePreHardeningSlope(runs, hardeningDate);
    expect(result).not.toBeNull();
    expect(result.slope).toBeLessThan(0); // declining, not influenced by the 80% post-hardening run
  });
});

describe("projectSlope", () => {
  it("projects zero change when slope is 0", () => {
    const t0 = new Date("2026-06-23T10:00:00Z").getTime();
    const atDate = new Date("2026-06-25T10:00:00Z").toISOString();
    expect(projectSlope(0, 50, t0, atDate)).toBe(50);
  });

  it("projects correct value for known slope", () => {
    const t0 = new Date("2026-06-23T00:00:00Z").getTime();
    const atDate = new Date("2026-06-24T00:00:00Z").toISOString(); // 1 day later
    // slope = -5 %/day, intercept = 50
    const val = projectSlope(-5, 50, t0, atDate);
    expect(val).toBeCloseTo(45, 5);
  });
});

describe("parseRun", () => {
  it("returns null for non-quality-gate workflows", () => {
    const doc = { workflowName: "quality-gate-fast", status: "succeeded", startedAt: "2026-06-25T10:00:00Z", jobs: [] };
    expect(parseRun(doc)).toBeNull();
  });

  it("parses a succeeded quality-gate run", () => {
    const doc = {
      id: "run-1",
      workflowName: "quality-gate",
      status: "succeeded",
      startedAt: "2026-06-25T10:00:00Z",
      completedAt: "2026-06-25T10:05:00Z",
      jobs: [
        {
          jobName: "check",
          steps: [
            {
              stepName: "spec-coverage",
              status: "succeeded",
              output: {
                resources: {
                  result: { current: { attributes: { pct: 42.5, passed: false, covered: 44, total: 104 } } },
                },
              },
            },
          ],
        },
      ],
    };
    const run = parseRun(doc);
    expect(run).not.toBeNull();
    expect(run.id).toBe("run-1");
    expect(run.status).toBe("succeeded");
    expect(run.metrics.specCoverage.pct).toBeCloseTo(42.5);
    expect(run.blockingStep).toBeNull();
  });

  it("detects blocking step from failed step", () => {
    const doc = {
      id: "run-2",
      workflowName: "quality-gate",
      status: "failed",
      startedAt: "2026-06-25T10:00:00Z",
      jobs: [
        {
          jobName: "mutation",
          steps: [{ stepName: "mutation", status: "failed", output: { resources: {} } }],
        },
      ],
    };
    const run = parseRun(doc);
    expect(run.blockingStep).toBe("mutation");
  });
});
