// Minimal local server: serves index/assets and handles /api/save + /api/get-state
// Usage: node server.js (optionally PORT=4000)
const http = require('http');
const fs = require('fs/promises');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, 'data.json');

const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

async function handleApi(req, res) {
  if (req.url.startsWith('/api/save') && req.method === 'POST') {
    let raw = '';
    req.on('data', chunk => (raw += chunk));
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(raw || '{}');
        if (!parsed.data) return send(res, 400, { error: 'No data provided' });
        await fs.writeFile(DATA_PATH, JSON.stringify(parsed.data, null, 2), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json', 'X-Persist-Mode': 'file' });
        return res.end(JSON.stringify({ success: true, url: DATA_PATH, mode: 'file' }));
      } catch (err) {
        console.error('Save failed', err);
        return send(res, 500, { error: 'Failed to save state' });
      }
    });
    return true;
  }

  if (req.url.startsWith('/api/get-state') && req.method === 'GET') {
    try {
      const raw = await fs.readFile(DATA_PATH, 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json', 'X-Persist-Mode': 'file' });
      return res.end(raw);
    } catch (err) {
      return send(res, 404, { error: 'No state found' }, { 'X-Persist-Mode': 'file' });
    }
  }

  return false;
}

async function handleStatic(req, res) {
  const safePath = req.url.split('?')[0].split('#')[0];
  const target = safePath === '/' ? 'index.html' : safePath.slice(1);
  const filePath = path.join(__dirname, target);
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type = mime[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  } catch (err) {
    res.writeHead(404);
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  // Basic CORS for local testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.end();

  if (await handleApi(req, res)) return;
  return handleStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Local HOA server running at http://localhost:${PORT}`);
  console.log('Data will be stored in data.json beside index.html');
});
