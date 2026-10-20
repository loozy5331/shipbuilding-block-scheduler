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

/** 접힌 날짜 칸(엑셀의 숨긴 열처럼)의 폭(px) */
export const FOLDED = 14;

/** 날짜 칸 배치. 접힌 칸이 있어 칸마다 폭이 다를 수 있다 */
export interface Columns {
  days: number;
  /** 접힌 날인가 */
  folded(day: number): boolean;
  /** day 칸의 왼쪽 x */
  left(day: number): number;
  width(day: number): number;
  /** [from, to] 칸을 덮는 폭 */
  span(from: number, to: number): number;
  /** x가 속한 날 (1 ~ days) */
  dayAt(x: number): number;
  /** start 칸에 있던 막대를 dx만큼 끌었을 때 놓이는 날 (칸 가운데 기준) */
  moved(start: number, dx: number): number;
  /** CSS grid 열 정의 (날짜 칸만) */
  template: string;
}

export function buildColumns(days: number, isFolded: (day: number) => boolean): Columns {
  const w = Array.from({ length: days }, (_, i) => (isFolded(i + 1) ? FOLDED : COL));
  const x = [0];
  for (const v of w) x.push(x[x.length - 1] + v);
  const clamp = (d: number) => Math.min(Math.max(d, 1), days + 1);
  const left = (d: number) => x[clamp(d) - 1];
  const width = (d: number) => w[d - 1] ?? COL;
  const dayAt = (px: number) => {
    let d = 1;
    while (d < days && x[d] <= px) d++;
    return d;
  };
  return {
    days,
    folded: (d) => w[d - 1] === FOLDED,
    left,
    width,
    span: (from, to) => left(to + 1) - left(from),
    dayAt,
    moved: (start, dx) => dayAt(left(start) + width(start) / 2 + dx),
    template: w.map((v) => `${v}px`).join(' '),
  };
}
