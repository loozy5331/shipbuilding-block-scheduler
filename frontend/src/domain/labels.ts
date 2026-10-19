import type { BlockStatus, UserMode } from './types';
import type { BlockedReason, BlockResult } from './evaluate';

export const STATUS_LABEL: Record<BlockStatus, string> = {
  ok: '납기 안',
  late: '납기 지연',
  conflict: '자원 겹침',
  blocked: '착수 불가',
  unscheduled: '미배치',
};

export const REASON_LABEL: Record<BlockedReason, string> = {
  noCrew: '작업자 없음',
  crewLimit: '인원 한도 초과',
  noCrane: '크레인 없음',
  noMaterial: '자재 없음',
};

/** 표·툴팁에 쓰는 한 줄 판정 */
export function verdictText(x: BlockResult): string {
  switch (x.status) {
    case 'blocked':
      return `착수 불가 (${x.blockedReasons.map((r) => REASON_LABEL[r]).join(' · ')})`;
    case 'conflict':
      return `${x.laneClash ? '작업장 겹침' : '자원 겹침'}${x.lateDays ? ` · ${x.lateDays}일 지연` : ''}`;
    case 'late':
      return `${x.lateDays}일 지연`;
    default:
      return STATUS_LABEL[x.status];
  }
}

/** 사용자 모드 이름과 설명 */
export const MODE_LABEL: Record<UserMode, { name: string; desc: string }> = {
  expert: { name: '숙련자', desc: '최적 배치 버튼으로 바로 계산' },
  novice: { name: '신입', desc: '직접 배치하고 힌트로 배우기' },
};
