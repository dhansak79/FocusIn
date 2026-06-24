import { assertEquals } from "jsr:@std/assert";
import { parseSpecCoverageOutput } from "./focusin_spec_coverage.ts";

Deno.test("parseSpecCoverageOutput: parses valid summary line", () => {
  const output = "Checking specs...\nSummary: 7 / 10 scenarios covered\nDone.";
  assertEquals(parseSpecCoverageOutput(output), { covered: 7, total: 10 });
});

Deno.test("parseSpecCoverageOutput: full coverage", () => {
  const output = "Summary: 10 / 10 scenarios covered";
  assertEquals(parseSpecCoverageOutput(output), { covered: 10, total: 10 });
});

Deno.test("parseSpecCoverageOutput: zero coverage", () => {
  const output = "Summary: 0 / 5 scenarios covered";
  assertEquals(parseSpecCoverageOutput(output), { covered: 0, total: 5 });
});

Deno.test("parseSpecCoverageOutput: no match returns zeros", () => {
  assertEquals(parseSpecCoverageOutput(""), { covered: 0, total: 0 });
  assertEquals(parseSpecCoverageOutput("No summary here"), { covered: 0, total: 0 });
});

Deno.test("parseSpecCoverageOutput: handles extra whitespace", () => {
  const output = "Summary:   3  /  8  scenarios covered";
  assertEquals(parseSpecCoverageOutput(output), { covered: 3, total: 8 });
});
