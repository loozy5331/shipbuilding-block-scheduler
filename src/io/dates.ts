/** 로컬 날짜 YYYY-MM-DD */
export function todayISO(): string {
  return toISO(new Date());
}

export function toISO(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 계획 시작일(오늘=1일) 기준 n일차의 날짜 */
export function dayToDate(planStart: string, day: number): Date {
  const d = parseISO(planStart);
  d.setDate(d.getDate() + day - 1);
  return d;
}

/** 날짜를 계획 시작일 기준 n일차로 (시작일 당일 = 1) */
export function dateToDay(planStart: string, date: Date): number {
  const start = parseISO(planStart);
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((day.getTime() - start.getTime()) / 86_400_000) + 1;
}

export function formatMD(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
