import type { Block, Resources } from '../domain/types';
import { maxBlockDailyMH } from './modes';

export type IssueCode = 'noCrane' | 'noWorkplace' | 'noWorker' | 'material' | 'blockTooBig' | 'cumulative';

export interface Issue {
  code: IssueCode;
  message: string;
  blockIds: string[];
}

export interface CapacityCheck {
  totalMH: number;
  /** 하루에 실제로 낼 수 있는 최대 MH (인력·작업장·크레인 동시 제약 반영) */
  dailyCapacityMH: number;
  /** 단순 인력 합계 MH */
  workforceMH: number;
  /** 납기 내 처리 가능성에 대한 상한 판정. false면 어떤 배치로도 전부 납기 준수는 불가능. */
  possible: boolean;
  issues: Issue[];
}

/**
 * 배치 전에 명백히 불가능한 경우를 걸러내는 용량 검사.
 * possible=true는 "불가능하다는 증거가 없음"을 뜻하며, 최종 판정은 솔버 결과로 한다.
 */
export function checkCapacity(blocks: Block[], r: Resources): CapacityCheck {
  const totalMH = blocks.reduce((s, b) => s + b.requiredMH, 0);
  const workforceMH = r.generalWorkers * r.generalMHPerDay + r.skilledWorkers * r.skilledMHPerDay;
  const parallel = Math.min(r.workplaces * r.blocksPerWorkplace, r.cranes);
  const perBlock = maxBlockDailyMH(r);
  const dailyCapacityMH = Math.min(workforceMH, parallel * perBlock);
  const issues: Issue[] = [];
  const all = blocks.map((b) => b.id);

  if (blocks.length === 0) return { totalMH, dailyCapacityMH, workforceMH, possible: true, issues };

  if (r.cranes <= 0) issues.push({ code: 'noCrane', message: '크레인이 없어 어떤 블록도 착수할 수 없습니다.', blockIds: all });
  if (r.workplaces * r.blocksPerWorkplace <= 0)
    issues.push({ code: 'noWorkplace', message: '작업장이 없어 어떤 블록도 착수할 수 없습니다.', blockIds: all });
  if (workforceMH <= 0) issues.push({ code: 'noWorker', message: '작업자가 없어 어떤 블록도 진행할 수 없습니다.', blockIds: all });

  const unready = blocks.filter((b) => !b.materialReady);
  if (unready.length > r.emergencyMaterials) {
    issues.push({
      code: 'material',
      message: `자재 미준비 블록 ${unready.length}개 중 비상 자재(${r.emergencyMaterials}개)로 착수 가능한 블록은 ${r.emergencyMaterials}개뿐입니다.`,
      blockIds: unready.map((b) => b.id),
    });
  }

  if (perBlock > 0) {
    const tooBig = blocks.filter((b) => b.requiredMH > b.dueDay * perBlock);
    if (tooBig.length > 0) {
      issues.push({
        code: 'blockTooBig',
        message: `블록당 하루 최대 ${perBlock}MH로는 납기 안에 끝낼 수 없는 블록이 있습니다.`,
        blockIds: tooBig.map((b) => b.id),
      });
    }
  }

  // 각 납기일까지 누적 필요 MH가 누적 가용 MH를 넘는지
  if (dailyCapacityMH > 0) {
    const dues = [...new Set(blocks.map((b) => b.dueDay))].sort((a, b) => a - b);
    for (const d of dues) {
      const due = blocks.filter((b) => b.dueDay <= d);
      const need = due.reduce((s, b) => s + b.requiredMH, 0);
      const cap = d * dailyCapacityMH;
      if (need > cap) {
        issues.push({
          code: 'cumulative',
          message: `${d}일차까지 필요한 ${need}MH가 가용 ${cap}MH를 넘습니다.`,
          blockIds: due.map((b) => b.id),
        });
        break;
      }
    }
  }

  return { totalMH, dailyCapacityMH, workforceMH, possible: issues.length === 0, issues };
}
