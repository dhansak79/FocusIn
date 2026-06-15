# FocusIn — Plan for World Domination

The mission: build the best extension in the world for protecting human attention from the internet's worst problem. One branch, one PR at a time.

---

## Phase 1 — Detection That Actually Works

The slop detector is the heart of this. Right now it's a static keyword list. Make it the best AI slop detector that exists anywhere.

- [x] Expand the dead giveaways list continuously (Dustin Andrews is a start — find more sources)
- [x] Weighted scoring — not all signals are equal; an em dash + line stacking + "here's the thing" should score higher than any one alone
- [x] Tune the threshold — right now one signal = slop. That's too aggressive. Score should reflect confidence.
- [x] Add tests for every new signal added

**Branch:** `improve-slop-detection`

---

## Phase 2 — Zero Configuration

The extension currently requires setup. The best version works immediately on install with defaults that protect you from 90% of the damage.

- [x] Audit current defaults — what is off by default that should be on
- [x] Turn on slop detection by default
- [x] Turn on ad blocking by default
- [x] Remove any feature that requires explanation to use

**Branch:** `better-defaults`

---

## Phase 3 — Transparency

Make the damage visible. Show people what FocusIn filtered and why. Not to second-guess the decision — to make the scale of the problem undeniable.

- [ ] Session counter — posts hidden, slop detected
- [ ] Signal breakdown — show why a post was flagged (emoji overload, buzzwords, etc.)
- [ ] Popup summary — "In this session, 34 AI-generated posts were hidden"

**Branch:** `show-the-damage`

---

## Phase 4 — The Manifesto

A proper website that makes people feel something. Not a product page — a statement. The README is not enough.

- [ ] Write the manifesto — what LinkedIn has become, why attention matters, what we're doing about it
- [ ] Landing page (GitHub Pages is fine to start)
- [ ] Clear install CTA

**Branch:** `manifesto`

---

## Phase 5 — Beyond LinkedIn

Same slop, different URL. The extension architecture already separates features by platform. Use it.

- [ ] X / Twitter
- [ ] Bluesky
- [ ] Medium / Substack (stretch)

**Branch per platform:** `platform-x`, `platform-bluesky`

---

## Phase 6 — Community Signal

The keyword list decays. What's slop today evolves. Build the network effect.

- [ ] Centralised pattern list with versioned releases — extension pulls updates
- [ ] Mechanism for community to propose new patterns (GitHub Discussions to start)
- [ ] Automated publishing pipeline for pattern updates

**Branch:** `community-patterns`

---

## What We Are Not Building

- A paid product
- A data harvesting tool
- Anything that requires an account
- Anything complex to configure
