import { describe, expect, it } from 'vitest';
import { compareObjective, evaluate, meetsMinimum, objective } from '../src/domain/evaluate';
import { solveAll } from '../src/solver';
import { checkCapacity } from '../src/solver/feasibility';
import { buildModes } from '../src/solver/modes';
import { rng, solvePolicy } from '../src/solver/search';
import { TUTORIAL_BLOCKS, TUTORIAL_RESOURCES } from '../src/tutorial/scenario';
import type { Block } from '../src/domain/types';

describe('튜토리얼 시나리오', () => {
  it('최적화하면 5블록 모두 자원 초과 없이 납기 안에 끝난다', () => {
    const sol = solvePolicy('optimal', TUTORIAL_BLOCKS, TUTORIAL_RESOURCES, { budgetMs: 300 });
    expect(sol.feasible).toBe(true);
    expect(sol.kpi.onTime).toBe(5);
    expect(sol.kpi.overloadCells).toBe(0);
    expect(sol.kpi.emergencyUsed).toBe(1);
    expect(sol.assignments['C-115'].emergency).toBe(true);
  });

  it('입력 순서대로 배치하면 지연이 생기고, 납기 빠른 순은 해소한다', () => {
    const input = solvePolicy('input', TUTORIAL_BLOCKS, TUTORIAL_RESOURCES);
    const edd = solvePolicy('edd', TUTORIAL_BLOCKS, TUTORIAL_RESOURCES);
    expect(input.kpi.late).toBeGreaterThan(0);
    expect(edd.kpi.onTime).toBe(5);
  });

  it('용량 요약: 전체 80MH, 하루 인력 44MH', () => {
    const c = checkCapacity(TUTORIAL_BLOCKS, TUTORIAL_RESOURCES);
    expect(c.totalMH).toBe(80);
    expect(c.workforceMH).toBe(44);
    expect(c.possible).toBe(true);
  });
});

describe('자원 부족', () => {
  const tight = { ...TUTORIAL_RESOURCES, skilledWorkers: 0, generalWorkers: 2 };

  it('불가 판정과 함께 해소 자원을 제안한다', () => {
    const res = solveAll({ blocks: TUTORIAL_BLOCKS, resources: tight, budgetMs: 200 });
    expect(res.solutions.optimal.feasible).toBe(false);
    expect(res.capacity.possible).toBe(false);
    expect(res.whatIf.length).toBeGreaterThan(0);
    expect(res.whatIf[0].resolves).toBe(true);
    expect(res.whatIf[0].key).toMatch(/generalWorkers|skilledWorkers/);
  });

  it('자재 미준비 블록이 비상 자재보다 많으면 일부는 착수하지 못한다', () => {
    const blocks = TUTORIAL_BLOCKS.map((b) => ({ ...b, materialReady: false }));
    const sol = solvePolicy('optimal', blocks, TUTORIAL_RESOURCES, { budgetMs: 100 });
    expect(sol.kpi.notRunnable).toBe(4);
    expect(checkCapacity(blocks, TUTORIAL_RESOURCES).issues.some((i) => i.code === 'material')).toBe(true);
  });
});

describe('모드', () => {
  it('지배되는 인원 구성은 제외한다', () => {
    const modes = buildModes({ id: 'X', dueDay: 2, requiredMH: 8, materialReady: true }, TUTORIAL_RESOURCES);
    // 8MH는 1명으로 하루에 끝나므로 2명 이상 1일짜리 구성은 없어야 한다 (일반 1명 / 숙련 1명은 서로 다른 자원이라 둘 다 남음)
    expect(modes.filter((m) => m.duration === 1)).toEqual([
      expect.objectContaining({ general: 1, skilled: 0 }),
      expect.objectContaining({ general: 0, skilled: 1 }),
    ]);
  });
});

