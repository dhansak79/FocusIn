import { assertEquals, assertAlmostEquals } from "jsr:@std/assert";
import { model, parseSpecCoverageOutput } from "./focusin_spec_coverage.ts";

type MockOutput = { code: number; stdout: Uint8Array; stderr: Uint8Array };

function withMockCommand(
  factory: () => { output: () => Promise<MockOutput> },
  fn: () => Promise<void>,
): Promise<void> {
  const saved = Deno.Command;
  // deno-lint-ignore no-explicit-any
  (Deno as any).Command = class { output() { return factory().output(); } };
  return fn().finally(() => { (Deno as any).Command = saved; });
}

Deno.test("parseSpecCoverageOutput: parses valid summary line", () => {
  const output = "Checking specs...\nSummary: 7 / 10 scenarios covered\nDone.";
  assertEquals(parseSpecCoverageOutput(output), { covered: 7, total: 10 });
});

Deno.test("parseSpecCoverageOutput: full coverage", () => {
  const output = "Summary: 10 / 10 scenarios covered";
  assertEquals(parseSpecCoverageOutput(output), { covered: 10, total: 10 });
});

Deno.test("parseSpecCoverageOutput: zero coverage", () => {
  const output = "Summary: 0 / 5 scenarios covered";
  assertEquals(parseSpecCoverageOutput(output), { covered: 0, total: 5 });
});

Deno.test("parseSpecCoverageOutput: no match returns zeros", () => {
  assertEquals(parseSpecCoverageOutput(""), { covered: 0, total: 0 });
  assertEquals(parseSpecCoverageOutput("No summary here"), { covered: 0, total: 0 });
});

Deno.test("parseSpecCoverageOutput: handles extra whitespace", () => {
  const output = "Summary:   3  /  8  scenarios covered";
  assertEquals(parseSpecCoverageOutput(output), { covered: 3, total: 8 });
});

Deno.test("model.run.execute: writes correct resource on success", async () => {
  const fakeOutput = "Checking...\nSummary: 8 / 10 scenarios covered\nDone.";
  const encoded = new TextEncoder().encode(fakeOutput);

  const written: Record<string, unknown>[] = [];
  const ctx = {
    globalArgs: { projectDir: "/tmp/fake-focusin" },
    writeResource: async (_s: string, _i: string, data: Record<string, unknown>) => {
      written.push(data);
      return { name: "result/current" };
    },
  };

  await withMockCommand(
    () => ({ output: async () => ({ code: 0, stdout: encoded, stderr: new Uint8Array() }) }),
    async () => {
      const result = await model.methods.run.execute({}, ctx as never);
      assertEquals(written[0].covered, 8);
      assertEquals(written[0].total, 10);
      assertAlmostEquals(written[0].pct as number, 80);
      assertEquals(written[0].passed, true);
      assertEquals((result as { dataHandles: unknown[] }).dataHandles.length, 1);
    },
  );
});

Deno.test("model.run.execute: handles command failure and empty stdout", async () => {
  const written: Record<string, unknown>[] = [];
  const ctx = {
    globalArgs: { projectDir: "/tmp/fake-focusin" },
    writeResource: async (_s: string, _i: string, data: Record<string, unknown>) => {
      written.push(data);
      return { name: "result/current" };
    },
  };

  await withMockCommand(
    () => ({ output: async () => ({ code: 1, stdout: new Uint8Array(), stderr: new Uint8Array() }) }),
    async () => {
      await model.methods.run.execute({}, ctx as never);
      assertEquals(written[0].covered, 0);
      assertEquals(written[0].total, 0);
      assertEquals(written[0].pct, 100);
      assertEquals(written[0].passed, false);
    },
  );
});
