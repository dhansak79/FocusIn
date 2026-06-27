/**
 * Workflow-scope report for quality-gate runs.
 * Produces a terminal summary and JSON artifact after every gate execution.
 *
 * @module
 */
import jsYaml from "npm:js-yaml@4.1.0";

interface DataHandle {
  name: string;
  specName?: string;
  version?: number;
}

interface StepExecution {
  stepName: string;
  modelType: string;
  modelId: string;
  status: "succeeded" | "failed" | "skipped";
  dataHandles: DataHandle[];
}

interface DataRepository {
  getContent(
    type: string,
    modelId: string,
    dataName: string,
    version?: number,
  ): Promise<Uint8Array | null>;
}

interface WorkflowReportContext {
  repoDir: string;
  workflowId: string;
  workflowRunId: string;
  workflowName: string;
  workflowStatus: "succeeded" | "failed";
  stepExecutions: StepExecution[];
  dataRepository: DataRepository;
}

interface RunRecord {
  id: string;
  workflowId: string;
  workflowName: string;
  status: string;
  startedAt: string;
}

interface StepAttrs {
  [key: string]: unknown;
}

interface AttemptFilter {
  runId: string;
  currentMs: number;
  windowMs: number;
}

interface RunRef {
  repoDir: string;
  workflowId: string;
  runId: string;
  startedAt: string;
}

interface RunSummary {
  status: string;
  attemptNumber: number;
  blockingStep: string | null;
}

function isStepReady(step: StepExecution | undefined): step is StepExecution {
  return !!step && step.status === "succeeded" && step.dataHandles.length > 0;
}

async function readStepAttrs(
  context: WorkflowReportContext,
  stepName: string,
): Promise<StepAttrs | null> {
  const step = context.stepExecutions.find((s) => s.stepName === stepName);
  if (!isStepReady(step)) return null;
  const handle = step.dataHandles[0];
  const bytes = await context.dataRepository.getContent(
    step.modelType,
    step.modelId,
    handle.name,
    handle.version,
  );
  if (!bytes) return null;
  return JSON.parse(new TextDecoder().decode(bytes)) as StepAttrs;
}

function isPriorAttempt(doc: RunRecord, filter: AttemptFilter): boolean {
  if (doc.id === filter.runId) return false;
  if (doc.status !== "failed" && doc.status !== "running") return false;
  const startMs = new Date(doc.startedAt).getTime();
  return startMs >= filter.currentMs - filter.windowMs && startMs < filter.currentMs;
}

async function inferAttemptNumber(
  ref: RunRef,
): Promise<{ attemptNumber: number; sessionStartedAt: string }> {
  const runDir = `${ref.repoDir}/.swamp/workflow-runs/${ref.workflowId}`;
  const filter: AttemptFilter = {
    runId: ref.runId,
    currentMs: new Date(ref.startedAt).getTime(),
    windowMs: 4 * 60 * 60 * 1000,
  };
  const priorAttempts: string[] = [];

  try {
    for await (const entry of Deno.readDir(runDir)) {
      if (!entry.name.endsWith(".yaml") || !entry.isFile) continue;
      const raw = await Deno.readTextFile(`${runDir}/${entry.name}`);
      const doc = jsYaml.load(raw) as RunRecord;
      if (isPriorAttempt(doc, filter)) priorAttempts.push(doc.startedAt);
    }
  } catch {
    // directory missing or unreadable — treat as first attempt
  }

  const sessionStartedAt = priorAttempts.length > 0
    ? priorAttempts.sort()[0]
    : ref.startedAt;
  return { attemptNumber: priorAttempts.length + 1, sessionStartedAt };
}

function findBlockingStep(steps: StepExecution[]): string | null {
  return steps.find((s) => s.status === "failed")?.stepName ?? null;
}

function fmt(val: number | null, decimals = 1): string {
  return val !== null ? val.toFixed(decimals) : "—";
}

function pass(val: boolean | null): string {
  if (val === null) return "skipped";
  return val ? "✓" : "✗";
}

function extractSpecMetrics(
  attrs: StepAttrs | null,
): { pct: number | null; passed: boolean | null } {
  if (attrs === null) return { pct: null, passed: null };
  return { pct: attrs["pct"] as number, passed: attrs["passed"] as boolean };
}

function extractTestsMetrics(
  attrs: StepAttrs | null,
): { passed: boolean | null; total: number | null; failing: number | null } {
  if (attrs === null) return { passed: null, total: null, failing: null };
  return {
    passed: attrs["passed"] as boolean,
    total: attrs["total"] as number,
    failing: attrs["failing"] as number,
  };
}

