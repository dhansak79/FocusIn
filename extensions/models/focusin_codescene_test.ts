import { assertEquals, assertRejects } from "jsr:@std/assert";
import { buildCommandEnv, buildHealthResult, model, parseDeltaOutput } from "./focusin_codescene.ts";

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

const enc = new TextEncoder();

// --- parseDeltaOutput ---

Deno.test("parseDeltaOutput: empty string returns empty array", () => {
  assertEquals(parseDeltaOutput(""), []);
});

Deno.test("parseDeltaOutput: no JSON array in output returns empty array", () => {
  assertEquals(parseDeltaOutput("something went wrong"), []);
});

Deno.test("parseDeltaOutput: maps kebab-case fields to camelCase", () => {
  const raw = JSON.stringify([
    { name: "src/foo.js", "old-score": 10.0, "new-score": 8.54, findings: [{ category: "Complex Method" }] },
  ]);
  const result = parseDeltaOutput(raw);
  assertEquals(result.length, 1);
  assertEquals(result[0].name, "src/foo.js");
  assertEquals(result[0].oldScore, 10.0);
  assertEquals(result[0].newScore, 8.54);
  assertEquals(result[0].findings.length, 1);
});

Deno.test("parseDeltaOutput: null old-score for new files is preserved", () => {
  const raw = JSON.stringify([
    { name: "src/new.js", "old-score": null, "new-score": 7.5, findings: [] },
  ]);
  const result = parseDeltaOutput(raw);
  assertEquals(result[0].oldScore, null);
});

Deno.test("parseDeltaOutput: invalid JSON after [ returns empty array", () => {
  assertEquals(parseDeltaOutput("version check [invalid json here"), []);
});

Deno.test("parseDeltaOutput: findings not an array falls back to empty array", () => {
  const raw = JSON.stringify([
    { name: "src/foo.js", "old-score": 9.0, "new-score": 7.0, findings: null },
  ]);
  const result = parseDeltaOutput(raw);
  assertEquals(result[0].findings, []);
});

Deno.test("parseDeltaOutput: tolerates version-check lines before JSON", () => {
  const raw = "New version available.\nUse cs version.\n" +
    JSON.stringify([{ name: "src/x.js", "old-score": 9.0, "new-score": 7.0, findings: [{}] }]);
  const result = parseDeltaOutput(raw);
  assertEquals(result.length, 1);
  assertEquals(result[0].name, "src/x.js");
});

// --- buildCommandEnv ---

Deno.test("buildCommandEnv: extends PATH with home .local/bin prefix", () => {
  const result = buildCommandEnv({ HOME: "/home/user", PATH: "/usr/bin:/bin" });
  assertEquals(result.PATH, "/home/user/.local/bin:/usr/bin:/bin");
  assertEquals(result.CS_DISABLE_VERSION_CHECK, "1");
});

Deno.test("buildCommandEnv: handles missing HOME and PATH gracefully", () => {
  const result = buildCommandEnv({});
  assertEquals(result.PATH, "/.local/bin:");
  assertEquals(result.CS_DISABLE_VERSION_CHECK, "1");
});

// --- buildHealthResult ---

Deno.test("buildHealthResult: empty files gives passed:true and failedFiles:0", () => {
  const result = buildHealthResult([], "2026-01-01T00:00:00.000Z");
  assertEquals(result.passed, true);
  assertEquals(result.failedFiles, 0);
  assertEquals(result.files, []);
  assertEquals(result.ranAt, "2026-01-01T00:00:00.000Z");
});

Deno.test("buildHealthResult: one degraded file gives passed:false and failedFiles:1", () => {
  const files = [{ name: "src/foo.js", oldScore: 10.0, newScore: 8.54, findings: [{}] }];
  const result = buildHealthResult(files, "2026-01-01T00:00:00.000Z");
  assertEquals(result.passed, false);
  assertEquals(result.failedFiles, 1);
  assertEquals(result.files, files);
});

// --- model.check.execute ---

Deno.test("model.check.execute: no degradations — writes passed result and returns", async () => {
  const written: Record<string, unknown>[] = [];
  const ctx = {
    globalArgs: { projectDir: "/tmp/focusin" },
    writeResource: async (_s: string, _i: string, data: Record<string, unknown>) => {
      written.push(data);
      return { name: "healthResult/current" };
    },
  };

  await withMockCommand(
    () => ({ output: async () => ({ code: 0, stdout: enc.encode("[]"), stderr: new Uint8Array() }) }),
    async () => {
      await model.methods.check.execute({}, ctx as never);
      assertEquals(written[0].passed, true);
      assertEquals(written[0].failedFiles, 0);
      assertEquals((written[0].files as unknown[]).length, 0);
    },
  );
});

async function runWithDegradedOutput(
  globalArgs: Record<string, unknown>,
  degradedJson: string,
): Promise<Record<string, unknown>> {
  const written: Record<string, unknown>[] = [];
  const ctx = {
    globalArgs,
    writeResource: async (_s: string, _i: string, data: Record<string, unknown>) => {
      written.push(data);
      return { name: "healthResult/current" };
    },
  };
  await withMockCommand(
    () => ({ output: async () => ({ code: 0, stdout: enc.encode(degradedJson), stderr: new Uint8Array() }) }),
    async () => {
      await assertRejects(
        () => model.methods.check.execute({}, ctx as never),
        Error,
        "CodeScene health gate failed",
      );
    },
  );
  return written[0];
}

Deno.test("model.check.execute: degraded file — writes result then throws", async () => {
  const degraded = JSON.stringify([
    { name: "src/foo.js", "old-score": 10.0, "new-score": 8.54, findings: [{ category: "Complex Method" }] },
  ]);
  const result = await runWithDegradedOutput({ projectDir: "/tmp/focusin" }, degraded);
  assertEquals(result.passed, false);
  assertEquals(result.failedFiles, 1);
});

Deno.test("model.check.execute: excludePaths filters matching files before health check", async () => {
  const output = JSON.stringify([
    { name: "src/foo.js", "old-score": 10.0, "new-score": 8.54, findings: [{}] },
    { name: "telemetry/workflow-runs/run.yaml", "old-score": null, "new-score": 7.0, findings: [{}] },
  ]);
  const result = await runWithDegradedOutput({ projectDir: "/tmp/focusin", excludePaths: ["telemetry/"] }, output);
  assertEquals(result.failedFiles, 1);
  assertEquals((result.files as Array<{ name: string }>)[0].name, "src/foo.js");
});

Deno.test("model.check.execute: cs binary not found — throws with install message", async () => {
  const ctx = {
    globalArgs: { projectDir: "/tmp/focusin" },
    writeResource: async () => ({ name: "healthResult/current" }),
  };

  await withMockCommand(
    () => ({ output: () => Promise.reject(new Error("No such file or directory")) }),
    async () => {
      await assertRejects(
        () => model.methods.check.execute({}, ctx as never),
        Error,
        "cs is not installed",
      );
    },
  );
});
