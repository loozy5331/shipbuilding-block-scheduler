import type { Assignment, Assignments, Block, BlockStatus, LoadKind, Resources } from './types';

export type BlockedReason = 'noCrane' | 'noMaterial' | 'noCrew';

export interface BlockResult {
  blockId: string;
  status: BlockStatus;
  blockedReasons: BlockedReason[];
  start: number | null;
  end: number | null;
  duration: number | null;
  dailyMH: number;
  /** 납기일까지 처리되는 MH (requiredMH로 상한) */
  mhByDue: number;
  lateDays: number;
  /** 작업 기간 중 이 블록이 쓰는 자원이 용량을 넘은 날이 있음 */
  overloaded: boolean;
  wasteMH: number;
}

export interface LoadRow {
  kind: LoadKind;
  capacity: number;
  /** usage[d-1] = d일의 사용량 */
  usage: number[];
}

export interface Kpi {
  total: number;
  onTime: number;
  late: number;
  notRunnable: number;
  onTimeRate: number;
  totalLateDays: number;
  emergencyUsed: number;
  emergencyCapacity: number;
  overloadCells: number;
  makespan: number;
  wasteMH: number;
}

export interface Evaluation {
  horizon: number;
  blocks: Record<string, BlockResult>;
  load: LoadRow[];
  kpi: Kpi;
  /** 모든 블록이 자원 초과 없이 납기 안에 끝나는가 */
  feasible: boolean;
}

export const LOAD_KINDS: LoadKind[] = ['slots', 'general', 'skilled', 'crane'];

export function dailyMHOf(a: Pick<Assignment, 'general' | 'skilled'>, r: Resources): number {
  return a.general * r.generalMHPerDay + a.skilled * r.skilledMHPerDay;
}

export function durationOf(requiredMH: number, dailyMH: number): number | null {
  if (dailyMH <= 0) return null;
  return Math.max(1, Math.ceil(requiredMH / dailyMH));
}

export function loadCapacity(kind: LoadKind, r: Resources): number {
  switch (kind) {
    case 'slots':
      return r.workplaces * r.blocksPerWorkplace;
    case 'general':
      return r.generalWorkers;
    case 'skilled':
      return r.skilledWorkers;
    case 'crane':
      return r.cranes;
  }
}

function loadUse(kind: LoadKind, a: Assignment): number {
  switch (kind) {
    case 'slots':
      return 1;
    case 'general':
      return a.general;
    case 'skilled':
      return a.skilled;
    case 'crane':
      return a.crane ? 1 : 0;
  }
}

export function evaluate(blocks: Block[], r: Resources, assignments: Assignments): Evaluation {
  const pre: Record<string, BlockResult> = {};
  let maxEnd = 0;

  for (const b of blocks) {
    const a = assignments[b.id];
    const dailyMH = a ? dailyMHOf(a, r) : 0;
    const duration = durationOf(b.requiredMH, dailyMH);
    const reasons: BlockedReason[] = [];
    if (a) {
      if (!a.crane) reasons.push('noCrane');
      if (!b.materialReady && !a.emergency) reasons.push('noMaterial');
      if (duration === null) reasons.push('noCrew');
    }
    const start = a?.startDay ?? null;
    const end = start !== null && duration !== null ? start + duration - 1 : null;
    if (end !== null) maxEnd = Math.max(maxEnd, end);

    let status: BlockStatus;
    if (start === null) status = 'unscheduled';
    else if (reasons.length > 0) status = 'blocked';
    else if (end! > b.dueDay) status = 'late';
    else status = 'ok';

    const runnable = status === 'ok' || status === 'late';
    const daysByDue = start !== null && duration !== null ? Math.max(0, Math.min(duration, b.dueDay - start + 1)) : 0;
    pre[b.id] = {
      blockId: b.id,
      status,
      blockedReasons: start === null ? [] : reasons,
      start,
      end,
      duration,
      dailyMH,
      mhByDue: runnable ? Math.min(b.requiredMH, daysByDue * dailyMH) : 0,
      lateDays: status === 'late' ? end! - b.dueDay : 0,
      overloaded: false,
      wasteMH: runnable ? dailyMH * duration! - b.requiredMH : 0,
    };
  }

  const maxDue = blocks.reduce((m, b) => Math.max(m, b.dueDay), 0);
  const horizon = Math.max(7, maxDue, maxEnd);

  // 간트에 올라간 블록은 착수 불가 상태여도 자원을 점유한 것으로 본다(계획상 예약).
  const load: LoadRow[] = LOAD_KINDS.map((kind) => ({ kind, capacity: loadCapacity(kind, r), usage: new Array(horizon).fill(0) }));
  const placed = blocks.filter((b) => pre[b.id].start !== null && pre[b.id].end !== null);
  for (const b of placed) {
    const a = assignments[b.id];
    const res = pre[b.id];
    for (let d = res.start!; d <= res.end!; d++) {
      for (const row of load) row.usage[d - 1] += loadUse(row.kind, a);
    }
  }

  let overloadCells = 0;
  for (const row of load) for (const u of row.usage) if (u > row.capacity) overloadCells++;

  for (const b of placed) {
    const a = assignments[b.id];
    const res = pre[b.id];
    for (let d = res.start!; d <= res.end! && !res.overloaded; d++) {
      res.overloaded = load.some((row) => loadUse(row.kind, a) > 0 && row.usage[d - 1] > row.capacity);
    }
  }

  const emergencyUsed = blocks.filter((b) => assignments[b.id]?.emergency).length;
  if (emergencyUsed > r.emergencyMaterials) {
    for (const b of blocks) if (assignments[b.id]?.emergency) pre[b.id].overloaded = true;
  }

  const results = Object.values(pre);
  const onTime = results.filter((x) => x.status === 'ok').length;
  const late = results.filter((x) => x.status === 'late').length;
  const kpi: Kpi = {
    total: blocks.length,
    onTime,
    late,
    notRunnable: blocks.length - onTime - late,
    onTimeRate: blocks.length ? onTime / blocks.length : 0,
    totalLateDays: results.reduce((s, x) => s + x.lateDays, 0),
    emergencyUsed,
    emergencyCapacity: r.emergencyMaterials,
    overloadCells: overloadCells + Math.max(0, emergencyUsed - r.emergencyMaterials),
    makespan: maxEnd,
    wasteMH: results.reduce((s, x) => s + x.wasteMH, 0),
  };

  return {
    horizon,
    blocks: pre,
    load,
    kpi,
    feasible: blocks.length > 0 && onTime === blocks.length && kpi.overloadCells === 0,
  };
}

/** 사전식 비교용 목적값. 작을수록 좋다. */
export function objective(k: Kpi): number[] {
  return [k.notRunnable, k.overloadCells, k.late, k.totalLateDays, k.emergencyUsed, k.wasteMH, k.makespan];
}

export function compareObjective(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
