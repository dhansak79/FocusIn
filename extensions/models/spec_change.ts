/**
 * Spec-change lifecycle model: structured data + phase state machine for safeguarded agentic development.
 *
 * @module
 */
import { z } from "npm:zod@4";

const GlobalArgsSchema = z.object({
  projectDir: z.string().describe("Absolute path to the project root"),
});

type GlobalArgs = z.infer<typeof GlobalArgsSchema>;

type WriteResourceFn = (
  specName: string,
  instanceName: string,
  data: Record<string, unknown>,
) => Promise<{ name: string }>;

const PHASES = [
  "draft",
  "proposal-pending-approval",
  "proposal-approved",
  "scenarios-pending-approval",
  "approved",
  "designing",
  "tasking",
  "implementing",
  "verifying",
  "archived",
] as const;

type Phase = typeof PHASES[number];

const PhaseSchema = z.enum(PHASES);

const ScenarioStatusSchema = z.enum(["pending", "pass", "fail"]);

const ScenarioSchema = z.object({
  name: z.string(),
  feature: z.string().optional(),
  given: z.array(z.string()).default([]),
  when: z.array(z.string()),
  then: z.array(z.string()),
  status: ScenarioStatusSchema.default("pending"),
});

const TaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  done: z.boolean().default(false),
});

export const SpecChangeSchema = z.object({
  name: z.string(),
  phase: PhaseSchema,
  proposal_text: z.string().default(""),
  design_text: z.string().default(""),
  scenarios: z.array(ScenarioSchema).default([]),
  tasks: z.array(TaskSchema).default([]),
  proposal_approved_at: z.string().optional(),
  scenarios_approved_at: z.string().optional(),
  archived_at: z.string().optional(),
});

type SpecChange = z.infer<typeof SpecChangeSchema>;
type Scenario = z.infer<typeof ScenarioSchema>;

const InputScenarioSchema = z.object({
  name: z.string(),
  feature: z.string().optional(),
  given: z.array(z.string()).default([]),
  when: z.array(z.string()),
  then: z.array(z.string()),
});

const InputTaskSchema = z.object({
  id: z.string(),
  description: z.string(),
});

function stateFilePath(projectDir: string, name: string): string {
  return `${projectDir}/.swamp/spec-change-${name}.json`;
}

export async function readState(projectDir: string, name: string): Promise<SpecChange> {
  const raw = await Deno.readTextFile(stateFilePath(projectDir, name));
  return SpecChangeSchema.parse(JSON.parse(raw));
}

export async function writeState(projectDir: string, state: SpecChange): Promise<void> {
  await Deno.mkdir(`${projectDir}/.swamp`, { recursive: true });
  await Deno.writeTextFile(stateFilePath(projectDir, state.name), JSON.stringify(state, null, 2));
}

function requirePhase(state: SpecChange, ...allowed: Phase[]): void {
  if (!allowed.includes(state.phase)) {
    throw new Error(
      `Cannot call this method in phase '${state.phase}'. Required: ${allowed.join(" or ")}`,
    );
  }
}

function appendSteps(lines: string[], steps: string[], keyword: string): void {
  if (steps.length === 0) return;
  lines.push(`    ${keyword} ${steps[0]}`);
  for (const step of steps.slice(1)) lines.push(`    And ${step}`);
}

export function buildFeatureFile(changeName: string, scenarios: Scenario[]): string {
  const lines: string[] = [`Feature: ${changeName}`, ""];
  for (const s of scenarios) {
    // Only scenarios that have never actually run (still "pending") get
    // skipped via @wip. A recorded "pass" or "fail" means this scenario has
    // been executed for real at least once — regenerating the feature file
    // must not silently re-skip it (that would hide a real failure, or
    // require re-verifying a pass that already happened).
    if (s.status === "pending") lines.push("  @wip");
    lines.push(`  Scenario: ${s.name}`);
    appendSteps(lines, s.given ?? [], "Given");
    appendSteps(lines, s.when ?? [], "When");
    appendSteps(lines, s.then ?? [], "Then");
    lines.push("");
  }
  return lines.join("\n");
}

type CucumberStep = { result?: { status?: string } };
type CucumberElement = { name?: string; steps?: CucumberStep[] };
type CucumberFeature = { elements?: CucumberElement[] };

export function parseCucumberReport(json: unknown): Map<string, "pass" | "fail"> {
  const results = new Map<string, "pass" | "fail">();
  if (!Array.isArray(json)) return results;
  for (const feature of json as CucumberFeature[]) {
    for (const element of (feature.elements ?? [])) {
      const name = element.name ?? "";
      const steps = element.steps ?? [];
      const allPassed = steps.every((s) => s.result?.status === "passed");
      results.set(name, allPassed ? "pass" : "fail");
    }
  }
  return results;
}

