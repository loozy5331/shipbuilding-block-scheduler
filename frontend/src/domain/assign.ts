import type { Assignment, Assignments, Block, ResourceKind, Resources } from './types';
import { materialOk } from './material';

/** 이 자원을 이 블록에 더 놓을 수 없는 이유. 놓을 수 있으면 null. */
export function assignBlockedReason(block: Block, a: Assignment | undefined, kind: ResourceKind, r: Resources, assignments: Assignments): string | null {
  if (a?.pinned) return '합의된 블록입니다. 합의를 풀고 바꾸세요';
  const crew = (a?.general ?? 0) + (a?.skilled ?? 0);
  switch (kind) {
    case 'general':
    case 'skilled':
      if ((kind === 'general' ? r.generalWorkers : r.skilledWorkers) === 0) return `보유 ${kind === 'general' ? '일반 작업자' : '숙련공'}가 없습니다`;
      return crew >= r.maxCrewPerBlock ? `블록 하나에 ${r.maxCrewPerBlock}명까지` : null;
    case 'crane':
      if (r.cranes === 0) return '보유 크레인이 없습니다';
      return a?.crane ? '이미 크레인이 있습니다' : null;
    case 'emergency': {
      if (materialOk(block, a?.startDay ?? null)) return block.materialDay !== undefined ? '자재가 들어온 뒤 착수합니다' : '자재가 준비된 블록입니다';
      if (a?.emergency) return '이미 비상 자재가 있습니다';
      const used = Object.values(assignments).filter((x) => x.emergency).length;
      return used >= r.emergencyMaterials ? '비상 자재가 남지 않았습니다' : null;
    }
  }
}
