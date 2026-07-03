import { assertEquals, assertRejects } from "jsr:@std/assert";
import {
  buildFeatureFile,
  model,
  parseCucumberReport,
  readState,
  SpecChangeSchema,
} from "./spec_change.ts";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTempDir(): Promise<string> {
  return Deno.makeTempDir();
}

async function setupSwampDir(projectDir: string): Promise<void> {
  await Deno.mkdir(`${projectDir}/.swamp`, { recursive: true });
}

function makeCtx(projectDir: string) {
  const written: Record<string, unknown>[] = [];
  return {
    ctx: {
      globalArgs: { projectDir },
      writeResource: async (_s: string, _i: string, data: Record<string, unknown>) => {
        written.push(data);
        return { name: "change/test" };
      },
    } as never,
    written,
  };
}

function makeReport(scenarioName: string, statuses: string[]): unknown[] {
  return [{ elements: [{ name: scenarioName, steps: statuses.map((status) => ({ result: { status } })) }] }];
}

async function makeContext(): Promise<{ projectDir: string; ctx: never }> {
  const projectDir = await makeTempDir();
  await setupSwampDir(projectDir);
  const { ctx } = makeCtx(projectDir);
  return { projectDir, ctx };
}

async function buildToApproved(ctx: never): Promise<void> {
  await model.methods.create.execute({ name: "chg" }, ctx);
  await model.methods["set-proposal"].execute({ name: "chg", text: "text" }, ctx);
  await model.methods["approve-proposal"].execute({ name: "chg" }, ctx);
}

async function buildToDesigning(ctx: never): Promise<void> {
  await buildToApproved(ctx);
  await model.methods["set-scenarios"].execute({
    name: "chg", scenarios: [{ name: "S", given: [], when: ["a"], then: ["b"] }],
  }, ctx);
  await model.methods["approve-scenarios"].execute({ name: "chg" }, ctx);
  await model.methods["set-design"].execute({ name: "chg", text: "design" }, ctx);
}

async function buildToImplementing(
  ctx: never,
  tasks: Array<{ id: string; description: string }> = [{ id: "1", description: "t" }],
): Promise<void> {
  await buildToDesigning(ctx);
  await model.methods["set-tasks"].execute({ name: "chg", tasks }, ctx);
  await model.methods["start-implementing"].execute({ name: "chg" }, ctx);
}

async function buildToVerifying(projectDir: string, ctx: never, stepStatus: string): Promise<void> {
  await buildToImplementing(ctx);
  const reportPath = `${projectDir}/cucumber-report.json`;
  await Deno.writeTextFile(reportPath, JSON.stringify(makeReport("S", [stepStatus])));
  await model.methods["record-results"].execute({ name: "chg", reportPath }, ctx);
}

// ── buildFeatureFile ──────────────────────────────────────────────────────────

Deno.test("buildFeatureFile: generates valid Gherkin with @wip tags", () => {
  const content = buildFeatureFile("semantic-filter", [
    {
      name: "Negative post is collapsed",
      given: ["a LinkedIn feed with 1 post"],
      when: ["the filter runs"],
      then: ["the post is collapsed"],
      status: "pending",
    },
  ]);
  const lines = content.split("\n");
  assertEquals(lines[0], "Feature: semantic-filter");
  assertEquals(lines[2], "  @wip");
  assertEquals(lines[3], "  Scenario: Negative post is collapsed");
  assertEquals(lines[4], "    Given a LinkedIn feed with 1 post");
  assertEquals(lines[5], "    When the filter runs");
  assertEquals(lines[6], "    Then the post is collapsed");
});

Deno.test("buildFeatureFile: multi-step uses And keyword", () => {
  const content = buildFeatureFile("tone-filter", [
    {
      name: "Multiple steps",
      given: ["precondition one", "precondition two"],
      when: ["action one", "action two"],
      then: ["result one", "result two"],
      status: "pending",
    },
  ]);
  assertEquals(content.includes("    Given precondition one"), true);
  assertEquals(content.includes("    And precondition two"), true);
  assertEquals(content.includes("    When action one"), true);
  assertEquals(content.includes("    And action two"), true);
  assertEquals(content.includes("    Then result one"), true);
  assertEquals(content.includes("    And result two"), true);
});

Deno.test("buildFeatureFile: scenario with no Given is handled gracefully", () => {
  const content = buildFeatureFile("tone-filter", [
    {
      name: "No given scenario",
      given: [],
      when: ["something happens"],
      then: ["something is true"],
      status: "pending",
    },
  ]);
  assertEquals(content.includes("Given"), false);
  assertEquals(content.includes("    When something happens"), true);
});