function extractCoverageMetrics(
  attrs: StepAttrs | null,
): { lines: number | null; passed: boolean | null } {
  if (attrs === null) return { lines: null, passed: null };
  return { lines: attrs["lines"] as number, passed: attrs["passed"] as boolean };
}

function extractPatchMetrics(attrs: StepAttrs | null): { passed: boolean | null } {
  if (attrs === null) return { passed: null };
  return { passed: attrs["passed"] as boolean };
}

function extractHealthMetrics(
  attrs: StepAttrs | null,
): { passed: boolean | null; failedFiles: number | null } {
  if (attrs === null) return { passed: null, failedFiles: null };
  return { passed: attrs["passed"] as boolean, failedFiles: attrs["failedFiles"] as number };
}

function extractMutationMetrics(
  attrs: StepAttrs | null,
): { score: number | null; passed: boolean | null } {
  if (attrs === null) return { score: null, passed: null };
  return { score: attrs["overallScore"] as number, passed: attrs["passed"] as boolean };
}

async function collectMetrics(context: WorkflowReportContext) {
  return {
    specCoverage: extractSpecMetrics(await readStepAttrs(context, "spec-coverage")),
    tests: extractTestsMetrics(await readStepAttrs(context, "tests")),
    coverage: extractCoverageMetrics(await readStepAttrs(context, "coverage")),
    patchCoverage: extractPatchMetrics(await readStepAttrs(context, "patch-coverage")),
    codeHealth: extractHealthMetrics(await readStepAttrs(context, "codescene-health")),
    mutation: extractMutationMetrics(await readStepAttrs(context, "mutation")),
  };
}

type Metrics = Awaited<ReturnType<typeof collectMetrics>>;

function buildMarkdown(summary: RunSummary, metrics: Metrics): string {
  const icon = summary.status === "succeeded" ? "✓" : "✗";
  const header = `## ${icon} quality-gate — Attempt ${summary.attemptNumber}` +
    (summary.blockingStep ? ` · blocked on \`${summary.blockingStep}\`` : "");

  const healthVal = metrics.codeHealth.failedFiles !== null
    ? `${metrics.codeHealth.failedFiles} degraded`
    : "—";

  const rows = [
    `| Spec coverage | ${fmt(metrics.specCoverage.pct)}% | ${pass(metrics.specCoverage.passed)} |`,
    `| Tests | ${metrics.tests.total ?? "—"} total, ${metrics.tests.failing ?? "—"} failing | ${pass(metrics.tests.passed)} |`,
    `| Line coverage | ${fmt(metrics.coverage.lines)}% | ${pass(metrics.coverage.passed)} |`,
    `| Patch coverage | | ${pass(metrics.patchCoverage.passed)} |`,
    `| Code health | ${healthVal} | ${pass(metrics.codeHealth.passed)} |`,
    `| Mutation score | ${fmt(metrics.mutation.score)}% | ${pass(metrics.mutation.passed)} |`,
  ].join("\n");

  return [header, "", "| Metric | Value | Status |", "|--------|-------|--------|", rows].join("\n");
}

async function readCurrentStartedAt(context: WorkflowReportContext): Promise<string> {
  const runDir = `${context.repoDir}/.swamp/workflow-runs/${context.workflowId}`;
  try {
    const raw = await Deno.readTextFile(`${runDir}/workflow-run-${context.workflowRunId}.yaml`);
    const doc = jsYaml.load(raw) as RunRecord;
    return doc.startedAt || new Date().toISOString();
  } catch {
    // YAML not yet written — use current time
    return new Date().toISOString();
  }
}

export const report = {
  name: "@focusin/quality-gate-summary",
  description:
    "Quality gate run summary: attempt number, per-step metrics, and blocking step",
  scope: "workflow" as const,
  labels: ["quality-gate"],

  execute: async (context: WorkflowReportContext) => {
    const startedAt = await readCurrentStartedAt(context);

    const { attemptNumber, sessionStartedAt } = await inferAttemptNumber({
      repoDir: context.repoDir,
      workflowId: context.workflowId,
      runId: context.workflowRunId,
      startedAt,
    });

    const blockingStep = findBlockingStep(context.stepExecutions);
    const metrics = await collectMetrics(context);
    const markdown = buildMarkdown(
      { status: context.workflowStatus, attemptNumber, blockingStep },
      metrics,
    );

    return {
      markdown,
      json: {
        runId: context.workflowRunId,
        workflowName: context.workflowName,
        status: context.workflowStatus,
        startedAt,
        attemptNumber,
        sessionStartedAt,
        blockingStep,
        metrics,
      },
    };
  },
};
