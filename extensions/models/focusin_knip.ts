/**
 * Knip dead-code checker runner for the FocusIn project.
 *
 * @module
 */
import { z } from "npm:zod@4";

const GlobalArgsSchema = z.object({
  projectDir: z.string().describe("Absolute path to the FocusIn project root"),
});

type GlobalArgs = z.infer<typeof GlobalArgsSchema>;

const KnipResultSchema = z.object({
  passed: z.boolean(),
  issueCount: z.number(),
  ranAt: z.string(),
});

type WriteResourceFn = (
  specName: string,
  instanceName: string,
  data: Record<string, unknown>,
) => Promise<{ name: string }>;

/**
 * Parse knip stdout to count total issues.
 * Knip section headers use `(N)` suffixes, e.g. "Unused files (2)".
 * Sum all such counts to get the total.
 */
export function parseKnipOutput(stdout: string): number {
  let total = 0;
  for (const m of stdout.matchAll(/\((\d+)\)/g)) {
    total += Number(m[1]);
  }
  return total;
}

/** Build the knipResult envelope. */
export function buildKnipResult(
  issueCount: number,
  ranAt: string,
): z.infer<typeof KnipResultSchema> {
  return { passed: issueCount === 0, issueCount, ranAt };
}

export const model = {
  type: "@focusin/knip",
  version: "2026.06.26.1",
  globalArguments: GlobalArgsSchema,
  resources: {
    knipResult: {
      description: "Knip dead code check results",
      schema: KnipResultSchema,
      lifetime: "30d",
      garbageCollection: 20,
    },
  },
  methods: {
    check: {
      description: "Run npm run knip and store pass/fail result",
      arguments: z.object({}),
      execute: async (
        _args: Record<string, never>,
        context: { globalArgs: GlobalArgs; writeResource: WriteResourceFn },
      ) => {
        const { projectDir } = context.globalArgs;
        const ranAt = new Date().toISOString();

        const result = await new Deno.Command("npm", {
          args: ["run", "knip"],
          cwd: projectDir,
          stdout: "piped",
          stderr: "piped",
        }).output().catch((e: Error) => {
          throw new Error(`focusin-knip: npm not found or failed to start.\nDetails: ${e.message}`);
        });

        const stdout = new TextDecoder().decode(result.stdout);
        const stderr = new TextDecoder().decode(result.stderr);
        const rawCount = parseKnipOutput(stdout + stderr);
        const issueCount = result.code !== 0 ? Math.max(rawCount, 1) : 0;
        const knipResult = buildKnipResult(issueCount, ranAt);

        const handle = await context.writeResource("knipResult", "current", knipResult);

        if (!knipResult.passed) {
          throw new Error(`Knip failed with ${issueCount} issue(s):\n${stdout}${stderr}`);
        }

        return { dataHandles: [handle] };
      },
    },
  },
};
