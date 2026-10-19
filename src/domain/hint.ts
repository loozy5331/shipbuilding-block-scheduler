import type { Assignment, Assignments, Block, Resources } from './types';
import { emptyAssignment } from './types';
import { compareObjective, evaluate, objective } from './evaluate';
import { assignLanes } from './lanes';

export interface Hint {
  blockId: string | null;
  message: string;
  /** 힌트대로 바꾼 배치 (적용 버튼용). 바꿀 것이 없으면 null */
  next: Assignments | null;
}

function changes(cur: Assignment, opt: Assignment): string[] {
  const out: string[] = [];
  if (cur.startDay !== opt.startDay) out.push(opt.startDay === null ? '간트에서 빼기' : cur.startDay === null ? `${opt.startDay}일에 착수` : `착수일 ${cur.startDay}일 → ${opt.startDay}일`);
  if (cur.general !== opt.general) out.push(`일반 작업자 ${cur.general} → ${opt.general}명`);
  if (cur.skilled !== opt.skilled) out.push(`숙련공 ${cur.skilled} → ${opt.skilled}명`);
  if (cur.crane !== opt.crane) out.push(opt.crane ? '크레인 배정' : '크레인 빼기');
  if (cur.emergency !== opt.emergency) out.push(opt.emergency ? '비상 자재 사용' : '비상 자재 빼기');
  return out;
}

/**
 * 현재 배치와 최적 배치의 차이 중, 하나만 고쳤을 때 가장 크게 좋아지는 블록 하나를 알려 준다.
 * 하나만 고쳐서는 좋아지지 않으면 납기가 가장 급한 차이부터 알려 준다.
 */
export function nextHint(blocks: Block[], r: Resources, current: Assignments, optimal: Assignments): Hint {
  const base = evaluate(blocks, r, current);
  const baseScore = objective(base.kpi);
  const optKpi = evaluate(blocks, r, optimal).kpi;

  const candidates = [...blocks]
    .sort((a, b) => a.dueDay - b.dueDay)
    .map((b) => {
      const cur = current[b.id] ?? emptyAssignment(b.id);
      const opt = optimal[b.id] ?? emptyAssignment(b.id);
      const diff = changes(cur, opt);
      if (diff.length === 0) return null;
      // 자리는 현재 것을 유지하되, 겹치면 빈 자리로 다시 잡는다
      let next = { ...current, [b.id]: { ...opt, lane: cur.lane } };
      if (evaluate(blocks, r, next).blocks[b.id].laneClash) next = assignLanes(blocks, { ...next, [b.id]: { ...opt, lane: undefined } }, r);
      const kpi = evaluate(blocks, r, next).kpi;
      return { block: b, diff, next, kpi, score: objective(kpi) };
    })
    .filter((x) => x !== null);

  if (candidates.length === 0 || compareObjective(baseScore, objective(optKpi)) <= 0) {
    return {
      blockId: null,
      message: base.feasible ? '최적 배치만큼 좋습니다. 모든 블록이 납기 안에 끝납니다.' : `최적 배치와 같은 결과입니다 (납기 준수 ${base.kpi.onTime}/${base.kpi.total}). 자원을 늘려야 개선됩니다.`,
      next: null,
    };
  }

  const best = candidates.reduce((x, y) => (compareObjective(y.score, x.score) < 0 ? y : x));
  const improves = compareObjective(best.score, baseScore) < 0;
  const pick = improves ? best : candidates[0];
  const effect = improves
    ? pick.kpi.onTime > base.kpi.onTime
      ? `납기 준수 ${base.kpi.onTime} → ${pick.kpi.onTime}개`
      : pick.kpi.totalLateDays < base.kpi.totalLateDays
        ? `총 지연 ${base.kpi.totalLateDays} → ${pick.kpi.totalLateDays}일`
        : '자원 겹침·낭비가 줄어듭니다'
    : '다른 블록과 함께 바꿔야 효과가 납니다';
  return { blockId: pick.block.id, message: `${pick.block.id}: ${pick.diff.join(', ')} (${effect})`, next: pick.next };
}
