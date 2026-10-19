import { evaluate, type Evaluation } from '../domain/evaluate';
import type { State } from './types';
import { useStore } from './schedulerStore';

let cache: { s: Pick<State, 'blocks' | 'resources' | 'assignments'>; ev: Evaluation } | null = null;

/** 지금 배치의 평가. 블록·자원·배치가 그대로면 지난 결과를 다시 쓴다 (화면·튜토리얼·애니메이션 공용) */
export function selectEvaluation(s: Pick<State, 'blocks' | 'resources' | 'assignments'>): Evaluation {
  if (!cache || cache.s.blocks !== s.blocks || cache.s.resources !== s.resources || cache.s.assignments !== s.assignments) {
    cache = { s: { blocks: s.blocks, resources: s.resources, assignments: s.assignments }, ev: evaluate(s.blocks, s.resources, s.assignments) };
  }
  return cache.ev;
}

export const useEvaluation = () => useStore(selectEvaluation);
