import { assertEquals, assertRejects } from "jsr:@std/assert";
import { model, parseVitestOutput, readCoverageMetrics } from "./focusin_tests.ts";

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

Deno.test("parseVitestOutput: parses valid JSON reporter output", () => {
  const raw = JSON.stringify({ numTotalTests: 10, numPassedTests: 9, numFailedTests: 1 });
  assertEquals(parseVitestOutput(raw), { total: 10, passing: 9, failing: 1 });
});

Deno.test("parseVitestOutput: returns zeros for invalid JSON", () => {
  assertEquals(parseVitestOutput("not json"), { total: 0, passing: 0, failing: 0 });
  assertEquals(parseVitestOutput(""), { total: 0, passing: 0, failing: 0 });
});

Deno.test("parseVitestOutput: returns zeros for missing fields", () => {
  assertEquals(parseVitestOutput("{}"), { total: 0, passing: 0, failing: 0 });
});

Deno.test("parseVitestOutput: all tests passed", () => {
  const raw = JSON.stringify({ numTotalTests: 640, numPassedTests: 640, numFailedTests: 0 });
  assertEquals(parseVitestOutput(raw), { total: 640, passing: 640, failing: 0 });
});

Deno.test("readCoverageMetrics: reads from coverage-summary.json", async () => {
  const dir = await Deno.makeTempDir();
  const coverageDir = `${dir}/coverage`;
  await Deno.mkdir(coverageDir);
  await Deno.writeTextFile(`${coverageDir}/coverage-summary.json`, JSON.stringify({
    total: { lines: { pct: 95 }, functions: { pct: 88 }, branches: { pct: 91 }, statements: { pct: 93 } },
  }));
  const result = await readCoverageMetrics(dir);
  assertEquals(result, { lines: 95, functions: 88, branches: 91, statements: 93 });
  await Deno.remove(dir, { recursive: true });
});

Deno.test("readCoverageMetrics: returns zeros when file missing", async () => {
  const result = await readCoverageMetrics("/nonexistent/path");
  assertEquals(result, { lines: 0, functions: 0, branches: 0, statements: 0 });
});

Deno.test("readCoverageMetrics: returns zeros for malformed JSON", async () => {
  const dir = await Deno.makeTempDir();
  const coverageDir = `${dir}/coverage`;
  await Deno.mkdir(coverageDir);
  await Deno.writeTextFile(`${coverageDir}/coverage-summary.json`, "bad json");
  const result = await readCoverageMetrics(dir);
  assertEquals(result, { lines: 0, functions: 0, branches: 0, statements: 0 });
  await Deno.remove(dir, { recursive: true });
});

Deno.test("readCoverageMetrics: returns zeros when total field is absent", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.mkdir(`${dir}/coverage`);
  await Deno.writeTextFile(`${dir}/coverage/coverage-summary.json`, "{}");
  const result = await readCoverageMetrics(dir);
  assertEquals(result, { lines: 0, functions: 0, branches: 0, statements: 0 });
  await Deno.remove(dir, { recursive: true });
});

Deno.test("model.test.execute: parses vitest output file and writes resource when both commands succeed", async () => {
  const dir = await Deno.makeTempDir();
  const vitestJson = JSON.stringify({ numTotalTests: 10, numPassedTests: 10, numFailedTests: 0 });

  const written: Record<string, unknown>[] = [];
  const ctx = {
    globalArgs: { projectDir: dir },
    writeResource: async (_s: string, _i: string, data: Record<string, unknown>) => {
      written.push(data);
      return { name: "testResult/current" };
    },
  };

  await withMockCommand(
    (_cmd, opts) => {
      const fileArg = opts.args.find((a) => a.startsWith("--outputFile="));
      const outputFile = fileArg ? fileArg.slice("--outputFile=".length) : "";
      return {
        output: async () => {
          if (outputFile) {
            const parentDir = outputFile.split("/").slice(0, -1).join("/");
            await Deno.mkdir(parentDir, { recursive: true });
            await Deno.writeTextFile(outputFile, vitestJson);
          }
          return { code: 0, stdout: new Uint8Array(), stderr: new Uint8Array() };
        },
      };
    },
    async () => {
      await model.methods.test.execute({}, ctx as never);
      assertEquals(written[0].passed, true);
      assertEquals(written[0].total, 10);
      assertEquals(written[0].passing, 10);
      assertEquals(written[0].failing, 0);
    },
  );

  await Deno.remove(dir, { recursive: true });
});

