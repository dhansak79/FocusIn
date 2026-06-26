## Context

The CodeScene `cs review` health check currently runs as a plain Node.js script (`scripts/check-codescene-health.js`) invoked from `.githooks/pre-commit`. It checks each staged file, logs any findings to stderr, and exits non-zero if any file scores below 10. Because it runs outside swamp, its results are never stored — there is no way to answer "how often did this gate block a commit, and what issues triggered it?"

The `quality-gate` swamp workflow (triggered by `.githooks/pre-push`) already captures structured output from spec-coverage, tests, coverage, and mutation steps, making every run queryable. Moving the CodeScene check into this workflow gives it the same treatment for free.

Key constraint: the current script checks *staged* files using `cs review` per-file. At pre-push time there are no staged files. The replacement uses `cs delta main` — the CodeScene CLI's built-in branch-comparison command — which handles file selection, scoring, and finding extraction in a single call.

This is a **branch-level health regression gate**, not a per-commit gate. If a branch degrades health in commit 1 but restores it by commit 3, the gate passes at push time even though commit 1 was unhealthy in isolation. The pre-commit script would have caught commit 1. This is an intentional, documented trade-off: the gate ensures no unhealthy code reaches origin, not that every intermediate commit is healthy.

## Goals / Non-Goals

**Goals:**
- Capture structured codescene health results (file, score, findings) as swamp data on every push
- Enable historical queries: failure rate, recurring issues, files that frequently fail
- Remove `check-codescene-health.js` from the pre-commit hook (reducing pre-commit latency)
- Keep the gate logic equivalent: any branch that introduces a health degradation fails the job

**Non-Goals:**
- Real-time per-commit tracking (moving to pre-push means checking branch-level changes, not per-commit)
- Changing the minimum health threshold (remains 10.0)
- Modifying the existing quality-gate job topology (mutation still runs last)

## Decisions

### New extension model: `focusin_codescene.ts`

**Decision**: Create a new extension model `@focusin/codescene` following the same pattern as `focusin_mutation.ts` and `focusin_tests.ts`.

**Why**: The existing models are standalone per-tool wrappers. CodeScene is a separate tool (the `cs` CLI) with its own result schema, so a dedicated model is the right unit. There is no existing `@focusin/codescene` model to extend.

**Alternative considered**: Add a `codescene` method to `focusin_tests.ts`. Rejected — mixing concerns; the tests model is scoped to vitest.

---

### Use `cs delta main` instead of `cs review` per-file

**Decision**: Run `cs delta main --output-format json` as a single command rather than iterating changed files and calling `cs review` per-file.

**Why**: `cs delta` is the purpose-built CLI command for git-workflow delta analysis. It handles file selection, per-file scoring, and finding extraction in one call. Verified against real output: the JSON is an array of file objects, each with `name`, `old-score`, `new-score`, and `findings[]`. No manual file iteration or git diff plumbing needed in the extension model.

**Semantics**: `cs delta main` catches any branch that leaves a file worse than it found it. All 17 source files currently score 10.0 (verified), so any introduced finding signals a drop below 10.0. New files with issues are fully flagged. This is a branch-level gate — intermediate commits that degrade and then recover are not caught. See Context for the explicit trade-off.

**Important — output-only-on-degradation**: `cs delta` only includes a file in its JSON output if that file has new findings. A clean modified file (no degradation) does not appear in the output. Verified by spike: modifying `utils.js` without introducing issues produced no entry for it in the output. This means `files.length` is always equal to the number of degraded files.

**Alternative considered**: `cs review` per-file with `git diff main --name-only`. Rejected — more complex, more code, and `cs delta` already does this correctly.

---

### Kebab-case field name mapping

**Decision**: The extension model must explicitly map `cs delta` output field names to camelCase when building the stored schema. `cs delta` uses `"old-score"` and `"new-score"` (kebab-case). JavaScript property access via dot notation or typed interfaces silently returns `undefined` for hyphenated keys — this would fail Zod validation at runtime without a compile error.

**Implementation rule**: always use bracket notation: `f['old-score']` and `f['new-score']`. Never cast the raw parsed JSON to a TypeScript interface that uses camelCase field names.

**`old-score` null vs absent**: confirmed from spike that `old-score` is explicitly `"old-score": null` (JSON null, not omitted) for new files. `z.number().nullable()` is correct; `z.number().nullish()` is not needed.

---

### Placement in the workflow: step in the `check` job

**Decision**: Add `codescene-health` as a third step alongside `spec-coverage` and `tests` in the existing `check` job.

**Why**: The check is fast (single `cs delta` call), has no dependency on other steps, and belongs logically with the first-pass quality checks. Adding it as a sibling step keeps the job topology flat.

**Alternative considered**: New top-level job that runs before `check` (fail-fast). Rejected — the check is fast enough that it doesn't justify restructuring the DAG, and it adds a dependency edge that makes the workflow harder to read.

---

### Result schema: envelope + per-file degradation records

**Decision**: Store an envelope with `passed` and `failedFiles` derived from the `cs delta` output array, with typed per-file fields for `name`, `oldScore`, `newScore`, and opaque `findings`.