describe('대규모 입력', () => {
  it('30블록을 1초 안에 풀고 결과가 자원 제약을 지킨다', () => {
    const rand = rng(42);
    const blocks: Block[] = Array.from({ length: 30 }, (_, i) => ({
      id: `B-${100 + i}`,
      dueDay: 1 + Math.floor(rand() * 15),
      requiredMH: 8 + Math.floor(rand() * 33),
      materialReady: rand() > 0.2,
    }));
    const r = { ...TUTORIAL_RESOURCES, workplaces: 4, generalWorkers: 10, skilledWorkers: 3, cranes: 3, emergencyMaterials: 3 };
    const t0 = Date.now();
    const res = solveAll({ blocks, resources: r, budgetMs: 600 });
    expect(Date.now() - t0).toBeLessThan(1000 + 5 * 3 * 120 + 500);
    const ev = evaluate(blocks, r, res.solutions.optimal.assignments);
    expect(ev.kpi.overloadCells).toBe(0);
    expect(res.solutions.optimal.kpi.late).toBeLessThanOrEqual(res.solutions.edd.kpi.late);
  });
});

describe('차선책', () => {
  it('최적해와 착수 순서가 다른 차선책을 최대 3개, 좋은 순으로 준다', () => {
    const sol = solvePolicy('optimal', TUTORIAL_BLOCKS, TUTORIAL_RESOURCES, { budgetMs: 300 });
    const alts = sol.alternatives!;
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.length).toBeLessThanOrEqual(3);
    const order = (a: typeof sol.assignments) =>
      Object.values(a)
        .filter((x) => x.startDay !== null)
        .sort((x, y) => x.startDay! - y.startDay! || x.blockId.localeCompare(y.blockId))
        .map((x) => x.blockId)
        .join();
    const orders = [sol, ...alts].map((p) => order(p.assignments));
    expect(new Set(orders).size).toBe(orders.length);
    for (let i = 1; i < alts.length; i++) expect(compareObjective(objective(alts[i - 1].kpi), objective(alts[i].kpi))).toBeLessThanOrEqual(0);
  });
});

describe('차선책 최소 요건', () => {
  const check = (blocks: Block[], r = TUTORIAL_RESOURCES) => {
    const sol = solvePolicy('optimal', blocks, r, { budgetMs: 300 });
    for (const alt of sol.alternatives!) {
      expect(meetsMinimum(blocks, r, alt.assignments)).toBe(true);
      expect(alt.kpi.overloadCells).toBe(0);
      expect(alt.kpi.notRunnable).toBeLessThanOrEqual(sol.kpi.notRunnable);
      for (const b of blocks) {
        const a = alt.assignments[b.id];
        if (a?.startDay == null) continue;
        // 자재는 무조건 갖춘다: 준비됐거나 비상 자재
        expect(b.materialReady || a.emergency).toBe(true);
        expect(a.crane).toBe(true);
        expect(a.general + a.skilled).toBeGreaterThan(0);
      }
    }
    return sol;
  };

  it('튜토리얼 5블록', () => {
    check(TUTORIAL_BLOCKS);
  });

  it('자재 미준비 블록이 비상 자재보다 많아도 자재 없는 블록은 착수하지 않는다', () => {
    const sol = check(TUTORIAL_BLOCKS.map((b, i) => ({ ...b, materialReady: i % 2 === 0 })));
    expect(sol.alternatives!.length).toBeGreaterThan(0);
  });

  it('자원이 빠듯해도 요건을 어기는 차선책은 내지 않는다', () => {
    check(TUTORIAL_BLOCKS, { ...TUTORIAL_RESOURCES, generalWorkers: 2, skilledWorkers: 0 });
  });

  it('meetsMinimum: 자재 없이 올린 블록이 있으면 불만족', () => {
    const c115 = { blockId: 'C-115', startDay: 1, general: 2, skilled: 0, crane: true, emergency: false };
    expect(meetsMinimum(TUTORIAL_BLOCKS, TUTORIAL_RESOURCES, { 'C-115': c115 })).toBe(false);
    expect(meetsMinimum(TUTORIAL_BLOCKS, TUTORIAL_RESOURCES, { 'C-115': { ...c115, emergency: true } })).toBe(true);
  });
});
