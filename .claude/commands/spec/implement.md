---
name: "Spec: Implement"
description: Work through implementation tasks in order, calling complete-task after each, showing N/M progress. Does not auto-verify.
category: Spec-Gate
tags: [spec-gate, implement, tasks]
---

Implement sub-flow for the spec-gate methodology. Handles `tasking` and `implementing` phases.

**Input**: Change name (required — resolved by the router).

## Steps

1. **Verify phase and resolve state**

   Read `.swamp/spec-change-{name}.json`. Phase must be `tasking` or `implementing`.

   If phase is `tasking`, transition first:
   ```
   swamp model method run spec-change start-implementing --name {name}
   ```

2. **Show progress**

   ```
   ## Implementing: {name}
   Progress: {done}/{total} tasks complete
   Scenarios: {N} ({passing} pass / {pending} pending)

   Pending tasks:
   - [ ] {id}: {description}
   ...
   ```

3. **Work through tasks in order (loop until done or blocked)**

   For each pending task:
   - Announce: "Working on task {id}/{total}: {description}"
   - Implement the task (code changes, file creation, step definition authoring, etc.)
   - If the task has a `kind` of `"feature"` and a `file` that appears in `risk_flags`: before completing it, re-run the live checks for that file now (`code_health_score`, current coverage/mutation figures) — do not trust the task list alone, it may be stale. Pass the real numbers:
     ```
     swamp model method run spec-change complete-task --name {name} --id {id} \
       --verifiedHealth {n} --verifiedLineCoverage {n} --verifiedMutationScore {n}
     ```
     If the model rejects the call, it means the file has not actually reached the target thresholds — report the rejection message verbatim (it names the metric that's short) and go work the remaining testing/refactor tasks for that file instead of retrying with fabricated numbers.
   - Otherwise, immediately after completing: call `swamp model method run spec-change complete-task --name {name} --id {id}`
   - Announce: "✓ Task {id} complete"
   - Continue to next task

   **Pause if:**
   - Task is unclear or reveals a design conflict → report and ask for guidance
   - Implementation uncovers a scenario that is wrong → suggest `/spec:scenarios` to revise
   - Error or blocker → report clearly and wait
   - `complete-task` rejects a feature task for prerequisite-ordering reasons (an earlier testing/refactor task on the same file is still open) → go complete that task first, do not skip ahead

4. **On completion or pause, show status**

   ```
   ## Implement status: {name}
   Progress: {done}/{total} tasks complete
   ```
   If all tasks done: "All tasks complete. Run `/spec:verify` to run the BDD suite and check scenario statuses."
   If paused: explain why and wait.

## Guardrails
- Call `complete-task` immediately after finishing each task — do not batch
- Do NOT auto-verify or auto-continue to verify — the user controls when to verify
- When writing step definitions, wire them to the actual `src/` code — no stubs that always pass
- After writing step definitions for a scenario, remove `@wip` from that scenario's entry in the feature file
- Keep changes minimal and scoped to the current task
- If the design is wrong, pause — do not improvise beyond the task spec
- Never pass `verifiedHealth`/`verifiedLineCoverage`/`verifiedMutationScore` without having just measured them live — the gate only works if these numbers are real
