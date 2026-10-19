import sqlite3

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.app.users import AuthError, UserStore, _hash


@pytest.fixture
def store():
    s = UserStore(":memory:")
    yield s
    s.close()


def test_가입한_아이디_비밀번호로_로그인한다(store):
    assert store.signup("kim_01", "secret1").id == "kim_01"
    user = store.login("kim_01", "secret1")
    assert (user.id, user.tutorial_seen) == ("kim_01", False)


def test_틀린_비밀번호와_없는_아이디는_같은_메시지로_거절한다(store):
    store.signup("kim_01", "secret1")
    with pytest.raises(AuthError) as wrong:
        store.login("kim_01", "secret2")
    with pytest.raises(AuthError) as missing:
        store.login("lee", "secret1")
    assert wrong.value.status == missing.value.status == 401
    assert wrong.value.message == missing.value.message


def test_같은_아이디는_대소문자_무시하고_다시_가입할_수_없다(store):
    store.signup("kim_01", "secret1")
    with pytest.raises(AuthError) as e:
        store.signup("KIM_01", "other12")
    assert e.value.status == 409


@pytest.mark.parametrize("user_id,password", [("ab", "secret1"), ("김철수", "secret1"), ("kim_01", "12345")])
def test_아이디_비밀번호_형식을_검사한다(store, user_id, password):
    with pytest.raises(AuthError) as e:
        store.signup(user_id, password)
    assert e.value.status == 400


def test_튜토리얼_가이드를_본_기록을_저장한다(store):
    store.signup("kim_01", "secret1")
    assert store.mark_tutorial_seen("KIM_01")
    assert store.login("kim_01", "secret1").tutorial_seen
    assert not store.mark_tutorial_seen("nobody")


def test_예전_Node_서버의_해시와_같다():
    # Node: crypto.scryptSync('secret1', Buffer.from('0011…eeff', 'hex'), 32)
    salt = bytes.fromhex("00112233445566778899aabbccddeeff")
    assert _hash("secret1", salt).hex() == "0421ced705cb1d2d24a213dc96ff8882b663ac547c847ec64739540bf74ac269"


def test_튜토리얼_열이_없던_예전_DB도_연다(tmp_path):
    path = str(tmp_path / "users.db")
    old = sqlite3.connect(path)
    old.execute(
        "CREATE TABLE users (id TEXT PRIMARY KEY COLLATE NOCASE, salt BLOB NOT NULL, hash BLOB NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))"
    )
    old.close()
    s = UserStore(path)
    s.signup("kim_01", "secret1")
    assert not s.login("kim_01", "secret1").tutorial_seen
    s.close()


def test_API_응답_형식(tmp_path):
    client = TestClient(create_app(str(tmp_path / "users.db")))
    assert client.post("/api/signup", json={"id": "kim_01", "password": "secret1"}).json() == {"id": "kim_01", "tutorialSeen": False}
    assert client.post("/api/tutorial-seen", json={"id": "kim_01"}).json() == {"ok": True}
    assert client.post("/api/login", json={"id": " kim_01 ", "password": "secret1"}).json() == {"id": "kim_01", "tutorialSeen": True}
    bad = client.post("/api/login", json={"id": "kim_01", "password": "nope123"})
    assert bad.status_code == 401 and bad.json()["message"] == "아이디 또는 비밀번호가 올바르지 않습니다."
    assert client.post("/api/login", content=b"not json").status_code == 400
    assert client.post("/api/tutorial-seen", json={"id": "nobody"}).status_code == 404
