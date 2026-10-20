import type { Block, Resources } from '../../domain/types';
import { nominalDuration, type Evaluation } from '../../domain/evaluate';
import { workEnd, type Calendar } from '../../domain/calendar';

/** 간트 하루 칸의 폭(px) */
export const COL = 96;
/** 이보다 긴 일정은 "전체 기간 표시"를 눌러야 다 보인다 */
export const MAX_DAYS = 90;

/**
 * 간트에 그릴 날 수. 작업장과 관계없이 모든 블록을 한 줄로 이어 붙여도 들어가도록
 * (배정된 기간, 아직이면 작업자 1명 기준 기간의 합을 쉬는 날 포함 달력 일수로) 잡고, 끌어 옮길 여유 2칸을 둔다.
 */
export function ganttDays(blocks: Block[], r: Resources, ev: Evaluation, cal: Calendar): number {
  const work = blocks.reduce((s, b) => s + (ev.blocks[b.id]?.duration ?? nominalDuration(b.requiredMH, r)), 0);
  return Math.max(ev.horizon, work > 0 ? workEnd(cal, 1, work) : 0) + 2;
}