// ── parseCucumberReport ───────────────────────────────────────────────────────

Deno.test("parseCucumberReport: marks all-passed scenario as pass", () => {
  const results = parseCucumberReport(makeReport("My scenario", ["passed", "passed"]));
  assertEquals(results.get("My scenario"), "pass");
});

Deno.test("parseCucumberReport: marks failed step as fail", () => {
  const results = parseCucumberReport(makeReport("Failing scenario", ["passed", "failed"]));
  assertEquals(results.get("Failing scenario"), "fail");
});

Deno.test("parseCucumberReport: empty array returns empty map", () => {
  const results = parseCucumberReport([]);
  assertEquals(results.size, 0);
});

Deno.test("parseCucumberReport: non-array returns empty map", () => {
  const results = parseCucumberReport(null);
  assertEquals(results.size, 0);
});

// ── Phase state machine ───────────────────────────────────────────────────────

Deno.test("create: initialises change in draft phase", async () => {
  const { projectDir, ctx } = await makeContext();
  await model.methods.create.execute({ name: "my-change" }, ctx);
  const state = await readState(projectDir, "my-change");
  assertEquals(state.phase, "draft");
  assertEquals(state.scenarios, []);
  assertEquals(state.tasks, []);
  assertEquals(state.proposal_text, "");
});

Deno.test("set-proposal: draft -> proposal-pending-approval", async () => {
  const { projectDir, ctx } = await makeContext();
  await model.methods.create.execute({ name: "chg" }, ctx);
  await model.methods["set-proposal"].execute({ name: "chg", text: "My proposal" }, ctx);
  const state = await readState(projectDir, "chg");
  assertEquals(state.phase, "proposal-pending-approval");
  assertEquals(state.proposal_text, "My proposal");
});

Deno.test("set-proposal: rejects if not in draft", async () => {
  const { projectDir, ctx } = await makeContext();
  await model.methods.create.execute({ name: "chg" }, ctx);
  await model.methods["set-proposal"].execute({ name: "chg", text: "text" }, ctx);
  await assertRejects(
    () => model.methods["set-proposal"].execute({ name: "chg", text: "new" }, ctx),
    Error,
    "draft",
  );
});

Deno.test("approve-proposal: proposal-pending-approval -> proposal-approved with timestamp", async () => {
  const { projectDir, ctx } = await makeContext();
  await buildToApproved(ctx);
  const state = await readState(projectDir, "chg");
  assertEquals(state.phase, "proposal-approved");
  assertEquals(typeof state.proposal_approved_at, "string");
});

Deno.test("approve-proposal: rejects empty proposal text", async () => {
  const { projectDir, ctx } = await makeContext();
  await model.methods.create.execute({ name: "chg" }, ctx);
  await model.methods["set-proposal"].execute({ name: "chg", text: "x" }, ctx);
  const state = await readState(projectDir, "chg");
  state.proposal_text = "";
  await Deno.writeTextFile(`${projectDir}/.swamp/spec-change-chg.json`, JSON.stringify(state, null, 2));
  await assertRejects(
    () => model.methods["approve-proposal"].execute({ name: "chg" }, ctx),
    Error,
    "empty",
  );
});

Deno.test("set-scenarios: stores with pending status", async () => {
  const { projectDir, ctx } = await makeContext();
  await buildToApproved(ctx);
  await model.methods["set-scenarios"].execute({
    name: "chg",
    scenarios: [{ name: "Scenario A", given: [], when: ["action"], then: ["result"] }],
  }, ctx);
  const state = await readState(projectDir, "chg");
  assertEquals(state.phase, "scenarios-pending-approval");
  assertEquals(state.scenarios[0].status, "pending");
});

Deno.test("approve-scenarios: Gate 2 records timestamp", async () => {
  const { projectDir, ctx } = await makeContext();
  await buildToApproved(ctx);
  await model.methods["set-scenarios"].execute({
    name: "chg", scenarios: [{ name: "S", given: [], when: ["a"], then: ["b"] }],
  }, ctx);
  await model.methods["approve-scenarios"].execute({ name: "chg" }, ctx);
  const state = await readState(projectDir, "chg");
  assertEquals(state.phase, "approved");
  assertEquals(typeof state.scenarios_approved_at, "string");
});

