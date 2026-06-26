import { assertEquals, assertRejects } from "jsr:@std/assert";
import { model, parseDenoTestOutput } from "./focusin_deno_ext_tests.ts";

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

const ALL_PASS_SUMMARY = "ok | 12 passed | 0 failed | 0 ignored | 0 measured | 0 filtered out (185ms)";
const ONE_FAIL_SUMMARY = "FAILED | 10 passed | 2 failed | 0 ignored | 0 measured | 0 filtered out (152ms)";
const SECONDS_SUMMARY = "ok | 5 passed | 0 failed | 0 ignored | 0 measured | 0 filtered out (1.2s)";

function makeDenoFactory(testCode: number, testSummary: string): CommandFactory {
  let callCount = 0;
  return () => ({
    output: async () => {
      callCount++;
      if (callCount === 1) {
        return { code: testCode, stdout: enc(testSummary), stderr: enc("") };
      }
      return { code: 0, stdout: enc("SF:extensions/models/foo.ts\nend_of_record\n"), stderr: enc("") };
    },
  });
}

async function runDenoExtTests(
  testCode: number,
  testSummary: string,
): Promise<{ written: Record<string, unknown>[]; threw: boolean }> {
  const written: Record<string, unknown>[] = [];
  const ctx = {
    globalArgs: { projectDir: "/proj" },
    writeResource: async (_s: string, _i: string, data: Record<string, unknown>) => {
      written.push(data);
      return { name: "testResult/current" };
    },
  };
  let threw = false;
  await withMockCommand(
    makeDenoFactory(testCode, testSummary),
    async () => {
      try { await model.methods.run.execute({}, ctx as never); } catch { threw = true; }
    },
  );
  return { written, threw };
}

Deno.test("parseDenoTestOutput: parses all-pass millisecond summary", () => {
  assertEquals(parseDenoTestOutput(ALL_PASS_SUMMARY), {
    total: 12, passing: 12, failing: 0, durationMs: 185,
  });
});

Deno.test("parseDenoTestOutput: parses failure summary", () => {
  assertEquals(parseDenoTestOutput(ONE_FAIL_SUMMARY), {
    total: 12, passing: 10, failing: 2, durationMs: 152,
  });
});

Deno.test("parseDenoTestOutput: parses seconds duration", () => {
  const r = parseDenoTestOutput(SECONDS_SUMMARY);
  assertEquals(r.passing, 5);
  assertEquals(r.failing, 0);
  assertEquals(r.durationMs, 1200);
});

Deno.test("parseDenoTestOutput: returns zeros for unrecognised output", () => {
  assertEquals(parseDenoTestOutput(""), { total: 0, passing: 0, failing: 0, durationMs: 0 });
  assertEquals(parseDenoTestOutput("some other text"), {
    total: 0, passing: 0, failing: 0, durationMs: 0,
  });
});

Deno.test("model.run.execute: writes testResult with passed=true when all tests pass", async () => {
  const { written, threw } = await runDenoExtTests(0, ALL_PASS_SUMMARY);
  assertEquals(threw, false);
  assertEquals(written[0].passed, true);
  assertEquals(written[0].passing, 12);
  assertEquals(written[0].failing, 0);
});

Deno.test("model.run.execute: writes resource then throws when tests fail", async () => {
  const { written, threw } = await runDenoExtTests(1, ONE_FAIL_SUMMARY);
  assertEquals(threw, true);
  assertEquals(written.length, 1, "resource written before throw");
  assertEquals(written[0].passed, false);
  assertEquals(written[0].failing, 2);
});

Deno.test("model.run.execute: throws with assertRejects on failure", async () => {
  const ctx = {
    globalArgs: { projectDir: "/proj" },
    writeResource: async (_s: string, _i: string, data: Record<string, unknown>) => {
      return { name: "testResult/current" };
    },
  };
  await withMockCommand(
    makeDenoFactory(1, ONE_FAIL_SUMMARY),
    async () => {
      await assertRejects(() => model.methods.run.execute({}, ctx as never));
    },
  );
});
