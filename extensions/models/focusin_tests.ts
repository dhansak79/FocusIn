/**
 * Vitest test and coverage runner for the FocusIn project.
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

const CoverageResultSchema = z.object({
  passed: z.boolean(),
  lines: z.number(),
  functions: z.number(),
  branches: z.number(),
  statements: z.number(),
  ranAt: z.string(),
});

type WriteResourceFn = (
  specName: string,
  instanceName: string,
  data: Record<string, unknown>,
) => Promise<{ name: string }>;

type CoverageMetrics = { lines: number; functions: number; branches: number; statements: number };

/** Parse vitest JSON reporter output into test counts. */
export function parseVitestOutput(raw: string): { total: number; passing: number; failing: number } {
  try {
    const r = JSON.parse(raw);
    return { total: r.numTotalTests ?? 0, passing: r.numPassedTests ?? 0, failing: r.numFailedTests ?? 0 };
  } catch {
    return { total: 0, passing: 0, failing: 0 };
  }
}

export async function readCoverageMetrics(projectDir: string): Promise<CoverageMetrics> {
  try {
    const raw = await Deno.readTextFile(`${projectDir}/coverage/coverage-summary.json`);
    const total = JSON.parse(raw).total ?? {};
    return {
      lines: total.lines?.pct ?? 0,
      functions: total.functions?.pct ?? 0,
      branches: total.branches?.pct ?? 0,
      statements: total.statements?.pct ?? 0,
    };
  } catch {
    return { lines: 0, functions: 0, branches: 0, statements: 0 };
  }
}

export const model = {
  type: "@focusin/tests",
  version: "2026.06.23.1",
  globalArguments: GlobalArgsSchema,
  resources: {
    testResult: {
      description: "Vitest test run results",
      schema: TestResultSchema,
      lifetime: "30d",
      garbageCollection: 20,
    },
    coverageResult: {
      description: "Vitest coverage results against configured thresholds",
      schema: CoverageResultSchema,
      lifetime: "30d",
      garbageCollection: 20,
    },
  },
  methods: {
    test: {
      description: "Run vitest and cucumber-js (not @wip), store pass/fail counts",
      arguments: z.object({}),
      execute: async (
        _args: Record<string, never>,
        context: { globalArgs: GlobalArgs; writeResource: WriteResourceFn },
      ) => {
        const { projectDir } = context.globalArgs;
        const ranAt = new Date().toISOString();
        const outputFile = `${projectDir}/.swamp/vitest-out-${Date.now()}.json`;

        const start = Date.now();
        const vitestResult = await new Deno.Command("npx", {
          args: ["vitest", "run", "--reporter=json", `--outputFile=${outputFile}`],
          cwd: projectDir,
          stdout: "piped",
          stderr: "piped",
        }).output();

        const cucumberResult = await new Deno.Command("node", {
          args: [
            "node_modules/@cucumber/cucumber/bin/cucumber-js",
            "--tags", "not @wip",
            "--format", "progress",
          ],
          cwd: projectDir,
          stdout: "piped",
          stderr: "piped",
        }).output();

        const durationMs = Date.now() - start;
        const code = vitestResult.code === 0 && cucumberResult.code === 0 ? 0 : 1;

        let total = 0, passing = 0, failing = 0;
        try {
          const raw = await Deno.readTextFile(outputFile);
          await Deno.remove(outputFile).catch(() => {});
          ({ total, passing, failing } = parseVitestOutput(raw));
        } catch {
          failing = vitestResult.code !== 0 ? 1 : 0;
        }
        if (cucumberResult.code !== 0) failing += 1;

        const handle = await context.writeResource("testResult", "current", {
          passed: code === 0,
          total,
          passing,
          failing,
          durationMs,
          ranAt,
        });

        if (code !== 0) throw new Error(`Tests failed: ${failing} failing out of ${total}`);
        return { dataHandles: [handle] };
      },
    },
    coverage: {
      description: "Run vitest with coverage and store percentage results",
      arguments: z.object({}),
      execute: async (
        _args: Record<string, never>,
        context: { globalArgs: GlobalArgs; writeResource: WriteResourceFn },
      ) => {
        const { projectDir } = context.globalArgs;
        const ranAt = new Date().toISOString();

        const { code } = await new Deno.Command("npm", {
          args: [
            "run", "coverage", "--",
            "--coverage.reporter=json-summary",
            "--coverage.reporter=text",
            "--coverage.reporter=lcov",
          ],
          cwd: projectDir,
          stdout: "piped",
          stderr: "piped",
        }).output();

        const metrics = await readCoverageMetrics(projectDir);

        const handle = await context.writeResource("coverageResult", "current", {
          passed: code === 0,
          ...metrics,
          ranAt,
        });

        if (code !== 0) throw new Error(`Coverage run failed (exit ${code})`);
        return { dataHandles: [handle] };
      },
    },
  },
};
