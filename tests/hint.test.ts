import { describe, expect, it } from 'vitest';
import { compareObjective, evaluate, objective } from '../src/domain/evaluate';
import { nextHint } from '../src/domain/hint';
import { tbmMessage } from '../src/domain/tbm';
import { compareReport, judge } from '../src/domain/report';
import { assignLanes } from '../src/domain/lanes';
import { solvePolicy } from '../src/solver/search';
import { TUTORIAL_BLOCKS, TUTORIAL_RESOURCES } from '../src/tutorial/scenario';
import type { Assignments } from '../src/domain/types';

const R = TUTORIAL_RESOURCES;
const optimal = assignLanes(TUTORIAL_BLOCKS, solvePolicy('optimal', TUTORIAL_BLOCKS, R, { budgetMs: 200 }).assignments, R);

describe('힌트', () => {
  it('힌트를 따라가면 매번 좋아지거나 같고, 결국 최적과 같아진다', () => {
    let plan: Assignments = {};
    for (let i = 0; i < 10; i++) {
      const h = nextHint(TUTORIAL_BLOCKS, R, plan, optimal);
      if (!h.next) break;
      expect(h.blockId).not.toBeNull();
      expect(h.message).toContain(h.blockId!);
      plan = h.next;
    }
    expect(compareObjective(objective(evaluate(TUTORIAL_BLOCKS, R, plan).kpi), objective(evaluate(TUTORIAL_BLOCKS, R, optimal).kpi))).toBeLessThanOrEqual(0);
    expect(nextHint(TUTORIAL_BLOCKS, R, plan, optimal).message).toContain('최적 배치만큼 좋습니다');
  });

  it('첫 힌트는 납기 준수를 늘리는 변경', () => {
    const h = nextHint(TUTORIAL_BLOCKS, R, {}, optimal);
    expect(h.message).toMatch(/납기 준수 0 → 1개/);
  });
});

describe('TBM · 평가서', () => {
  const ev = evaluate(TUTORIAL_BLOCKS, R, optimal);

  it('그날 작업 블록을 작업장별로 적고 투입 인원과 안전 문구를 넣는다', () => {
    const msg = tbmMessage(1, TUTORIAL_BLOCKS, optimal, ev, R, '2026-10-19');
    expect(msg.split('\n')[0]).toBe('[TBM] 10/19(월) 오늘 작업');
    expect(msg).toMatch(/\[작업장 1\]/);
    expect(msg).toMatch(/■ 투입: 일반 \d\/4명/);
    expect(msg).toContain('크레인 인양 시 신호수 배치');
    expect(tbmMessage(30, TUTORIAL_BLOCKS, optimal, ev, R, '2026-10-19')).toContain('예정된 블록 작업이 없습니다');
  });

  it('최적 대비 판정', () => {
    const empty = evaluate(TUTORIAL_BLOCKS, R, {}).kpi;
    const rows = compareReport(empty, ev.kpi);
    expect(judge(rows[0])).toBe('worse');
    expect(rows.map(judge)).toContain('worse');
    expect(compareReport(ev.kpi, ev.kpi).every((r) => judge(r) === 'same')).toBe(true);
  });
});
