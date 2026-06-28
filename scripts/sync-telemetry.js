/* eslint-env node */
/**
 * Copies workflow run YAML files from .swamp/workflow-runs/ → telemetry/workflow-runs/.
 * Only copies files that do not already exist in the destination (never overwrites).
 * Run this after quality-gate runs to commit telemetry alongside code changes.
 *
 * Usage: node scripts/sync-telemetry.js
 */
import { readdirSync, mkdirSync, copyFileSync, existsSync } from "fs";
import { join } from "path";

const src = ".swamp/workflow-runs";
const dst = "telemetry/workflow-runs";

if (!existsSync(src)) {
  console.log("No .swamp/workflow-runs directory found — nothing to sync.");
  process.exit(0);
}

let copied = 0;
let skipped = 0;

for (const workflowId of readdirSync(src, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)) {
  const srcDir = join(src, workflowId);
  const dstDir = join(dst, workflowId);
  mkdirSync(dstDir, { recursive: true });

  for (const file of readdirSync(srcDir)) {
    if (!file.endsWith(".yaml")) continue;
    const dstFile = join(dstDir, file);
    if (existsSync(dstFile)) {
      skipped++;
      continue;
    }
    copyFileSync(join(srcDir, file), dstFile);
    console.log(`  synced: ${workflowId}/${file}`);
    copied++;
  }
}

console.log(`\nDone: ${copied} copied, ${skipped} already present.`);
