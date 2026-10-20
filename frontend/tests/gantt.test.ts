import { describe, expect, it } from 'vitest';
import { evaluate } from '../src/domain/evaluate';
import { assignBlockedReason } from '../src/domain/assign';
import { TUTORIAL_BLOCKS } from '../src/tutorial/scenario';
import { DEFAULT_RESOURCES } from '../src/domain/types';
import type { Assignments } from '../src/domain/types';
import { buildCalendar, NO_OFF } from '../src/domain/calendar';
import { buildColumns, COL, FOLDED, ganttDays } from '../src/components/board/ganttLayout';

// 자원 규칙 검증용: 일반 작업자 4명 · 숙련공 1명 기본값
const R = DEFAULT_RESOURCES;
const a = (blockId: string, startDay: number, general: number, skilled = 0) => ({ blockId, startDay, general, skilled, crane: true, emergency: false });

describe('자원 겹침', () => {
  it('용량을 넘은 날의 공수는 인정하지 않고 conflict로 판정한다', () => {
    // 1일에 일반 작업자 2+3=5명 > 4명
    const plan: Assignments = { 'A-101': a('A-101', 1, 2), 'B-203': a('B-203', 1, 3) };
    const ev = evaluate(TUTORIAL_BLOCKS, R, plan);
    expect(ev.blocks['A-101'].status).toBe('conflict');
    expect(ev.blocks['A-101'].overDays).toEqual([1]);
    expect(ev.blocks['A-101'].mhByDue).toBe(0);
    expect(ev.kpi.onTime).toBe(0);
    expect(ev.kpi.conflicts).toBe(2);
  });

  it('겹치지 않는 날의 공수는 인정한다', () => {
    // 1일에 A·D·B 3블록 > 작업장 2곳. B-203은 1~3일(일반 1명, 8MH/일), 납기 2일
    const plan: Assignments = { 'A-101': a('A-101', 1, 2), 'D-208': a('D-208', 1, 1), 'B-203': a('B-203', 1, 1) };
    const b = evaluate(TUTORIAL_BLOCKS, R, plan).blocks['B-203'];
    expect(b.status).toBe('conflict');
    expect(b.overDays).toEqual([1]);
    expect(b.creditedMH).toBe(16); // 2·3일만 인정
    expect(b.mhByDue).toBe(8); // 납기 2일까지는 2일차 하루분
    expect(b.lateDays).toBe(1);
  });
});

describe('배정 규칙', () => {
  const C115 = TUTORIAL_BLOCKS[2];
  const A101 = TUTORIAL_BLOCKS[0];
  it('인원 한도·중복 크레인·자재 준비 블록·비상 자재 소진을 막는다', () => {
    expect(assignBlockedReason(A101, a('A-101', 1, 3), 'general', R, {})).toBe('블록 하나에 3명까지');
    expect(assignBlockedReason(A101, a('A-101', 1, 1), 'crane', R, {})).toBe('이미 크레인이 있습니다');
    expect(assignBlockedReason(A101, undefined, 'emergency', R, {})).toBe('자재가 준비된 블록입니다');
    const used = { X: { ...a('X', 1, 1), emergency: true } };
    expect(assignBlockedReason(C115, undefined, 'emergency', R, used)).toBe('비상 자재가 남지 않았습니다');
    expect(assignBlockedReason(C115, undefined, 'emergency', R, {})).toBeNull();
  });
});

describe('간트 날짜 범위', () => {
  it('모든 블록을 한 줄로 이어도 들어가도록 날짜를 잡는다', () => {
    // 튜토리얼 5블록: 16+24+12+8+20 = 80MH → 작업자 1명(8MH) 기준 2+3+2+1+3 = 11일
    const ev = evaluate(TUTORIAL_BLOCKS, R, {});
    expect(ganttDays(TUTORIAL_BLOCKS, R, ev, NO_OFF)).toBe(11 + 2);
    // 주말이 끼면 그만큼 늘어난다 (10/19 월 시작, 작업일 11일 → 11/2 = 15일차)
    const cal = buildCalendar('2026-10-19', { weekends: true, holidays: true, extraOff: [], extraOn: [] });
    expect(ganttDays(TUTORIAL_BLOCKS, R, evaluate(TUTORIAL_BLOCKS, R, {}, cal), cal)).toBe(15 + 2);
  });
});

describe('접힌 날짜 칸', () => {
  it('접힌 칸은 좁고, 막대 폭·끌어 놓은 날을 칸 폭대로 계산한다', () => {
    // 6·7일 접힘
    const cols = buildColumns(10, (d) => d === 6 || d === 7);
    expect(cols.left(6)).toBe(5 * COL);
    expect(cols.left(8)).toBe(5 * COL + 2 * FOLDED);
    expect(cols.span(5, 8)).toBe(2 * COL + 2 * FOLDED);
    expect(cols.template.split(' ')[5]).toBe(`${FOLDED}px`);
    // 5일 막대를 한 칸 반 오른쪽으로 끌면 접힌 주말을 넘어 8일
    expect(cols.moved(5, COL)).toBe(8);
    expect(cols.moved(5, -COL)).toBe(4);
    expect(cols.moved(1, -500)).toBe(1);
  });
});
