import { useEffect } from 'react';
import { PAGES, useStore, type Page } from './store/schedulerStore';
import { LoginPage, MenuPage, ModeToggle } from './components/home/StartPages';
import { InputPage } from './components/input/InputPage';
import { BoardPage } from './components/board/BoardPage';
import { ResultPage } from './components/result/ResultPage';
import { Tour } from './tutorial/Tour';
import { Toast } from './components/common/Modal';

const VIEW: Record<Page, () => React.ReactNode> = {
  login: LoginPage,
  menu: MenuPage,
  setup: InputPage,
  schedule: BoardPage,
  result: ResultPage,
};

export function App() {
  const page = useStore((s) => s.page);
  const setPage = useStore((s) => s.setPage);
  const blocks = useStore((s) => s.blocks);
  const user = useStore((s) => s.user);
  const mode = useStore((s) => s.mode);
  const logout = useStore((s) => s.logout);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  // Esc: 클릭 배정용으로 고른 아이콘 해제
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && useStore.getState().selectToken(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 로그인 전에는 로그인만, 블록이 없으면 스케줄링·결과로 갈 수 없다
  const needsBlocks = (p: Page) => p === 'schedule' || p === 'result';
  const current: Page = !user ? 'login' : needsBlocks(page) && blocks.length === 0 ? 'setup' : page;
  const View = VIEW[current];

  return (
    <>
      <header className="topbar">
        <button type="button" className="brand" onClick={() => user && setPage('menu')} aria-label="메뉴로">
          <span className="brand-bar" />
          블록 일정 스케줄러
        </button>
        <nav className="tabs steps" aria-label="단계">
          {PAGES.map((p, i) => (
            <button
              key={p.page}
              type="button"
              className={current === p.page ? 'on' : ''}
              aria-current={current === p.page ? 'step' : undefined}
              onClick={() => setPage(p.page)}
              disabled={(!user && p.page !== 'login') || (!!user && p.page === 'login') || (needsBlocks(p.page) && blocks.length === 0)}
            >
              <span className="step-no">{i + 1}</span>
              <span className="step-label">{p.label}</span>
            </button>
          ))}
        </nav>
        <div className="topbar-right">
          {current === 'login' ? <ModeToggle /> : <span className={`mode-chip ${mode}`}>{mode === 'expert' ? '숙련자' : '신입'}</span>}
          {user && (
            <span className="user-chip">
              {user.guest ? '체험 중' : user.id}
              <button type="button" className="link-btn" onClick={logout} data-testid="logout-btn">
                {user.guest ? '나가기' : '로그아웃'}
              </button>
            </span>
          )}
        </div>
      </header>
      <main className={current === 'login' || current === 'menu' ? 'main paper-bg' : 'main'}>
        <View />
      </main>
      <Tour />
      <Toast />
    </>
  );
}
