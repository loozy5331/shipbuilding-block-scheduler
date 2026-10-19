import { useEffect } from 'react';
import { useStore } from './store/schedulerStore';
import { InputPage } from './components/input/InputPage';
import { BoardPage } from './components/board/BoardPage';
import { Tour } from './tutorial/Tour';

export function App() {
  const page = useStore((s) => s.page);
  const setPage = useStore((s) => s.setPage);
  const blocks = useStore((s) => s.blocks);
  const tutorialSeen = useStore((s) => s.tutorialSeen);
  const tutorialStep = useStore((s) => s.tutorialStep);
  const startTutorial = useStore((s) => s.startTutorial);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  // 첫 방문이면 튜토리얼을 띄운다
  useEffect(() => {
    if (!tutorialSeen && tutorialStep === null) startTutorial();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <span className="brand-bar" />
          블록 일정 스케줄러
        </div>
        <nav className="tabs">
          <button type="button" className={page === 'input' ? 'on' : ''} onClick={() => setPage('input')}>
            1. 입력
          </button>
          <button type="button" className={page === 'board' ? 'on' : ''} onClick={() => setPage('board')} disabled={blocks.length === 0}>
            2. 배치
          </button>
        </nav>
        <button type="button" className="btn ghost small" onClick={startTutorial}>
          튜토리얼
        </button>
      </header>
      <main className={page === 'input' ? 'main paper-bg' : 'main'}>{page === 'input' ? <InputPage /> : <BoardPage />}</main>
      <Tour />
    </>
  );
}
