import { describe, expect, it } from 'vitest';
import { evaluate } from '../src/domain/evaluate';
import { assignBlockedReason } from '../src/domain/assign';
import { TUTORIAL_BLOCKS, TUTORIAL_RESOURCES } from '../src/tutorial/scenario';
import type { Assignments } from '../src/domain/types';

const R = TUTORIAL_RESOURCES;
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
