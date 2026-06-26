import { assertEquals, assertRejects } from "jsr:@std/assert";
import { buildKnipResult, model, parseKnipOutput } from "./focusin_knip.ts";

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

async function runKnipCheck(
  code: number,
  stdout = "",
  stderr = "",
): Promise<{ written: Record<string, unknown>[]; threw: boolean }> {
  const written: Record<string, unknown>[] = [];
  const ctx = {
    globalArgs: { projectDir: "/proj" },
    writeResource: async (_s: string, _i: string, data: Record<string, unknown>) => {
      written.push(data);
      return { name: "knipResult/current" };
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

Deno.test("parseKnipOutput: returns 0 for empty output", () => {
  assertEquals(parseKnipOutput(""), 0);
});

Deno.test("parseKnipOutput: returns 0 when no parenthetical counts", () => {
  assertEquals(parseKnipOutput("Ran knip. All good!"), 0);
});

Deno.test("parseKnipOutput: sums all parenthetical counts", () => {
  const output = "Unused files (2)\n  src/a.ts\n  src/b.ts\nUnused exports (3)\n  foo\n  bar\n  baz";
  assertEquals(parseKnipOutput(output), 5);
});

Deno.test("parseKnipOutput: handles single section", () => {
  assertEquals(parseKnipOutput("Unused dependencies (1)\n  lodash"), 1);
});

Deno.test("buildKnipResult: passed=true when issueCount=0", () => {
  const r = buildKnipResult(0, "2026-01-01T00:00:00.000Z");
  assertEquals(r, { passed: true, issueCount: 0, ranAt: "2026-01-01T00:00:00.000Z" });
});

Deno.test("buildKnipResult: passed=false when issueCount>0", () => {
  const r = buildKnipResult(5, "2026-01-01T00:00:00.000Z");
  assertEquals(r, { passed: false, issueCount: 5, ranAt: "2026-01-01T00:00:00.000Z" });
});

Deno.test("model.check.execute: writes knipResult with passed=true on zero issues", async () => {
  const { written, threw } = await runKnipCheck(0);
  assertEquals(threw, false);
  assertEquals(written[0].passed, true);
  assertEquals(written[0].issueCount, 0);
});

Deno.test("model.check.execute: writes resource then throws on non-zero issues", async () => {
  const { written, threw } = await runKnipCheck(
    1,
    "Unused files (2)\n  src/a.ts\n  src/b.ts",
  );
  assertEquals(threw, true);
  assertEquals(written.length, 1, "resource written before throw");
  assertEquals(written[0].passed, false);
  assertEquals(written[0].issueCount, 2);
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
