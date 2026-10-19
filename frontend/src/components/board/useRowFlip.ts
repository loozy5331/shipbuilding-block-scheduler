import { useLayoutEffect, useRef, type RefObject } from 'react';

const DURATION = 450;

/**
 * 렌더마다 블록 줄 위치를 재고, 자리가 바뀐 줄은 이전 위치에서 새 위치로 미끄러지게 한다(FLIP).
 * 최적 배치로 줄이 재정렬될 때 블록이 어디로 갔는지 보이게 하려는 것.
 */
export function useRowFlip(container: RefObject<HTMLElement | null>) {
  const prev = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const base = root.getBoundingClientRect().top;
    const next = new Map<string, number>();
    const rows = root.querySelectorAll<HTMLElement>('[data-testid^="row-"]');
    // 첫 렌더나 모션 줄이기 설정이면 위치만 기록한다
    const animate = prev.current.size > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    rows.forEach((el) => {
      const id = el.dataset.testid!;
      const top = el.getBoundingClientRect().top - base;
      next.set(id, top);
      const before = prev.current.get(id);
      if (!animate || before === undefined) return;
      const dy = before - top;
      if (Math.abs(dy) < 1) return;
      el.animate([{ transform: `translateY(${dy}px)`, zIndex: 5 }, { transform: 'translateY(0)', zIndex: 5 }], {
        duration: DURATION,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      });
    });
    prev.current = next;
  });
}
