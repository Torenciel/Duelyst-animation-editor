#!/usr/bin/env node
/**
 * Batch converter: Cocos2d .plist (units)  →  atlas JSON + anims JSON
 *
 * Each unit plist contains frames for ALL animations (attack_000, idle_000…).
 * This script groups them by animation name prefix and outputs one anims JSON
 * with one entry per animation — same format as convert-all.js output.
 *
 * Usage:
 *   node convert-units-plist.js
 *   node convert-units-plist.js --units boss_andromeda,boss_kane
 *   node convert-units-plist.js --fps 20
 *   node convert-units-plist.js --out ./dist
 *
 * Requires "unitsDir" set in config.json.
 */

const fs   = require('fs');
const path = require('path');

const OUT_DIR = path.resolve(path.join(__dirname, 'dist'));

const args = process.argv.slice(2);
const getArg = name => { const i = args.indexOf(name); return i !== -1 ? args[i + 1] : null; };

const config = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')); }
  catch { return {}; }
})();

if (!config.unitsDir) { console.error('Error: set "unitsDir" in config.json'); process.exit(1); }
const UNITS_DIR = path.resolve(config.unitsDir);

const unitFilter = (() => {
  const v = getArg('--units');
  return v ? new Set(v.split(',').map(s => s.trim())) : null;
})();
const outDir = (() => { const v = getArg('--out'); return v ? path.resolve(v) : OUT_DIR; })();
const fps           = (() => { const v = getArg('--fps'); return v ? parseFloat(v) : 20; })();
const frameDuration = Math.round(1000 / fps);

// ---------------------------------------------------------------------------
// Parse plist  →  Map<frameName, {x,y,w,h,rotated}>
// Frame rect string format: "{{x,y},{w,h}}"
// ---------------------------------------------------------------------------
function parsePlist(plistPath) {
  const text   = fs.readFileSync(plistPath, 'utf8');
  const frames = new Map();

  const framesBlockM = text.match(/<key>frames<\/key>\s*<dict>([\s\S]*?)<\/dict>\s*<key>metadata<\/key>/);
  if (!framesBlockM) throw new Error('Could not find frames block');

  const entryRe = /<key>([^<]+)<\/key>\s*<dict>([\s\S]*?)<\/dict>/g;
  let m;
  while ((m = entryRe.exec(framesBlockM[1])) !== null) {
    const name  = path.basename(m[1], '.png');
    const block = m[2];

    const frameM   = block.match(/<key>frame<\/key>\s*<string>\{\{(\d+),(\d+)\},\{(\d+),(\d+)\}\}<\/string>/);
    if (!frameM) continue;

    const rotatedM = block.match(/<key>rotated<\/key>\s*<(true|false)\/>/);
    const rotated  = rotatedM ? rotatedM[1] === 'true' : false;

    const x = parseInt(frameM[1], 10);
    const y = parseInt(frameM[2], 10);
    const w = rotated ? parseInt(frameM[4], 10) : parseInt(frameM[3], 10);
    const h = rotated ? parseInt(frameM[3], 10) : parseInt(frameM[4], 10);

    frames.set(name, { x, y, w, h, rotated });
  }

  const texM = text.match(/<key>textureFileName<\/key>\s*<string>([^<]+)<\/string>/);
  return { frames, textureName: texM ? texM[1] : null };
}

// ---------------------------------------------------------------------------
// Group frames into animations by stripping the trailing _NNN index.
// e.g. "boss_andromeda_attack_003" → animKey "boss_andromeda_attack"
// ---------------------------------------------------------------------------
function groupIntoAnims(unitName, frames) {
  const animMap = new Map(); // animKey → [{name, duration}]

  for (const frameName of [...frames.keys()].sort()) {
    // Match trailing _000 … _999 (one or more digits)
    const m = frameName.match(/^(.+)_(\d+)$/);
    if (!m) continue;
    const animKey = m[1];
    if (!animMap.has(animKey)) animMap.set(animKey, []);
    animMap.get(animKey).push({ name: frameName, duration: frameDuration });
  }

  // Determine repeat: death/hit play once, everything else loops
  const onceSuffixes = ['_death', '_hit'];
  const animDefs = [];
  for (const [key, animFrames] of animMap) {
    const isOnce = onceSuffixes.some(s => key.endsWith(s));
    animDefs.push({ key, repeat: isOnce ? 0 : -1, frames: animFrames });
  }

  return animDefs;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const plists = fs.readdirSync(UNITS_DIR)
    .filter(f => f.endsWith('.plist'))
    .filter(f => !unitFilter || unitFilter.has(path.basename(f, '.plist')));

  let ok = 0, skipped = 0, errors = 0;

  for (const plistFile of plists) {
    const unitName  = path.basename(plistFile, '.plist');
    const plistPath = path.join(UNITS_DIR, plistFile);

    try {
      const { frames, textureName } = parsePlist(plistPath);

      if (!frames.size) { console.warn(`SKIP ${unitName} — no frames`); skipped++; continue; }

      const pngName = textureName || `${unitName}.png`;
      const pngSrc  = path.join(UNITS_DIR, pngName);
      if (!fs.existsSync(pngSrc)) { console.warn(`SKIP ${unitName} — PNG not found`); skipped++; continue; }

      // Atlas
      const atlasFrames = {};
      for (const [name, rect] of frames) {
        atlasFrames[name] = { frame: { x: rect.x, y: rect.y, w: rect.w, h: rect.h }, rotated: rect.rotated };
      }

      // Anims
      const animDefs = groupIntoAnims(unitName, frames);
      if (!animDefs.length) { console.warn(`SKIP ${unitName} — no animations grouped`); skipped++; continue; }

      fs.copyFileSync(pngSrc, path.join(outDir, pngName));
      fs.writeFileSync(path.join(outDir, `${unitName}.json`),       JSON.stringify({ frames: atlasFrames }, null, 2));
      fs.writeFileSync(path.join(outDir, `${unitName}_anims.json`), JSON.stringify(animDefs, null, 2));

      ok++;
      if (ok % 100 === 0) console.log(`  ${ok}/${plists.length} done...`);
    } catch (err) {
      console.error(`ERROR ${unitName}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone. ${ok} converted, ${skipped} skipped, ${errors} errors.`);
  console.log(`Output: ${outDir}`);
}

main();
