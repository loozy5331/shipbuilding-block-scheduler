import { describe, expect, it } from 'vitest';
import { evaluate } from '../src/domain/evaluate';
import { assignLanes, samePlan } from '../src/domain/lanes';
import { TUTORIAL_BLOCKS } from '../src/tutorial/scenario';
import { DEFAULT_RESOURCES } from '../src/domain/types';
import { solvePolicy } from '../src/solver/search';
import type { Assignments } from '../src/domain/types';

// 자원 규칙 검증용: 일반 작업자 4명 · 숙련공 1명 기본값
const R = DEFAULT_RESOURCES;
const a = (blockId: string, startDay: number, general: number, lane?: number) => ({ blockId, startDay, general, skilled: 0, crane: true, emergency: false, lane });

describe('작업 자리(레인)', () => {
  it('최적 배치에 자리를 주면 같은 자리에서 겹치는 블록이 없다', () => {
    const sol = solvePolicy('optimal', TUTORIAL_BLOCKS, R, { budgetMs: 200 });
    const placed = assignLanes(TUTORIAL_BLOCKS, sol.assignments, R);
    const ev = evaluate(TUTORIAL_BLOCKS, R, placed);
    expect(Object.values(placed).filter((x) => x.startDay !== null).every((x) => x.lane === 0 || x.lane === 1)).toBe(true);
    expect(TUTORIAL_BLOCKS.some((b) => ev.blocks[b.id].laneClash)).toBe(false);
    expect(ev.feasible).toBe(true);
    expect(samePlan(placed, sol.assignments)).toBe(true);
  });

  it('이미 정한 자리는 유지하고, 빈 자리를 고른다', () => {
    const plan: Assignments = { 'A-101': a('A-101', 1, 2, 1), 'D-208': a('D-208', 1, 1) };
    const placed = assignLanes(TUTORIAL_BLOCKS, plan, R);
    expect(placed['A-101'].lane).toBe(1);
    expect(placed['D-208'].lane).toBe(0);
  });

  it('같은 작업장에서 날짜가 겹치면 작업장 겹침(conflict)', () => {
    const plan: Assignments = { 'A-101': a('A-101', 1, 2, 0), 'D-208': a('D-208', 1, 1, 0) };
    const ev = evaluate(TUTORIAL_BLOCKS, R, plan);
    expect(ev.blocks['D-208'].status).toBe('conflict');
    expect(ev.blocks['D-208'].laneClash).toBe(true);
    expect(ev.blocks['D-208'].overDays).toEqual([1]);
    expect(ev.kpi.overloadCells).toBe(1);
  });

  it('작업장 수가 줄면 범위를 벗어난 자리를 다시 잡는다', () => {
    const plan: Assignments = { 'A-101': a('A-101', 1, 2, 1) };
    expect(assignLanes(TUTORIAL_BLOCKS, plan, { ...R, workplaces: 1 })['A-101'].lane).toBe(0);
  });

  it('납기 여유일: 납기 전에 끝난 날 수', () => {
    const ev = evaluate(TUTORIAL_BLOCKS, R, { 'E-320': a('E-320', 1, 3, 0) });
    expect(ev.blocks['E-320'].slackDays).toBe(3);
    expect(ev.kpi.totalSlackDays).toBe(3);
  });
});
