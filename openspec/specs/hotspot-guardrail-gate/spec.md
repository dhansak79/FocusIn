## Purpose

Defines how the spec-gate methodology flags spec-changes that touch unhealthy, hotspot, or under-covered files during design, sequences testing/refactor/feature tasks in a fixed order during task generation, and blocks `complete-task` until live-measured Code Health and coverage actually reach target thresholds.

## Requirements

### Requirement: Design records risk flags for unhealthy, hotspot, or under-covered target files
During `/spec:design`, for each file identified in the design's "Files to change", the system SHALL check Code Health, hotspot status, and coverage/mutation data for that file, and SHALL record a risk flag (`file`, `reason`, `detail`) via `spec-change set-design --riskFlags` when Code Health is below 10.0, the file is a listed hotspot, or coverage is below 100% line / 95% mutation.

#### Scenario: Design flags an at-risk target file
- **GIVEN** a spec-change design targets a file whose Code Health is below 10.0, or the file is a listed CodeScene hotspot, or its coverage is below 100% line / 95% mutation
- **WHEN** the design phase records that file
- **THEN** the stored design SHALL include a risk flag for that file naming the specific deficiency (health score, hotspot status, or coverage gap)

#### Scenario: Unflagged changes are unaffected
- **GIVEN** a spec-change targets only files that are healthy, not hotspots, and fully covered
- **WHEN** design and tasks are generated for that change
- **THEN** no risk flags SHALL be recorded and no extra prerequisite tasks SHALL be inserted beyond what the proposal already scoped

### Requirement: Task generation orders testing before refactor before feature work per flagged file
During `/spec:tasks`, for every risk-flagged file, the system SHALL tag each task touching that file with `file` and `kind` (`"testing"`, `"refactor"`, or `"feature"`), and SHALL order all `testing` tasks for that file before all `refactor` tasks, which SHALL precede all `feature` tasks.

#### Scenario: Task generation orders testing before refactor before feature work
- **GIVEN** a spec-change design carries a risk flag for a target file
- **WHEN** tasks are generated for that change
- **THEN** the stored task list SHALL place the testing task(s) for that file before the refactor task(s), and the refactor task(s) before the feature task(s), in that fixed order

### Requirement: complete-task blocks a task when an earlier-kind sibling on the same file is unfinished
The `spec-change` model's `complete-task` method SHALL reject marking a task done when that task has a `kind` and `file`, and another task shares the same `file` with an earlier `kind` in the order testing < refactor < feature that is not yet done. The rejection SHALL name the blocking task's id and description.

#### Scenario: Implement blocks a feature task with an unmet prerequisite
- **GIVEN** a spec-change's task list has an incomplete testing or refactor task for a flagged file
- **WHEN** implement attempts to start or complete the feature task for that file
- **THEN** it SHALL be rejected, and the response SHALL name the specific unmet prerequisite task

### Requirement: complete-task requires live-measured thresholds for feature tasks on flagged files
The `complete-task` method SHALL require `verifiedHealth`, `verifiedLineCoverage`, and `verifiedMutationScore` arguments whenever completing a `"feature"`-kind task whose `file` has a matching entry in `risk_flags`, and SHALL reject the call if any value is missing or below threshold (`verifiedHealth === 10`, `verifiedLineCoverage === 100`, `verifiedMutationScore >= 95`). The model SHALL NOT measure these values itself — it only validates numbers supplied by the caller, which `/spec:implement` is responsible for measuring live via CodeScene before calling `complete-task`.

#### Scenario: Implement proceeds once the live check actually passes
- **GIVEN** a spec-change's prerequisite testing and refactor tasks for a flagged file are marked done
- **WHEN** implement re-checks that file's Code Health and coverage live and finds Code Health at 10.0, line coverage at 100%, and mutation coverage at 95% or above
- **THEN** implement SHALL be allowed to proceed with the feature task for that file
