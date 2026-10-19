import { solveAll, type SolveRequest } from './index';

self.onmessage = (e: MessageEvent<SolveRequest & { id: number }>) => {
  const { id, ...req } = e.data;
  self.postMessage({ id, result: solveAll(req) });
};