async function runTestExecuteNoFile(exitCode: number): Promise<Record<string, unknown>> {
  const written: Record<string, unknown>[] = [];
  const ctx = {
    globalArgs: { projectDir: "/nonexistent-abc" },
    writeResource: async (_s: string, _i: string, data: Record<string, unknown>) => {
      written.push(data);
      return { name: "testResult/current" };
    },
  };
  await withMockCommand(
    () => ({ output: async () => ({ code: exitCode, stdout: new Uint8Array(), stderr: new Uint8Array() }) }),
    async () => { await model.methods.test.execute({}, ctx as never); },
  );
  return written[0];
}

Deno.test("model.test.execute: failing=0 when both commands succeed but output file absent", async () => {
  const result = await runTestExecuteNoFile(0);
  assertEquals(result.passed, true);
  assertEquals(result.failing, 0);
});

async function assertThrowsOnFailure(
  execute: (ctx: never) => Promise<unknown>,
  errorMsg: string,
  extraCheck?: (written: Record<string, unknown>[]) => void,
) {
  const written: Record<string, unknown>[] = [];
  const ctx = {
    globalArgs: { projectDir: "/nonexistent-abc" },
    writeResource: async (_s: string, _i: string, data: Record<string, unknown>) => {
      written.push(data);
      return { name: "result/current" };
    },
  };
  await withMockCommand(
    () => ({ output: async () => ({ code: 1, stdout: new Uint8Array(), stderr: new Uint8Array() }) }),
    async () => {
      await assertRejects(() => execute(ctx as never), Error, errorMsg);
      assertEquals(written[0].passed, false);
      extraCheck?.(written);
    },
  );
}

Deno.test("model.test.execute: throws and writes passed=false when commands fail", () =>
  assertThrowsOnFailure(
    (ctx) => model.methods.test.execute({}, ctx),
    "Tests failed",
    (written) => assertEquals((written[0].failing as number) > 0, true),
  ));

Deno.test("model.coverage.execute: reads coverage-summary.json and writes resource", async () => {
  const dir = await Deno.makeTempDir();
  await Deno.mkdir(`${dir}/coverage`);
  await Deno.writeTextFile(`${dir}/coverage/coverage-summary.json`, JSON.stringify({
    total: { lines: { pct: 100 }, functions: { pct: 98 }, branches: { pct: 91 }, statements: { pct: 99 } },
  }));

  const written: Record<string, unknown>[] = [];
  const ctx = {
    globalArgs: { projectDir: dir },
    writeResource: async (_s: string, _i: string, data: Record<string, unknown>) => {
      written.push(data);
      return { name: "coverageResult/current" };
    },
  };

  await withMockCommand(
    () => ({ output: async () => ({ code: 0, stdout: new Uint8Array(), stderr: new Uint8Array() }) }),
    async () => {
      await model.methods.coverage.execute({}, ctx as never);
      assertEquals(written[0].passed, true);
      assertEquals(written[0].lines, 100);
      assertEquals(written[0].functions, 98);
      assertEquals(written[0].branches, 91);
      assertEquals(written[0].statements, 99);
    },
  );

  await Deno.remove(dir, { recursive: true });
});

Deno.test("model.coverage.execute: throws and writes passed=false when command fails", () =>
  assertThrowsOnFailure(
    (ctx) => model.methods.coverage.execute({}, ctx),
    "Coverage run failed",
  ));
