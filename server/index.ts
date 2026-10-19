/** 배포용 서버: dist/ 정적 파일 + 로그인 API. `npm run build && npm start` */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { authMiddleware, openUserStore } from './auth.ts';

const PORT = Number(process.env.PORT ?? 8787);
const DIST = join(import.meta.dirname, '..', 'dist');
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const auth = authMiddleware(openUserStore(process.env.AUTH_DB ?? 'data/users.db'));

createServer((req, res) => {
  auth(req, res, () => {
    const path = normalize(decodeURIComponent(req.url?.split('?')[0] ?? '/')).replace(/^(\.\.[/\\])+/, '');
    let file = join(DIST, path);
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
