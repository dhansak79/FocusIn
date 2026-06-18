[![CodeScene Average Code Health](https://codescene.io/projects/81232/status-badges/average-code-health)](https://codescene.io/projects/81232)[![CodeScene Hotspot Code Health](https://codescene.io/projects/81232/status-badges/hotspot-code-health)](https://codescene.io/projects/81232)[![CodeScene System Mastery](https://codescene.io/projects/81232/status-badges/system-mastery)](https://codescene.io/projects/81232)[![Mutation Tests](https://github.com/dhansak79/FocusIn/actions/workflows/mutation.yml/badge.svg)](https://github.com/dhansak79/FocusIn/actions/workflows/mutation.yml)[![codecov](https://codecov.io/gh/dhansak79/FocusIn/graph/badge.svg)](https://codecov.io/gh/dhansak79/FocusIn)

# FocusIn: LinkedIn Attention Filter

In early 2026 a barrier was crossed: the majority of LinkedIn posts were AI-generated. 53.7% to be specific.

You can feel it when you scroll. The same rhythm, the same phrases, the same staccato lines. A thousand people who learned to write by prompting the same model, all publishing into the same feed.

FocusIn filters that out. Posts that match enough AI writing patterns get collapsed to a one-line summary with a reveal button. You can still read them. You just don't have to scroll through a wall of them to find the ones worth reading.

> Forked from [njelich/LinkOff](https://github.com/njelich/LinkOff)

## How it works

The detector scans for patterns: em dashes, emoji bullets, hook/contrast structures, buzzword phrases, single-sentence line stacking. Each signal is weighted. Cross the threshold and the post collapses. The summary tells you which signals matched.

A second pass runs a local classifier against structural archetypes of AI writing, for posts that clear the pattern checks but still read like no one wrote them.

There is also a semantic topic filter that hides posts by meaning rather than exact words, using an embedding model that runs entirely in your browser. "Hustle culture" catches posts about it even when that phrase never appears. You can use the built-in topics or add your own.

And a keyword filter, for when you just want anything mentioning a specific word gone.

## Signal table

| Signal | Notes |
|---|---|
| **Buzzword phrases** | "game-changer", "let that sink in", "thought leadership", "delve", "leverage" (two or more triggers) |
| **Contrast structures** | "It's not X. It's Y." hook/punchline pairs |
| **Listicle titles** | "7 habits that...", numbered thread formats |
| **Arrow bullet lists** | arrows used as bullets |
| **Em dash** | Rarely typed by hand; very common in AI output |
| **Emoji overload** | More than 4 emoji in a post |
| **Emoji bullets** | Two or more lines each opening with an emoji |
| **Raw markdown** | `**bold**`, `# headers`, `* bullets` pasted straight from a chatbot |
| **Line stacking** | Short single-sentence lines throughout |

## Install

**Firefox**

1. Type `about:debugging` in the URL bar and press <kbd>Enter</kbd>
2. Click **This Firefox** then **Load Temporary Add-on...**
3. Navigate to the unzipped folder and select `manifest.json`

**Chromium**

1. Type `chrome://extensions` in the URL bar and press <kbd>Enter</kbd>
2. Enable **Developer mode**
3. Click **Load Unpacked** and select the unzipped folder

## FAQ

### Why was my post collapsed?

It matched enough signals. One is rarely enough; the detector is looking for patterns that cluster together. The summary on the collapsed post shows exactly which ones fired.

### Does any of this send my data anywhere?

No. Everything runs in your browser.

### What is the difference between the keyword filter and the semantic topic filter?

The keyword filter is exact match. The semantic filter understands meaning, so it catches posts about a topic even when the specific words you typed never appear. It is slower and less precise; use it for themes that are hard to pin down with a word list.

## Development

| Command | Purpose |
|---|---|
| `npm test` | Unit tests |
| `npm run coverage` | Unit tests with coverage report |
| `npm run knip` | Dead code check |
| `npm run mutate` | Mutation tests |

The pre-commit hook runs lint, dead code, coverage, patch coverage, and CodeScene health on every commit.

CI enforces two quality gates on every PR:

- Unit test coverage >= 90% across lines, functions, branches, and statements
- Mutation score >= 75%

The latest [mutation report](https://dhansak79.github.io/FocusIn/) is published to GitHub Pages on each merge to `main`.
