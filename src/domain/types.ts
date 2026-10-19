/** 작업 대상 블록. dueDay는 "남은 기간(오늘 포함)" — 오늘이 1일, 그날 작업까지 납기 안. */
export interface Block {
  id: string;
  dueDay: number;
  requiredMH: number;
  materialReady: boolean;
}

export interface Resources {
  workplaces: number;
  blocksPerWorkplace: number;
  generalWorkers: number;
  generalMHPerDay: number;
  skilledWorkers: number;
  skilledMHPerDay: number;
  cranes: number;
  emergencyMaterials: number;
  maxCrewPerBlock: number;
}

/** 블록 하나에 대한 배치. startDay가 null이면 아직 간트에 올라가지 않은 상태. */
export interface Assignment {
  blockId: string;
  startDay: number | null;
  general: number;
  skilled: number;
  crane: boolean;
  emergency: boolean;
  /** 작업 자리(레인). 작업장 = ⌊lane / blocksPerWorkplace⌋. 없으면 아직 자리를 정하지 않은 상태 */
  lane?: number;
}

export type Assignments = Record<string, Assignment>;

/** 드래그로 배정 가능한 자원 종류 */
export type ResourceKind = 'general' | 'skilled' | 'crane' | 'emergency';

/** 일별 부하를 추적하는 자원 */
export type LoadKind = 'slots' | 'general' | 'skilled' | 'crane';

/** conflict: 작업 기간 중 쓰는 자원이 용량을 넘은 날이 있음 (그날 공수는 인정하지 않음) */
export type BlockStatus = 'ok' | 'late' | 'conflict' | 'blocked' | 'unscheduled';

/** input: 입력 순서대로 배치(튜토리얼 비교용), optimal: 최적화 */
export type Policy = 'input' | 'optimal';

/** 숙련자: 최적 배치 버튼 / 신입: 힌트 버튼 */
export type UserMode = 'expert' | 'novice';

export const DEFAULT_RESOURCES: Resources = {
  workplaces: 2,
  blocksPerWorkplace: 1,
  generalWorkers: 4,
  generalMHPerDay: 8,
  skilledWorkers: 1,
  skilledMHPerDay: 12,
  cranes: 2,
  emergencyMaterials: 1,
  maxCrewPerBlock: 3,
};

export function emptyAssignment(blockId: string): Assignment {
  return { blockId, startDay: null, general: 0, skilled: 0, crane: false, emergency: false };
}
