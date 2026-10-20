import type { Assignments, Block, Resources } from './types';
import type { Evaluation } from './evaluate';
import { laneCount, workplaceOf } from './lanes';
import { dayToDate, toISO } from '../io/dates';
import { isWorkDay, NO_OFF, workDaysIn, type Calendar } from './calendar';
import { HOLIDAYS } from './holidays';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

export interface DayWork {
  block: Block;
  workplace: number | null;
  /** 이 블록의 몇째 날인지 (1부터) */
  nth: number;
  duration: number;
  general: number;
  skilled: number;
  crane: boolean;
  emergency: boolean;
}

/** day일에 작업 중인 블록 (작업장 순). 쉬는 날은 없다 */
export function workOn(day: number, blocks: Block[], assignments: Assignments, ev: Evaluation, r: Resources, cal: Calendar = NO_OFF): DayWork[] {
  if (!isWorkDay(cal, day)) return [];
  return blocks
    .filter((b) => {
      const x = ev.blocks[b.id];
      return x.start !== null && x.end !== null && x.start <= day && day <= x.end;
    })
    .map((b) => {
      const a = assignments[b.id];
      const x = ev.blocks[b.id];
      return {
        block: b,
        workplace: a.lane !== undefined && a.lane < laneCount(r) ? workplaceOf(a.lane, r) : null,
        nth: workDaysIn(cal, x.start!, day),
        duration: x.duration!,
        general: a.general,
        skilled: a.skilled,
        crane: a.crane,
        emergency: a.emergency,
      };
    })
    .sort((p, q) => (p.workplace ?? 99) - (q.workplace ?? 99) || p.block.id.localeCompare(q.block.id));
}

function offLabel(date: Date): string {
  const holiday = HOLIDAYS[toISO(date)];
  if (holiday) return holiday;
  return date.getDay() === 0 || date.getDay() === 6 ? '주말' : '작업 불가일';
}

/** TBM(작업 전 안전 회의)에서 그대로 공유할 수 있는 일별 메시지 */
export function tbmMessage(day: number, blocks: Block[], assignments: Assignments, ev: Evaluation, r: Resources, planStart: string, cal: Calendar = NO_OFF): string {
  const date = dayToDate(planStart, day);
  const head = `[TBM] ${date.getMonth() + 1}/${date.getDate()}(${WEEK[date.getDay()]}) ${day === 1 ? '오늘' : `${day}일차`} 작업`;
  if (!isWorkDay(cal, day)) return `${head}\n- 작업하지 않는 날입니다 (${offLabel(date)}).`;
  const work = workOn(day, blocks, assignments, ev, r, cal);
  if (work.length === 0) return `${head}\n- 예정된 블록 작업이 없습니다.`;

  const lines = [head];
  for (const w of work) {
    const crew = [w.general && `일반 ${w.general}명`, w.skilled && `숙련 ${w.skilled}명`].filter(Boolean).join(' · ') || '작업자 미배정';
    const extra = [w.crane && '크레인 1대', w.emergency && '비상 자재'].filter(Boolean).join(' · ');
    const due = ev.blocks[w.block.id].due - day;
    const dueText = due === 0 ? '오늘 납기' : due < 0 ? `납기 ${-due}일 지남` : `납기 ${due}일 남음`;
    const place = w.workplace === null ? '작업장 미정' : `작업장 ${w.workplace + 1}`;
    lines.push(`- [${place}] ${w.block.id}: ${crew}${extra ? ` · ${extra}` : ''} (${w.nth}/${w.duration}일차, ${dueText})`);
  }

  const used = (k: 'general' | 'skilled' | 'crane') => ev.load.find((l) => l.kind === k)!.usage[day - 1] ?? 0;
  lines.push(`■ 투입: 일반 ${used('general')}/${r.generalWorkers}명 · 숙련 ${used('skilled')}/${r.skilledWorkers}명 · 크레인 ${used('crane')}/${r.cranes}대`);

  const warn: string[] = [];
  for (const w of work) {
    const x = ev.blocks[w.block.id];
    if (x.overDays.includes(day)) warn.push(`${w.block.id} ${x.laneClash ? '작업장 겹침' : '자원 초과'}`);
    if (x.status === 'blocked') warn.push(`${w.block.id} 착수 불가(사전 요건 없음)`);
    else if (x.lateDays > 0 && day === x.end) warn.push(`${w.block.id} 납기 ${x.lateDays}일 지연`);
    if (w.emergency && w.nth === 1) warn.push(`${w.block.id} 비상 자재 반입 확인`);
  }
  if (warn.length) lines.push(`■ 주의: ${warn.join(' / ')}`);

  const safety = ['용접 화기·환기 점검'];
  if (work.some((w) => w.crane)) safety.unshift('크레인 인양 시 신호수 배치·하부 출입 통제');
  lines.push(`■ 안전: ${safety.join(' / ')}`);
  return lines.join('\n');
}
