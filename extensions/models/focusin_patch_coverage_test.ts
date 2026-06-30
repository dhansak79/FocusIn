import { assertEquals, assertRejects } from "jsr:@std/assert";
import {
  findUncoveredLines,
  model,
  parseLcov,
  parseStagedDiff,
} from "./focusin_patch_coverage.ts";

type MockOutput = { code: number; stdout: Uint8Array; stderr: Uint8Array };
type CommandFactory = (cmd: string, opts: { args: string[] }) => { output: () => Promise<MockOutput> };

function withMockCommand(factory: CommandFactory, fn: () => Promise<void>): Promise<void> {
  const saved = Deno.Command;
  // deno-lint-ignore no-explicit-any
  (Deno as any).Command = class {
    private delegate: { output: () => Promise<MockOutput> };
    constructor(cmd: string, opts: { args: string[] }) { this.delegate = factory(cmd, opts); }
    output() { return this.delegate.output(); }
  };
  return fn().finally(() => { (Deno as any).Command = saved; });
}

const enc = (s: string) => new TextEncoder().encode(s);

async function runPatchCoverageCheck(
  dir: string,
  diff: string,
  mode: "staged" | "branch" = "staged",
): Promise<{ written: Record<string, unknown>[]; threw: boolean; capturedArgs: string[][] }> {
  const written: Record<string, unknown>[] = [];
  const capturedArgs: string[][] = [];
  const ctx = {
    globalArgs: { projectDir: dir },
    writeResource: async (_s: string, _i: string, data: Record<string, unknown>) => {
      written.push(data);
      return { name: "patchCoverageResult/current" };
    },
  };
  let threw = false;
  await withMockCommand(
    (_cmd: string, opts: { args: string[] }) => {
      capturedArgs.push(opts.args);
      return { output: async () => ({ code: 0, stdout: enc(diff), stderr: enc("") }) };
    },
    async () => {
      try { await model.methods.check.execute({ mode }, ctx as never); } catch { threw = true; }
    },
  );
  return { written, threw, capturedArgs };
}

// ---- parseLcov ----

Deno.test("parseLcov: parses basic lcov data", () => {
  const raw = "SF:src/utils.js\nDA:1,2\nDA:2,0\nDA:3,5\nend_of_record\n";
  const result = parseLcov(raw);
  assertEquals(result["src/utils.js"], { 1: 2, 2: 0, 3: 5 });
});

Deno.test("parseLcov: handles multiple files", () => {
  const raw = "SF:src/a.js\nDA:1,1\nend_of_record\nSF:src/b.js\nDA:2,0\nend_of_record\n";
  const result = parseLcov(raw);
  assertEquals(result["src/a.js"], { 1: 1 });
  assertEquals(result["src/b.js"], { 2: 0 });
});

Deno.test("parseLcov: returns empty for empty input", () => {
  assertEquals(parseLcov(""), {});
});

Deno.test("parseLcov: downgrades covered line when a branch has taken=0 (partial)", () => {
  const raw = "SF:src/utils.js\nDA:1,3\nBRDA:1,0,0,0\nend_of_record\n";
  assertEquals(parseLcov(raw)["src/utils.js"][1], 0);
});

Deno.test("parseLcov: downgrades covered line when a branch has taken=- (never executed)", () => {
  const raw = "SF:src/utils.js\nDA:1,3\nBRDA:1,0,0,-\nend_of_record\n";
  assertEquals(parseLcov(raw)["src/utils.js"][1], 0);
});

Deno.test("parseLcov: leaves covered line when all branches are taken", () => {
  const raw = "SF:src/utils.js\nDA:1,3\nBRDA:1,0,0,2\nBRDA:1,0,1,1\nend_of_record\n";
  assertEquals(parseLcov(raw)["src/utils.js"][1], 3);
});

// ---- parseStagedDiff ----

// Uses -U0 format (no context lines) matching `git diff --cached -U0` in production
const SIMPLE_DIFF = `diff --git a/src/utils.js b/src/utils.js
index abc..def 100644
--- a/src/utils.js
+++ b/src/utils.js
@@ -2,0 +2,1 @@
+added line 2
@@ -4,0 +4,1 @@
+added line 4
`;

Deno.test("parseStagedDiff: extracts added line numbers", () => {
  const result = parseStagedDiff(SIMPLE_DIFF);
  assertEquals(result["src/utils.js"].has(2), true);
  assertEquals(result["src/utils.js"].has(4), true);
});

