import type { Policy } from '../domain/types';
import { solveInWorker } from '../solver/client';
import type { SolveResponse } from '../solver';
import { useStore } from './schedulerStore';

/** 같은 입력으로 동시에 여러 번 계산하지 않도록 진행 중인 계산을 공유한다 */
let inflight: { blocks: unknown; resources: unknown; promise: Promise<SolveResponse> } | null = null;

/** 현재 입력으로 세 가지 정책을 모두 계산해 저장하고, 지정한 정책의 배치를 적용한다. */
export async function runSolve(apply: Policy | null = 'optimal'): Promise<SolveResponse> {
  const { blocks, resources, solve } = useStore.getState();
  let result = solve;
  if (!result) {
    if (!inflight || inflight.blocks !== blocks || inflight.resources !== resources) {
      inflight = { blocks, resources, promise: solveInWorker({ blocks, resources }) };
    }
    const mine = inflight;
    try {
      result = await mine.promise;
    } finally {
      if (inflight === mine) inflight = null;
    }
  }
  // 계산하는 동안 입력이 바뀌었으면 낡은 결과를 저장하지 않는다
  const now = useStore.getState();
  if (now.blocks !== blocks || now.resources !== resources) return result;
  useStore.getState().setSolve(result);
  if (apply) useStore.getState().applyAssignments(result.solutions[apply].assignments);
  return result;
}
