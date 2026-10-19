import { useEffect } from 'react';
import { PAGES, useStore, type Page } from './store/schedulerStore';
import { MenuPage, ModePage } from './components/home/StartPages';
import { InputPage } from './components/input/InputPage';
import { BoardPage } from './components/board/BoardPage';
import { ResultPage } from './components/result/ResultPage';
import { Tour } from './tutorial/Tour';
import { Toast } from './components/common/Modal';

const VIEW: Record<Page, () => React.ReactNode> = {
  mode: ModePage,
  menu: MenuPage,
  setup: InputPage,
  schedule: BoardPage,
  result: ResultPage,
};

export function App() {
  const page = useStore((s) => s.page);
  const setPage = useStore((s) => s.setPage);
  const blocks = useStore((s) => s.blocks);
  const mode = useStore((s) => s.mode);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  // Esc: 클릭 배정용으로 고른 아이콘 해제
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && useStore.getState().selectToken(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 모드를 고르기 전에는 모드 선택만, 블록이 없으면 스케줄링·결과로 갈 수 없다
  const needsBlocks = (p: Page) => p === 'schedule' || p === 'result';
  const current: Page = !mode ? 'mode' : needsBlocks(page) && blocks.length === 0 ? 'setup' : page;
  const View = VIEW[current];

  return (
    <>
      <header className="topbar">
        <button type="button" className="brand" onClick={() => mode && setPage('menu')} aria-label="메뉴로">
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
              disabled={(!mode && p.page !== 'mode') || (needsBlocks(p.page) && blocks.length === 0)}
            >
              <span className="step-no">{i + 1}</span>
              <span className="step-label">{p.label}</span>
            </button>
          ))}
        </nav>
        {mode && <span className={`mode-chip ${mode}`}>{mode === 'expert' ? '숙련자' : '신입'}</span>}
      </header>
      <main className={current === 'schedule' || current === 'result' ? 'main' : 'main paper-bg'}>
        <View />
      </main>
      <Tour />
      <Toast />
    </>
  );
}
