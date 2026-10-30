import { describe, expect, it } from 'vitest';
import { buildCalendar, dayInfo, effectiveDue, isWorkDay, NO_OFF, workEnd, type CalendarOptions } from '../src/domain/calendar';
import { evaluate } from '../src/domain/evaluate';
import { tbmMessage } from '../src/domain/tbm';
import { solvePolicy } from '../src/solver/search';
import { checkCapacity } from '../src/solver/feasibility';
import { DEFAULT_RESOURCES, type Block } from '../src/domain/types';

// 2026-10-19는 월요일. 10월 남은 기간에는 공휴일이 없다
const MON = '2026-10-19';
const opts = (o: Partial<CalendarOptions> = {}): CalendarOptions => ({ weekends: true, holidays: true, extraOff: [], extraOn: [], ...o });

describe('작업하지 않는 날', () => {
  it('주말을 건너뛰고 작업일만 센다', () => {
    const cal = buildCalendar(MON, opts());
    expect(isWorkDay(cal, 5)).toBe(true); // 10/23 금
    expect(isWorkDay(cal, 6)).toBe(false); // 10/24 토
    expect(isWorkDay(cal, 7)).toBe(false);
    // 금요일에 착수해 작업일 2일 → 월요일에 끝
    expect(workEnd(cal, 5, 2)).toBe(8);
    expect(workEnd(NO_OFF, 5, 2)).toBe(6);
  });

  it('공휴일·대체공휴일을 쉰다', () => {
    const cal = buildCalendar('2026-10-01', opts());
    expect(dayInfo('2026-10-01', 5, opts())).toMatchObject({ off: 'holiday', holiday: '대체공휴일(개천절)' });
    expect(isWorkDay(cal, 9)).toBe(false); // 10/9 한글날
    expect(isWorkDay(buildCalendar('2026-10-01', opts({ holidays: false })), 9)).toBe(true);
  });

  it('주말·공휴일은 납기를 늦춘다: 남은 기간을 근무일로 센다', () => {
    const cal = buildCalendar(MON, opts());
    expect(effectiveDue(cal, 5)).toBe(5); // 10/23 그대로
    expect(effectiveDue(cal, 7)).toBe(9); // 원래 10/25(일) → 10/27(화)
    expect(effectiveDue(cal, 10)).toBe(12); // 엑셀 날짜 10/28(수) → 10/30(금)
  });

  it('직접 고른 작업 불가일과 근무일로 되돌린 날은 납기를 바꾸지 않는다', () => {
    const manual = buildCalendar(MON, opts({ extraOff: ['2026-10-22'] }));
    expect(isWorkDay(manual, 4)).toBe(false);
    expect(effectiveDue(manual, 5)).toBe(5);
    // 작업만 하루 밀린다: 1·2·3·5·8일
    expect(workEnd(manual, 1, 5)).toBe(8);

    const restored = buildCalendar(MON, opts({ extraOn: ['2026-10-24'] }));
    expect(isWorkDay(restored, 6)).toBe(true);
    expect(effectiveDue(restored, 7)).toBe(9);
  });

  it('평가: 쉬는 날에는 자원을 쓰지 않고, 막대는 쉬는 날을 건너 이어진다', () => {
    const cal = buildCalendar(MON, opts());
    const blocks: Block[] = [{ id: 'A', dueDay: 6, requiredMH: 16, materialReady: true }];
    const a = { A: { blockId: 'A', startDay: 5, general: 1, skilled: 0, crane: true, emergency: false, lane: 0 } };
    const ev = evaluate(blocks, DEFAULT_RESOURCES, a, cal);
    expect(ev.blocks.A).toMatchObject({ start: 5, end: 8, duration: 2, due: 8, status: 'ok', creditedMH: 16 });
    const general = ev.load.find((l) => l.kind === 'general')!.usage;
    expect(general.slice(4, 8)).toEqual([1, 0, 0, 1]);
  });

  it('납기 여유일·지연일은 작업일로 센다', () => {
    const cal = buildCalendar(MON, opts({ extraOff: ['2026-10-29'] }));
    const at = (startDay: number) => ({ blockId: 'A', startDay, general: 1, skilled: 0, crane: true, emergency: false, lane: 0 });
    // 남은 7일 → 납기 10/27(화). 금요일(5일)에 끝나면 주말을 빼고 월·화 2일 여유
    const blocks: Block[] = [{ id: 'A', dueDay: 7, requiredMH: 8, materialReady: true }];
    expect(evaluate(blocks, DEFAULT_RESOURCES, { A: at(5) }, cal).blocks.A).toMatchObject({ end: 5, due: 9, slackDays: 2 });
    expect(evaluate(blocks, DEFAULT_RESOURCES, { A: at(5) }, NO_OFF).blocks.A).toMatchObject({ end: 5, due: 7, slackDays: 2 });
    // 남은 1일 → 납기 10/19(월). 금요일 끝이면 화~금 4일 지연, 작업 불가일(10/29 목)을 지나 10/30에 끝나면 8일 지연
    const late: Block[] = [{ id: 'A', dueDay: 1, requiredMH: 8, materialReady: true }];
    expect(evaluate(late, DEFAULT_RESOURCES, { A: at(5) }, cal).blocks.A).toMatchObject({ status: 'late', lateDays: 4 });
    expect(evaluate(late, DEFAULT_RESOURCES, { A: at(12) }, cal).blocks.A).toMatchObject({ end: 12, lateDays: 8 });
  });

  it('TBM의 남은 날도 작업일로 센다', () => {
    const cal = buildCalendar(MON, opts());
    const blocks: Block[] = [{ id: 'A', dueDay: 7, requiredMH: 16, materialReady: true }];
    const a = { A: { blockId: 'A', startDay: 5, general: 1, skilled: 0, crane: true, emergency: false, lane: 0 } };
    const ev = evaluate(blocks, DEFAULT_RESOURCES, a, cal);
    // 10/23(금) 기준 납기 10/27(화)까지 주말을 빼면 월·화 2일
    expect(tbmMessage(5, blocks, a, ev, DEFAULT_RESOURCES, MON, cal)).toContain('납기 2일 남음');
  });

  it('최적화는 쉬는 날에 착수하지 않는다', () => {
    const cal = buildCalendar(MON, opts());
    const blocks: Block[] = Array.from({ length: 6 }, (_, i) => ({ id: `B${i}`, dueDay: 4 + i, requiredMH: 24, materialReady: true }));
    const sol = solvePolicy('optimal', blocks, DEFAULT_RESOURCES, { budgetMs: 150, cal });
    for (const a of Object.values(sol.assignments)) if (a.startDay !== null) expect(isWorkDay(cal, a.startDay)).toBe(true);
    const ev = evaluate(blocks, DEFAULT_RESOURCES, sol.assignments, cal);
    expect(ev.kpi.overloadCells).toBe(0);
  });

  it('용량 검사는 납기까지의 작업일만 센다', () => {
    const blocks: Block[] = [{ id: 'A', dueDay: 2, requiredMH: 40, materialReady: true }];
    // 블록당 하루 최대 MH = 일반 2명 + 숙련 1명 → 28MH, 이틀이면 56MH
    expect(checkCapacity(blocks, DEFAULT_RESOURCES).issues).toHaveLength(0);
    // 이틀 중 하루를 작업 불가로 지정하면 납기는 그대로라 하루치 28MH로는 부족
    const cal = buildCalendar(MON, opts({ extraOff: ['2026-10-20'] }));
    expect(checkCapacity(blocks, DEFAULT_RESOURCES, cal).issues.map((i) => i.code)).toContain('blockTooBig');
  });
});
