/**
 * Deno extension model test runner for the FocusIn project.
 *
 * @module
 */
import { z } from "npm:zod@4";

const GlobalArgsSchema = z.object({
  projectDir: z.string().describe("Absolute path to the FocusIn project root"),
});

type GlobalArgs = z.infer<typeof GlobalArgsSchema>;

const TestResultSchema = z.object({
  passed: z.boolean(),
  total: z.number(),
  passing: z.number(),
  failing: z.number(),
  durationMs: z.number(),
  ranAt: z.string(),
});

type WriteResourceFn = (
  specName: string,
  instanceName: string,
  data: Record<string, unknown>,
) => Promise<{ name: string }>;

/**
 * Parse deno test summary line.
 * Example: "ok | 12 passed | 0 failed | 0 ignored | 0 measured | 0 filtered out (185ms)"
 * Also handles: "FAILED | 10 passed | 2 failed | 0 ignored | 0 measured | 0 filtered out (1.2s)"
 */
export function parseDenoTestOutput(
  stdout: string,
): { total: number; passing: number; failing: number; durationMs: number } {
  const m = stdout.match(/(\d+)\s+passed[^|]*\|[^|]*(\d+)\s+failed[^(]*\((\d+(?:\.\d+)?)(ms|s)\)/);
  if (!m) return { total: 0, passing: 0, failing: 0, durationMs: 0 };
  const passing = Number(m[1]);
  const failing = Number(m[2]);
  const durValue = Number(m[3]);
  const durationMs = m[4] === "s" ? Math.round(durValue * 1000) : Math.round(durValue);
  return { total: passing + failing, passing, failing, durationMs };
}

/** Build env extending PATH with ~/.swamp/deno so deno is found regardless of shell PATH. */
export function buildDenoEnv(base: Record<string, string | undefined>): Record<string, string> {
  const home = base.HOME ?? "";
  const path = base.PATH ?? "";
  return { ...(base as Record<string, string>), PATH: `${home}/.swamp/deno:${path}` };
}

export const model = {
  type: "@focusin/deno-ext-tests",
  version: "2026.06.26.1",
  globalArguments: GlobalArgsSchema,
  resources: {
    testResult: {
      description: "Deno extension model test results",
      schema: TestResultSchema,
      lifetime: "30d",
      garbageCollection: 20,
    },
  },
  methods: {
    run: {
      description: "Run deno test on extensions/models/, append lcov to coverage/lcov.info",
      arguments: z.object({}),
      execute: async (
        _args: Record<string, never>,
        context: { globalArgs: GlobalArgs; writeResource: WriteResourceFn },
      ) => {
        const { projectDir } = context.globalArgs;
        const ranAt = new Date().toISOString();
        const coverageDir = `${projectDir}/.deno-coverage`;
        const lcovPath = `${projectDir}/coverage/lcov.info`;
        const env = buildDenoEnv(Deno.env.toObject());

        const testResult = await new Deno.Command("deno", {
          args: [
            "test",
            "--allow-read",
            "--allow-write",
            "--allow-env",
            "--node-modules-dir=auto",
            `--coverage=${coverageDir}`,
            "extensions/models/",
            "extensions/reports/",
          ],
          cwd: projectDir,
          env,
          stdout: "piped",
          stderr: "piped",
        }).output();

        const testStdout = new TextDecoder().decode(testResult.stdout);
        const testStderr = new TextDecoder().decode(testResult.stderr);
        const combined = testStdout + testStderr;
        const { total, passing, failing, durationMs } = parseDenoTestOutput(combined);

        // Append lcov coverage data regardless of test outcome so partial coverage is captured
        const lcovResult = await new Deno.Command("deno", {
          args: ["coverage", coverageDir, "--lcov"],
          cwd: projectDir,
          env,
          stdout: "piped",
          stderr: "piped",
        }).output().catch(() => null);

        if (lcovResult && lcovResult.stdout.length > 0) {
          const lcovData = new TextDecoder().decode(lcovResult.stdout);
          await Deno.writeTextFile(lcovPath, lcovData, { append: true }).catch(() => {});
        }

        const passed = testResult.code === 0;
        const handle = await context.writeResource("testResult", "current", {
          passed,
          total,
          passing,
          failing,
          durationMs,
          ranAt,
        });

        if (!passed) {
          throw new Error(`Deno extension tests failed (${failing} failing):\n${combined}`);
        }

        return { dataHandles: [handle] };
      },
    },
  },
};
