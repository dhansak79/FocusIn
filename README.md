[![CodeScene Average Code Health](https://codescene.io/projects/81232/status-badges/average-code-health)](https://codescene.io/projects/81232)[![CodeScene Hotspot Code Health](https://codescene.io/projects/81232/status-badges/hotspot-code-health)](https://codescene.io/projects/81232)[![CodeScene System Mastery](https://codescene.io/projects/81232/status-badges/system-mastery)](https://codescene.io/projects/81232)[![Mutation Tests](https://github.com/dhansak79/FocusIn/actions/workflows/mutation.yml/badge.svg)](https://github.com/dhansak79/FocusIn/actions/workflows/mutation.yml)[![codecov](https://codecov.io/gh/dhansak79/FocusIn/graph/badge.svg)](https://codecov.io/gh/dhansak79/FocusIn)

# FocusIn: LinkedIn Attention Filter

In early 2026 a barrier was crossed: the majority of LinkedIn posts were AI-generated. 53.7% to be specific.

AI content has a peculiar flavour. The em dashes, the hook/contrast/punchline structures, the emoji bullets, the wall-to-wall single-sentence lines. Each one is a small signal. Stacked together, they reliably mark a post that was effortless to produce, and for that reason carries less value to read.

FocusIn detects those signals and gets them out of your way, so the posts written by actual humans with actual things to say have a chance of being seen.

> Forked from [njelich/LinkOff](https://github.com/njelich/LinkOff)

## What it does

**AI slop detection:** scans every post for the tell-tale patterns of LLM-generated writing. When enough signals stack up, the post collapses to a one-line summary with a "Show anyway" button. You stay in control; nothing is permanently hidden.

**Semantic topic filter:** hides posts about a topic by *meaning*, not just keyword match. Uses a local sentence-embedding model that runs entirely in your browser (no data leaves your machine). Pick from built-in topics (hustle culture, personal branding, motivational quotes...) or add your own.

**Keyword filter:** exact-match filtering on any word or phrase you choose.

## How AI slop detection works

Posts are scored against a set of signals. Cross the threshold, and the post collapses:

| Signal | Notes |
|---|---|
| **Buzzword phrases** | "game-changer", "let that sink in", "thought leadership", "delve", "leverage" (two or more is a flag) |
| **Contrast structures** | "It's not X. It's Y." hook/punchline pairs |
| **Listicle titles** | "7 habits that...", numbered thread formats |
| **Arrow bullet lists** | arrows used as bullets |
| **Em dash** | Rarely typed by hand; extremely common in AI writing |
| **Emoji overload** | More than 4 emoji in a post |
| **Emoji bullets** | Two or more lines each opening with an emoji |
| **Raw markdown** | `**bold**`, `# headers`, `* bullets` pasted straight from a chatbot |
| **Line stacking** | Short single-sentence lines throughout, the signature AI staccato rhythm |

Collapsed posts show a brief extractive summary so you can decide whether to expand without reading the full thing.

**Model-based detection** adds a second pass using a local classifier that scores posts against structural archetypes of AI writing, catching posts that pass the pattern checks but still read like a machine wrote them.

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

FocusIn looks for specific patterns that reliably appear in AI-generated posts. A single signal is not enough; posts are only collapsed when several stack up together. The summary shown on a collapsed post lists which signals matched, so it is never a black box.

### Does any of this send my data anywhere?

No. The slop detector, semantic filter, and model-based classifier all run entirely inside your browser.

### What is the difference between keyword filtering and the semantic topic filter?

Keyword filtering hides a post only if it contains the exact word or phrase you typed. The semantic filter understands *meaning*: it can hide a post about "hustle culture" even if that phrase never appears, by comparing the post's content to your chosen topics using a local embedding model. It is slower than keyword matching; use it for themes that are hard to capture with a fixed list of words.

## Development

| Command | Purpose |
|---|---|
| `npm test` | Unit tests |
| `npm run coverage` | Unit tests with coverage report |
| `npm run knip` | Dead code check |
| `npm run mutate` | Mutation tests |

The pre-commit hook runs lint, dead code, coverage, patch coverage, and CodeScene health on every commit.

CI enforces two quality gates on every PR:

- **Unit test coverage >= 90%** across lines, functions, branches, and statements
- **Mutation score >= 75%**

The latest [mutation report](https://dhansak79.github.io/FocusIn/) is published to GitHub Pages on each merge to `main`.
