#!/usr/bin/env node
// Tiny static file server for the live previews (ES modules need http://).
//
//   node tools/serve.mjs [port]      → http://localhost:4600/

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] ?? process.env.PORT ?? 4600);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') {
      res.writeHead(302, { Location: '/opus-birthday/' });
      res.end();
      return;
    }
    let file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT)) throw Object.assign(new Error('outside root'), { code: 'ENOENT' });
    if ((await stat(file)).isDirectory()) {
      if (!url.pathname.endsWith('/')) {
        res.writeHead(302, { Location: `${url.pathname}/` });
        res.end();
        return;
      }
      file = path.join(file, 'index.html');
    }
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch (err) {
    res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain' });
    res.end(err.code === 'ENOENT' ? 'Not found' : String(err));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Preview: http://localhost:${PORT}/`);
});
