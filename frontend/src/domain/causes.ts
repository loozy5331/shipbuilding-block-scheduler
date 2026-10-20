import type { Assignments, Block } from './types';
import type { Evaluation } from './evaluate';
import { isWorkDay, nextWorkDay, workDaysIn, workEnd, type Calendar } from './calendar';

/**
 * 납기를 넘긴 블록이 왜 늦었는지 (결과 배치표·엑셀의 지연 원인). 늦지 않았으면 빈 목록.
 * date: 일차 → 표시용 날짜
 */
export function delayCauses(block: Block, ev: Evaluation, assignments: Assignments, cal: Calendar, date: (day: number) => string): string[] {
  const x = ev.blocks[block.id];
  if (x.lateDays <= 0 || x.start === null || x.end === null || x.duration === null) return [];
  const a = assignments[block.id];
  const out: string[] = [];

  // 가장 이르게 착수할 수 있는 날: 첫 작업일, 자재가 늦게 오면(비상 자재 없이) 입고일
  let earliest = nextWorkDay(cal, 1);
  if (block.materialDay !== undefined && !a?.emergency && block.materialDay > earliest) {
    earliest = nextWorkDay(cal, block.materialDay);
    out.push(
      earliest > x.due
        ? `자재 ${date(block.materialDay)} 입고 — 납기보다 늦어 비상 자재 없이는 납기를 맞출 수 없음`
        : `자재 ${date(block.materialDay)} 입고 → ${date(earliest)}부터 착수 가능`,
    );
  }
  if (earliest <= x.due && workEnd(cal, earliest, x.duration) > x.due) out.push(`투입 인원으로 ${x.duration}작업일이 걸려 ${date(earliest)}에 착수해도 납기를 넘김`);
  if (x.start > earliest) out.push(`착수가 ${workDaysIn(cal, earliest, x.start - 1)}작업일 늦음 (앞선 블록과 작업장·인원을 나눠 씀)`);

  // 주말·공휴일은 납기도 그만큼 늦췄으니, 직접 지정한 작업 불가일만 원인으로 센다
  const preset = new Set(cal.baseOff);
  let manual = 0;
  for (let d = x.start; d <= x.end; d++) if (!isWorkDay(cal, d) && !preset.has(d)) manual++;
  if (manual > 0) out.push(`작업 기간에 작업 불가일 ${manual}일`);

  if (x.status === 'conflict') out.push(x.laneClash ? '같은 작업장 자리에서 다른 블록과 겹침' : `자원 초과 ${x.overDays.length}일 (그날 공수 불인정)`);
  return out;
}
