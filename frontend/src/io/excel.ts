import type { Assignments, Block, Resources } from '../domain/types';
import { evaluate, type Evaluation } from '../domain/evaluate';
import { verdictText } from '../domain/labels';
import { laneCount, workplaceOf } from '../domain/lanes';
import { compareReport, judge } from '../domain/report';
import { tbmMessage } from '../domain/tbm';
import { isWorkDay, NO_OFF, type Calendar } from '../domain/calendar';
import { dayToDate, toISO } from './dates';
import { parseTable, type ParseResult } from './parse';

/** 업로드 받는 파일 형식. 맥 Numbers(.numbers)도 SheetJS가 바로 읽는다 */
export const FILE_ACCEPT = '.xlsx,.xls,.csv,.numbers';
export const FILE_TYPES = '.xlsx / .xls / .csv / .numbers';

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

const LOAD_LABEL = { slots: '동시 처리 블록', general: '일반 작업자', skilled: '숙련공', crane: '크레인' } as const;

function planRows(blocks: Block[], r: Resources, assignments: Assignments, ev: Evaluation, date: (d: number | null) => string) {
  const lanes = laneCount(r);
  return [
    ['블록 ID', '납기(남은 일)', '납기일', '필요 MH', '자재', '작업장', '착수일', '종료일', '기간(작업일)', '작업자 수', '일반 작업자', '숙련공', '하루 MH', '납기 여유(일)', '크레인', '비상 자재', '판정', '지연(일)', '납기 내 인정 MH', '전체 인정 MH'],
    ...blocks.map((b) => {
      const a = assignments[b.id];
      const x = ev.blocks[b.id];
      return [
        b.id,
        b.dueDay,
        // 주말·공휴일만큼 미뤄진 실제 납기
        date(x.due),
        b.requiredMH,
        b.materialReady ? '준비' : '미준비',
        x.start !== null && a?.lane !== undefined && a.lane < lanes ? workplaceOf(a.lane, r) + 1 : '',
        date(x.start),
        date(x.end),
        x.duration ?? '',
        (a?.general ?? 0) + (a?.skilled ?? 0),
        a?.general ?? 0,
        a?.skilled ?? 0,
        x.dailyMH,
        x.slackDays,
        a?.crane ? 1 : 0,
        a?.emergency ? 1 : 0,
        verdictText(x),
        x.lateDays,
        x.mhByDue,
        x.creditedMH,
      ];
    }),
  ];
}

function loadRows(ev: Evaluation, date: (d: number | null) => string, cal: Calendar) {
  const days = Array.from({ length: ev.horizon }, (_, i) => i + 1);
  return [
    ['자원', '용량', ...days.map((d) => `${d}일 (${date(d)})${isWorkDay(cal, d) ? '' : ' 휴무'}`)],
    ...ev.load.map((row) => [LOAD_LABEL[row.kind], row.capacity, ...row.usage]),
  ];
}

export interface ExportExtras {
  /** 최적 배치. 있으면 평가서 시트를 만든다 */
  optimal?: Assignments;
  /** 신입 모드의 힌트 사용 횟수 */
  hintCount?: number;
  /** 작업하지 않는 날 */
  cal?: Calendar;
}

export async function exportSchedule(blocks: Block[], r: Resources, assignments: Assignments, planStart: string, extras: ExportExtras = {}) {
  const XLSX = await loadXLSX();
  const cal = extras.cal ?? NO_OFF;
  const ev = evaluate(blocks, r, assignments, cal);
  const date = (day: number | null) => (day === null ? '' : toISO(dayToDate(planStart, day)));
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
    ['잔여 납기 여유일', k.totalSlackDays],
  ];
  const tbm = [['일차', '날짜', 'TBM 메시지'], ...Array.from({ length: ev.horizon }, (_, i) => [i + 1, date(i + 1), tbmMessage(i + 1, blocks, assignments, ev, r, planStart, cal)])];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(planRows(blocks, r, assignments, ev, date)), '배치표');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(loadRows(ev, date, cal)), '일별 자원 부하');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), '요약');
  const tbmSheet = XLSX.utils.aoa_to_sheet(tbm);
  tbmSheet['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, tbmSheet, 'TBM');
  if (extras.optimal) {
    const rows = compareReport(k, evaluate(blocks, r, extras.optimal, cal).kpi);
    const report: (string | number)[][] = [
      ['항목', '현재', '최적', '차이', '판정'],
      ...rows.map((x) => [x.label, x.current, x.optimal, x.current - x.optimal, { better: '최적보다 좋음', same: '같음', worse: '최적보다 나쁨' }[judge(x)]]),
    ];
    if (extras.hintCount !== undefined) report.push(['힌트 사용', extras.hintCount, '', '', '']);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(report), '평가서');
  }
  XLSX.writeFile(wb, `블록_배치_${planStart}.xlsx`);
}
