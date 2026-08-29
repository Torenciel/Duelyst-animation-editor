#!/usr/bin/env node
/**
 * Batch converter: Cocos2d .plist  →  atlas JSON + anims JSON
 *
 * Output per effect (in --out folder):
 *   {fx}.png          — copied as-is
 *   {fx}.json         — atlas  { frames: { name: { frame: {x,y,w,h} } } }
 *   {fx}_anims.json   — [ { key, repeat, frames: [{name, duration}] } ]
 *
 * Usage:
 *   node convert-fx.js
 *   node convert-fx.js --fps 30
 *   node convert-fx.js --fx f3_fx_circleofdessication
 *   node convert-fx.js --out ./my-assets
 *
 * Requires "fxDir" set in config.json.
 */

const fs   = require('fs');
const path = require('path');

const OUT_DIR = path.resolve(path.join(__dirname, 'dist-fx'));

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const getArg = name => { const i = args.indexOf(name); return i !== -1 ? args[i + 1] : null; };

const config = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')); }
  catch { return {}; }
})();

if (!config.fxDir) { console.error('Error: set "fxDir" in config.json'); process.exit(1); }
const FX_DIR = path.resolve(config.fxDir);

const fxFilter = (() => {
  const v = getArg('--fx');
  return v ? new Set(v.split(',').map(s => s.trim())) : null;
})();
const outDir = (() => { const v = getArg('--out'); return v ? path.resolve(v) : OUT_DIR; })();
const fps = (() => { const v = getArg('--fps'); return v ? parseFloat(v) : 60; })();
const frameDuration = Math.round(1000 / fps);

// ---------------------------------------------------------------------------
// Parse Cocos2d plist  →  { frames: Map<name, {x,y,w,h}>, textureName }
// The frame rect string is "{{x,y},{w,h}}"
// ---------------------------------------------------------------------------
function parsePlist(plistPath) {
  const text = fs.readFileSync(plistPath, 'utf8');
  const frames = new Map();

  // Extract the frames dict block (between <key>frames</key> and <key>metadata</key>)
  const framesBlockM = text.match(/<key>frames<\/key>\s*<dict>([\s\S]*?)<\/dict>\s*<key>metadata<\/key>/);
  if (!framesBlockM) throw new Error('Could not find frames block');

  const block = framesBlockM[1];

  // Split on each frame entry: <key>name</key><dict>...</dict>
  const entryRe = /<key>([^<]+)<\/key>\s*<dict>([\s\S]*?)<\/dict>/g;
  let m;
  while ((m = entryRe.exec(block)) !== null) {
    const name = path.basename(m[1], '.png'); // strip .png suffix if present
    const entryBlock = m[2];

    const frameM = entryBlock.match(/<key>frame<\/key>\s*<string>\{\{(\d+),(\d+)\},\{(\d+),(\d+)\}\}<\/string>/);
    if (!frameM) continue;

    const rotatedM = entryBlock.match(/<key>rotated<\/key>\s*<(true|false)\/>/);
    const rotated  = rotatedM ? rotatedM[1] === 'true' : false;

    const x = parseInt(frameM[1], 10);
    const y = parseInt(frameM[2], 10);
    const w = rotated ? parseInt(frameM[4], 10) : parseInt(frameM[3], 10);
    const h = rotated ? parseInt(frameM[3], 10) : parseInt(frameM[4], 10);

    frames.set(name, { x, y, w, h, rotated });
  }

  // Texture filename from metadata
  const texM = text.match(/<key>textureFileName<\/key>\s*<string>([^<]+)<\/string>/);
  const textureName = texM ? texM[1] : null;

  return { frames, textureName };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const plists = fs.readdirSync(FX_DIR)
    .filter(f => f.endsWith('.plist') && (!fxFilter || fxFilter.has(path.basename(f, '.plist'))));

  let ok = 0, skipped = 0, errors = 0;

  for (const plistFile of plists) {
    const fxName = path.basename(plistFile, '.plist');
    const plistPath = path.join(FX_DIR, plistFile);

    try {
      const { frames, textureName } = parsePlist(plistPath);

      if (!frames.size) {
        console.warn(`SKIP ${fxName} — no frames parsed`);
        skipped++;
        continue;
      }

      // Resolve PNG source — prefer the textureFileName from metadata, fall back to same-name
      const pngName = textureName || `${fxName}.png`;
      const pngSrc  = path.join(FX_DIR, pngName);
      if (!fs.existsSync(pngSrc)) {
        console.warn(`SKIP ${fxName} — PNG not found: ${pngName}`);
        skipped++;
        continue;
      }

      // Atlas JSON
      const atlasFrames = {};
      for (const [name, rect] of frames) {
        atlasFrames[name] = { frame: { x: rect.x, y: rect.y, w: rect.w, h: rect.h }, rotated: rect.rotated };
      }

      // Anims JSON — single animation, frames sorted by name (000, 001, ...)
      const sortedNames = [...frames.keys()].sort();
      const animFrames  = sortedNames.map(name => ({ name, duration: frameDuration }));

      const animDefs = [{
        key:    fxName,
        repeat: 0,   // play once — VFX don't loop
        frames: animFrames,
      }];

      // Write outputs
      fs.copyFileSync(pngSrc, path.join(outDir, pngName));
      fs.writeFileSync(path.join(outDir, `${fxName}.json`),       JSON.stringify({ frames: atlasFrames }, null, 2));
      fs.writeFileSync(path.join(outDir, `${fxName}_anims.json`), JSON.stringify(animDefs, null, 2));

      ok++;
      if (ok % 50 === 0) console.log(`  ${ok}/${plists.length} done...`);
    } catch (err) {
      console.error(`ERROR ${fxName}: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone. ${ok} converted, ${skipped} skipped, ${errors} errors.`);
  console.log(`Output: ${outDir}`);
}

main();
