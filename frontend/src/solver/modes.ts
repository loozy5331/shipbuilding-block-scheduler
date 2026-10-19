import type { Block, Resources } from '../domain/types';
import { dailyMHOf, durationOf } from '../domain/evaluate';

/** 블록 하나를 처리하는 인원 구성 후보 */
export interface Mode {
  general: number;
  skilled: number;
  dailyMH: number;
  duration: number;
  wasteMH: number;
}

/** 블록별 가능한 인원 구성을 만들고, 더 느리면서 인원도 더 쓰는 지배된 구성은 제거한다. */
export function buildModes(block: Block, r: Resources): Mode[] {
  const all: Mode[] = [];
  const maxG = Math.min(r.generalWorkers, r.maxCrewPerBlock);
  const maxK = Math.min(r.skilledWorkers, r.maxCrewPerBlock);
  for (let g = 0; g <= maxG; g++) {
    for (let k = 0; k <= maxK; k++) {
      if (g + k === 0 || g + k > r.maxCrewPerBlock) continue;
      const dailyMH = dailyMHOf({ general: g, skilled: k }, r);
      const duration = durationOf(block.requiredMH, dailyMH)!;
      all.push({ general: g, skilled: k, dailyMH, duration, wasteMH: dailyMH * duration - block.requiredMH });
    }
  }
  const dominated = (m: Mode, o: Mode) =>
    o !== m &&
    o.duration <= m.duration &&
    o.general <= m.general &&
    o.skilled <= m.skilled &&
    (o.duration < m.duration || o.general < m.general || o.skilled < m.skilled);
  return all
    .filter((m) => !all.some((o) => dominated(m, o)))
    .sort((a, b) => a.duration - b.duration || a.wasteMH - b.wasteMH || a.general + a.skilled - (b.general + b.skilled) || a.skilled - b.skilled);
}

/** 블록 하나가 하루에 낼 수 있는 최대 MH (인원 상한 내에서 숙련공 우선) */
export function maxBlockDailyMH(r: Resources): number {
  const k = Math.min(r.skilledWorkers, r.maxCrewPerBlock);
  const g = Math.min(r.generalWorkers, r.maxCrewPerBlock - k);
  return dailyMHOf({ general: g, skilled: k }, r);
}
