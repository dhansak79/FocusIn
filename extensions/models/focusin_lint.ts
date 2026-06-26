/**
 * ESLint runner for the FocusIn project.
 *
 * @module
 */
import { z } from "npm:zod@4";

const GlobalArgsSchema = z.object({
  projectDir: z.string().describe("Absolute path to the FocusIn project root"),
});

type GlobalArgs = z.infer<typeof GlobalArgsSchema>;

const LintResultSchema = z.object({
  passed: z.boolean(),
  issueCount: z.number(),
  ranAt: z.string(),
});

type WriteResourceFn = (
  specName: string,
  instanceName: string,
  data: Record<string, unknown>,
) => Promise<{ name: string }>;

/** Parse ESLint stdout to extract the total problem count. */
export function parseLintOutput(stdout: string): number {
  const m = stdout.match(/(\d+)\s+problem/);
  return m ? Number(m[1]) : 0;
}

/** Build the lintResult envelope. */
export function buildLintResult(
  issueCount: number,
  ranAt: string,
): z.infer<typeof LintResultSchema> {
  return { passed: issueCount === 0, issueCount, ranAt };
}

export const model = {
  type: "@focusin/lint",
  version: "2026.06.26.1",
  globalArguments: GlobalArgsSchema,
  resources: {
    lintResult: {
      description: "ESLint check results",
      schema: LintResultSchema,
      lifetime: "30d",
      garbageCollection: 20,
    },
  },
  methods: {
    check: {
      description: "Run npm run lint and store pass/fail result",
      arguments: z.object({}),
      execute: async (
        _args: Record<string, never>,
        context: { globalArgs: GlobalArgs; writeResource: WriteResourceFn },
      ) => {
        const { projectDir } = context.globalArgs;
        const ranAt = new Date().toISOString();

        const result = await new Deno.Command("npm", {
          args: ["run", "lint"],
          cwd: projectDir,
          stdout: "piped",
          stderr: "piped",
        }).output().catch((e: Error) => {
          throw new Error(`focusin-lint: npm not found or failed to start.\nDetails: ${e.message}`);
        });

        const stdout = new TextDecoder().decode(result.stdout);
        const stderr = new TextDecoder().decode(result.stderr);
        const issueCount = result.code !== 0 ? Math.max(parseLintOutput(stdout + stderr), 1) : 0;
        const lintResult = buildLintResult(issueCount, ranAt);

        const handle = await context.writeResource("lintResult", "current", lintResult);

        if (!lintResult.passed) {
          throw new Error(`Lint failed with ${issueCount} issue(s):\n${stdout}${stderr}`);
        }

        return { dataHandles: [handle] };
      },
    },
  },
};
