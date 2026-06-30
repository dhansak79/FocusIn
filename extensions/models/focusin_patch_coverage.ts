/**
 * Patch coverage checker — verifies every staged added line is covered.
 * Reimplements scripts/check-patch-coverage.js logic in Deno.
 *
 * @module
 */
import { z } from "npm:zod@4";

const GlobalArgsSchema = z.object({
  projectDir: z.string().describe("Absolute path to the FocusIn project root"),
});

type GlobalArgs = z.infer<typeof GlobalArgsSchema>;

const PatchCoverageResultSchema = z.object({
  passed: z.boolean(),
  uncoveredLines: z.number(),
  ranAt: z.string(),
});

type WriteResourceFn = (
  specName: string,
  instanceName: string,
  data: Record<string, unknown>,
) => Promise<{ name: string }>;

function isBranchUncovered(taken: string): boolean {
  return taken === "0" || taken === "-";
}

function applyBranchLine(fileCov: Record<number, number>, line: string): void {
  const parts = line.slice(5).split(",");
  if (isBranchUncovered(parts[3])) fileCov[Number(parts[0])] = 0;
}

/** Parse lcov data into a map of { filePath: { lineNumber: hitCount } }.
 * BRDA entries downgrade partially-covered lines to 0 to match Codecov patch behaviour. */
export function parseLcov(raw: string): Record<string, Record<number, number>> {
  const coverage: Record<string, Record<number, number>> = {};
  let file: string | null = null;
  for (const line of raw.split("\n")) {
    if (line.startsWith("SF:")) {
      file = line.slice(3).trim();
      coverage[file] = {};
    } else if (line.startsWith("DA:") && file) {
      const [ln, hits] = line.slice(3).split(",");
      coverage[file][Number(ln)] = Number(hits);
    } else if (line.startsWith("BRDA:") && file) {
      applyBranchLine(coverage[file], line);
    }
  }
  return coverage;
}

function parseHunkStart(line: string): number | null {
  const m = line.match(/\+(\d+)/);
  if (!m) return null;
  return Number(m[1]);
}

function isAddedLine(line: string): boolean {
  return line.startsWith("+") && !line.startsWith("+++");
}

/** Parse git diff output into a map of { filePath: Set<addedLineNumber> }. */
export function parseStagedDiff(diff: string): Record<string, Set<number>> {
  const added: Record<string, Set<number>> = {};
  let cur: string | null = null;
  let lineNum: number | null = null;

  for (const line of diff.split("\n")) {
    if (line.startsWith("+++ b/")) {
      cur = line.slice(6).trim();
      added[cur] = new Set();
      lineNum = null;
      continue;
    }
    if (cur === null) continue;
    if (line.startsWith("@@")) {
      lineNum = parseHunkStart(line);
    } else if (isAddedLine(line) && lineNum !== null) {
      added[cur].add(lineNum++);
    }
  }
  return added;
}

/** Find staged added lines with zero coverage hits. Checks any file present in the lcov report,
 * matching Codecov patch behaviour exactly. Files absent from the lcov are silently skipped. */
export function findUncoveredLines(
  coverage: Record<string, Record<number, number>>,
  staged: Record<string, Set<number>>,
): { file: string; line: number }[] {
  const uncovered: { file: string; line: number }[] = [];
  for (const [f, lines] of Object.entries(staged)) {
    const fileCov = coverage[f];
    if (!fileCov) continue; // file not in lcov — skip (markdown, yaml, test files, etc.)

    for (const ln of lines) {
      if (ln in fileCov && fileCov[ln] === 0) {
        uncovered.push({ file: f, line: ln });
      }
    }
  }
  return uncovered;
}

export const model = {
  type: "@focusin/patch-coverage",
  version: "2026.06.27.1",
  globalArguments: GlobalArgsSchema,
  resources: {
    patchCoverageResult: {
      description: "Staged-diff patch coverage check results",
      schema: PatchCoverageResultSchema,
      lifetime: "30d",
      garbageCollection: 20,
    },
  },
  methods: {
    check: {
      description: "Check that every added line in the diff is hit by the coverage report",
      arguments: z.object({
        mode: z.enum(["staged", "branch"]).default("staged").describe(
          "staged: git diff --cached (pre-commit); branch: git diff main...HEAD (pre-push/CI)",
        ),
      }),
      execute: async (
        { mode }: { mode: "staged" | "branch" },
        context: { globalArgs: GlobalArgs; writeResource: WriteResourceFn },
      ) => {
        const { projectDir } = context.globalArgs;
        const ranAt = new Date().toISOString();
        const lcovPath = `${projectDir}/coverage/lcov.info`;

        // Read lcov — graceful pass if missing (e.g. first run before coverage job)
        let lcovRaw = "";
        try {
          lcovRaw = await Deno.readTextFile(lcovPath);
        } catch {
          // Missing lcov is treated as empty coverage
        }

        const diffArgs = mode === "branch"
          ? ["diff", "main...HEAD", "-U0"]
          : ["diff", "--cached", "-U0"];

        const diffResult = await new Deno.Command("git", {
          args: diffArgs,
          cwd: projectDir,
          stdout: "piped",
          stderr: "piped",
        }).output();

        const diff = new TextDecoder().decode(diffResult.stdout);

        // Strip projectDir prefix from lcov paths so they match diff paths
        const normalizedLcov = lcovRaw.replace(
          new RegExp(`^SF:${projectDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/`, "gm"),
          "SF:",
        );

        const coverage = parseLcov(normalizedLcov);
        const staged = parseStagedDiff(diff);
        const uncovered = findUncoveredLines(coverage, staged);

        const result = { passed: uncovered.length === 0, uncoveredLines: uncovered.length, ranAt };
        const handle = await context.writeResource("patchCoverageResult", "current", result);

        if (!result.passed) {
          const lines = uncovered.map((u) => `  UNCOVERED  ${u.file}:${u.line}`).join("\n");
          const hint = mode === "branch"
            ? "Add tests for the lines above — these are new lines on this branch vs main."
            : "Add tests for the lines above before committing.";
          throw new Error(
            `Patch coverage failed — ${uncovered.length} uncovered line(s):\n${lines}\n\n${hint}`,
          );
        }

        return { dataHandles: [handle] };
      },
    },
  },
};
