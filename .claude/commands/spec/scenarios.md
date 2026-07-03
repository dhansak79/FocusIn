---
name: "Spec: Scenarios"
description: Generate Given/When/Then scenarios from an approved proposal, get human approval at Gate 2, then auto-continue to design.
category: Spec-Gate
tags: [spec-gate, scenarios, bdd, gate-2]
---

Scenarios sub-flow for the spec-gate methodology. Handles `proposal-approved` and `scenarios-pending-approval` phases.

**Input**: Change name (required — resolved by the router).

## Steps

1. **Verify phase**

   Read `.swamp/spec-change-{name}.json`. If phase is `scenarios-pending-approval`, an existing set of scenarios is stored — display them and go to step 3. If phase is `proposal-approved`, proceed to step 2.

   Otherwise:
   - If phase is `draft` or `proposal-pending-approval` (the scenarios gate hasn't been reached yet): report this and stop — route the user to `/spec:propose` first.
   - If phase is `archived`: report that this change is archived (a closed decision-log entry) and stop.
   - If phase is anything from `approved` through `verifying`: tell the user the scenarios were already approved, and ask whether they want to reopen them for revision. If yes, run `swamp model method run spec-change reopen-scenarios --name {name}`, then proceed to step 2 as normal. If no, stop and let the user decide next steps.

2. **Generate scenarios**

   Using the approved `proposal_text` and relevant code in `src/`, generate Given/When/Then scenarios:
   - Each scenario must have a clear `Given` precondition, `When` action, and `Then` observable outcome
   - Scenarios must be testable with Cucumber step definitions
   - Cover the happy path, edge cases, and failure modes described in the proposal
   - Scenarios should be expressed in terms of observable user-facing or system behaviour — not implementation detail
   - Use multi-step `Given/And`, `When/And`, `Then/And` where appropriate

   Format for display:
   ```
   ## Scenarios for: {name}

   **Scenario: {name}**
   - Given {precondition}
   - When {action}
   - Then {expected outcome}
   ```

3. **Present and iterate**

   Show all scenarios. Ask: "Approve these scenarios? (yes / edit / add / remove)"
   If the user wants changes, update the list and re-present. Repeat until approved.
   Each update: run `swamp model method run spec-change set-scenarios --name {name} --scenarios '{json}'`

4. **Gate 2: Record approval**

   When the user approves, run:
   ```
   swamp model method run spec-change approve-scenarios --name {name}
   ```
   Announce: "Scenarios approved ✓ — continuing to design..."

5. **Auto-continue to design flow**

   Load the `/spec:design` sub-flow with the same change name.

## Scenario Quality Rules
- Every scenario MUST have at least one `When` and one `Then` step
- Scenarios with no `Given` are allowed (stateless preconditions), but warn the user
- Scenario names must be unique within the change
- Avoid implementation-specific language (e.g., "the function returns X" → "the UI shows X")
- Each scenario name will become a Cucumber `Scenario:` title — keep it concise and readable

## Guardrails
- Gate 2 MUST be called — never skip `approve-scenarios`
- Store scenarios via `set-scenarios` before asking for approval
- The scenarios you generate here become the executable contract — take time to get them right
- `reopen-scenarios` clears `design_text`/`tasks` but preserves the approved proposal — warn the user this discards design/task work before calling it, not just after
