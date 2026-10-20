import type { Assignments, Block, Resources } from '../../domain/types';
import { evaluate, type Evaluation } from '../../domain/evaluate';
import { laneCount } from '../../domain/lanes';

/** 조립 애니메이션에 그릴 최대 기간·작업 자리 (넘는 부분은 잘라낸다) */
export const SCENE_MAX_DAYS = 30;
export const SCENE_MAX_LANES = 8;

export interface SceneBar {
  id: string;
  lane: number;
  /** 1일부터 */
  start: number;
  /** 화면 안에 보이는 길이(일) */
  length: number;
}

export interface Scene {
  days: number;
  lanes: number;
  bars: SceneBar[];
  /** 클로즈업할 블록 */
  hero: string;
  /** 크레인이 옆에 내려놓을 블록 (없으면 이름 없는 블록) */
  partner: string | null;
}

/**
 * 간트에 올라간 블록으로 조립 장면을 만든다. 블록이 가장 많은 작업 자리에서 먼저 착수하는 블록을 주인공으로,
 * 같은 자리의 다음 블록(없으면 다른 블록)을 크레인이 붙일 블록으로 고른다. 배치된 블록이 없으면 null.
 */
export function buildScene(blocks: Block[], resources: Resources, assignments: Assignments, ev: Evaluation = evaluate(blocks, resources, assignments)): Scene | null {
  const days = Math.min(ev.horizon, SCENE_MAX_DAYS);
  const lanes = Math.min(laneCount(resources), SCENE_MAX_LANES);
  const bars: SceneBar[] = [];
  for (const b of blocks) {
    const res = ev.blocks[b.id];
    const lane = assignments[b.id]?.lane;
    if (res.start === null || lane === undefined || lane >= lanes || res.start > days) continue;
    // 막대 길이는 사이의 쉬는 날을 포함한 기간
    const span = res.end !== null ? res.end - res.start + 1 : 1;
    bars.push({ id: b.id, lane, start: res.start, length: Math.max(1, Math.min(span, days - res.start + 1)) });
  }
  if (bars.length === 0) return null;
  bars.sort((x, y) => x.start - y.start || x.id.localeCompare(y.id));

  const perLane = new Map<number, SceneBar[]>();
  for (const bar of bars) perLane.set(bar.lane, [...(perLane.get(bar.lane) ?? []), bar]);
  const busiest = [...perLane.values()].sort((x, y) => y.length - x.length || x[0].start - y[0].start)[0];
  const hero = busiest[0].id;
  const partner = busiest[1]?.id ?? bars.find((bar) => bar.id !== hero)?.id ?? null;
  return { days, lanes: Math.max(1, lanes), bars, hero, partner };
}
