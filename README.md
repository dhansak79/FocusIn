# FocusIn - LinkedIn Attention Filter

FocusIn cuts through LinkedIn's engagement bait, leaving behind the signal you actually care about.

> Forked from [njelich/LinkOff](https://github.com/njelich/LinkOff)

Make your LinkedIn experience better, instantly. Fewer distractions, better filtered content — your feed works for you, not against your attention.

No more seeing unwanted likes and comments by your connections. Block the feed or filter it using custom keywords and find the connections and posts you want more easily. Clean up your inbox too — mass deletion built in.

<details markdown="1">
<summary>Click for preview</summary>

---
![Preview FocusIn browser extension](https://addons.mozilla.org/user-media/previews/full/256/256407.png)

[![FocusIn—Clean your feed](https://img.youtube.com/vi/rGQneD68f1w/maxresdefault.jpg)](https://www.youtube.com/watch?v=rGQneD68f1w)

---
</details>

## Features

- Option to hide the whole feed
- Post filtering by content (polls, videos, promoted, shared, etc)
- Hide posts by companies or specific people
- Filter by custom keywords (politics, coronavirus, vaccination, whatever)
- Hide posts shown due to interactions (comments, reactions, followed by connections)
- Hide irrelevant old posts (older than an hour, day, week, month)
- Select messages for mass deletion (clean your inbox)
- Message filters (COMING SOON)
- Unfollow all collections
- Job filtering (COMING SOON)
- Block ads on LinkedIn (banners and sidebar)
- Hide LinkedIn learning and course recommendations
- Hide community panel and follow recommendations
- Stop LinkedIn premium upsell pestering
- Fully configurable to suit your need!
- Completely FREE and with NO ADS

## Frequently Asked Questions

> Are you going to make a Tampermonkey/Greasemonkey script?

Not currently planned — the browser extension approach covers the main use cases well.

> What about Vivaldi/Brave/Edge/Opera and other browsers?

The extension can be natively installed on all Chromium browsers.

> What about Safari and macOS?

The App Store charges $100/year to post apps, which makes this impractical for a free extension.

> How can I use this on mobile?

Since neither Chrome nor Firefox allow extensions in mobile browsers, you need a Chromium distribution that does — Kiwi Browser works well (please report any issues).

## Contributing

Please create an issue before submitting a pull request.

Use `npm install` to install dependencies. To build the CSS from SCSS run `npm run css-build`.

You can also trigger the build on changes by running the watcher with `npm start`.

To install the extension locally follow the instructions below for your browser.

**Firefox**

- Type `about:debugging` in the Firefox URL bar and press <kbd>Enter</kbd>
- Click **This Firefox** on the left, and then **Load Temporary Add-on…**
- Navigate to the location of the folder you unzipped, select the `manifest.json` file inside

**Chromium**

- Type `chrome://extensions` in the Chrome URL bar and press <kbd>Enter</kbd>
- Enable **Developer mode** using the toggle on the right
- Click **Load Unpacked** on the left side of the window
- Navigate to the location of the folder you unzipped, and click **Select Folder**

### Commit message format

We use [Conventional Commit format](https://www.conventionalcommits.org/en/v1.0.0/)
