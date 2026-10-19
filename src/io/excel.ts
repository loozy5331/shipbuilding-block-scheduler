import type { Assignments, Block, Resources } from '../domain/types';
import { evaluate } from '../domain/evaluate';
import { dayToDate, toISO } from './dates';
import { parseTable, type ParseResult } from './parse';

/** SheetJS는 무거우므로 엑셀을 다룰 때만 불러온다 */
const loadXLSX = () => import('xlsx');

export async function readBlocksFromFile(file: File, planStart: string): Promise<ParseResult> {
  const XLSX = await loadXLSX();
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' });
  return parseTable(rows, planStart);
}

export const TEMPLATE_HEADER = ['블록 ID', '납기일', '필요 작업 시간', '자재준비 여부'];

export async function downloadTemplate(planStart: string) {
  const XLSX = await loadXLSX();
  const rows = [
    TEMPLATE_HEADER,
    ['A-101', dayToDate(planStart, 1), 16, '준비'],
    ['B-203', dayToDate(planStart, 2), 24, '준비'],
    ['C-115', dayToDate(planStart, 3), 12, '미준비'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows, { cellDates: true, dateNF: 'yyyy-mm-dd' });
  ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '블록');
  XLSX.writeFile(wb, '블록_입력_양식.xlsx');
}

const STATUS_LABEL = { ok: '납기 안', late: '납기 지연', blocked: '착수 불가', unscheduled: '미배치' } as const;
const LOAD_LABEL = { slots: '동시 처리 블록', general: '일반 작업자', skilled: '숙련공', crane: '크레인' } as const;

export async function exportSchedule(blocks: Block[], r: Resources, assignments: Assignments, planStart: string) {
  const XLSX = await loadXLSX();
  const ev = evaluate(blocks, r, assignments);
  const date = (day: number | null) => (day === null ? '' : toISO(dayToDate(planStart, day)));

  const plan = [
    ['블록 ID', '납기(남은 일)', '납기일', '필요 MH', '자재', '착수일', '종료일', '기간(일)', '일반 작업자', '숙련공', '하루 MH', '크레인', '비상 자재', '상태', '지연(일)'],
    ...blocks.map((b) => {
      const a = assignments[b.id];
      const x = ev.blocks[b.id];
      return [
        b.id,
        b.dueDay,
        date(b.dueDay),
        b.requiredMH,
        b.materialReady ? '준비' : '미준비',
        date(x.start),
        date(x.end),
        x.duration ?? '',
        a?.general ?? 0,
        a?.skilled ?? 0,
        x.dailyMH,
        a?.crane ? 1 : 0,
        a?.emergency ? 1 : 0,
        STATUS_LABEL[x.status],
        x.lateDays,
      ];
    }),
  ];

  const days = Array.from({ length: ev.horizon }, (_, i) => i + 1);
  const load = [
    ['자원', '용량', ...days.map((d) => `${d}일 (${date(d)})`)],
    ...ev.load.map((row) => [LOAD_LABEL[row.kind], row.capacity, ...row.usage]),
  ];

  const k = ev.kpi;
  const summary = [
    ['항목', '값'],
    ['계획 시작일', planStart],
    ['블록 수', k.total],
    ['납기 준수', `${k.onTime} / ${k.total}`],
    ['준수율', `${Math.round(k.onTimeRate * 100)}%`],
    ['총 지연일', k.totalLateDays],
    ['비상 자재 사용', `${k.emergencyUsed} / ${k.emergencyCapacity}`],
    ['자원 초과 칸', k.overloadCells],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(plan), '배치표');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(load), '일별 자원 부하');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), '요약');
  XLSX.writeFile(wb, `블록_배치_${planStart}.xlsx`);
}
