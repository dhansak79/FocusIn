import { assertEquals, assertAlmostEquals } from "jsr:@std/assert";
import { aggregateScores, scoreMutants } from "./focusin_mutation.ts";

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
