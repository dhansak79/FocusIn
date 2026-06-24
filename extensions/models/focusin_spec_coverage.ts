/**
 * Spec scenario boundary-test coverage checker for the FocusIn project.
 *
 * @module
 */
import { z } from "npm:zod@4";

const GlobalArgsSchema = z.object({
  projectDir: z.string().describe("Absolute path to the FocusIn project root"),
});

type GlobalArgs = z.infer<typeof GlobalArgsSchema>;

const SpecCoverageResultSchema = z.object({
  passed: z.boolean(),
  covered: z.number(),
  total: z.number(),
  pct: z.number(),
  ranAt: z.string(),
});

type WriteResourceFn = (
  specName: string,
  instanceName: string,
  data: Record<string, unknown>,
) => Promise<{ name: string }>;

/** Parse "Summary: N / M scenarios covered" from spec-coverage script stdout. */
export function parseSpecCoverageOutput(output: string): { covered: number; total: number } {
  const match = output.match(/Summary:\s+(\d+)\s*\/\s*(\d+)\s+scenarios covered/);
  if (!match) return { covered: 0, total: 0 };
  return { covered: parseInt(match[1], 10), total: parseInt(match[2], 10) };
}

export const model = {
  type: "@focusin/spec-coverage",
  version: "2026.06.23.1",
  globalArguments: GlobalArgsSchema,
  resources: {
    result: {
      description: "Spec scenario boundary-test coverage results",
      schema: SpecCoverageResultSchema,
      lifetime: "30d",
      garbageCollection: 20,
    },
  },
  methods: {
    run: {
      description: "Check which spec scenarios have boundary tests and store coverage",
      arguments: z.object({}),
      execute: async (
        _args: Record<string, never>,
        context: { globalArgs: GlobalArgs; writeResource: WriteResourceFn },
      ) => {
        const { projectDir } = context.globalArgs;
        const ranAt = new Date().toISOString();

        const { code, stdout } = await new Deno.Command("node", {
          args: ["scripts/spec-coverage.js"],
          cwd: projectDir,
          stdout: "piped",
          stderr: "piped",
        }).output();

        const output = new TextDecoder().decode(stdout);
        const { covered, total } = parseSpecCoverageOutput(output);
        const pct = total > 0 ? (covered / total) * 100 : 100;

        const handle = await context.writeResource("result", "current", {
          passed: code === 0,
          covered,
          total,
          pct,
          ranAt,
        });

        return { dataHandles: [handle] };
      },
    },
  },
};
