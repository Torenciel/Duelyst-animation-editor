const fs   = require('fs');
const path = require('path');

const distDir = path.join(__dirname, 'dist');
const units   = fs.readdirSync(distDir)
  .filter(f => f.endsWith('_anims.json'))
  .map(f => f.replace('_anims.json', ''))
  .sort();

fs.writeFileSync(
  path.join(distDir, 'manifest.json'),
  JSON.stringify(units, null, 2)
);

console.log(`manifest.json written — ${units.length} units`);
