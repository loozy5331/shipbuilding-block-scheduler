import { useEffect } from 'react';
import { useStore } from './store/schedulerStore';
import { HomePage } from './components/home/HomePage';
import { InputPage } from './components/input/InputPage';
import { BoardPage } from './components/board/BoardPage';
import { Tour } from './tutorial/Tour';
import { Toast } from './components/common/Modal';

export function App() {
  const page = useStore((s) => s.page);
  const setPage = useStore((s) => s.setPage);
  const blocks = useStore((s) => s.blocks);
  const mode = useStore((s) => s.mode);
  const startTutorial = useStore((s) => s.startTutorial);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  // Esc: 클릭 배정용으로 고른 아이콘 해제
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && useStore.getState().selectToken(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // 모드를 고르기 전에는 진입 화면만 보인다
  const current = mode ? page : 'home';

  return (
    <>
      <header className="topbar">
        <button type="button" className="brand" onClick={() => setPage('home')} aria-label="처음 화면">
          <span className="brand-bar" />
          블록 일정 스케줄러
        </button>
        {mode && (
          <nav className="tabs">
            <button type="button" className={current === 'home' ? 'on' : ''} onClick={() => setPage('home')}>
              홈
            </button>
            <button type="button" className={current === 'input' ? 'on' : ''} onClick={() => setPage('input')}>
              1. 입력
            </button>
            <button type="button" className={current === 'board' ? 'on' : ''} onClick={() => setPage('board')} disabled={blocks.length === 0}>
              2. 배치
            </button>
          </nav>
        )}
        {mode && (
          <>
            <span className={`mode-chip ${mode}`}>{mode === 'expert' ? '숙련자' : '신입'}</span>
            <button type="button" className="btn ghost small" onClick={startTutorial}>
              튜토리얼
            </button>
          </>
        )}
      </header>
      <main className={current === 'board' ? 'main' : 'main paper-bg'}>
        {current === 'home' ? <HomePage /> : current === 'input' ? <InputPage /> : <BoardPage />}
      </main>
      <Tour />
      <Toast />
    </>
  );
}
