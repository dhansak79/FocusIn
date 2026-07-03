---
name: "Spec: Design"
description: Generate technical design after scenario approval, store it in the model, and auto-continue to tasks.
category: Spec-Gate
tags: [spec-gate, design]
---

Design sub-flow for the spec-gate methodology. Handles `approved` phase.

**Input**: Change name (required — resolved by the router).

## Steps

1. **Verify phase**

   Read `.swamp/spec-change-{name}.json`. Phase must be `approved`. If not, report and stop.

2. **Generate technical design**

   Using `proposal_text`, `scenarios`, and the existing codebase (`src/`, `extensions/`, `tests/`), write a concise technical design covering:
   - **Approach**: How the requirement will be implemented technically
   - **Files to change**: Which source files will be created or modified and why
   - **Key decisions**: Any technical choices that affect testability or architecture
   - **Step definition strategy**: How the Cucumber step definitions will exercise the code (what to stub, what to invoke directly)
   - **Risk / trade-offs**: Anything non-obvious

   This design is for the agent's implementation guidance — it does not need human approval.

3. **Flag hotspot / unhealthy / under-covered target files**

   For each file identified in "Files to change" above, check its current state:
   - `code_health_score` (and `list_technical_debt_hotspots_for_project_file` if a CodeScene project is linked) for Code Health and hotspot status
   - existing coverage/mutation data for that file (e.g. from `reports/mutation/mutation.json` or the last coverage run)

   If a file's Code Health is below 10.0, it is a listed hotspot, or its coverage is below 100% line / 95% mutation, record a risk flag for it:
   ```json
   { "file": "src/foo.js", "reason": "unhealthy" | "hotspot" | "undercovered", "detail": "health 8.1" }
   ```
   A file with no deficiency gets no risk flag — most changes will have an empty `riskFlags` array, and this step is a no-op for them.

4. **Store design**

   Run:
   ```
   swamp model method run spec-change set-design --name {name} --text "{design_text}" --riskFlags '{riskFlags_json}'
   ```
   Pass `--riskFlags '[]'` when no file was flagged.

5. **Announce and auto-continue**

   Display a brief summary of the design approach, and any risk flags recorded, then load the `/spec:tasks` sub-flow.

## Guardrails
- No human gate on design — proceed automatically
- Keep design focused on what the implementation tasks need to know
- Step definition strategy is critical: think now about how each scenario will be tested
- Risk-flagging is not optional when a target file qualifies — `/spec:tasks` depends on `risk_flags` to sequence testing/refactor ahead of feature work, and `/spec:implement` depends on it to gate `complete-task`
