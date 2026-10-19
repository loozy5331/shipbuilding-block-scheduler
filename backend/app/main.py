"""API 서버: 로그인 API(+ 배포 시 frontend/dist/ 정적 파일). `uvicorn --factory backend.app.main:create_app`

개발: `npm run dev`가 vite와 함께 이 서버를 띄운다 (vite가 /api를 넘김).
배포: `npm run build && npm start` → uvicorn 하나가 화면과 API를 모두 제공한다.
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from .users import AuthError, UserStore

ROOT = Path(__file__).resolve().parents[2]
DIST = ROOT / "frontend" / "dist"


class Credentials(BaseModel):
    id: str = ""
    password: str = ""


class UserId(BaseModel):
    id: str = ""


def create_app(db_path: str | None = None) -> FastAPI:
    store = UserStore(db_path or os.environ.get("AUTH_DB", str(ROOT / "backend" / "data" / "users.db")))
    app = FastAPI(title="블록 일정 스케줄러 API", docs_url="/api/docs", openapi_url="/api/openapi.json")

    @app.exception_handler(AuthError)
    async def auth_error(_: Request, e: AuthError):
        return JSONResponse({"message": e.message}, status_code=e.status)

    @app.exception_handler(RequestValidationError)
    async def bad_body(_: Request, __: RequestValidationError):
        return JSONResponse({"message": "아이디와 비밀번호를 입력하세요."}, status_code=400)

    @app.post("/api/signup")
    def signup(body: Credentials):
        user = store.signup(body.id.strip(), body.password)
        return {"id": user.id, "tutorialSeen": user.tutorial_seen}

    @app.post("/api/login")
    def login(body: Credentials):
        user = store.login(body.id.strip(), body.password)
        return {"id": user.id, "tutorialSeen": user.tutorial_seen}

    @app.post("/api/tutorial-seen")
    def tutorial_seen(body: UserId):
        if not store.mark_tutorial_seen(body.id.strip()):
            raise AuthError(404, "없는 아이디입니다.")
        return {"ok": True}

    # 빌드된 화면. 없는 경로는 index.html (한 페이지 앱)
    @app.get("/{path:path}", include_in_schema=False)
    def static(path: str):
        file = (DIST / path).resolve()
        if path and file.is_file() and DIST in file.parents:
            return FileResponse(file)
        index = DIST / "index.html"
        if not index.is_file():
            return JSONResponse({"message": "frontend/dist/가 없습니다. npm run build를 먼저 실행하세요."}, status_code=404)
        return FileResponse(index)

    app.state.store = store
    return app