Deno.test("parseStagedDiff: returns empty for no staged changes", () => {
  assertEquals(parseStagedDiff(""), {});
});

Deno.test("parseStagedDiff: ignores added lines when hunk header has no +N", () => {
  const diff = `+++ b/src/utils.js\n@@ malformed @@\n+added\n`;
  assertEquals(parseStagedDiff(diff)["src/utils.js"].size, 0);
});

// ---- findUncoveredLines ----

Deno.test("findUncoveredLines: returns empty when all staged lines are covered", () => {
  const coverage = { "src/utils.js": { 10: 2, 11: 1 } };
  const staged = { "src/utils.js": new Set([10, 11]) };
  assertEquals(findUncoveredLines(coverage, staged), []);
});

Deno.test("findUncoveredLines: reports uncovered lines in src js files", () => {
  const coverage = { "src/utils.js": { 10: 0, 11: 1 } };
  const staged = { "src/utils.js": new Set([10, 11]) };
  const result = findUncoveredLines(coverage, staged);
  assertEquals(result, [{ file: "src/utils.js", line: 10 }]);
});

Deno.test("findUncoveredLines: reports uncovered lines in deno extension files", () => {
  const coverage = { "extensions/models/focusin_lint.ts": { 5: 0 } };
  const staged = { "extensions/models/focusin_lint.ts": new Set([5]) };
  const result = findUncoveredLines(coverage, staged);
  assertEquals(result, [{ file: "extensions/models/focusin_lint.ts", line: 5 }]);
});

Deno.test("findUncoveredLines: skips test files (not present in lcov)", () => {
  const coverage: Record<string, Record<number, number>> = {};
  const staged = { "extensions/models/focusin_lint_test.ts": new Set([10]) };
  assertEquals(findUncoveredLines(coverage, staged), []);
});

Deno.test("findUncoveredLines: skips staged line not present in file coverage data", () => {
  const coverage = { "src/utils.js": { 10: 1 } };
  const staged = { "src/utils.js": new Set([99]) };
  assertEquals(findUncoveredLines(coverage, staged), []);
});

Deno.test("findUncoveredLines: skips files not in lcov (e.g. markdown, yaml, content files)", () => {
  const coverage: Record<string, Record<number, number>> = {};
  const staged = {
    "src/utils.js": new Set([10]),
    "src/content/foo.js": new Set([1]),
    "README.md": new Set([5]),
  };
  assertEquals(findUncoveredLines(coverage, staged), []);
});

Deno.test("findUncoveredLines: reports uncovered lines in scripts/ files", () => {
  const coverage = { "scripts/generate-guardrails-dashboard.js": { 10: 0, 11: 1 } };
  const staged = { "scripts/generate-guardrails-dashboard.js": new Set([10, 11]) };
  assertEquals(findUncoveredLines(coverage, staged), [
    { file: "scripts/generate-guardrails-dashboard.js", line: 10 },
  ]);
});

Deno.test("findUncoveredLines: reports uncovered lines in extensions/reports/ files", () => {
  const coverage = { "extensions/reports/quality_gate_summary.ts": { 90: 0, 91: 1 } };
  const staged = { "extensions/reports/quality_gate_summary.ts": new Set([90, 91]) };
  assertEquals(findUncoveredLines(coverage, staged), [
    { file: "extensions/reports/quality_gate_summary.ts", line: 90 },
  ]);
});

Deno.test("findUncoveredLines: reports uncovered lines in src/popup/ files when in lcov", () => {
  const coverage = { "src/popup/popup.js": { 1: 0 } };
  const staged = { "src/popup/popup.js": new Set([1]) };
  assertEquals(findUncoveredLines(coverage, staged), [
    { file: "src/popup/popup.js", line: 1 },
  ]);
});

