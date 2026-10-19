import { useEffect } from 'react';
import { PAGES, useStore, type Page } from './store/schedulerStore';
import { LoginPage } from './components/home/LoginPage';
import { MenuPage } from './components/home/MenuPage';
import { ModeToggle } from './components/home/ModeToggle';
import { InputPage } from './components/input/InputPage';
import { BoardPage } from './components/board/BoardPage';
import { ResultPage } from './components/result/ResultPage';
import { Tour } from './tutorial/Tour';
import { Toast } from './components/common/Modal';
import { AssemblyShow } from './components/assembly/AssemblyShow';

const VIEW: Record<Page, () => React.ReactNode> = {
  login: LoginPage,
  menu: MenuPage,
  setup: InputPage,
  schedule: BoardPage,
  result: ResultPage,
};

/** 튜토리얼 중에는 지금 페이지와 가이드를 이미 본(지나온) 페이지로만 이동한다 (순서를 건너뛰지 않게) */
function openInTutorial(page: Page, current: Page, guided: Page[]) {
  return page === current || (page !== 'menu' && page !== 'login' && guided.includes(page));
}

export function App() {
  const page = useStore((s) => s.page);
  const setPage = useStore((s) => s.setPage);
  const blocks = useStore((s) => s.blocks);
  const user = useStore((s) => s.user);
  const mode = useStore((s) => s.mode);
  const tutorialActive = useStore((s) => s.tutorialActive);
  const tutorialGuided = useStore((s) => s.tutorialGuided);
  const logout = useStore((s) => s.logout);
  const assemblyShow = useStore((s) => s.assemblyShow);

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
              disabled={
                (!user && p.page !== 'login') ||
                (!!user && p.page === 'login') ||
                (needsBlocks(p.page) && blocks.length === 0) ||
                (tutorialActive && !openInTutorial(p.page, current, tutorialGuided))
              }
              title={tutorialActive && !openInTutorial(p.page, current, tutorialGuided) ? '튜토리얼 중에는 각 페이지의 다음 버튼으로 이동합니다' : undefined}
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
      {assemblyShow && current === 'result' && <AssemblyShow />}
    </>
  );
}
