import { describe, expect, it } from 'vitest';
import { parseDue, parseMaterial, parsePasted, parseTable } from '../src/io/parse';
import { evaluate } from '../src/domain/evaluate';
import { TUTORIAL_BLOCKS, TUTORIAL_RESOURCES } from '../src/tutorial/scenario';

const START = '2026-10-19';

describe('엑셀 표 파싱', () => {
  it('헤더 별칭과 열 순서를 인식한다', () => {
    const r = parseTable(
      [
        ['자재준비 여부', '블록ID', '필요 작업 시간', '납기일'],
        ['완료', 'A-101', 16, new Date(2026, 9, 19)],
        ['X', 'C-115', '12시간', '2026-10-21'],
      ],
      START,
    );
    expect(r.errors).toEqual([]);
    expect(r.blocks).toEqual([
      { id: 'A-101', dueDay: 1, requiredMH: 16, materialReady: true },
      { id: 'C-115', dueDay: 3, requiredMH: 12, materialReady: false },
    ]);
  });

  it('헤더가 없으면 ID·납기·MH·자재 순서로 읽는다 (붙여넣기)', () => {
    const r = parsePasted('A-101\t1\t16\t예\nB-203\t2\t24\t미준비', START);
    expect(r.blocks.map((b) => [b.id, b.dueDay, b.materialReady])).toEqual([
      ['A-101', 1, true],
      ['B-203', 2, false],
    ]);
  });

  it('행 단위 오류를 모아 보고한다', () => {
    const r = parseTable(
      [
        ['블록 ID', '납기일', '필요 작업 시간', '자재준비 여부'],
        ['A', 1, 16, '준비'],
        ['A', 2, 8, '준비'],
        ['B', '???', -3, '모름'],
      ],
      START,
    );
    expect(r.blocks).toHaveLength(1);
    expect(r.errors.map((e) => e.row)).toEqual([3, 4]);
    expect(r.errors[1].message).toContain('납기 해석 불가');
  });

  it('필수 열이 없으면 알려 준다', () => {
    const r = parseTable([['블록 ID', '납기일'], ['A', 1]], START);
    expect(r.errors[0].message).toContain('필요 작업 시간');
  });

  it('자재·납기 값 정규화', () => {
    expect(['Y', 'o', '준비', '완료', 'TRUE'].map(parseMaterial)).toEqual([true, true, true, true, true]);
    expect(['N', 'x', '미준비', '미완료', 'false'].map(parseMaterial)).toEqual([false, false, false, false, false]);
    expect(parseDue(46314, START)).toBe(1); // 엑셀 일련번호 2026-10-19
    expect(parseDue('10/22', START)).toBe(4);
  });
});

describe('evaluate (수동 배치)', () => {
  it('자원 초과·착수 불가·지연을 판정한다', () => {
    const a = {
      'A-101': { blockId: 'A-101', startDay: 1, general: 3, skilled: 0, crane: true, emergency: false },
      'D-208': { blockId: 'D-208', startDay: 1, general: 2, skilled: 0, crane: true, emergency: false },
      'C-115': { blockId: 'C-115', startDay: 1, general: 1, skilled: 0, crane: true, emergency: false },
      'E-320': { blockId: 'E-320', startDay: 4, general: 1, skilled: 0, crane: true, emergency: false },
    };
    const ev = evaluate(TUTORIAL_BLOCKS, TUTORIAL_RESOURCES, a);
    expect(ev.blocks['A-101'].overloaded).toBe(true); // 일반 5명 > 4명, 동시 3블록 > 2
    expect(ev.blocks['C-115'].status).toBe('blocked');
    expect(ev.blocks['C-115'].blockedReasons).toEqual(['noMaterial']);
    expect(ev.blocks['E-320'].status).toBe('late');
    expect(ev.blocks['E-320'].lateDays).toBe(2);
    expect(ev.blocks['E-320'].mhByDue).toBe(8);
    expect(ev.blocks['B-203'].status).toBe('unscheduled');
    expect(ev.feasible).toBe(false);
  });
});

describe('맥 Numbers 파일', () => {
  it('.numbers 파일을 엑셀처럼 읽는다', async () => {
    const XLSX = await import('xlsx');
    const { default: zahl } = await import('xlsx/dist/xlsx.zahl.mjs');
    const ws = XLSX.utils.aoa_to_sheet([
      ['블록 ID', '남은 기간', '필요 작업 시간', '자재준비 여부'],
      ['A-101', 1, 16, '준비'],
      ['B-203', 3, 24, '미준비'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '블록');
    const buf: ArrayBuffer = XLSX.write(wb, { bookType: 'numbers', type: 'array', numbers: zahl });
    const { readBlocksFromFile } = await import('../src/io/excel');
    const r = await readBlocksFromFile(new File([buf], '블록.numbers'), START);
    expect(r.errors).toEqual([]);
    expect(r.blocks).toEqual([
      { id: 'A-101', dueDay: 1, requiredMH: 16, materialReady: true },
      { id: 'B-203', dueDay: 3, requiredMH: 24, materialReady: false },
    ]);
  });
});

describe('자재 납기일 (선택 열)', () => {
  it('자재 납기일이 있으면 그날 입고, 오늘 이전이면 준비, 빈 칸은 자재준비 여부를 따른다', () => {
    const r = parseTable(
      [
        ['블록 ID', '납기일', '필요 작업 시간', '자재준비 여부', '자재 납기일'],
        ['A', 5, 16, '미준비', '2026-10-22'],
        ['B', 5, 16, '미준비', '2026-10-19'],
        ['C', 5, 16, '준비', ''],
      ],
      START,
    );
    expect(r.errors).toEqual([]);
    expect(r.blocks).toEqual([
      { id: 'A', dueDay: 5, requiredMH: 16, materialReady: false, materialDay: 4 },
      { id: 'B', dueDay: 5, requiredMH: 16, materialReady: true },
      { id: 'C', dueDay: 5, requiredMH: 16, materialReady: true },
    ]);
  });

  it('"자재 납기일(예정)"은 자재준비 여부가 아니라 자재 납기일로 읽고, 그 열만 있어도 된다', () => {
    const r = parseTable(
      [
        ['블록', '납기', '공수', '자재 납기일(예정)'],
        ['A', 5, 16, '10/23'],
        ['B', 5, 16, ''],
      ],
      START,
    );
    expect(r.errors).toEqual([]);
    expect(r.blocks.map((b) => [b.id, b.materialReady, b.materialDay])).toEqual([
      ['A', false, 5],
      ['B', true, undefined],
    ]);
  });

  it('해석할 수 없는 자재 납기일은 행 오류', () => {
    const r = parseTable(
      [
        ['블록 ID', '납기일', '필요 작업 시간', '자재준비 여부', '자재 입고일'],
        ['A', 5, 16, '준비', '언젠가'],
      ],
      START,
    );
    expect(r.errors[0].message).toContain('자재 납기일');
  });
});
