# 배포 이미지: Node로 화면을 빌드하고, Python 이미지의 uvicorn 하나가 화면과 로그인 API를 함께 제공한다.
FROM node:24-slim AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY frontend frontend
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PORT=8787 AUTH_DB=/data/users.db
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/__init__.py backend/__init__.py
COPY backend/app backend/app
COPY --from=web /app/frontend/dist frontend/dist
# 회원 DB는 /data에 둔다. 영구 볼륨은 호스팅 쪽에서 붙인다(Railway는 Dockerfile의 VOLUME을 허용하지 않음)
EXPOSE 8787
CMD ["sh", "-c", "exec python -m uvicorn --factory backend.app.main:create_app --host 0.0.0.0 --port ${PORT}"]
