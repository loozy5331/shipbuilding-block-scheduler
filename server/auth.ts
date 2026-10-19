import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

/** 아이디: 영문·숫자·밑줄 3~20자, 비밀번호: 6~64자 */
export const ID_RULE = /^[A-Za-z0-9_]{3,20}$/;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 64;

export type AuthResult = { ok: true; id: string } | { ok: false; status: number; message: string };

/** 비밀번호는 사용자마다 다른 salt로 scrypt 해시해서 저장한다 */
function hash(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, 32);
}

export function openUserStore(path: string) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY COLLATE NOCASE,
    salt BLOB NOT NULL,
    hash BLOB NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  const find = db.prepare('SELECT id, salt, hash FROM users WHERE id = ?');
  const insert = db.prepare('INSERT INTO users (id, salt, hash) VALUES (?, ?, ?)');

  return {
    signup(id: string, password: string): AuthResult {
      if (!ID_RULE.test(id)) return { ok: false, status: 400, message: '아이디는 영문·숫자·밑줄 3~20자로 입력하세요.' };
      if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX)
        return { ok: false, status: 400, message: `비밀번호는 ${PASSWORD_MIN}~${PASSWORD_MAX}자로 입력하세요.` };
      if (find.get(id)) return { ok: false, status: 409, message: '이미 있는 아이디입니다.' };
      const salt = randomBytes(16);
      insert.run(id, salt, hash(password, salt));
      return { ok: true, id };
    },
    login(id: string, password: string): AuthResult {
      const row = find.get(id) as { id: string; salt: Uint8Array; hash: Uint8Array } | undefined;
      // 없는 아이디와 틀린 비밀번호를 구분하지 않는다
      if (!row || !timingSafeEqual(hash(password, Buffer.from(row.salt)), Buffer.from(row.hash)))
        return { ok: false, status: 401, message: '아이디 또는 비밀번호가 올바르지 않습니다.' };
      return { ok: true, id: row.id };
    },
    close: () => db.close(),
  };
}

export type UserStore = ReturnType<typeof openUserStore>;

function readJSON(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > 10_000) req.destroy();
    });
    req.on('end', () => {
      try {
        const v = JSON.parse(body);
        resolve(v && typeof v === 'object' ? v : {});
      } catch {
        resolve({});
      }
    });
  });
}

function send(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

/** POST /api/signup, POST /api/login — 그 밖의 요청은 next로 넘긴다 */
export function authMiddleware(store: UserStore) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const route = req.url?.split('?')[0];
    if (req.method !== 'POST' || (route !== '/api/signup' && route !== '/api/login')) return next();
    const body = await readJSON(req);
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const r = route === '/api/signup' ? store.signup(id, password) : store.login(id, password);
    if (r.ok) send(res, 200, { id: r.id });
    else send(res, r.status, { message: r.message });
  };
}
