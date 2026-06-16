[![CodeScene Average Code Health](https://codescene.io/projects/81232/status-badges/average-code-health)](https://codescene.io/projects/81232)[![CodeScene Hotspot Code Health](https://codescene.io/projects/81232/status-badges/hotspot-code-health)](https://codescene.io/projects/81232)[![CodeScene System Mastery](https://codescene.io/projects/81232/status-badges/system-mastery)](https://codescene.io/projects/81232)[![Mutation Tests](https://github.com/dhansak79/FocusIn/actions/workflows/mutation.yml/badge.svg)](https://github.com/dhansak79/FocusIn/actions/workflows/mutation.yml)[![codecov](https://codecov.io/gh/dhansak79/FocusIn/graph/badge.svg)](https://codecov.io/gh/dhansak79/FocusIn)

# FocusIn - LinkedIn Attention Filter

LinkedIn is doing real damage. Millions of people spend hours every day scrolling through AI-generated slop, engagement bait, and corporate noise dressed up as insight. Attention is finite. We are here to protect it.

FocusIn gives you back control of your LinkedIn feed — filtering out the garbage so the things that actually matter can get through.

> Forked from [njelich/LinkOff](https://github.com/njelich/LinkOff)

## Features

- Option to hide the whole feed, or sort it by recent instead of LinkedIn's algorithm
- Filter by custom keywords (politics, coronavirus, vaccination, whatever)
- Semantic topic filter — hide posts about a topic by meaning, not just keyword match (e.g. "hustle culture", "personal branding"), with your own custom topics too
- Hide posts shown due to interactions (comments, reactions, followed by connections)
- Hide irrelevant old posts (older than an hour, day, week, month)
- Filter job postings by keyword, and hide promoted jobs
- Select messages for mass deletion (clean your inbox)
- Unfollow all collections
- Block ads on LinkedIn (banners and sidebar)
- Hide notification counts, LinkedIn News, follow recommendations, and premium upsell prompts
- A "Today" dashboard in the popup showing how many AI posts and other posts have been filtered
- Fully configurable to suit your need!
- Completely FREE and with NO ADS

### AI Slop Detection

Collapse or completely hide posts that read like AI-generated content — buzzword phrases, filler hooks, emoji overload, raw markdown, contrasting clause structures, and wall-to-wall single-sentence line stacking. Posts that trip enough signals are either collapsed (with a reveal button) or hidden entirely, depending on your settings. Collapsed posts show a brief extractive summary so you can judge whether to expand without reading the full post.

### Semantic Topic Filter

Beyond plain keyword matching, FocusIn can hide posts that are *about* a topic even if they don't use the exact words, using a local sentence-embedding model (runs entirely in-browser, no data leaves your machine). Pick from built-in topics or add your own.

FocusIn will be available in every browser on every device.

**Firefox**

- Type `about:debugging` in the Firefox URL bar and press <kbd>Enter</kbd>
- Click **This Firefox** on the left, and then **Load Temporary Add-on…**
- Navigate to the location of the folder you unzipped, select the `manifest.json` file inside

**Chromium**

- Type `chrome://extensions` in the Chrome URL bar and press <kbd>Enter</kbd>
- Enable **Developer mode** using the toggle on the right
- Click **Load Unpacked** on the left side of the window
- Navigate to the location of the folder you unzipped, and click **Select Folder**

### Testing

| Command | Purpose |
|---|---|
| `npm test` | Run unit tests (fast, no coverage) |
| `npm run coverage` | Run unit tests with coverage report |
| `npm run mutate` | Run mutation tests |

CI enforces two quality gates on every PR:

- **Unit test coverage ≥ 90%** across lines, functions, branches, and statements (via [test.yml](https://github.com/dhansak79/FocusIn/actions/workflows/test.yml))
- **Mutation score ≥ 75%** (via [mutation.yml](https://github.com/dhansak79/FocusIn/actions/workflows/mutation.yml))

The latest [mutation report](https://dhansak79.github.io/FocusIn/) is published to GitHub Pages on each merge to `main`.