Deno.test("approve-scenarios: rejects with no scenarios", async () => {
  const { projectDir, ctx } = await makeContext();
  await buildToApproved(ctx);
  await model.methods["set-scenarios"].execute({ name: "chg", scenarios: [{ name: "S", given: [], when: ["a"], then: ["b"] }] }, ctx);
  const state = await readState(projectDir, "chg");
  state.scenarios = [];
  await Deno.writeTextFile(`${projectDir}/.swamp/spec-change-chg.json`, JSON.stringify(state, null, 2));
  await assertRejects(
    () => model.methods["approve-scenarios"].execute({ name: "chg" }, ctx),
    Error,
    "no scenarios",
  );
});

Deno.test("reopen-proposal: resets to draft and clears downstream state", async () => {
  const { projectDir, ctx } = await makeContext();
  await buildToDesigning(ctx);
  await model.methods["reopen-proposal"].execute({ name: "chg" }, ctx);
  const state = await readState(projectDir, "chg");
  assertEquals(state.phase, "draft");
  assertEquals(state.scenarios, []);
  assertEquals(state.design_text, "");
  assertEquals(state.tasks, []);
  assertEquals(state.proposal_approved_at, undefined);
  assertEquals(state.scenarios_approved_at, undefined);
  assertEquals(state.proposal_text, "text");
});

for (const phase of ["draft", "archived"]) {
  Deno.test(`reopen-proposal: rejects from ${phase}`, async () => {
    const { projectDir, ctx } = await makeContext();
    await model.methods.create.execute({ name: "chg" }, ctx);
    const state = await readState(projectDir, "chg");
    state.phase = phase as never;
    await Deno.writeTextFile(`${projectDir}/.swamp/spec-change-chg.json`, JSON.stringify(state, null, 2));
    await assertRejects(
      () => model.methods["reopen-proposal"].execute({ name: "chg" }, ctx),
      Error,
    );
  });
}

Deno.test("reopen-scenarios: resets to proposal-approved and preserves the proposal", async () => {
  const { projectDir, ctx } = await makeContext();
  await buildToDesigning(ctx);
  await model.methods["reopen-scenarios"].execute({ name: "chg" }, ctx);
  const state = await readState(projectDir, "chg");
  assertEquals(state.phase, "proposal-approved");
  assertEquals(state.scenarios, []);
  assertEquals(state.design_text, "");
  assertEquals(state.tasks, []);
  assertEquals(state.scenarios_approved_at, undefined);
  assertEquals(state.proposal_text, "text");
  assertEquals(typeof state.proposal_approved_at, "string");
});

for (const phase of ["draft", "proposal-approved", "archived"]) {
  Deno.test(`reopen-scenarios: rejects from ${phase}`, async () => {
    const { projectDir, ctx } = await makeContext();
    await model.methods.create.execute({ name: "chg" }, ctx);
    const state = await readState(projectDir, "chg");
    state.phase = phase as never;
    await Deno.writeTextFile(`${projectDir}/.swamp/spec-change-chg.json`, JSON.stringify(state, null, 2));
    await assertRejects(
      () => model.methods["reopen-scenarios"].execute({ name: "chg" }, ctx),
      Error,
    );
  });
}

Deno.test("archive: succeeds when all scenarios pass", async () => {
  const { projectDir, ctx } = await makeContext();
  await buildToVerifying(projectDir, ctx, "passed");
  await model.methods.archive.execute({ name: "chg" }, ctx);
  const state = await readState(projectDir, "chg");
  assertEquals(state.phase, "archived");
  assertEquals(typeof state.archived_at, "string");
});

Deno.test("archive: blocked by failing scenario", async () => {
  const { projectDir, ctx } = await makeContext();
  await buildToVerifying(projectDir, ctx, "failed");
  await assertRejects(() => model.methods.archive.execute({ name: "chg" }, ctx), Error, "not passing");
});

Deno.test("archive: blocked by pending scenario", async () => {
  const { projectDir, ctx } = await makeContext();
  await buildToImplementing(ctx);
  const reportPath = `${projectDir}/cucumber-report.json`;
  await Deno.writeTextFile(reportPath, JSON.stringify([{ elements: [] }]));
  await model.methods["record-results"].execute({ name: "chg", reportPath }, ctx);
  await assertRejects(() => model.methods.archive.execute({ name: "chg" }, ctx), Error, "not passing");
});

Deno.test("archive: blocked by wrong phase (not verifying)", async () => {
  const { projectDir, ctx } = await makeContext();
  await model.methods.create.execute({ name: "chg" }, ctx);
  await assertRejects(
    () => model.methods.archive.execute({ name: "chg" }, ctx),
    Error,
    "verifying",
  );
});

