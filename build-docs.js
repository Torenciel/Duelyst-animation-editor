#!/usr/bin/env node
/**
 * Build script for the GitHub Pages static demo (docs/).
 *
 * Copies viewer.html, viewer.css, src/ into docs/, then copies the
 * hand-picked demo assets from demo-assets/dist/ and demo-assets/dist-fx/.
 * Patches docs/src/config.js to enable STATIC_MODE.
 *
 * To add units/FX to the demo, place their files in:
 *   demo-assets/dist/        ← units  (.png, .json, _anims.json + manifest.json)
 *   demo-assets/dist-fx/     ← FX     (.png, .json, _anims.json + manifest.json)
 *   demo-assets/background/  ← map backgrounds (optional, falls back to none)
 *
 * Usage:
 *   node build-docs.js
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = new URL(".", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const DOCS = path.join(ROOT, "docs");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function copyAssets(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) {
    console.warn(`  skipped (not found): ${srcDir}`);
    return 0;
  }
  fs.mkdirSync(destDir, { recursive: true });
  const files = fs.readdirSync(srcDir);
  for (const f of files) {
    fs.copyFileSync(path.join(srcDir, f), path.join(destDir, f));
  }
  return files.length;
}

// Clean docs/
if (fs.existsSync(DOCS)) fs.rmSync(DOCS, { recursive: true });
fs.mkdirSync(DOCS);

// Static app files
console.log("Copying app files…");
fs.copyFileSync(path.join(ROOT, "viewer.html"), path.join(DOCS, "viewer.html"));
fs.copyFileSync(path.join(ROOT, "viewer.css"), path.join(DOCS, "viewer.css"));
copyDir(path.join(ROOT, "src"), path.join(DOCS, "src"));

// Redirect index.html → viewer.html
fs.writeFileSync(
  path.join(DOCS, "index.html"),
  `<!doctype html><meta http-equiv="refresh" content="0;url=viewer.html">`,
);

// Patch config.js: STATIC_MODE = true, API = ""
const configPath = path.join(DOCS, "src", "config.js");
let config = fs.readFileSync(configPath, "utf8");
config = config.replace(
  `export const API = "http://localhost:3000";`,
  `export const API = "";`,
);
config = config.replace(
  `export const STATIC_MODE = false;`,
  `export const STATIC_MODE = true;`,
);
fs.writeFileSync(configPath, config);
console.log("  Patched src/config.js for static mode");

// Demo assets — sourced from demo-assets/, not the generated dist/ folders
const DEMO = path.join(ROOT, "demo-assets");

console.log("Copying demo-assets/dist/ …");
const unitCount = copyAssets(path.join(DEMO, "dist"), path.join(DOCS, "dist"));
console.log(`  ${unitCount} files`);

console.log("Copying demo-assets/dist-fx/ …");
const fxCount = copyAssets(path.join(DEMO, "dist-fx"), path.join(DOCS, "dist-fx"));
console.log(`  ${fxCount} files`);

console.log("Copying demo-assets/background/ …");
const bgCount = copyAssets(path.join(DEMO, "background"), path.join(DOCS, "background"));
console.log(`  ${bgCount} files`);

console.log(`\nDone → docs/`);
console.log("Push to GitHub and enable Pages from the docs/ folder.");
