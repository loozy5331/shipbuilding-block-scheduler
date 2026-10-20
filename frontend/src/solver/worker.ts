import { solveAll, solvePinned, type PinnedRequest, type SolveRequest } from './index';

self.onmessage = (e: MessageEvent<(SolveRequest | PinnedRequest) & { id: number }>) => {
  const { id, ...req } = e.data;
  self.postMessage({ id, result: 'fixed' in req ? solvePinned(req) : solveAll(req) });
};
