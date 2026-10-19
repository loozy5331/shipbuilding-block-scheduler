import { afterEach, describe, expect, it } from 'vitest';
import { openUserStore, type UserStore } from '../server/auth.ts';

describe('회원가입·로그인', () => {
  let store: UserStore;
  afterEach(() => store.close());

  it('가입한 아이디·비밀번호로 로그인한다', () => {
    store = openUserStore(':memory:');
    expect(store.signup('kim_01', 'secret1')).toEqual({ ok: true, id: 'kim_01', tutorialSeen: false });
    expect(store.login('kim_01', 'secret1')).toEqual({ ok: true, id: 'kim_01', tutorialSeen: false });
  });

  it('틀린 비밀번호와 없는 아이디는 같은 메시지로 거절한다', () => {
    store = openUserStore(':memory:');
    store.signup('kim_01', 'secret1');
    const wrong = store.login('kim_01', 'secret2');
    const missing = store.login('lee', 'secret1');
    expect(wrong).toMatchObject({ ok: false, status: 401 });
    expect(missing).toEqual(wrong);
  });

  it('같은 아이디(대소문자 무시)는 다시 가입할 수 없다', () => {
    store = openUserStore(':memory:');
    store.signup('kim_01', 'secret1');
    expect(store.signup('KIM_01', 'other12')).toMatchObject({ ok: false, status: 409 });
  });

  it('아이디·비밀번호 형식을 검사한다', () => {
    store = openUserStore(':memory:');
    expect(store.signup('ab', 'secret1')).toMatchObject({ ok: false, status: 400 });
    expect(store.signup('김철수', 'secret1')).toMatchObject({ ok: false, status: 400 });
    expect(store.signup('kim_01', '12345')).toMatchObject({ ok: false, status: 400 });
  });

  it('튜토리얼 가이드를 본 기록을 저장한다 (아이디 대소문자 무시)', () => {
    store = openUserStore(':memory:');
    store.signup('kim_01', 'secret1');
    expect(store.markTutorialSeen('KIM_01')).toBe(true);
    expect(store.login('kim_01', 'secret1')).toMatchObject({ ok: true, tutorialSeen: true });
    expect(store.markTutorialSeen('nobody')).toBe(false);
  });

  it('튜토리얼 열이 없던 예전 DB도 연다', async () => {
    const { DatabaseSync } = await import('node:sqlite');
    const { mkdtempSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const path = join(mkdtempSync(join(tmpdir(), 'auth-')), 'users.db');
    const old = new DatabaseSync(path);
    old.exec("CREATE TABLE users (id TEXT PRIMARY KEY COLLATE NOCASE, salt BLOB NOT NULL, hash BLOB NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))");
    old.close();
    store = openUserStore(path);
    store.signup('kim_01', 'secret1');
    expect(store.login('kim_01', 'secret1')).toMatchObject({ ok: true, tutorialSeen: false });
  });
});
