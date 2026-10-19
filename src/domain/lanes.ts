import type { Assignment, Assignments, Block, Resources } from './types';
import { dailyMHOf, durationOf, nominalDuration } from './evaluate';

/** 작업 자리 수 = 작업장 × 작업장당 동시 처리 블록 */
export function laneCount(r: Resources): number {
  return r.workplaces * r.blocksPerWorkplace;
}

export function workplaceOf(lane: number, r: Resources): number {
  return Math.floor(lane / Math.max(1, r.blocksPerWorkplace));
}

/** 간트에 차지하는 기간 [start, end]. 작업자가 없으면 필요 작업시간 기준 길이로 본다. */
export function spanOf(block: Block, a: Assignment, r: Resources): [number, number] | null {
  if (a.startDay === null) return null;
  const d = durationOf(block.requiredMH, dailyMHOf(a, r)) ?? nominalDuration(block.requiredMH, r);
  return [a.startDay, a.startDay + d - 1];
}

const overlaps = (x: [number, number], y: [number, number]) => x[0] <= y[1] && y[0] <= x[1];

/**
 * 자리가 없거나 범위를 벗어난 블록에 빈 자리를 준다. 이미 자리가 있는 블록은 그대로 둔다.
 * 착수일 순으로 비어 있는 첫 자리를, 없으면 가장 덜 겹치는 자리를 고른다.
 */
export function assignLanes(blocks: Block[], assignments: Assignments, r: Resources): Assignments {
  const n = laneCount(r);
  if (n <= 0) return assignments;
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const taken: [number, number][][] = Array.from({ length: n }, () => []);
  const todo: { a: Assignment; span: [number, number] }[] = [];
  const out: Assignments = { ...assignments };

  for (const a of Object.values(assignments)) {
    const b = byId.get(a.blockId);
    const span = b && spanOf(b, a, r);
    if (!span) continue;
    if (a.lane !== undefined && a.lane >= 0 && a.lane < n) taken[a.lane].push(span);
    else todo.push({ a, span });
  }

  todo.sort((x, y) => x.span[0] - y.span[0] || x.a.blockId.localeCompare(y.a.blockId));
  for (const { a, span } of todo) {
    let best = 0;
    let bestHits = Infinity;
    for (let lane = 0; lane < n; lane++) {
      const hits = taken[lane].filter((s) => overlaps(s, span)).length;
      if (hits < bestHits) {
        best = lane;
        bestHits = hits;
      }
      if (hits === 0) break;
    }
    taken[best].push(span);
    out[a.blockId] = { ...a, lane: best };
  }
  return out;
}

/** 블록마다 같은 자리의 다른 블록과 겹치는 날 */
export function laneOverlapDays(blocks: Block[], assignments: Assignments, r: Resources): Record<string, number[]> {
  const n = laneCount(r);
  const spans = blocks
    .map((b) => {
      const a = assignments[b.id];
      const span = a && a.lane !== undefined && a.lane < n ? spanOf(b, a, r) : null;
      return span ? { id: b.id, lane: a.lane!, span } : null;
    })
    .filter((x) => x !== null);
  const out: Record<string, number[]> = {};
  for (const x of spans) {
    for (const y of spans) {
      if (x === y || x.lane !== y.lane || !overlaps(x.span, y.span)) continue;
      const days = (out[x.id] ??= []);
      for (let d = Math.max(x.span[0], y.span[0]); d <= Math.min(x.span[1], y.span[1]); d++) if (!days.includes(d)) days.push(d);
    }
  }
  for (const days of Object.values(out)) days.sort((p, q) => p - q);
  return out;
}

/** 착수 순서(같은 날은 ID 순). 미배치 블록은 빠진다. */
export function startOrder(a: Assignments): string[] {
  return Object.values(a)
    .filter((x) => x.startDay !== null)
    .sort((x, y) => x.startDay! - y.startDay! || x.blockId.localeCompare(y.blockId))
    .map((x) => x.blockId);
}

/** 배치가 같은지 비교 (자리는 무시) */
export function samePlan(a: Assignments, b: Assignments): boolean {
  const ka = Object.keys(a).filter((k) => a[k].startDay !== null || a[k].general || a[k].skilled || a[k].crane || a[k].emergency);
  const kb = Object.keys(b).filter((k) => b[k].startDay !== null || b[k].general || b[k].skilled || b[k].crane || b[k].emergency);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => {
    const x = a[k];
    const y = b[k];
    return !!y && x.startDay === y.startDay && x.general === y.general && x.skilled === y.skilled && x.crane === y.crane && x.emergency === y.emergency;
  });
}

/** 작업장 wp로 옮길 때 쓸 자리: 그 작업장에서 [start, …] 기간에 비어 있는 첫 자리, 없으면 첫 자리 */
export function seatIn(wp: number, block: Block, start: number, assignments: Assignments, blocks: Block[], r: Resources): number {
  const first = wp * r.blocksPerWorkplace;
  const a = { ...(assignments[block.id] ?? { blockId: block.id, startDay: null, general: 0, skilled: 0, crane: false, emergency: false }), startDay: start };
  const span = spanOf(block, a, r)!;
  for (let lane = first; lane < first + r.blocksPerWorkplace; lane++) {
    const busy = blocks.some((b) => {
      const o = assignments[b.id];
      if (b.id === block.id || o?.lane !== lane) return false;
      const s = spanOf(b, o, r);
      return !!s && overlaps(s, span);
    });
    if (!busy) return lane;
  }
  return first;
}
