import { assertEquals, assertRejects } from "jsr:@std/assert";
import { buildLintResult, model, parseLintOutput } from "./focusin_lint.ts";

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

async function runLintCheck(
  code: number,
  stdout = "",
  stderr = "",
): Promise<{ written: Record<string, unknown>[]; threw: boolean }> {
  const written: Record<string, unknown>[] = [];
  const ctx = {
    globalArgs: { projectDir: "/proj" },
    writeResource: async (_s: string, _i: string, data: Record<string, unknown>) => {
      written.push(data);
      return { name: "lintResult/current" };
    },
  };
  let threw = false;
  await withMockCommand(
    () => ({ output: async () => ({ code, stdout: enc(stdout), stderr: enc(stderr) }) }),
    async () => {
      try { await model.methods.check.execute({}, ctx as never); } catch { threw = true; }
    },
  );
  return { written, threw };
}

Deno.test("parseLintOutput: returns 0 when no problems reported", () => {
  assertEquals(parseLintOutput(""), 0);
  assertEquals(parseLintOutput("All files pass linting."), 0);
});

Deno.test("parseLintOutput: extracts singular problem count", () => {
  assertEquals(parseLintOutput("✖ 1 problem (1 error, 0 warnings)"), 1);
});

Deno.test("parseLintOutput: extracts plural problem count", () => {
  assertEquals(parseLintOutput("✖ 5 problems (3 errors, 2 warnings)"), 5);
});

Deno.test("buildLintResult: passed=true when issueCount=0", () => {
  const r = buildLintResult(0, "2026-01-01T00:00:00.000Z");
  assertEquals(r, { passed: true, issueCount: 0, ranAt: "2026-01-01T00:00:00.000Z" });
});

Deno.test("buildLintResult: passed=false when issueCount>0", () => {
  const r = buildLintResult(3, "2026-01-01T00:00:00.000Z");
  assertEquals(r, { passed: false, issueCount: 3, ranAt: "2026-01-01T00:00:00.000Z" });
});

Deno.test("model.check.execute: writes lintResult with passed=true on zero issues", async () => {
  const { written, threw } = await runLintCheck(0);
  assertEquals(threw, false);
  assertEquals(written[0].passed, true);
  assertEquals(written[0].issueCount, 0);
});

Deno.test("model.check.execute: writes resource then throws on non-zero issues", async () => {
  const { written, threw } = await runLintCheck(1, "✖ 3 problems (3 errors, 0 warnings)");
  assertEquals(threw, true);
  assertEquals(written.length, 1, "resource written before throw");
  assertEquals(written[0].passed, false);
  assertEquals(written[0].issueCount, 3);
});

Deno.test("model.check.execute: non-zero exit with zero-count output still fails", async () => {
  const { written, threw } = await runLintCheck(1);
  assertEquals(threw, true);
  assertEquals(written[0].passed, false);
  assertEquals(written[0].issueCount, 1);
});

Deno.test("model.check.execute: throws with message when npm not found", async () => {
  const ctx = {
    globalArgs: { projectDir: "/proj" },
    writeResource: async (_s: string, _i: string, _d: Record<string, unknown>) => ({ name: "x" }),
  };
  await withMockCommand(
    () => ({ output: () => Promise.reject(new Error("spawn ENOENT")) }),
    async () => {
      await assertRejects(
        () => model.methods.check.execute({}, ctx as never),
        Error,
        "npm not found",
      );
    },
  );
});
