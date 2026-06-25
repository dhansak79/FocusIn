## Why

The author whitelist, introduced in commit 96b6923, was only wired into the slop-detection and semantic-match paths. Two paths — keyword-match and hide-promoted — bypass the whitelist entirely, causing whitelisted authors' posts to be hidden against the spec's stated intent ("regardless of which detection path fires").

## What Changes

- Add a whitelist guard to the keyword-match branch in `applyKeywordToPost` so whitelisted authors' posts are never hidden by keyword matching.
- Add a whitelist guard to the promoted-post branch in `applyKeywordToPost` so whitelisted authors' promoted posts pass through when `hide-promoted` is enabled.
- Add spec scenarios to the existing `author-whitelist` spec covering keyword and promoted-post bypass.

## Capabilities

### New Capabilities

_(none — this is a bug fix to existing behaviour)_

### Modified Capabilities

- `author-whitelist`: Add missing scenarios for keyword-match bypass and promoted-post bypass; the existing requirement text already covers these cases but the spec has no explicit scenarios for them.

## Impact

- **`src/features/feed.js`** — `applyKeywordToPost`: two guard insertions (keyword branch, promoted branch).
- **`openspec/specs/author-whitelist/spec.md`** — add two scenarios.
- No new storage keys, no API changes, no dependency changes.
