import { assertEquals } from "jsr:@std/assert";
import { model } from "./focusin_spec_runner.ts";

type MockOutput = { code: number; stdout: Uint8Array; stderr: Uint8Array };

function withMockCommand(
  factory: (cmd: string, opts: { args: string[]; cwd?: string }) => { output: () => Promise<MockOutput> },
  fn: () => Promise<void>,
): Promise<void> {
  const saved = Deno.Command;
  // deno-lint-ignore no-explicit-any
  (Deno as any).Command = class {
    private delegate: { output: () => Promise<MockOutput> };
    constructor(cmd: string, opts: { args: string[]; cwd?: string }) { this.delegate = factory(cmd, opts); }
    output() { return this.delegate.output(); }
  };
  return fn().finally(() => { (Deno as any).Command = saved; });
}

Deno.test("run: passed=true and reportPath returned when cucumber exits 0", async () => {
  const dir = await Deno.makeTempDir();
  const written: Record<string, unknown>[] = [];
  const ctx = {
    globalArgs: { projectDir: dir },
    writeResource: async (_s: string, _i: string, data: Record<string, unknown>) => {
      written.push(data);
      return { name: "runResult/current" };
    },
  };

  await withMockCommand(
    () => ({ output: async () => ({ code: 0, stdout: new Uint8Array(), stderr: new Uint8Array() }) }),
    async () => {
      const result = await model.methods.run.execute({}, ctx as never);
      assertEquals(written[0].passed, true);
      assertEquals(typeof written[0].reportPath, "string");
      assertEquals(typeof written[0].ranAt, "string");
      assertEquals(result.reportPath, `${dir}/cucumber-report.json`);
    },
  );

  await Deno.remove(dir, { recursive: true });
});

Deno.test("run: passed=false when cucumber exits non-zero", async () => {
  const dir = await Deno.makeTempDir();
  const written: Record<string, unknown>[] = [];
  const ctx = {
    globalArgs: { projectDir: dir },
    writeResource: async (_s: string, _i: string, data: Record<string, unknown>) => {
      written.push(data);
      return { name: "runResult/current" };
    },
  };

  await withMockCommand(
    () => ({ output: async () => ({ code: 1, stdout: new Uint8Array(), stderr: new Uint8Array() }) }),
    async () => {
      await model.methods.run.execute({}, ctx as never);
      assertEquals(written[0].passed, false);
    },
  );

  await Deno.remove(dir, { recursive: true });
});

Deno.test("run: uses featuresGlob override when provided", async () => {
  const dir = await Deno.makeTempDir();
  const capturedArgs: string[][] = [];
  const ctx = {
    globalArgs: { projectDir: dir },
    writeResource: async (_s: string, _i: string, data: Record<string, unknown>) => {
      return { name: "runResult/current" };
    },
  };

  await withMockCommand(
    (_cmd, opts) => {
      capturedArgs.push(opts.args);
      return { output: async () => ({ code: 0, stdout: new Uint8Array(), stderr: new Uint8Array() }) };
    },
    async () => {
      await model.methods.run.execute({ featuresGlob: "tests/custom/**/*.feature" }, ctx as never);
      assertEquals(capturedArgs[0][1], "tests/custom/**/*.feature");
    },
  );

  await Deno.remove(dir, { recursive: true });
});
