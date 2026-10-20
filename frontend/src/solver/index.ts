import type { Assignments, Block, Policy, Resources } from '../domain/types';
import { checkCapacity, type CapacityCheck } from './feasibility';
import { solvePolicy, type Solution } from './search';
import { whatIf, type WhatIfResult } from './whatif';

export interface SolveRequest {
  blocks: Block[];
  resources: Resources;
  budgetMs?: number;
}

export interface SolveResponse {
  capacity: CapacityCheck;
  solutions: Record<Policy, Solution>;
  /** 최적화로도 전 블록 납기 준수가 안 될 때만 채워진다 */
  whatIf: WhatIfResult[];
}

export function solveAll({ blocks, resources, budgetMs = 800 }: SolveRequest): SolveResponse {
  const solutions = {
    input: solvePolicy('input', blocks, resources),
    optimal: solvePolicy('optimal', blocks, resources, { budgetMs }),
  };
  return {
    capacity: checkCapacity(blocks, resources),
    solutions,
    whatIf: solutions.optimal.feasible || blocks.length === 0 ? [] : whatIf(blocks, resources, solutions.optimal.kpi),
  };
}

export interface PinnedRequest extends SolveRequest {
  /** 고정한 블록의 배치 */
  fixed: Assignments;
}

/** 고정한 블록은 그대로 두고 나머지 블록만 다시 최적화 (차선책 포함) */
export function solvePinned({ blocks, resources, fixed, budgetMs = 800 }: PinnedRequest): Solution {
  return solvePolicy('optimal', blocks, resources, { budgetMs, fixed });
}
