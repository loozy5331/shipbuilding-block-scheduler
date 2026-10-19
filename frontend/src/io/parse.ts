import type { Block } from '../domain/types';
import { dateToDay } from './dates';

export interface ParseError {
  row: number;
  message: string;
}

export interface ParseResult {
  blocks: Block[];
  errors: ParseError[];
}

type Field = 'id' | 'due' | 'mh' | 'material';

const ALIASES: Record<Field, string[]> = {
  id: ['블록id', '블록', 'blockid', 'block', 'id', '작업'],
  due: ['납기일', '납기', '남은기간', '남은기간(일)', '남은기간(일,오늘포함)', 'due', 'duedate', 'deadline'],
  mh: ['필요작업시간', '필요공수', '필요공수(mh)', '작업시간', '필요작업시간(mh)', 'mh', '공수', 'hours'],
  material: ['자재준비여부', '자재준비', '자재', 'material', 'materialready'],
};

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[\s_\-·.]/g, '');

function matchField(header: unknown): Field | null {
  const h = norm(header);
  if (!h) return null;
  for (const f of Object.keys(ALIASES) as Field[]) if (ALIASES[f].some((a) => h === a)) return f;
  // 접두 일치: "필요 작업 시간(시간)" 같은 변형
  for (const f of Object.keys(ALIASES) as Field[]) if (ALIASES[f].some((a) => a.length >= 2 && h.startsWith(a))) return f;
  return null;
}

const READY = new Set(['y', 'yes', 'o', 'true', '1', '준비', '완료', '준비완료', '예', 'ok', '✓', '○']);
const NOT_READY = new Set(['n', 'no', 'x', 'false', '0', '미준비', '미완료', '아니오', '대기', '×', '']);

export function parseMaterial(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  const s = norm(v);
  if (READY.has(s)) return true;
  if (NOT_READY.has(s)) return false;
  return null;
}

/** 엑셀 날짜 일련번호 → Date (1900 체계) */
function excelSerialToDate(n: number): Date {
  const ms = Math.round((n - 25569) * 86_400_000);
  const d = new Date(ms);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** 납기 값을 "남은 기간(오늘=1)"으로 변환. 날짜면 계획 시작일 기준으로 환산한다. */
export function parseDue(v: unknown, planStart: string): number | null {
  if (v instanceof Date && !isNaN(v.getTime())) return dateToDay(planStart, v);
  if (typeof v === 'number') return v > 20000 ? dateToDay(planStart, excelSerialToDate(v)) : v;
  const s = String(v ?? '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m) return dateToDay(planStart, new Date(+m[1], +m[2] - 1, +m[3]));
  const md = s.match(/^(\d{1,2})[/.](\d{1,2})$/);
  if (md) {
    const y = +planStart.slice(0, 4);
    return dateToDay(planStart, new Date(y, +md[1] - 1, +md[2]));
  }
  const n = parseFloat(s.replace(/[^\d.\-]/g, ''));
  return isNaN(n) ? null : n;
}

function parseNumber(v: unknown): number | null {
  // 부동소수점 오차(24.000000000000004 등)를 걷어 낸다
  if (typeof v === 'number') return Math.round(v * 1e6) / 1e6;
  const n = parseFloat(String(v ?? '').replace(/[^\d.\-]/g, ''));
  return isNaN(n) ? null : n;
}

/**
 * 2차원 표(엑셀 시트 또는 붙여넣기)를 블록 목록으로 변환한다.
 * 헤더 행이 있으면 열 이름으로, 없으면 "ID · 납기 · MH · 자재" 순서로 읽는다.
 */
export function parseTable(rows: unknown[][], planStart: string): ParseResult {
  const blocks: Block[] = [];
  const errors: ParseError[] = [];
  const nonEmpty = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.some((c) => String(c ?? '').trim() !== ''));
  if (nonEmpty.length === 0) return { blocks, errors: [{ row: 0, message: '읽을 데이터가 없습니다.' }] };

  let col: Record<Field, number> = { id: 0, due: 1, mh: 2, material: 3 };
  let dataStart = 0;
  const headerIdx = nonEmpty.findIndex(({ r }) => r.map(matchField).filter(Boolean).length >= 2);
  if (headerIdx >= 0 && headerIdx < 5) {
    const header = nonEmpty[headerIdx].r;
    const found: Partial<Record<Field, number>> = {};
    header.forEach((h, i) => {
      const f = matchField(h);
      if (f && found[f] === undefined) found[f] = i;
    });
    const missing = (Object.keys(ALIASES) as Field[]).filter((f) => found[f] === undefined);
    if (missing.length > 0) {
      const names: Record<Field, string> = { id: '블록 ID', due: '납기일', mh: '필요 작업 시간', material: '자재준비 여부' };
      errors.push({ row: nonEmpty[headerIdx].i + 1, message: `열을 찾지 못했습니다: ${missing.map((f) => names[f]).join(', ')}` });
      return { blocks, errors };
    }
    col = found as Record<Field, number>;
    dataStart = headerIdx + 1;
  }

  const seen = new Set<string>();
  for (const { r, i } of nonEmpty.slice(dataStart)) {
    const rowNo = i + 1;
    const id = String(r[col.id] ?? '').trim();
    const due = parseDue(r[col.due], planStart);
    const mh = parseNumber(r[col.mh]);
    const material = parseMaterial(r[col.material]);
    const problems: string[] = [];
    if (!id) problems.push('블록 ID 없음');
    else if (seen.has(id)) problems.push(`중복 ID ${id}`);
    if (due === null) problems.push('납기 해석 불가');
    else if (due < 1) problems.push(`납기가 계획 시작일 이전 (${due}일차)`);
    if (mh === null || mh <= 0) problems.push('필요 작업 시간 오류');
    if (material === null) problems.push(`자재 값 "${r[col.material]}" 해석 불가`);
    if (problems.length > 0) {
      errors.push({ row: rowNo, message: problems.join(', ') });
      continue;
    }
    seen.add(id);
    blocks.push({ id, dueDay: Math.round(due!), requiredMH: mh!, materialReady: material! });
  }
  return { blocks, errors };
}

/** 엑셀에서 복사한 탭 구분 텍스트 */
export function parsePasted(text: string, planStart: string): ParseResult {
  const rows = text
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => (line.includes('\t') ? line.split('\t') : line.split(/\s{2,}|,/)));
  return parseTable(rows, planStart);
}
