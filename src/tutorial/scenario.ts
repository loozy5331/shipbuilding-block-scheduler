import type { Block, Resources } from '../domain/types';
import { DEFAULT_RESOURCES } from '../domain/types';

/** 발표 자료의 "작업 배정 실습 10일 아침의 다섯 블록" */
export const TUTORIAL_TITLE = '작업 배정 실습 10일 아침의 다섯 블록';

export const TUTORIAL_BLOCKS: Block[] = [
  { id: 'A-101', dueDay: 1, requiredMH: 16, materialReady: true },
  { id: 'B-203', dueDay: 2, requiredMH: 24, materialReady: true },
  { id: 'C-115', dueDay: 3, requiredMH: 12, materialReady: false },
  { id: 'D-208', dueDay: 1, requiredMH: 8, materialReady: true },
  { id: 'E-320', dueDay: 4, requiredMH: 20, materialReady: true },
];

/** 하루 가용 40인시: 일반 작업자 2명 × 8MH + 숙련공 2명 × 12MH */
export const TUTORIAL_RESOURCES: Resources = { ...DEFAULT_RESOURCES, generalWorkers: 2, skilledWorkers: 2 };
