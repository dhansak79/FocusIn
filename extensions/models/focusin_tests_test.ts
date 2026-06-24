import { assertEquals } from "jsr:@std/assert";
import { parseVitestOutput, readCoverageMetrics } from "./focusin_tests.ts";

Deno.test("parseVitestOutput: parses valid JSON reporter output", () => {
  const raw = JSON.stringify({ numTotalTests: 10, numPassedTests: 9, numFailedTests: 1 });
  assertEquals(parseVitestOutput(raw), { total: 10, passing: 9, failing: 1 });
});

Deno.test("parseVitestOutput: returns zeros for invalid JSON", () => {
  assertEquals(parseVitestOutput("not json"), { total: 0, passing: 0, failing: 0 });
  assertEquals(parseVitestOutput(""), { total: 0, passing: 0, failing: 0 });
});

Deno.test("parseVitestOutput: returns zeros for missing fields", () => {
  assertEquals(parseVitestOutput("{}"), { total: 0, passing: 0, failing: 0 });
});

Deno.test("parseVitestOutput: all tests passed", () => {
  const raw = JSON.stringify({ numTotalTests: 640, numPassedTests: 640, numFailedTests: 0 });
  assertEquals(parseVitestOutput(raw), { total: 640, passing: 640, failing: 0 });
});

Deno.test("readCoverageMetrics: reads from coverage-summary.json", async () => {
  const dir = await Deno.makeTempDir();
  const coverageDir = `${dir}/coverage`;
  await Deno.mkdir(coverageDir);
  await Deno.writeTextFile(`${coverageDir}/coverage-summary.json`, JSON.stringify({
    total: { lines: { pct: 95 }, functions: { pct: 88 }, branches: { pct: 91 }, statements: { pct: 93 } },
  }));
  const result = await readCoverageMetrics(dir);
  assertEquals(result, { lines: 95, functions: 88, branches: 91, statements: 93 });
  await Deno.remove(dir, { recursive: true });
});

Deno.test("readCoverageMetrics: returns zeros when file missing", async () => {
  const result = await readCoverageMetrics("/nonexistent/path");
  assertEquals(result, { lines: 0, functions: 0, branches: 0, statements: 0 });
});

Deno.test("readCoverageMetrics: returns zeros for malformed JSON", async () => {
  const dir = await Deno.makeTempDir();
  const coverageDir = `${dir}/coverage`;
  await Deno.mkdir(coverageDir);
  await Deno.writeTextFile(`${coverageDir}/coverage-summary.json`, "bad json");
  const result = await readCoverageMetrics(dir);
  assertEquals(result, { lines: 0, functions: 0, branches: 0, statements: 0 });
  await Deno.remove(dir, { recursive: true });
});
