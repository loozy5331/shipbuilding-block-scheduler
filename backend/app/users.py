"""회원 저장소 (SQLite). 비밀번호는 사용자마다 다른 salt로 scrypt 해시한다.

해시 파라미터(N=16384, r=8, p=1, 32바이트)는 예전 Node 서버(crypto.scryptSync 기본값)와 같아서 기존 DB를 그대로 쓴다.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import re
import sqlite3
import threading
from dataclasses import dataclass
from pathlib import Path

ID_RULE = re.compile(r"^[A-Za-z0-9_]{3,20}$")
PASSWORD_MIN = 6
PASSWORD_MAX = 64


@dataclass
class AuthOk:
    id: str
    tutorial_seen: bool


class AuthError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def _hash(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=16384, r=8, p=1, dklen=32)


class UserStore:
    def __init__(self, path: str):
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        # FastAPI가 요청을 여러 스레드에서 처리하므로 연결 하나를 잠금으로 공유한다
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._lock = threading.Lock()
        with self._lock, self._db:
            self._db.execute(
                """CREATE TABLE IF NOT EXISTS users (
                  id TEXT PRIMARY KEY COLLATE NOCASE,
                  salt BLOB NOT NULL,
                  hash BLOB NOT NULL,
                  created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )"""
            )
            # 튜토리얼 가이드를 본 적 있는지 (처음 로그인할 때만 가이드를 띄운다). 예전 DB에는 열을 더한다
            columns = {row[1] for row in self._db.execute("PRAGMA table_info(users)")}
            if "tutorial_seen" not in columns:
                self._db.execute("ALTER TABLE users ADD COLUMN tutorial_seen INTEGER NOT NULL DEFAULT 0")

    def signup(self, user_id: str, password: str) -> AuthOk:
        if not ID_RULE.match(user_id):
            raise AuthError(400, "아이디는 영문·숫자·밑줄 3~20자로 입력하세요.")
        if not PASSWORD_MIN <= len(password) <= PASSWORD_MAX:
            raise AuthError(400, f"비밀번호는 {PASSWORD_MIN}~{PASSWORD_MAX}자로 입력하세요.")
        salt = os.urandom(16)
        with self._lock, self._db:
            if self._db.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone():
                raise AuthError(409, "이미 있는 아이디입니다.")
            self._db.execute("INSERT INTO users (id, salt, hash) VALUES (?, ?, ?)", (user_id, salt, _hash(password, salt)))
        return AuthOk(user_id, False)

    def login(self, user_id: str, password: str) -> AuthOk:
        with self._lock:
            row = self._db.execute("SELECT id, salt, hash, tutorial_seen FROM users WHERE id = ?", (user_id,)).fetchone()
        # 없는 아이디와 틀린 비밀번호를 구분하지 않는다
        if not row or not hmac.compare_digest(_hash(password, row[1]), row[2]):
            raise AuthError(401, "아이디 또는 비밀번호가 올바르지 않습니다.")
        return AuthOk(row[0], row[3] == 1)

    def mark_tutorial_seen(self, user_id: str) -> bool:
        """튜토리얼 가이드를 봤다고 기록한다. 없는 아이디면 False"""
        with self._lock, self._db:
            return self._db.execute("UPDATE users SET tutorial_seen = 1 WHERE id = ?", (user_id,)).rowcount > 0

    def close(self) -> None:
        self._db.close()
