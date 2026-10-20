import type { Policy } from '../domain/types';
import { pinKey, pinnedOf } from '../domain/lanes';
import { solveInWorker, solvePinnedInWorker } from '../solver/client';
import type { SolveResponse } from '../solver';
import type { Solution } from '../solver/search';
import { useStore } from './schedulerStore';
import { selectCalendar } from './calendar';

/** 같은 입력으로 동시에 여러 번 계산하지 않도록 진행 중인 계산을 공유한다 */
let inflight: { blocks: unknown; resources: unknown; cal: unknown; promise: Promise<SolveResponse> } | null = null;

/** 현재 입력으로 세 가지 정책을 모두 계산해 저장하고, 지정한 정책의 배치를 적용한다. */
export async function runSolve(apply: Policy | null = 'optimal'): Promise<SolveResponse> {
  const { blocks, resources, solve } = useStore.getState();
  const cal = selectCalendar(useStore.getState());
  let result = solve;
  if (!result) {
    if (!inflight || inflight.blocks !== blocks || inflight.resources !== resources || inflight.cal !== cal) {
      inflight = { blocks, resources, cal, promise: solveInWorker({ blocks, resources, cal }) };
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
  if (now.blocks !== blocks || now.resources !== resources || selectCalendar(now) !== cal) return result;
  useStore.getState().setSolve(result);
  if (apply) useStore.getState().applyAssignments(result.solutions[apply].assignments);
  return result;
}

/** 고정한 블록은 그대로 두고 나머지만 다시 최적화한다 (같은 고정 배치면 지난 결과를 쓴다). 적용은 부르는 쪽에서 */
export async function runPinnedSolve(): Promise<Solution> {
  const { blocks, resources, assignments, pinSolve } = useStore.getState();
  const cal = selectCalendar(useStore.getState());
  const fixed = pinnedOf(assignments);
  const key = pinKey(fixed);
  if (pinSolve && pinSolve.blocks === blocks && pinSolve.resources === resources && pinSolve.key === key) return pinSolve.solution;
  const solution = await solvePinnedInWorker({ blocks, resources, fixed, cal });
  const now = useStore.getState();
  if (now.blocks === blocks && now.resources === resources && selectCalendar(now) === cal && pinKey(pinnedOf(now.assignments)) === key)
    now.setPinSolve({ blocks, resources, key, solution });
  return solution;
}
