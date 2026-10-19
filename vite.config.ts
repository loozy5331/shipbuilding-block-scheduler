import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';

const API_PORT = Number(process.env.API_PORT ?? 8000);
const PYTHON = '.venv/bin/python';

/** 개발·미리보기 서버를 띄울 때 프로젝트 .venv의 FastAPI 서버(backend/)도 함께 띄운다 */
function pythonApi(): Plugin {
  let child: ChildProcess | null = null;
  const start = () => {
    // vitest도 이 설정을 읽으므로 단위 테스트 중에는 띄우지 않는다
    if (child || process.env.VITEST) return;
    if (!existsSync(PYTHON)) {
      console.warn('\n[api] .venv가 없습니다. `npm run setup:py`를 먼저 실행하세요. (로그인 없이 체험하기는 동작)\n');
      return;
    }
    child = spawn(PYTHON, ['-m', 'uvicorn', '--factory', 'backend.app.main:create_app', '--port', String(API_PORT), '--log-level', 'warning'], {
      stdio: 'inherit',
      env: process.env,
    });
    const stop = () => child?.kill();
    process.once('exit', stop);
    process.once('SIGINT', () => (stop(), process.exit()));
    process.once('SIGTERM', () => (stop(), process.exit()));
  };
  return {
    name: 'python-api',
    configureServer: (server) => {
      start();
      server.httpServer?.once('close', () => child?.kill());
    },
    configurePreviewServer: () => start(),
  };
}

const proxy = { '/api': `http://127.0.0.1:${API_PORT}` };

export default defineConfig({
  plugins: [react(), pythonApi()],
  server: { proxy },
  preview: { proxy },
  test: { include: ['tests/**/*.test.ts'] },
} as never);
