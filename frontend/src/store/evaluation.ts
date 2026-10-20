import { evaluate, type Evaluation } from '../domain/evaluate';
import type { Calendar } from '../domain/calendar';
import type { State } from './types';
import { useStore } from './schedulerStore';
import { selectCalendar } from './calendar';

type Input = Pick<State, 'blocks' | 'resources' | 'assignments' | 'planStart' | 'calendar' | 'tutorialActive'>;
let cache: { blocks: unknown; resources: unknown; assignments: unknown; cal: Calendar; ev: Evaluation } | null = null;

/** 지금 배치의 평가. 블록·자원·배치·작업일이 그대로면 지난 결과를 다시 쓴다 (화면·튜토리얼·애니메이션 공용) */
export function selectEvaluation(s: Input): Evaluation {
  const cal = selectCalendar(s);
  if (!cache || cache.blocks !== s.blocks || cache.resources !== s.resources || cache.assignments !== s.assignments || cache.cal !== cal) {
    cache = { blocks: s.blocks, resources: s.resources, assignments: s.assignments, cal, ev: evaluate(s.blocks, s.resources, s.assignments, cal) };
  }
  return cache.ev;
}

export const useEvaluation = () => useStore(selectEvaluation);

export const useCalendar = () => useStore(selectCalendar);
