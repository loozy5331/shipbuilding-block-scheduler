import { HOLIDAYS } from './holidays';
import { dayToDate, toISO } from '../io/dates';

/**
 * 작업하지 않는 날(일차, 1=계획 시작일). 워커로 넘길 수 있게 배열로 둔다.
 * - off: 실제로 작업하지 않는 날 = 사전 등록(주말·공휴일) + 직접 고른 날 - 근무일로 되돌린 날
 * - baseOff: 사전 등록만. 납기는 이 날들만큼 뒤로 밀린다 (직접 고른 날은 납기를 바꾸지 않는다)
 */
export interface Calendar {
  off: number[];
  baseOff: number[];
}

export const NO_OFF: Calendar = { off: [], baseOff: [] };

export interface CalendarOptions {
  weekends: boolean;
  holidays: boolean;
  /** 직접 고른 작업 불가 날짜 (YYYY-MM-DD) */
  extraOff: string[];
  /** 주말·공휴일이지만 작업하는 날짜 */
  extraOn: string[];
}

export type OffKind = 'weekend' | 'holiday' | 'manual';

export interface DayInfo {
  /** 작업하지 않는 이유. 작업하는 날이면 null */
  off: OffKind | null;
  /** 사전 등록(주말·공휴일)된 날인가 — 근무일로 되돌렸어도 true */
  preset: boolean;
  /** 공휴일 이름 */
  holiday?: string;
}

/** 계산할 최대 기간(일). 그 뒤는 모두 근무일로 본다 */
const LIMIT = 730;

export function dayInfo(planStart: string, day: number, o: CalendarOptions): DayInfo {
  const date = dayToDate(planStart, day);
  const iso = toISO(date);
  const holiday = o.holidays ? HOLIDAYS[iso] : undefined;
  const weekend = o.weekends && (date.getDay() === 0 || date.getDay() === 6);
  const preset = !!holiday || weekend;
  let off: OffKind | null = null;
  if (o.extraOff.includes(iso)) off = 'manual';
  else if (preset && !o.extraOn.includes(iso)) off = holiday ? 'holiday' : 'weekend';
  return { off, preset, holiday };
}

export function buildCalendar(planStart: string, o: CalendarOptions): Calendar {
  const off: number[] = [];
  const baseOff: number[] = [];
  if (!o.weekends && !o.holidays && o.extraOff.length === 0) return NO_OFF;
  for (let d = 1; d <= LIMIT; d++) {
    const info = dayInfo(planStart, d, o);
    if (info.off) off.push(d);
    if (info.preset) baseOff.push(d);
  }
  return { off, baseOff };
}

const sets = new WeakMap<Calendar, { off: Set<number>; base: Set<number> }>();
function setsOf(cal: Calendar) {
  let s = sets.get(cal);
  if (!s) sets.set(cal, (s = { off: new Set(cal.off), base: new Set(cal.baseOff) }));
  return s;
}

export function isWorkDay(cal: Calendar, day: number): boolean {
  return cal.off.length === 0 || !setsOf(cal).off.has(day);
}

/** day부터 처음 오는 작업일 */
export function nextWorkDay(cal: Calendar, day: number): number {
  let d = Math.max(1, day);
  while (!isWorkDay(cal, d)) d++;
  return d;
}

/** start부터 작업일 workDays일을 채우면 끝나는 날. 사이의 쉬는 날은 건너뛴다 */
export function workEnd(cal: Calendar, start: number, workDays: number): number {
  if (cal.off.length === 0) return start + workDays - 1;
  let d = start - 1;
  for (let n = 0; n < workDays; ) if (isWorkDay(cal, ++d)) n++;
  return d;
}

/** [from, to] 안의 작업일 수 */
export function workDaysIn(cal: Calendar, from: number, to: number): number {
  if (cal.off.length === 0) return Math.max(0, to - from + 1);
  let n = 0;
  for (let d = from; d <= to; d++) if (isWorkDay(cal, d)) n++;
  return n;
}

/** 실제 납기(일차): "남은 기간 N일"을 사전 등록 근무일로 센 N번째 근무일 */
export function effectiveDue(cal: Calendar, dueDay: number): number {
  if (cal.baseOff.length === 0 || dueDay < 1) return dueDay;
  const base = setsOf(cal).base;
  let d = 0;
  for (let n = 0; n < dueDay; ) if (!base.has(++d)) n++;
  return d;
}