async function updateState(
  name: string,
  context: { globalArgs: GlobalArgs; writeResource: WriteResourceFn },
  phases: Phase[],
  mutate: (state: SpecChange) => void | Promise<void>,
) {
  const { projectDir } = context.globalArgs;
  const state = await readState(projectDir, name);
  requirePhase(state, ...phases);
  await mutate(state);
  await writeState(projectDir, state);
  const handle = await context.writeResource("change", name, state);
  return { dataHandles: [handle] };
}

export const model = {
  type: "@focusin/spec-change",
  version: "2026.06.28.1",
  globalArguments: GlobalArgsSchema,
  resources: {
    change: {
      description: "Specification change lifecycle state",
      schema: SpecChangeSchema,
      lifetime: "365d",
      garbageCollection: 100,
    },
  },
  methods: {
    create: {
      description: "Create a new spec change in draft phase",
      arguments: z.object({ name: z.string().describe("Kebab-case change name") }),
      execute: async (
        { name }: { name: string },
        context: { globalArgs: GlobalArgs; writeResource: WriteResourceFn },
      ) => {
        const { projectDir } = context.globalArgs;
        const state: SpecChange = {
          name,
          phase: "draft",
          proposal_text: "",
          design_text: "",
          scenarios: [],
          tasks: [],
        };
        await writeState(projectDir, state);
        const handle = await context.writeResource("change", name, state);
        return { dataHandles: [handle] };
      },
    },

    "set-proposal": {
      description: "Store proposal text and move to proposal-pending-approval",
      arguments: z.object({
        name: z.string(),
        text: z.string().describe("Proposal text — why/what"),
      }),
      execute: async (
        { name, text }: { name: string; text: string },
        context: { globalArgs: GlobalArgs; writeResource: WriteResourceFn },
      ) => updateState(name, context, ["draft"], (state) => {
        state.proposal_text = text;
        state.phase = "proposal-pending-approval";
      }),
    },

    "approve-proposal": {
      description: "Gate 1: approve the proposal and move to proposal-approved",
      arguments: z.object({ name: z.string() }),
      execute: async (
        { name }: { name: string },
        context: { globalArgs: GlobalArgs; writeResource: WriteResourceFn },
      ) => updateState(name, context, ["proposal-pending-approval"], (state) => {
        if (!state.proposal_text.trim()) throw new Error("Cannot approve: proposal text is empty");
        state.phase = "proposal-approved";
        state.proposal_approved_at = new Date().toISOString();
      }),
    },

    "set-scenarios": {
      description: "Store scenarios and move to scenarios-pending-approval",
      arguments: z.object({
        name: z.string(),
        scenarios: z.array(InputScenarioSchema),
      }),
      execute: async (
        { name, scenarios }: { name: string; scenarios: z.infer<typeof InputScenarioSchema>[] },
        context: { globalArgs: GlobalArgs; writeResource: WriteResourceFn },
      ) => updateState(name, context, ["proposal-approved"], (state) => {
        state.scenarios = scenarios.map((s) => ({ ...s, status: "pending" as const }));
        state.phase = "scenarios-pending-approval";
      }),
    },

    "approve-scenarios": {
      description: "Gate 2: approve scenarios and move to approved",
      arguments: z.object({ name: z.string() }),
      execute: async (
        { name }: { name: string },
        context: { globalArgs: GlobalArgs; writeResource: WriteResourceFn },
      ) => updateState(name, context, ["scenarios-pending-approval"], (state) => {
        if (state.scenarios.length === 0) throw new Error("Cannot approve: no scenarios exist");
        state.phase = "approved";
        state.scenarios_approved_at = new Date().toISOString();
      }),
    },

    "set-design": {
      description: "Store design text and move to designing",
      arguments: z.object({
        name: z.string(),
        text: z.string().describe("Technical design text"),
      }),
      execute: async (
        { name, text }: { name: string; text: string },
        context: { globalArgs: GlobalArgs; writeResource: WriteResourceFn },
      ) => updateState(name, context, ["approved"], (state) => {
        state.design_text = text;
        state.phase = "designing";
      }),
    },

    "set-tasks": {
      description: "Store task list and move to tasking",
      arguments: z.object({
        name: z.string(),
        tasks: z.array(InputTaskSchema),
      }),
      execute: async (
        { name, tasks }: { name: string; tasks: z.infer<typeof InputTaskSchema>[] },
        context: { globalArgs: GlobalArgs; writeResource: WriteResourceFn },
      ) => updateState(name, context, ["designing"], (state) => {
        state.tasks = tasks.map((t) => ({ ...t, done: false }));
        state.phase = "tasking";
      }),
    },

    "start-implementing": {
      description: "Move to implementing phase",
      arguments: z.object({ name: z.string() }),
      execute: async (
        { name }: { name: string },
        context: { globalArgs: GlobalArgs; writeResource: WriteResourceFn },
      ) => updateState(name, context, ["tasking"], (state) => {
        state.phase = "implementing";
      }),
    },

    "complete-task": {
      description: "Mark a task done by ID",
      arguments: z.object({
        name: z.string(),
        id: z.string().describe("Task ID to mark complete"),
      }),
      execute: async (
        { name, id }: { name: string; id: string },
        context: { globalArgs: GlobalArgs; writeResource: WriteResourceFn },
      ) => updateState(name, context, ["implementing"], (state) => {
        const task = state.tasks.find((t) => t.id === id);
        if (!task) throw new Error(`Task '${id}' not found`);
        task.done = true;
      }),
    },

    "generate-features": {
      description: "Write @wip-tagged Gherkin feature files to tests/cucumber/features/",
      arguments: z.object({ name: z.string() }),
      execute: async (
        { name }: { name: string },
        context: { globalArgs: GlobalArgs; writeResource: WriteResourceFn },
      ) => {
        const { projectDir } = context.globalArgs;
        const state = await readState(projectDir, name);
        const approvedPhases: Phase[] = [
          "approved", "designing", "tasking", "implementing", "verifying", "archived",
        ];
        requirePhase(state, ...approvedPhases);

        const featuresDir = `${projectDir}/tests/cucumber/features`;
        await Deno.mkdir(featuresDir, { recursive: true });

        // Group scenarios by feature name (defaults to change name)
        const byFeature = new Map<string, Scenario[]>();
        for (const scenario of state.scenarios) {
          const featureName = scenario.feature ?? name;
          const group = byFeature.get(featureName) ?? [];
          group.push(scenario);
          byFeature.set(featureName, group);
        }

        const writtenFiles: string[] = [];
        for (const [featureName, scenarios] of byFeature) {
          if (scenarios.some((s) => !s.given || s.given.length === 0)) {
            console.warn(`Warning: some scenarios in '${featureName}' have no Given step`);
          }
          const content = buildFeatureFile(featureName, scenarios);
          const filePath = `${featuresDir}/${featureName}.feature`;
          await Deno.writeTextFile(filePath, content);
          writtenFiles.push(filePath);
        }

        const handle = await context.writeResource("change", name, state);
        return { dataHandles: [handle], writtenFiles };
      },
    },

    "record-results": {
      description: "Read cucumber-report.json and update scenario statuses, move to verifying",
      arguments: z.object({
        name: z.string(),
        reportPath: z.string().describe("Path to cucumber-report.json"),
      }),
      execute: async (
        { name, reportPath }: { name: string; reportPath: string },
        context: { globalArgs: GlobalArgs; writeResource: WriteResourceFn },
      ) => {
        const raw = await Deno.readTextFile(reportPath);
        const results = parseCucumberReport(JSON.parse(raw));
        // Allow re-running from "verifying" too — a prior record-results
        // call may have advanced the phase without every scenario actually
        // having been exercised yet (e.g. one was still @wip), and there is
        // no separate "re-verify" method to get back to "implementing".
        return updateState(name, context, ["implementing", "verifying"], (state) => {
          for (const scenario of state.scenarios) {
            const result = results.get(scenario.name);
            if (result !== undefined) scenario.status = result;
          }
          state.phase = "verifying";
        });
      },
    },

    archive: {
      description: "Archive the change — requires all scenarios to have status: pass",
      arguments: z.object({ name: z.string() }),
      execute: async (
        { name }: { name: string },
        context: { globalArgs: GlobalArgs; writeResource: WriteResourceFn },
      ) => updateState(name, context, ["verifying"], (state) => {
        const nonPassing = state.scenarios.filter((s) => s.status !== "pass");
        if (nonPassing.length > 0) {
          const list = nonPassing.map((s) => `  - ${s.name} (${s.status})`).join("\n");
          throw new Error(`Cannot archive: the following scenarios are not passing:\n${list}`);
        }
        state.phase = "archived";
        state.archived_at = new Date().toISOString();
      }),
    },
  },
};
