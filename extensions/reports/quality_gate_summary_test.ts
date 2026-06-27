import { assertEquals } from "jsr:@std/assert";
import { report } from "./quality_gate_summary.ts";

// Minimal stub builder for WorkflowReportContext
function makeStep(
  stepName: string,
  status: "succeeded" | "failed" | "skipped",
  data: Record<string, unknown> | null,
) {
  return {
    stepName,
    modelType: `@focusin/${stepName}`,
    modelId: `model-${stepName}`,
    status,
    dataHandles: data !== null
      ? [{ name: "current", specName: "result", version: 1 }]
      : [],
    _data: data,
  };
}

function makeContext(
  overrides: {
    workflowStatus?: "succeeded" | "failed";
    steps?: ReturnType<typeof makeStep>[];
    repoDir?: string;
    runId?: string;
  } = {},
) {
  const steps = overrides.steps ?? [];
  return {
    repoDir: overrides.repoDir ?? "/nonexistent",
    workflowId: "wf-123",
    workflowRunId: overrides.runId ?? "run-abc",
    workflowName: "quality-gate",
    workflowStatus: overrides.workflowStatus ?? "succeeded",
    stepExecutions: steps,
    dataRepository: {
      getContent: async (
        _type: string,
        _id: string,
        _name: string,
        _version?: number,
      ): Promise<Uint8Array | null> => {
        const step = steps.find((s) => s.modelId === `model-${_id.replace("model-", "")}`) ??
          steps.find((s) => s.modelId === _id);
        if (!step || !(step as { _data?: Record<string, unknown> | null })._data) return null;
        return new TextEncoder().encode(
          JSON.stringify((step as { _data: Record<string, unknown> })._data),
        );
      },
    },
  };
}

Deno.test("report: produces succeeded markdown with attempt 1 on first run", async () => {
  const ctx = makeContext({
    workflowStatus: "succeeded",
    steps: [
      makeStep("spec-coverage", "succeeded", {
        passed: true,
        pct: 52.0,
        covered: 54,
        total: 104,
        ranAt: new Date().toISOString(),
      }),
      makeStep("tests", "succeeded", {
        passed: true,
        total: 47,
        passing: 47,
        failing: 0,
        durationMs: 1000,
      }),
      makeStep("coverage", "succeeded", {
        passed: true,
        lines: 91.3,
        functions: 90.0,
        branches: 88.0,
        statements: 91.0,
      }),
      makeStep("patch-coverage", "succeeded", {
        passed: true,
        uncoveredLines: 0,
        ranAt: new Date().toISOString(),
      }),
      makeStep("codescene-health", "succeeded", {
        passed: true,
        failedFiles: 0,
        ranAt: new Date().toISOString(),
      }),
      makeStep("mutation", "succeeded", {
        passed: true,
        overallScore: 87.4,
        killed: 100,
        survived: 10,
        noCoverage: 2,
      }),
    ],
  });

  const result = await report.execute(ctx as Parameters<typeof report.execute>[0]);

  // Attempt 1 when no prior YAML files exist
  assertEquals(result.json.attemptNumber, 1);
  assertEquals(result.json.workflowName, "quality-gate");
  assertEquals(result.json.status, "succeeded");
  assertEquals(result.json.blockingStep, null);
  assertEquals((result.json.metrics as { specCoverage: { pct: number } }).specCoverage.pct, 52.0);
  assertEquals((result.json.metrics as { mutation: { score: number } }).mutation.score, 87.4);
});

Deno.test("report: marks blocking step when a step failed", async () => {
  const ctx = makeContext({
    workflowStatus: "failed",
    steps: [
      makeStep("spec-coverage", "succeeded", { passed: false, pct: 32.1, covered: 33, total: 104, ranAt: "" }),
      makeStep("tests", "succeeded", { passed: true, total: 47, passing: 47, failing: 0, durationMs: 1000 }),
      makeStep("coverage", "failed", null),
      makeStep("mutation", "skipped", null),
    ],
  });

  const result = await report.execute(ctx as Parameters<typeof report.execute>[0]);

  assertEquals(result.json.blockingStep, "coverage");
  assertEquals(result.json.status, "failed");
  assertEquals(
    (result.json.metrics as { mutation: { score: null } }).mutation.score,
    null,
  );
});

