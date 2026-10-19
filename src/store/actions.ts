import type { Policy } from '../domain/types';
import { solveInWorker } from '../solver/client';
import type { SolveResponse } from '../solver';
import { useStore } from './schedulerStore';

/** 현재 입력으로 세 가지 정책을 모두 계산해 저장하고, 지정한 정책의 배치를 적용한다. */
export async function runSolve(apply: Policy | null = 'optimal'): Promise<SolveResponse> {
  const { blocks, resources, solve } = useStore.getState();
  const result = solve ?? (await solveInWorker({ blocks, resources }));
  useStore.getState().setSolve(result);
  if (apply) useStore.getState().applyAssignments(result.solutions[apply].assignments);
  return result;
}
