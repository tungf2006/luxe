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
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

// Sensitive file patterns that should never be served publicly
const FORBIDDEN_PATTERNS = [
  /^\/\./,              // Hidden files/directories (.env, .git, etc.)
  /package.*\.json$/,   // package descriptors
  /server\.js$/,        // server source
  /AGENTS\.md$/,        // internal agent brain
  /\.log$/,             // log files
];

// Content Security Policy header allowing Google Fonts, Supabase, and browser ESM CDN
const CSP_HEADER = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://esm.sh",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co https://esm.sh https://cdn.jsdelivr.net https://fonts.googleapis.com https://fonts.gstatic.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

function createDevServer() {
  return http.createServer((req, res) => {
    let url = req.url.split('?')[0];
    if (url === '/') url = '/index.html';

    // 1. Security check: Block sensitive files
    if (FORBIDDEN_PATTERNS.some((pattern) => pattern.test(url))) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('403 Forbidden');
    }

    // 2. Security check: Block path traversal
    const safePath = path.normalize(path.join(__dirname, url));
    if (!safePath.startsWith(__dirname)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('403 Forbidden');
    }

    // 3. Resolve file path and extension
    let ext = path.parse(safePath).ext;
    let finalPath = safePath;

    // Handle extensionless ES module imports inside /src/
    if (!ext && safePath.includes(path.sep + 'src' + path.sep)) {
      finalPath = safePath + '.js';
      ext = '.js';
    }

    fs.readFile(finalPath, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
      } else {
        const isDevAsset = ['.js', '.json', '.css'].includes(ext);
        res.writeHead(200, {
          'Content-Type': MIME[ext] || 'text/plain',
          'Content-Security-Policy': CSP_HEADER,
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
          ...(isDevAsset ? { 'Cache-Control': 'no-cache, no-store, must-revalidate' } : { 'Cache-Control': 'public, max-age=86400' }),
        });
        res.end(data);
      }
    });
  });
}

function startServer(port, maxAttempts = 5) {
  let currentPort = port;
  let attempts = 0;

  function tryListen() {
    const srv = createDevServer();

    srv.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        attempts++;
        console.warn(`⚠️  Port ${currentPort} đang bận (đã có tiến trình khác sử dụng).`);
        if (attempts < maxAttempts) {
          currentPort++;
          console.log(`🔄 Đang thử tự động chuyển sang port ${currentPort}...`);
          tryListen();
        } else {
          console.error(`❌ Không thể tìm port trống sau ${maxAttempts} lần thử.`);
          console.error(`💡 Mẹo: Giải phóng port bằng lệnh PowerShell:`);
          console.error(`   Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force`);
          process.exit(1);
        }
      } else {
        console.error('Lỗi khởi động máy chủ:', err);
        process.exit(1);
      }
    });

    srv.listen(currentPort, () => {
      console.log(`🚀 Luxe dev server đang hoạt động tại: http://localhost:${currentPort}`);
      if (currentPort !== 3000) {
        console.log(`ℹ️  Lưu ý: Đang sử dụng port ${currentPort} thay cho 3000.`);
      }
    });
  }

  tryListen();
}

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
startServer(DEFAULT_PORT);
