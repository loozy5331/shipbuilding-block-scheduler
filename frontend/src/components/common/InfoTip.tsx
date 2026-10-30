import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { GLOSSARY, OPTIMAL_CRITERIA, type TermKey } from '../../domain/glossary';

const WIDTH = 280;

/**
 * 용어 옆 "i" 아이콘. 올리거나 누르면 설명을 띄운다.
 * 표·간트의 스크롤 영역에 잘리지 않도록 설명은 body에 고정 위치로 그린다.
 */
export function InfoTip({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();

  const place = () => {
    const r = btn.current!.getBoundingClientRect();
    const w = Math.min(WIDTH, window.innerWidth - 32);
    setPos({ top: r.bottom + 6, left: Math.max(16, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - 16 - w)) });
  };
  const show = () => {
    place();
    setOpen(true);
  };
  const hide = () => {
    setOpen(false);
    setPinned(false);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    const onDown = (e: PointerEvent) => !btn.current?.contains(e.target as Node) && hide();
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btn}
        type="button"
        className="info-tip"
        aria-label={`${title} 설명`}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        data-testid={testId}
        onMouseEnter={show}
        onMouseLeave={() => !pinned && setOpen(false)}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => {
          // summary·label 안에 있어도 펼치기·체크가 같이 일어나지 않게
          e.preventDefault();
          e.stopPropagation();
          if (pinned) hide();
          else {
            show();
            setPinned(true);
          }
        }}
      >
        i
      </button>
      {open &&
        createPortal(
          <div id={id} role="tooltip" className="info-pop" style={{ top: pos.top, left: pos.left, width: Math.min(WIDTH, window.innerWidth - 32) }}>
            <b>{title}</b>
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}

/** 용어집의 한 항목 */
export function Term({ k }: { k: TermKey }) {
  const t = GLOSSARY[k];
  return (
    <InfoTip title={t.term} testId={`term-${k}`}>
      <p>{t.desc}</p>
    </InfoTip>
  );
}

/** 최적 배치가 안을 고르는 기준 */
export function OptimalTip() {
  return (
    <InfoTip title="최적 배치 기준" testId="optimal-tip">
      <p>여러 착수 순서를 만들어 아래 기준으로 비교합니다. 앞 기준이 같을 때만 다음 기준을 봅니다.</p>
      <ol>
        {OPTIMAL_CRITERIA.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ol>
      <p>
        블록마다 가장 좋은 착수일과 인원(일반·숙련 조합)을 고르고, 납기 빠른 순으로 시작해 순서를 바꿔 가며 약 1초 동안 더 나은 안을 찾습니다. 합의한 블록은
        그대로 둡니다.
      </p>
    </InfoTip>
  );
}
