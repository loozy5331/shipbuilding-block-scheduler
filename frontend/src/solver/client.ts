import type { PinnedRequest, SolveRequest, SolveResponse } from './index';
import type { Solution } from './search';

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (r: unknown) => void>();

function post<T>(req: object): Promise<T> {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; result: unknown }>) => {
      pending.get(e.data.id)?.(e.data.result);
      pending.delete(e.data.id);
    };
  }
  const id = ++seq;
  return new Promise((resolve) => {
    pending.set(id, resolve as (r: unknown) => void);
    worker!.postMessage({ id, ...req });
  });
}

/** 최적화를 Web Worker에서 돌려 UI가 멈추지 않게 한다. */
export const solveInWorker = (req: SolveRequest) => post<SolveResponse>(req);

/** 고정 블록은 두고 나머지만 다시 최적화 */
export const solvePinnedInWorker = (req: PinnedRequest) => post<Solution>(req);
