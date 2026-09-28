import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';
  const filePath = path.join(__dirname, url);
  const ext = path.parse(filePath).dir.includes('src') && !path.parse(filePath).ext
    ? '.js'
    : path.parse(filePath).ext;

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
    } else {
      const isDevAsset = ['.js', '.json', '.css'].includes(ext);
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'text/plain',
        ...(isDevAsset ? { 'Cache-Control': 'no-cache, no-store, must-revalidate' } : {}),
      });
      res.end(data);
    }
  });
});

server.listen(3000, () => console.log('Luxe dev server: http://localhost:3000'));
