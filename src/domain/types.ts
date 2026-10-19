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
}

export type Assignments = Record<string, Assignment>;

/** 드래그로 배정 가능한 자원 종류 */
export type ResourceKind = 'general' | 'skilled' | 'crane' | 'emergency';

/** 일별 부하를 추적하는 자원 */
export type LoadKind = 'slots' | 'general' | 'skilled' | 'crane';

export type BlockStatus = 'ok' | 'late' | 'blocked' | 'unscheduled';

export type Policy = 'input' | 'edd' | 'optimal';

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