Deno.test("report: skipped step appears as null metrics", async () => {
  const ctx = makeContext({
    workflowStatus: "failed",
    steps: [
      makeStep("spec-coverage", "failed", null),
      makeStep("tests", "skipped", null),
      makeStep("mutation", "skipped", null),
    ],
  });

  const result = await report.execute(ctx as Parameters<typeof report.execute>[0]);

  const m = result.json.metrics as {
    specCoverage: { pct: null };
    tests: { passed: null };
    mutation: { score: null };
  };
  assertEquals(m.specCoverage.pct, null);
  assertEquals(m.tests.passed, null);
  assertEquals(m.mutation.score, null);
  assertEquals(result.json.blockingStep, "spec-coverage");
});

Deno.test("report: markdown includes attempt number and check mark", async () => {
  const ctx = makeContext({
    workflowStatus: "succeeded",
    steps: [makeStep("tests", "succeeded", { passed: true, total: 10, passing: 10, failing: 0, durationMs: 500 })],
  });

  const result = await report.execute(ctx as Parameters<typeof report.execute>[0]);

  assertEquals(typeof result.markdown, "string");
  assertEquals(result.markdown.includes("Attempt 1"), true);
  assertEquals(result.markdown.includes("✓"), true);
});

Deno.test("report: markdown includes blocked step on failure", async () => {
  const ctx = makeContext({
    workflowStatus: "failed",
    steps: [makeStep("mutation", "failed", null)],
  });

  const result = await report.execute(ctx as Parameters<typeof report.execute>[0]);

  assertEquals(result.markdown.includes("mutation"), true);
  assertEquals(result.markdown.includes("✗"), true);
});

Deno.test("report.name is @focusin/quality-gate-summary", () => {
  assertEquals(report.name, "@focusin/quality-gate-summary");
  assertEquals(report.scope, "workflow");
});

Deno.test("report: returns null metric when getContent returns null for a ready step", async () => {
  const ctx = {
    ...makeContext({
      workflowStatus: "succeeded",
      steps: [makeStep("tests", "succeeded", { passed: true, total: 10, passing: 10, failing: 0, durationMs: 500 })],
    }),
    dataRepository: {
      getContent: async (): Promise<Uint8Array | null> => null,
    },
  };
  const result = await report.execute(ctx as Parameters<typeof report.execute>[0]);
  assertEquals((result.json.metrics as { tests: { passed: null } }).tests.passed, null);
});

Deno.test("report: counts attempt 2 when prior failed run YAML exists on disk", async () => {
  const tmpDir = await Deno.makeTempDir();
  const wfDir = `${tmpDir}/.swamp/workflow-runs/wf-123`;
  await Deno.mkdir(wfDir, { recursive: true });

  const now = Date.now();
  const currentStartedAt = new Date(now).toISOString();
  const priorStartedAt = new Date(now - 30 * 60 * 1000).toISOString();

  // Current run YAML (covers readCurrentStartedAt success path)
  await Deno.writeTextFile(
    `${wfDir}/workflow-run-run-current.yaml`,
    JSON.stringify({ id: "run-current", workflowId: "wf-123", workflowName: "quality-gate", status: "succeeded", startedAt: currentStartedAt }),
  );
  // Prior failed run (covers isPriorAttempt lines 97-98 returning true)
  await Deno.writeTextFile(
    `${wfDir}/workflow-run-run-prior.yaml`,
    JSON.stringify({ id: "run-prior", workflowId: "wf-123", workflowName: "quality-gate", status: "failed", startedAt: priorStartedAt }),
  );
  // Prior succeeded run (covers isPriorAttempt line 96 returning false for non-failed status)
  await Deno.writeTextFile(
    `${wfDir}/workflow-run-run-old.yaml`,
    JSON.stringify({ id: "run-old", workflowId: "wf-123", workflowName: "quality-gate", status: "succeeded", startedAt: priorStartedAt }),
  );
  // Non-YAML file (covers line 114 continue branch for non-matching entries)
  await Deno.writeTextFile(`${wfDir}/README.txt`, "ignored");

  try {
    const ctx = makeContext({ repoDir: tmpDir, runId: "run-current" });
    const result = await report.execute(ctx as Parameters<typeof report.execute>[0]);
    assertEquals(result.json.attemptNumber, 2);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});
