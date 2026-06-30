/**
 * CodeScene cs delta health check runner for the FocusIn project.
 *
 * @module
 */
import { z } from "npm:zod@4";

const GlobalArgsSchema = z.object({
  projectDir: z.string().describe("Absolute path to the FocusIn project root"),
  excludePaths: z
    .array(z.string())
    .optional()
    .describe("Path prefixes to exclude from health check results"),
});

type GlobalArgs = z.infer<typeof GlobalArgsSchema>;

const DegradedFileSchema = z.object({
  name: z.string(),
  oldScore: z.number().nullable(),
  newScore: z.number(),
  findings: z.array(z.unknown()),
});

const HealthResultSchema = z.object({
  passed: z.boolean(),
  failedFiles: z.number(),
  ranAt: z.string(),
  files: z.array(DegradedFileSchema),
});

type WriteResourceFn = (
  specName: string,
  instanceName: string,
  data: Record<string, unknown>,
) => Promise<{ name: string }>;

type DegradedFile = z.infer<typeof DegradedFileSchema>;

type CsDeltaRaw = {
  name: string;
  "old-score": number | null;
  "new-score": number;
  findings: unknown[];
};

/**
 * Parse raw cs delta JSON output, mapping kebab-case field names to camelCase.
 * cs delta only emits files that have introduced new findings — passing files are absent.
 * Tolerates version-check lines before the JSON array in stdout.
 */
export function parseDeltaOutput(raw: string): DegradedFile[] {
  const jsonStart = raw.indexOf("[");
  if (jsonStart === -1) return [];
  try {
    const arr = JSON.parse(raw.slice(jsonStart)) as CsDeltaRaw[];
    return arr.map((f) => {
      const entry = f as CsDeltaRaw;
      return {
        name: entry.name,
        oldScore: entry["old-score"],
        newScore: entry["new-score"],
        findings: Array.isArray(entry.findings) ? entry.findings : [],
      };
    });
  } catch {
    return [];
  }
}

/** Build the environment for the cs command, extending PATH with ~/.local/bin. */
export function buildCommandEnv(
  base: Record<string, string | undefined>,
): Record<string, string> {
  const home = base.HOME ?? "";
  const path = base.PATH ?? "";
  return {
    ...(base as Record<string, string>),
    PATH: `${home}/.local/bin:${path}`,
    CS_DISABLE_VERSION_CHECK: "1",
  };
}

/** Build the healthResult envelope from the list of degraded files. */
export function buildHealthResult(
  files: DegradedFile[],
  ranAt: string,
): z.infer<typeof HealthResultSchema> {
  return {
    passed: files.length === 0,
    failedFiles: files.length,
    ranAt,
    files,
  };
}

export const model = {
  type: "@focusin/codescene",
  version: "2026.06.26.1",
  globalArguments: GlobalArgsSchema,
  resources: {
    healthResult: {
      description: "CodeScene cs delta branch health check results",
      schema: HealthResultSchema,
      lifetime: "30d",
      garbageCollection: 20,
    },
  },
  methods: {
    check: {
      description: "Run cs delta main against the current branch and store degraded file scores",
      arguments: z.object({}),
      execute: async (
        _args: Record<string, never>,
        context: { globalArgs: GlobalArgs; writeResource: WriteResourceFn },
      ) => {
        const { projectDir } = context.globalArgs;
        const ranAt = new Date().toISOString();

        const env = buildCommandEnv(Deno.env.toObject());

        const result = await new Deno.Command("cs", {
          args: ["delta", "main", "--output-format", "json"],
          cwd: projectDir,
          env,
          stdout: "piped",
          stderr: "piped",
        }).output().catch((e: Error) => {
          throw new Error(
            "CodeScene health gate: cs is not installed.\n" +
              "Follow the guidance at https://codescene.io/docs/cli/index.html to install it.\n" +
              `Details: ${e.message}`,
          );
        });

        const raw = new TextDecoder().decode(result.stdout);
        const { excludePaths = [] } = context.globalArgs;
        const files = parseDeltaOutput(raw).filter(
          (f) => !excludePaths.some((p) => f.name.startsWith(p)),
        );
        const health = buildHealthResult(files, ranAt);

        const handle = await context.writeResource("healthResult", "current", health);

        if (!health.passed) {
          const names = health.files
            .map((f) => `  ${projectDir}/${f.name}  (${f.newScore}/10)`)
            .join("\n");
          throw new Error(
            `CodeScene health gate failed — ${health.failedFiles} file(s) introduced degradations:\n${names}\n\n` +
              "REQUIRED: Call the CodeScene MCP tool `code_health_review` on each file above\n" +
              "before attempting any fixes. Do not reason about or propose solutions without\n" +
              "first inspecting the tool output.\n\n" +
              "After reviewing all files, apply the `guiding-refactoring-with-code-health` skill.",
          );
        }

        return { dataHandles: [handle] };
      },
    },
  },
};