**Why `checkedFiles` is omitted**: `cs delta` only emits files with new findings (verified by spike — clean modifications do not appear). `files.length` therefore always equals `failedFiles`. A `checkedFiles` field cannot be independently derived from `cs delta` output without a separate `git diff` call, which adds complexity for minimal value. Omitting it avoids a misleading field that would always equal `failedFiles`.

**Why per-file `passed` is omitted**: since `cs delta` only returns degraded files, any file in the array implicitly has `passed: false`. A per-file `passed` field would always be `false` and is therefore redundant.

**Why `findings` stays opaque**: querying into finding categories is a future concern. `name` and `newScore` at the file level are sufficient to answer "which file degraded most often."

Actual `cs delta` JSON shape (confirmed from live spike runs):
```json
[
  {
    "name": "src/stats.js",
    "old-score": 10.0,
    "new-score": 8.54,
    "findings": [
      {
        "category": "Complex Method",
        "change-type": "introduced",
        "new-pp": 1.0,
        "threshold": 9,
        "change-details": [
          {
            "description": "processSignalMatrix has a cyclomatic complexity of 10",
            "value": 10,
            "locations": [{ "start-line": 148, "end-line": 171, "function": "processSignalMatrix" }]
          }
        ]
      }
    ]
  }
]
```

`old-score` is `null` (explicit JSON null) for new files, numeric for modified files. Empty array when no files degraded vs. `main`.

The stored `healthResult` resource:
```
{
  passed: boolean,           // files.length === 0 (no degraded files)
  failedFiles: number,       // files.length
  ranAt: string,
  files: Array<{
    name: string,            // queryable: "which file degraded most?"
    oldScore: number | null, // null for new files; mapped from f['old-score']
    newScore: number,        // queryable: "what score did it land at?"; mapped from f['new-score']
    findings: unknown[]      // raw cs delta findings array, opaque for now
  }>
}
```

---

### `cs` binary availability

The extension model must check for the `cs` binary before running and emit a clear error if it is not found. The current `check-codescene-health.js` already does this and prepends `~/.local/bin` to PATH (where `cs` is installed on this machine). The extension model must replicate both behaviours:

1. Extend PATH to include `~/.local/bin` before spawning `cs`.
2. Check that `cs` is reachable; if not, fail with a message matching the current script's message.

This is critical because swamp model methods run in a Deno subprocess that inherits PATH at workflow-run time — not the user's interactive shell PATH — and `~/.local/bin` may not be present. A missing `cs` binary with `allowFailure: true` would silently produce no `healthResult` output, which could look identical to a valid "no degradations" result.

## Risks / Trade-offs

- **`cs` CLI must be installed**: same dependency as the current pre-commit script. Method logs a clear error and exits if `cs` is not found. PATH must be extended to include `~/.local/bin`.
- **Pre-push runs later than pre-commit**: the gate now fires on `git push` instead of `git commit`. A developer could make several local commits that introduce health issues before being blocked. Acceptable trade-off: the gate still blocks code from leaving the machine.
- **Branch base assumption**: hardcoded diff against `main`. If contributors work from non-`main` base branches this could miss or double-count files. Low risk for this single-contributor project; can be parameterised later via a globalArgument.

## Rollout and migration sequence

The rollout and pre-commit cleanup are a single ordered sequence. Do not skip ahead.

**Phase 1 — Deploy the workflow step (allowFailure: true)**
1. Add `extensions/models/focusin_codescene.ts` with the `@focusin/codescene` model and `check` method.
2. Provision the model: `swamp model create @focusin/codescene focusin-codescene --arg projectDir=<path>`.
3. Update `workflows/workflow-adb5a2c2-eee7-4dbb-a708-86c7f53cd81a.yaml` — add `codescene-health` step to the `check` job with `allowFailure: true`.
4. Run `swamp workflow run quality-gate` and confirm the `codescene-health` step appears in output and writes a `healthResult` resource with a valid `ranAt` field.

**Phase 2 — Graduation (allowFailure → false)**

Flip `allowFailure` to `false` when **all** of the following are true:
1. Three consecutive workflow runs complete with the `codescene-health` step writing a valid `healthResult` resource (confirms `cs` binary is accessible).
2. At least one run has been observed where a branch with introduced degradations was correctly flagged (`failedFiles > 0`), OR the step has been running cleanly for 5+ pushes with no unexplained empty/missing results.
3. No unexpected failures or malformed output in the stored resources.

The pre-commit `check-codescene-health.js` script MUST NOT be removed until Phase 2 is complete. It remains the active enforcement gate during Phase 1.

**Phase 3 — Pre-commit cleanup (only after Phase 2)**
5. Remove `node scripts/check-codescene-health.js` from `.githooks/pre-commit`.
6. Delete `scripts/check-codescene-health.js`.
7. Confirm `git commit` no longer mentions CodeScene.

Rollback: re-add the script invocation to `.githooks/pre-commit` and set `allowFailure: true` on the workflow step. No data loss.
