/**
 * Stryker mutation testing runner for the FocusIn project.
 *
 * @module
 */
import { z } from "npm:zod@4";

const GlobalArgsSchema = z.object({
  projectDir: z.string().describe("Absolute path to the FocusIn project root"),
});

type GlobalArgs = z.infer<typeof GlobalArgsSchema>;

const FileScoreSchema = z.object({
  path: z.string(),
  score: z.number(),
  killed: z.number(),
  survived: z.number(),
  noCoverage: z.number(),
  total: z.number(),
});

const MutationResultSchema = z.object({
  passed: z.boolean(),
  overallScore: z.number(),
  killed: z.number(),
  survived: z.number(),
  noCoverage: z.number(),
  total: z.number(),
  files: z.array(FileScoreSchema),
  ranAt: z.string(),
});

type WriteResourceFn = (
  specName: string,
  instanceName: string,
  data: Record<string, unknown>,
) => Promise<{ name: string }>;

type StrykerFile = {
  mutants: Array<{ status: string }>;
};

type FileScore = z.infer<typeof FileScoreSchema>;

/** Score a single file's mutants: killed+timeout count as killed. */
export function scoreMutants(path: string, mutants: StrykerFile["mutants"]): FileScore {
  const killed = mutants.filter((m) => m.status === "Killed" || m.status === "Timeout").length;
  const survived = mutants.filter((m) => m.status === "Survived").length;
  const noCoverage = mutants.filter((m) => m.status === "NoCoverage").length;
  const total = mutants.length;
  return { path, score: total ? (killed / total) * 100 : 100, killed, survived, noCoverage, total };
}

/** Aggregate per-file scores into overall totals. */
export function aggregateScores(files: FileScore[]): { overallScore: number; killed: number; survived: number; noCoverage: number; total: number } {
  const killed = files.reduce((s, f) => s + f.killed, 0);
  const survived = files.reduce((s, f) => s + f.survived, 0);
  const noCoverage = files.reduce((s, f) => s + f.noCoverage, 0);
  const total = files.reduce((s, f) => s + f.total, 0);
  return { overallScore: total ? (killed / total) * 100 : 0, killed, survived, noCoverage, total };
}

export const model = {
  type: "@focusin/mutation",
  version: "2026.06.23.1",
  globalArguments: GlobalArgsSchema,
  resources: {
    result: {
      description: "Stryker mutation test results with per-file scores",
      schema: MutationResultSchema,
      lifetime: "30d",
      garbageCollection: 20,
    },
  },
  methods: {
    run: {
      description:
        "Run Stryker mutation testing and store per-file scores (slow: 5–30 min)",
      arguments: z.object({}),
      execute: async (
        _args: Record<string, never>,
        context: { globalArgs: GlobalArgs; writeResource: WriteResourceFn },
      ) => {
        const { projectDir } = context.globalArgs;
        const ranAt = new Date().toISOString();

        const { code } = await new Deno.Command("npm", {
          args: ["run", "mutate"],
          cwd: projectDir,
          stdout: "piped",
          stderr: "piped",
        }).output();

        const reportPath = `${projectDir}/reports/mutation/mutation.json`;
        let overallScore = 0, killed = 0, survived = 0, noCoverage = 0, total = 0;
        const files: FileScore[] = [];

        try {
          const data = JSON.parse(await Deno.readTextFile(reportPath)) as {
            files: Record<string, StrykerFile>;
          };
          for (const [filepath, fileData] of Object.entries(data.files)) {
            files.push(scoreMutants(filepath, fileData.mutants));
          }
          ({ overallScore, killed, survived, noCoverage, total } = aggregateScores(files));
        } catch {
          // mutation report not generated
        }

        const handle = await context.writeResource("result", "current", {
          passed: code === 0,
          overallScore,
          killed,
          survived,
          noCoverage,
          total,
          files,
          ranAt,
        });

        if (code !== 0) throw new Error(`Mutation testing failed: score ${overallScore.toFixed(1)}% (${killed}/${total} mutants killed)`);
        return { dataHandles: [handle] };
      },
    },
  },
};
