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

## FAQ

### Why was my post hidden or collapsed?

FocusIn doesn't hide posts at random — it's looking for specific patterns that tend to show up in AI-generated LinkedIn posts. Posts only get flagged once enough of these patterns stack up together, so a single quirky sentence shouldn't trip it. If a post gets collapsed, the reveal button shows you which signals it matched, so it's never a black box.

### How does the AI slop detector decide what's "slop"?

It scans the post text for a handful of tells and adds up points for each one. The post is flagged once the total crosses a threshold:

- **Buzzword phrases**: things like "game-changer," "let that sink in," "thought leadership," "delve," "leverage." One on its own doesn't flag a post; two or more does.
- **Telltale sentence structures**: patterns like "It's not X. It's Y." contrast pairs, "As [someone] once said:" quote drops, numbered listicle titles ("7 habits that..."), Twitter-style "1/ 2/ 3/" threads, arrow (→) bullet lists, and em dashes (rarely typed by hand, very common in AI writing). Any one of these is treated as a strong signal on its own.
- **Emoji overload**: more than 4 emoji in the post.
- **Emoji bullet lists**: two or more lines that each start with an emoji used as a bullet point.
- **Raw markdown**: `**bold**`, `# headers`, or `* bullets` that never got rendered, suggesting the text was pasted straight from a chatbot.
- **Line stacking**: lots of short, single-sentence lines in a row, a very AI-typical staccato format. Extreme stacking (15+ lines, mostly single-sentence) is suspicious enough to flag a post on its own.

Depending on your settings, flagged posts are either **collapsed** (with a reveal button) or **hidden completely**.

### What's the difference between keyword filtering and the semantic topic filter?

Keyword filtering hides a post only if it contains the exact word or phrase you typed. The semantic topic filter instead understands *meaning* — it can hide a post about "hustle culture" even if that exact phrase never appears, by comparing the post's content to your chosen topics using a small AI model that runs locally in your browser (nothing is sent anywhere). It's slower and less precise than keyword matching, so use it for themes that are hard to capture with a fixed list of words.

### What does "Label post type with AI classification" do?

It runs each post through a small local model to guess its category (e.g. job update, article share, poll) and shows that label on the post. It's just a label for context — it doesn't hide anything on its own.

### Does any of this send my data anywhere?

No. The slop detector, semantic filter, and post classifier all run entirely inside your browser. Nothing about your feed or your settings is sent to a server.

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

