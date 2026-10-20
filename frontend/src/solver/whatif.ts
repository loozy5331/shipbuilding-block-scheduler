import type { Block, Resources } from '../domain/types';
import { compareObjective, objective, type Kpi } from '../domain/evaluate';
import { solvePolicy } from './search';
import type { Calendar } from '../domain/calendar';

export type WhatIfKey = 'generalWorkers' | 'skilledWorkers' | 'cranes' | 'workplaces' | 'emergencyMaterials';

export const WHATIF_LABEL: Record<WhatIfKey, { name: string; unit: string }> = {
  generalWorkers: { name: '일반 작업자', unit: '명' },
  skilledWorkers: { name: '숙련공', unit: '명' },
  cranes: { name: '크레인', unit: '대' },
  workplaces: { name: '작업장', unit: '곳' },
  emergencyMaterials: { name: '비상 자재', unit: '개' },
};

export interface WhatIfResult {
  key: WhatIfKey;
  added: number;
  kpi: Kpi;
  /** 이 추가로 전 블록 납기 준수가 되는가 */
  resolves: boolean;
}

/**
 * 자원을 하나씩 늘려 보며(최대 maxAdd) 개선 효과를 측정한다.
 * 해소되는 최소 추가량을, 해소가 안 되면 가장 많이 개선되는 추가량을 돌려준다.
 */
export function whatIf(blocks: Block[], r: Resources, baseline: Kpi, cal?: Calendar, maxAdd = 3, budgetMs = 120): WhatIfResult[] {
  const out: WhatIfResult[] = [];
  const base = objective(baseline);
  for (const key of Object.keys(WHATIF_LABEL) as WhatIfKey[]) {
    let bestHere: WhatIfResult | null = null;
    for (let add = 1; add <= maxAdd; add++) {
      const sol = solvePolicy('optimal', blocks, { ...r, [key]: r[key] + add }, { budgetMs, cal });
      const res = { key, added: add, kpi: sol.kpi, resolves: sol.feasible };
      if (!bestHere || compareObjective(objective(res.kpi), objective(bestHere.kpi)) < 0) bestHere = res;
      if (sol.feasible) break;
    }
    if (bestHere && compareObjective(objective(bestHere.kpi), base) < 0) out.push(bestHere);
  }
  // 해소하는 것 우선, 그다음 적게 추가하는 것, 그다음 개선 폭
  return out.sort(
    (a, b) => Number(b.resolves) - Number(a.resolves) || a.added - b.added || compareObjective(objective(a.kpi), objective(b.kpi)),
  );
}
