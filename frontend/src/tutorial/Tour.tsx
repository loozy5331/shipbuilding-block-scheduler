import { useEffect, useLayoutEffect, useState } from 'react';
import { PAGES, useStore } from '../store/schedulerStore';
import { STEPS, stepsOf } from './steps';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;

function useTargetRect(target: string | undefined, key: unknown): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);
  useLayoutEffect(() => {
    if (!target) {
      setRect(null);
      return;
    }
    let frame = 0;
    let scrolled = false;
    const tick = () => {
      const el = document.querySelector(`[data-tour="${target}"]`);
      if (el) {
        if (!scrolled) {
          el.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
          scrolled = true;
        }
        const r = el.getBoundingClientRect();
        setRect((prev) =>
          prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height
            ? prev
            : { top: r.top, left: r.left, width: r.width, height: r.height },
        );
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [target, key]);
  return rect;
}

export function Tour() {
  const page = useStore((s) => s.page);
  const active = useStore((s) => s.tutorialActive);
  const guided = useStore((s) => s.tutorialGuided);
  const guidePage = useStore((s) => s.tutorialPage);
  const stepIndex = useStore((s) => s.tutorialStep);
  const setStep = useStore((s) => s.setTutorialStep);
  const openPageGuide = useStore((s) => s.openPageGuide);
  const endTutorial = useStore((s) => s.endTutorial);
  const setPage = useStore((s) => s.setPage);
  // 단계 본문이 상태(배치 결과)에 따라 바뀌므로 구독
  useStore((s) => s.assignments);
  const [ready, setReady] = useState(true);
  const pageSteps = stepsOf(page);
  const step = stepIndex !== null && guidePage === page ? (pageSteps[stepIndex] ?? null) : null;

  // 튜토리얼 중 새 페이지에 처음 들어오면 그 페이지 가이드를 연다
  useEffect(() => {
    if (active && pageSteps.length > 0 && !guided.includes(page)) openPageGuide(page);
  }, [active, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!step) return;
    let alive = true;
    setReady(false);
    Promise.resolve(step.enter?.()).finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [step]);

  useEffect(() => {
    if (!step) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') endTutorial();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, endTutorial]);

  const rect = useTargetRect(ready ? step?.target : undefined, `${page}:${stepIndex}`);
  if (!step || stepIndex === null) return null;

  const last = stepIndex === pageSteps.length - 1;
  const final = last && page === STEPS[STEPS.length - 1].page;
  const nextPage = PAGES[PAGES.findIndex((p) => p.page === page) + 1];
  // 마지막 페이지까지 보면 실제 작업을 시작하도록 메뉴로, 페이지 끝이면 가이드만 닫는다
  const next = () => {
    if (!last) return setStep(stepIndex + 1);
    if (final) {
      endTutorial();
      setPage('menu');
    } else setStep(null);
  };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(380, vw - 32);
  let cardStyle: React.CSSProperties;
  // 오른쪽 상태 칸처럼 화면 오른쪽에 있는 대상은 아래가 아니라 왼쪽 옆에 둔다 (아래에 두면 대상을 가린다)
  const besideLeft = rect ? rect.left - PAD - 16 - cardW : -1;
  if (rect && rect.left > vw / 2 && besideLeft >= 16) {
    cardStyle = { top: Math.min(Math.max(16, rect.top), vh - 260), left: besideLeft, width: cardW };
  } else if (rect) {
    const below = rect.top + rect.height + PAD + 16;
    const fitsBelow = below + 220 < vh;
    const top = fitsBelow ? below : Math.max(16, rect.top - PAD - 16 - 220);
    const left = Math.min(Math.max(16, rect.left), vw - cardW - 16);
    cardStyle = { top, left, width: cardW };
  } else {
    cardStyle = { top: '50%', left: '50%', width: Math.min(460, vw - 32), transform: 'translate(-50%, -50%)' };
  }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="튜토리얼">
      {rect ? (
        <div
          className="tour-spot"
          style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
        />
      ) : (
        <div className="tour-dim" />
      )}
      <div className="tour-card" style={cardStyle}>
        <span className="eyebrow-label">— {step.eyebrow}</span>
        <h3>{step.title}</h3>
        <p>{ready ? step.body() : '계산 중…'}</p>
        {last && !final && nextPage && <p className="tour-next-hint">화면의 ‘다음: {nextPage.label}’ 버튼을 누르면 다음 가이드가 이어집니다.</p>}
        <div className="tour-foot">
          <span className="muted">
            {stepIndex + 1} / {pageSteps.length}
          </span>
          <span className="spacer" />
          <button type="button" className="btn ghost small" onClick={endTutorial}>
            건너뛰기
          </button>
          {stepIndex > 0 && (
            <button type="button" className="btn ghost small" onClick={() => setStep(stepIndex - 1)}>
              이전
            </button>
          )}
          <button type="button" className="btn primary small" disabled={!ready} onClick={next} data-testid="tour-next">
            {final ? '마치기' : last ? '확인' : '다음'}
          </button>
        </div>
      </div>
    </div>
  );
}
