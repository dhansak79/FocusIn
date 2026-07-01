/**
 * Development-time Cucumber runner for spec-gate verify flow.
 * Runs cucumber-js against all feature files and writes cucumber-report.json.
 *
 * @module
 */
import { z } from "npm:zod@4";

const GlobalArgsSchema = z.object({
  projectDir: z.string().describe("Absolute path to the FocusIn project root"),
});

type GlobalArgs = z.infer<typeof GlobalArgsSchema>;

const RunResultSchema = z.object({
  passed: z.boolean(),
  reportPath: z.string(),
  ranAt: z.string(),
  exitCode: z.number(),
  stderr: z.string(),
});

type WriteResourceFn = (
  specName: string,
  instanceName: string,
  data: Record<string, unknown>,
) => Promise<{ name: string }>;

export const model = {
  type: "@focusin/spec-runner",
  version: "2026.07.01.3",
  globalArguments: GlobalArgsSchema,
  resources: {
    runResult: {
      description: "Cucumber spec run result",
      schema: RunResultSchema,
      lifetime: "30d",
      garbageCollection: 20,
    },
  },
  methods: {
    run: {
      description: "Run cucumber-js against feature files and write cucumber-report.json",
      arguments: z.object({
        featuresGlob: z.string().optional().describe("Optional glob override; defaults to all features"),
      }),
      execute: async (
        { featuresGlob }: { featuresGlob?: string },
        context: { globalArgs: GlobalArgs; writeResource: WriteResourceFn },
      ) => {
        const { projectDir } = context.globalArgs;
        const ranAt = new Date().toISOString();
        const reportPath = `${projectDir}/cucumber-report.json`;
        const glob = featuresGlob ?? "tests/cucumber/features/**/*.feature";

        const { code, stderr } = await new Deno.Command("node", {
          args: [
            "node_modules/@cucumber/cucumber/bin/cucumber-js",
            glob,
            "--tags", "not @wip",
            "--format", `json:${reportPath}`,
            "--format", "progress",
          ],
          cwd: projectDir,
          stdout: "piped",
          stderr: "piped",
        }).output();

        const handle = await context.writeResource("runResult", "current", {
          passed: code === 0,
          reportPath,
          ranAt,
          exitCode: code,
          stderr: new TextDecoder().decode(stderr).slice(0, 2000),
        });

        return { dataHandles: [handle], reportPath };
      },
    },
  },
};
