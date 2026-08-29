const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.css':  'text/css',
};

function serveStatic(req, res) {
  const urlPath  = req.url.split('?')[0];
  const relative = urlPath === '/' ? 'viewer.html' : urlPath.replace(/^\//, '');
  const filePath = path.resolve(ROOT, relative);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  const target = filePath;
  const ext    = path.extname(target);

  fs.readFile(target, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function handleSave(req, res) {
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString()); }
    catch { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid JSON' })); return; }

    const { path: relPath, data } = body;

    if (typeof relPath !== 'string' || relPath.includes('..') || !relPath.startsWith('dist')) {
      res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid path' })); return;
    }

    const absPath = path.resolve(ROOT, relPath);
    if (!absPath.startsWith(ROOT)) {
      res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Forbidden' })); return;
    }

    fs.mkdirSync(path.dirname(absPath), { recursive: true });

    // Mirror the PNG and atlas JSON from the base dist folder if not already there
    const segments  = relPath.split('/');
    const baseSeg   = segments[0].replace('-custom', '');
    const unitFile  = segments[segments.length - 1].replace('_anims.json', '');
    for (const ext of ['.png', '.json']) {
      const src  = path.resolve(ROOT, baseSeg, unitFile + ext);
      const dest = path.resolve(ROOT, path.dirname(absPath), unitFile + ext);
      if (fs.existsSync(src) && !fs.existsSync(dest)) fs.copyFileSync(src, dest);
    }

    fs.writeFile(absPath, JSON.stringify(data, null, 2), 'utf8', err => {
      if (err) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: err.message })); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true }));
    });
  });
}

function handleDeleteFile(req, res) {
  const url     = new URL(req.url, `http://localhost:${PORT}`);
  const dir     = url.searchParams.get('dir');
  const name    = url.searchParams.get('name');

  if (!dir || dir.includes('..') || !dir.startsWith('dist') ||
      !name || name.includes('..') || name.includes('/') || name.includes('\\')) {
    res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid params' })); return;
  }
  const absDir = path.resolve(ROOT, dir);
  if (!absDir.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Forbidden' })); return;
  }

  const toDelete = [
    path.join(absDir, `${name}_anims.json`),
    path.join(absDir, `${name}.json`),
    path.join(absDir, `${name}.png`),
  ];
  for (const f of toDelete) {
    if (fs.existsSync(f)) try { fs.unlinkSync(f); } catch {}
  }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true }));
}

function handleList(req, res) {
  const url    = new URL(req.url, `http://localhost:${PORT}`);
  const dir    = url.searchParams.get('dir');
  if (!dir || dir.includes('..') || !dir.startsWith('dist')) {
    res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid dir' })); return;
  }
  const absDir = path.resolve(ROOT, dir);
  if (!absDir.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Forbidden' })); return;
  }
  try {
    const names = fs.readdirSync(absDir)
      .filter(f => f.endsWith('_anims.json'))
      .map(f => f.replace('_anims.json', ''))
      .sort();
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(names));
  } catch {
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify([]));
  }
}

function handleSaveBinary(req, res) {
  const url     = new URL(req.url, `http://localhost:${PORT}`);
  const relPath = url.searchParams.get('path');

  if (typeof relPath !== 'string' || relPath.includes('..') || !relPath.startsWith('dist')) {
    res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Invalid path' })); return;
  }
  const absPath = path.resolve(ROOT, relPath);
  if (!absPath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Forbidden' })); return;
  }

  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFile(absPath, Buffer.concat(chunks), err => {
      if (err) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: err.message })); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true }));
    });
  });
}

const { exec } = require('child_process');

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method === 'POST' && req.url === '/save') handleSave(req, res);
  else if (req.method === 'POST' && req.url.startsWith('/save-binary')) handleSaveBinary(req, res);
  else if (req.method === 'DELETE' && req.url.startsWith('/delete-file')) handleDeleteFile(req, res);
  else if (req.method === 'GET' && req.url.startsWith('/list')) handleList(req, res);
  else if (req.method === 'GET' && req.url === '/open-folder') {
    exec(`explorer "${ROOT}"`);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: true }));
  }
  else serveStatic(req, res);
}).listen(PORT, () => console.log(`Duelyst viewer → http://localhost:${PORT}/viewer.html`));
