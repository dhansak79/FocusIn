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
  version: "2026.07.24.2",
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

        // Uses cucumber.spec-gate.mjs, not the repo's default cucumber.mjs:
        // that default sets tags: "not @wip" for day-to-day `npm run bdd`
        // runs, but a scenario newly marked @wip by generate-features
        // (status still "pending" — see buildFeatureFile in spec_change.ts)
        // must actually execute here so record-results can see a real
        // outcome for it. Excluding @wip would permanently strand every
        // scenario at "pending", since it would never appear in the report
        // to record. record-results only updates entries matching the
        // current change's scenario names, so any unrelated in-progress
        // @wip scenario elsewhere in the repo is unaffected either way.
        const { code, stderr } = await new Deno.Command("node", {
          args: [
            "node_modules/@cucumber/cucumber/bin/cucumber-js",
            glob,
            "--config", "cucumber.spec-gate.mjs",
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
