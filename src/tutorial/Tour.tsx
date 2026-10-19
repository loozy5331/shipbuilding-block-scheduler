import { useEffect, useLayoutEffect, useState } from 'react';
import { useStore } from '../store/schedulerStore';
import { STEPS } from './steps';

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
  const stepIndex = useStore((s) => s.tutorialStep);
  const setStep = useStore((s) => s.setTutorialStep);
  const setPage = useStore((s) => s.setPage);
  // 단계 본문이 상태(배치 결과)에 따라 바뀌므로 구독
  useStore((s) => s.assignments);
  const [ready, setReady] = useState(true);
  const step = stepIndex === null ? null : STEPS[stepIndex];

  useEffect(() => {
    if (!step) return;
    let alive = true;
    setPage(step.page);
    setReady(false);
    Promise.resolve(step.enter?.()).finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stepIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStep(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepIndex, setStep]);

  const rect = useTargetRect(ready ? step?.target : undefined, stepIndex);
  if (!step || stepIndex === null) return null;

  const last = stepIndex === STEPS.length - 1;
  // 끝까지 보면 실제 작업을 시작하도록 메뉴로, 건너뛰면 튜토리얼 페이지에 머문다
  const finish = () => {
    setStep(null);
    setPage('menu');
  };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(380, vw - 32);
  let cardStyle: React.CSSProperties;
  if (rect) {
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
        <div className="tour-foot">
          <span className="muted">
            {stepIndex + 1} / {STEPS.length}
          </span>
          <span className="spacer" />
          <button type="button" className="btn ghost small" onClick={() => setStep(null)}>
            건너뛰기
          </button>
          {stepIndex > 0 && (
            <button type="button" className="btn ghost small" onClick={() => setStep(stepIndex - 1)}>
              이전
            </button>
          )}
          <button type="button" className="btn primary small" disabled={!ready} onClick={() => (last ? finish() : setStep(stepIndex + 1))} data-testid="tour-next">
            {last ? '시작하기' : '다음'}
          </button>
        </div>
      </div>
    </div>
  );
}