async function withLcov(
  lcov: string,
  fn: (dir: string) => Promise<void>,
): Promise<void> {
  const dir = await Deno.makeTempDir();
  await Deno.mkdir(`${dir}/coverage`);
  await Deno.writeTextFile(`${dir}/coverage/lcov.info`, lcov);
  try {
    await fn(dir);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

// ---- model.check.execute ----

Deno.test("model.check.execute: vacuous pass when no staged changes", async () => {
  await withLcov("SF:src/utils.js\nDA:1,2\nend_of_record\n", async (dir) => {
    const { written, threw } = await runPatchCoverageCheck(dir, "");
    assertEquals(threw, false);
    assertEquals(written[0].passed, true);
    assertEquals(written[0].uncoveredLines, 0);
  });
});

Deno.test("model.check.execute: passes when all staged lines are covered", async () => {
  await withLcov("", async (dir) => {
    await Deno.writeTextFile(`${dir}/coverage/lcov.info`, `SF:${dir}/src/utils.js\nDA:1,2\nend_of_record\n`);
    const { written, threw } = await runPatchCoverageCheck(dir, `+++ b/src/utils.js\n@@ -0,0 +1 @@\n+added\n`);
    assertEquals(threw, false);
    assertEquals(written[0].passed, true);
  });
});

Deno.test("model.check.execute: writes resource then throws when staged lines uncovered", async () => {
  await withLcov("", async (dir) => {
    await Deno.writeTextFile(`${dir}/coverage/lcov.info`, `SF:${dir}/src/utils.js\nDA:1,0\nend_of_record\n`);
    const { written, threw } = await runPatchCoverageCheck(dir, `+++ b/src/utils.js\n@@ -0,0 +1 @@\n+added line\n`);
    assertEquals(threw, true);
    assertEquals(written.length, 1, "resource written before throw");
    assertEquals(written[0].passed, false);
    assertEquals(written[0].uncoveredLines, 1);
  });
});

Deno.test("model.check.execute: passes gracefully when lcov.info missing", async () => {
  const dir = await Deno.makeTempDir();
  const { written, threw } = await runPatchCoverageCheck(dir, "");
  assertEquals(threw, false);
  assertEquals(written[0].passed, true);
  await Deno.remove(dir, { recursive: true });
});

Deno.test("model.check.execute: throws with assertRejects on uncovered lines", async () => {
  await withLcov("", async (dir) => {
    await Deno.writeTextFile(`${dir}/coverage/lcov.info`, `SF:${dir}/src/utils.js\nDA:1,0\nend_of_record\n`);
    const diff = `+++ b/src/utils.js\n@@ -0,0 +1 @@\n+added line\n`;
    const ctx = {
      globalArgs: { projectDir: dir },
      writeResource: async (_s: string, _i: string, _d: Record<string, unknown>) => ({
        name: "patchCoverageResult/current",
      }),
    };
    await withMockCommand(
      () => ({ output: async () => ({ code: 0, stdout: enc(diff), stderr: enc("") }) }),
      async () => {
        await assertRejects(() => model.methods.check.execute({ mode: "staged" }, ctx as never));
      },
    );
  });
});

// ---- branch mode ----

Deno.test("model.check.execute: staged mode uses git diff --cached", async () => {
  const dir = await Deno.makeTempDir();
  const { capturedArgs } = await runPatchCoverageCheck(dir, "", "staged");
  assertEquals(capturedArgs[0], ["diff", "--cached", "-U0"]);
  await Deno.remove(dir, { recursive: true });
});

Deno.test("model.check.execute: branch mode uses git diff main...HEAD", async () => {
  const dir = await Deno.makeTempDir();
  const { capturedArgs } = await runPatchCoverageCheck(dir, "", "branch");
  assertEquals(capturedArgs[0], ["diff", "main...HEAD", "-U0"]);
  await Deno.remove(dir, { recursive: true });
});

Deno.test("model.check.execute: branch mode passes when all branch lines are covered", async () => {
  await withLcov("", async (dir) => {
    await Deno.writeTextFile(`${dir}/coverage/lcov.info`, `SF:${dir}/src/utils.js\nDA:1,3\nend_of_record\n`);
    const { written, threw } = await runPatchCoverageCheck(dir, `+++ b/src/utils.js\n@@ -0,0 +1 @@\n+added\n`, "branch");
    assertEquals(threw, false);
    assertEquals(written[0].passed, true);
  });
});

Deno.test("model.check.execute: branch mode throws when branch lines uncovered", async () => {
  await withLcov("", async (dir) => {
    await Deno.writeTextFile(`${dir}/coverage/lcov.info`, `SF:${dir}/src/utils.js\nDA:1,0\nend_of_record\n`);
    const { written, threw } = await runPatchCoverageCheck(dir, `+++ b/src/utils.js\n@@ -0,0 +1 @@\n+added line\n`, "branch");
    assertEquals(threw, true);
    assertEquals(written[0].passed, false);
    assertEquals(written[0].uncoveredLines, 1);
  });
});
