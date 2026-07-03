---
name: "Spec: Propose"
description: Create a spec change, generate a proposal (why/what), get human approval at Gate 1, then auto-continue to scenarios.
category: Spec-Gate
tags: [spec-gate, proposal, gate-1]
---

Propose sub-flow for the spec-gate methodology. Handles `draft` and `proposal-pending-approval` phases.

**Input**: Change name (required). If not provided, ask the user what they want to build and derive a kebab-case name.

## Steps

1. **Resolve or create the change**

   Check if `.swamp/spec-change-{name}.json` exists:
   - If not: run `swamp model method run spec-change create --name {name}` to initialise it
   - If exists and phase is `archived`: tell the user this change is archived (a closed decision-log entry) and offer to start a new change instead
   - If exists and phase is anything from `proposal-approved` through `verifying`: tell the user the proposal was already approved, and ask whether they want to reopen it for revision. If yes, run `swamp model method run spec-change reopen-proposal --name {name}`, then proceed to step 2's `draft` branch as normal. If no, stop and let the user decide next steps.

2. **Present or generate proposal text**

   If the change is in `proposal-pending-approval`, an existing proposal is stored — display it:
   ```
   ## Existing proposal for: {name}
   {proposal_text}
   ```
   Ask: "Approve this proposal? (yes / edit / no)"

   If the change is in `draft`, generate a proposal:
   - Research the relevant code; consult `openspec/specs/` for reference (rendered outputs, not source of truth)
   - Write a concise proposal covering:
     - **Why**: Problem being solved
     - **What**: Scope of change (what will be built, what will not)
     - **Success criteria**: How we know it is done
   - Present the proposal to the user
   - Ask: "Approve this proposal? (yes / edit / no)"

3. **Iterate on proposal**

   If the user wants edits, apply them and re-present. Repeat until approved.
   On each iteration: run `swamp model method run spec-change set-proposal --name {name} --text "{text}"`

4. **Gate 1: Record approval**

   When the user approves, run:
   ```
   swamp model method run spec-change approve-proposal --name {name}
   ```
   Announce: "Proposal approved ✓ — continuing to scenarios..."

5. **Auto-continue to scenarios flow**

   Load the `/spec:scenarios` sub-flow with the same change name.

## Guardrails
- Gate 1 MUST be called — never skip `approve-proposal`
- Proposals must be specific enough to generate unambiguous Given/When/Then scenarios
- Store proposal text before asking for approval via `set-proposal`
- `reopen-proposal` clears `scenarios`/`design_text`/`tasks` — warn the user this discards downstream work before calling it, not just after
