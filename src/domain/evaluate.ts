import type { Assignment, Assignments, Block, BlockStatus, LoadKind, Resources } from './types';
import { laneOverlapDays } from './lanes';

export type BlockedReason = 'noCrane' | 'noMaterial' | 'noCrew' | 'crewLimit';

export interface BlockResult {
  blockId: string;
  status: BlockStatus;
  blockedReasons: BlockedReason[];
  start: number | null;
  end: number | null;
  duration: number | null;
  dailyMH: number;
  /** 납기일까지 인정되는 MH. 자원 겹침이 있는 날의 공수는 인정하지 않는다. */
  mhByDue: number;
  /** 전체 기간에 인정되는 MH */
  creditedMH: number;
  lateDays: number;
  /** 이 블록이 쓰는 자원이 용량을 넘었거나 같은 작업 자리의 다른 블록과 겹친 날 */
  overDays: number[];
  /** 같은 작업 자리에서 다른 블록과 겹친 날이 있음 */
  laneClash: boolean;
  /** 납기 안에 끝났을 때 남는 날 (납기 여유일) */
  slackDays: number;
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
  /** 자원 겹침 없이 납기를 넘긴 블록 */
  late: number;
  conflicts: number;
  notRunnable: number;
  onTimeRate: number;
  /** 납기를 넘긴 블록(겹침 포함)과 지연일 합 */
  lateBlocks: number;
  totalLateDays: number;
  emergencyUsed: number;
  emergencyCapacity: number;
  overloadCells: number;
  makespan: number;
  wasteMH: number;
  /** 납기 안 블록의 잔여 납기 여유일 합 */
  totalSlackDays: number;
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
      if (duration === null) reasons.push('noCrew');
      if (a.general + a.skilled > r.maxCrewPerBlock) reasons.push('crewLimit');
      if (!a.crane) reasons.push('noCrane');
      if (!b.materialReady && !a.emergency) reasons.push('noMaterial');
    }
    const start = a?.startDay ?? null;
    const end = start !== null && duration !== null ? start + duration - 1 : null;
    if (end !== null) maxEnd = Math.max(maxEnd, end);

    let status: BlockStatus;
    if (start === null) status = 'unscheduled';
    else if (reasons.length > 0) status = 'blocked';
    else if (end! > b.dueDay) status = 'late';
    else status = 'ok';

    pre[b.id] = {
      blockId: b.id,
      status,
      blockedReasons: start === null ? [] : reasons,
      start,
      end,
      duration,
      dailyMH,
      mhByDue: 0,
      creditedMH: 0,
      lateDays: status === 'late' ? end! - b.dueDay : 0,
      overDays: [],
      laneClash: false,
      slackDays: 0,
      overloaded: false,
      wasteMH: status === 'ok' || status === 'late' ? dailyMH * duration! - b.requiredMH : 0,
    };
  }

  const maxDue = Math.max(1, ...blocks.map((b) => b.dueDay));
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

  const overByDay: LoadKind[][] = Array.from({ length: horizon + 1 }, (_, d) =>
    d === 0 ? [] : load.filter((row) => row.usage[d - 1] > row.capacity).map((row) => row.kind),
  );
  let overloadCells = 0;
  for (const row of load) for (const u of row.usage) if (u > row.capacity) overloadCells++;

  const emergencyUsed = blocks.filter((b) => assignments[b.id]?.emergency).length;
  const emergencyOver = emergencyUsed > r.emergencyMaterials;

  const clash = laneOverlapDays(blocks, assignments, r);
  const clashCells = new Set<string>();
  for (const b of placed) {
    const a = assignments[b.id];
    const res = pre[b.id];
    for (let d = res.start!; d <= res.end!; d++) {
      if (overByDay[d].some((k) => loadUse(k, a) > 0) || clash[b.id]?.includes(d)) res.overDays.push(d);
    }
    res.laneClash = !!clash[b.id];
    for (const d of clash[b.id] ?? []) clashCells.add(`${a.lane}:${d}`);
    res.overloaded = res.overDays.length > 0 || (emergencyOver && a.emergency);
    if (res.status !== 'ok' && res.status !== 'late') continue;
    if (res.overloaded) res.status = 'conflict';
    // 겹친 날의 공수는 인정하지 않고, 미완료분을 뒤로 늘리지도 않는다
    let remaining = b.requiredMH;
    for (let d = res.start!; d <= res.end!; d++) {
      if (res.overDays.includes(d) || (emergencyOver && a.emergency)) continue;
      const earned = Math.min(res.dailyMH, remaining);
      remaining -= earned;
      res.creditedMH += earned;
      if (d <= b.dueDay) res.mhByDue += earned;
    }
    if (res.status === 'conflict') res.lateDays = Math.max(0, res.end! - b.dueDay);
    if (res.status === 'ok') res.slackDays = b.dueDay - res.end!;
  }

  const results = Object.values(pre);
  const count = (s: BlockStatus) => results.filter((x) => x.status === s).length;
  const onTime = count('ok');
  const conflicts = count('conflict');
  const notRunnable = count('blocked') + count('unscheduled');
  const total = blocks.length;
  const lateBlocks = results.filter((x) => x.lateDays > 0);
  const kpi: Kpi = {
    total,
    onTime,
    late: count('late'),
    conflicts,
    notRunnable,
    onTimeRate: total ? onTime / total : 0,
    lateBlocks: lateBlocks.length,
    totalLateDays: lateBlocks.reduce((s, x) => s + x.lateDays, 0),
    emergencyUsed,
    emergencyCapacity: r.emergencyMaterials,
    overloadCells: overloadCells + clashCells.size + Math.max(0, emergencyUsed - r.emergencyMaterials),
    makespan: maxEnd,
    wasteMH: results.reduce((s, x) => s + x.wasteMH, 0),
    totalSlackDays: results.reduce((s, x) => s + x.slackDays, 0),
  };

  return {
    horizon,
    blocks: pre,
    load,
    kpi,
    feasible: total > 0 && onTime === total && kpi.overloadCells === 0,
  };
}

/** 사전식 비교용 목적값. 작을수록 좋다. */
export function objective(k: Kpi): number[] {
  return [k.notRunnable, k.overloadCells, k.lateBlocks, k.totalLateDays, k.emergencyUsed, k.wasteMH, k.makespan];
}

export function compareObjective(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
