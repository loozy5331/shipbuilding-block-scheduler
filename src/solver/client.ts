import type { SolveRequest, SolveResponse } from './index';

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (r: SolveResponse) => void>();

/** 최적화를 Web Worker에서 돌려 UI가 멈추지 않게 한다. */
export function solveInWorker(req: SolveRequest): Promise<SolveResponse> {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; result: SolveResponse }>) => {
      pending.get(e.data.id)?.(e.data.result);
      pending.delete(e.data.id);
    };
  }
  const id = ++seq;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    worker!.postMessage({ id, ...req });
  });
}
