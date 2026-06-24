import { assertEquals, assertAlmostEquals } from "jsr:@std/assert";
import { aggregateScores, model, scoreMutants } from "./focusin_mutation.ts";

type MockOutput = { code: number; stdout: Uint8Array; stderr: Uint8Array };

function withMockCommand(
  factory: () => { output: () => Promise<MockOutput> },
  fn: () => Promise<void>,
): Promise<void> {
  const saved = Deno.Command;
  // deno-lint-ignore no-explicit-any
  (Deno as any).Command = class { output() { return factory().output(); } };
  return fn().finally(() => { (Deno as any).Command = saved; });
}

Deno.test("scoreMutants: killed and timeout both count as killed", () => {
  const mutants = [
    { status: "Killed" },
    { status: "Timeout" },
    { status: "Survived" },
    { status: "NoCoverage" },
  ];
  const result = scoreMutants("src/foo.ts", mutants);
  assertEquals(result.path, "src/foo.ts");
  assertEquals(result.killed, 2);
  assertEquals(result.survived, 1);
  assertEquals(result.noCoverage, 1);
  assertEquals(result.total, 4);
  assertAlmostEquals(result.score, 50);
});

Deno.test("scoreMutants: all killed gives score 100", () => {
  const mutants = [{ status: "Killed" }, { status: "Timeout" }];
  const result = scoreMutants("src/bar.ts", mutants);
  assertAlmostEquals(result.score, 100);
  assertEquals(result.survived, 0);
});

Deno.test("scoreMutants: empty mutants gives score 100", () => {
  const result = scoreMutants("src/empty.ts", []);
  assertEquals(result.score, 100);
  assertEquals(result.total, 0);
});

Deno.test("aggregateScores: sums across files correctly", () => {
  const files = [
    { path: "a.ts", score: 75, killed: 3, survived: 1, noCoverage: 0, total: 4 },
    { path: "b.ts", score: 50, killed: 1, survived: 1, noCoverage: 0, total: 2 },
  ];
  const result = aggregateScores(files);
  assertEquals(result.killed, 4);
  assertEquals(result.survived, 2);
  assertEquals(result.noCoverage, 0);
  assertEquals(result.total, 6);
  assertAlmostEquals(result.overallScore, (4 / 6) * 100);
});

Deno.test("aggregateScores: empty files gives zero overallScore", () => {
  const result = aggregateScores([]);
  assertEquals(result.overallScore, 0);
  assertEquals(result.total, 0);
});

Deno.test("aggregateScores: sums noCoverage correctly", () => {
  const files = [
    { path: "a.ts", score: 0, killed: 0, survived: 0, noCoverage: 3, total: 3 },
  ];
  const result = aggregateScores(files);
  assertEquals(result.noCoverage, 3);
  assertEquals(result.overallScore, 0);
});

Deno.test("model.run.execute: reads mutation report and writes correct resource", async () => {
  const dir = await Deno.makeTempDir();
  const reportDir = `${dir}/reports/mutation`;
  await Deno.mkdir(reportDir, { recursive: true });
  await Deno.writeTextFile(`${reportDir}/mutation.json`, JSON.stringify({
    files: {
      "src/feed.js": {
        mutants: [{ status: "Killed" }, { status: "Survived" }, { status: "Timeout" }],
      },
    },
  }));

  const written: Record<string, unknown>[] = [];
  const ctx = {
    globalArgs: { projectDir: dir },
    writeResource: async (_s: string, _i: string, data: Record<string, unknown>) => {
      written.push(data);
      return { name: "result/current" };
    },
  };

  await withMockCommand(
    () => ({ output: async () => ({ code: 0, stdout: new Uint8Array(), stderr: new Uint8Array() }) }),
    async () => {
      await model.methods.run.execute({}, ctx as never);
      assertEquals(written[0].killed, 2);
      assertEquals(written[0].survived, 1);
      assertEquals(written[0].total, 3);
      assertAlmostEquals(written[0].overallScore as number, (2 / 3) * 100);
      assertEquals(written[0].passed, true);
    },
  );

  await Deno.remove(dir, { recursive: true });
});

Deno.test("model.run.execute: handles missing mutation report gracefully", async () => {
  const written: Record<string, unknown>[] = [];
  const ctx = {
    globalArgs: { projectDir: "/nonexistent-dir-abc123" },
    writeResource: async (_s: string, _i: string, data: Record<string, unknown>) => {
      written.push(data);
      return { name: "result/current" };
    },
  };

  await withMockCommand(
    () => ({ output: async () => ({ code: 1, stdout: new Uint8Array(), stderr: new Uint8Array() }) }),
    async () => {
      await model.methods.run.execute({}, ctx as never);
      assertEquals(written[0].overallScore, 0);
      assertEquals(written[0].total, 0);
      assertEquals(written[0].passed, false);
    },
  );
});
