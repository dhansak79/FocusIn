/**
 * Injects a "Guardrails Dashboard" nav link into the Stryker mutation report HTML.
 * Uses cheerio for DOM manipulation — robust against Stryker bundle structure changes.
 *
 * Usage: node scripts/inject-dashboard-link.js
 */
import { readFileSync, writeFileSync } from "fs";
import * as cheerio from "cheerio";

const INPUT = "reports/mutation/index.html";
const LINK_HREF = "/FocusIn/insights/";
const LINK_TEXT = "Guardrails Dashboard";
const NAV_ID = "guardrails-nav";

const html = readFileSync(INPUT, "utf8");
const $ = cheerio.load(html);

if ($(`#${NAV_ID}`).length === 0) {
  const nav = `<div id="${NAV_ID}" style="position:fixed;top:0;right:0;z-index:9999;background:#161b22;border-bottom-left-radius:6px;padding:6px 14px;font-family:system-ui,sans-serif;font-size:13px;border:1px solid #30363d;border-top:none;border-right:none"><a href="${LINK_HREF}" style="color:#58a6ff;text-decoration:none;">${LINK_TEXT}</a></div>`;
  $("body").prepend(nav);
}

writeFileSync(INPUT, $.html(), "utf8");
console.log(`Injected "${LINK_TEXT}" link into ${INPUT}`);
