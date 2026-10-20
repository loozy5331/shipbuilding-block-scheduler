import type { Block } from '../../domain/types';

/** 주말·공휴일 때문에 납기가 뒤로 밀렸으면 며칠 밀렸는지 덧붙인다 */
export function DueShift({ block, due }: { block: Block; due: number }) {
  const shift = due - block.dueDay;
  if (shift <= 0) return null;
  return (
    <small className="muted due-shift" title={`남은 기간 ${block.dueDay}일을 근무일로 세어 주말·공휴일 ${shift}일만큼 납기가 늦춰졌습니다`}>
      {' '}
      (휴일 +{shift}일)
    </small>
  );
}