Deno.test("complete-task: marks task done", async () => {
  const { projectDir, ctx } = await makeContext();
  await buildToImplementing(ctx, [{ id: "1.1", description: "first" }]);
  await model.methods["complete-task"].execute({ name: "chg", id: "1.1" }, ctx);
  const state = await readState(projectDir, "chg");
  assertEquals(state.tasks[0].done, true);
});

Deno.test("complete-task: rejects unknown task id", async () => {
  const { projectDir, ctx } = await makeContext();
  await buildToImplementing(ctx, [{ id: "1.1", description: "t" }]);
  await assertRejects(
    () => model.methods["complete-task"].execute({ name: "chg", id: "99" }, ctx),
    Error,
    "not found",
  );
});

Deno.test("SpecChangeSchema: validates correct data", () => {
  const result = SpecChangeSchema.safeParse({
    name: "test",
    phase: "draft",
    proposal_text: "",
    design_text: "",
    scenarios: [],
    tasks: [],
  });
  assertEquals(result.success, true);
});

Deno.test("generate-features: writes feature file per capability", async () => {
  const { projectDir, ctx } = await makeContext();
  await model.methods.create.execute({ name: "semantic-filter" }, ctx);
  await model.methods["set-proposal"].execute({ name: "semantic-filter", text: "proposal" }, ctx);
  await model.methods["approve-proposal"].execute({ name: "semantic-filter" }, ctx);
  await model.methods["set-scenarios"].execute({
    name: "semantic-filter",
    scenarios: [
      { name: "Negative post collapsed", given: ["a feed with 1 post"], when: ["filter runs"], then: ["post hidden"] },
    ],
  }, ctx);
  await model.methods["approve-scenarios"].execute({ name: "semantic-filter" }, ctx);
  await model.methods["generate-features"].execute({ name: "semantic-filter" }, ctx);
  const featureContent = await Deno.readTextFile(`${projectDir}/tests/cucumber/features/semantic-filter.feature`);
  assertEquals(featureContent.includes("Feature: semantic-filter"), true);
  assertEquals(featureContent.includes("@wip"), true);
  assertEquals(featureContent.includes("Scenario: Negative post collapsed"), true);
});

Deno.test("generate-features: warns and still writes when scenario has no Given", async () => {
  const { projectDir, ctx } = await makeContext();
  await model.methods.create.execute({ name: "no-given-test" }, ctx);
  await model.methods["set-proposal"].execute({ name: "no-given-test", text: "proposal" }, ctx);
  await model.methods["approve-proposal"].execute({ name: "no-given-test" }, ctx);
  await model.methods["set-scenarios"].execute({
    name: "no-given-test",
    scenarios: [{ name: "No given scenario", given: [], when: ["something"], then: ["result"] }],
  }, ctx);
  await model.methods["approve-scenarios"].execute({ name: "no-given-test" }, ctx);
  await model.methods["generate-features"].execute({ name: "no-given-test" }, ctx);
  const featureContent = await Deno.readTextFile(`${projectDir}/tests/cucumber/features/no-given-test.feature`);
  assertEquals(featureContent.includes("Feature: no-given-test"), true);
  assertEquals(featureContent.includes("Given"), false);
});

for (const stepStatus of ["passed", "failed"]) {
  Deno.test(`generate-features: does not re-tag @wip for a scenario that already ${stepStatus}`, async () => {
    const { projectDir, ctx } = await makeContext();
    await buildToVerifying(projectDir, ctx, stepStatus);
    await model.methods["generate-features"].execute({ name: "chg" }, ctx);
    const featureContent = await Deno.readTextFile(`${projectDir}/tests/cucumber/features/chg.feature`);
    assertEquals(featureContent.includes("@wip"), false);
    assertEquals(featureContent.includes("Scenario: S"), true);
  });
}

Deno.test("record-results: can be called again from verifying phase", async () => {
  const { projectDir, ctx } = await makeContext();
  await buildToVerifying(projectDir, ctx, "passed");
  const state1 = await readState(projectDir, "chg");
  assertEquals(state1.phase, "verifying");
  assertEquals(state1.scenarios[0].status, "pass");

  // Re-run with a different report reflecting a changed outcome.
  const reportPath2 = `${projectDir}/cucumber-report-2.json`;
  await Deno.writeTextFile(reportPath2, JSON.stringify(makeReport("S", ["failed"])));
  await model.methods["record-results"].execute({ name: "chg", reportPath: reportPath2 }, ctx);

  const state2 = await readState(projectDir, "chg");
  assertEquals(state2.phase, "verifying");
  assertEquals(state2.scenarios[0].status, "fail");
});
