import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { authMiddleware, openUserStore } from './server/auth.ts';

/** 개발·미리보기 서버에도 로그인 API(/api/signup, /api/login)를 붙인다 */
function authApi(): Plugin {
  const handler = () => authMiddleware(openUserStore(process.env.AUTH_DB ?? 'data/users.db'));
  return {
    name: 'auth-api',
    configureServer: (server) => void server.middlewares.use(handler()),
    configurePreviewServer: (server) => void server.middlewares.use(handler()),
  };
}

export default defineConfig({
  plugins: [react(), authApi()],
  test: { include: ['tests/**/*.test.ts'] },
} as never);
