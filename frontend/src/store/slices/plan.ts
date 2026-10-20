import type { Assignment, Assignments, Block, ResourceKind, Resources } from '../../domain/types';
import { DEFAULT_RESOURCES, emptyAssignment } from '../../domain/types';
import { assignBlockedReason } from '../../domain/assign';
import { assignLanes, pinnedOf, seatIn } from '../../domain/lanes';
import type { SolveResponse } from '../../solver';
import type { Solution } from '../../solver/search';
import { todayISO, toISO, dayToDate } from '../../io/dates';
import { dayInfo, nextWorkDay, type CalendarOptions } from '../../domain/calendar';
import { selectCalendar } from '../calendar';
import { TUTORIAL_BLOCKS, TUTORIAL_RESOURCES } from '../../tutorial/scenario';
import type { Slice, State } from '../types';

/** 블록 · 자원 · 배치 · 최적화 결과 */
export interface PlanSlice {
  planStart: string;
  /** 작업하지 않는 날: 주말·공휴일(사전 등록)과 날짜 칸에서 직접 고른 날 */
  calendar: CalendarOptions;
  blocks: Block[];
  resources: Resources;
  assignments: Assignments;
  /** 마지막 최적화 결과 (블록/자원 입력이 바뀌면 지운다) */
  solve: SolveResponse | null;
  /** 고정 블록을 두고 다시 최적화한 결과. 블록·자원·고정 배치가 그대로일 때만 쓴다 (저장하지 않음) */
  pinSolve: PinSolve | null;
  /** 신입 모드에서 힌트를 받은 횟수 (평가서에 표시) */
  hintCount: number;

  setPlanStart(d: string): void;
  setCalendar(patch: Partial<CalendarOptions>): void;
  /** day일을 작업 불가 ↔ 작업일로 바꾼다 (주말·공휴일은 근무일로 되돌리고, 다시 누르면 쉬는 날로) */
  toggleOffDay(day: number): void;
  setBlocks(b: Block[]): void;
  updateBlock(index: number, patch: Partial<Block>): void;
  addBlock(): void;
  removeBlock(index: number): void;
  setResource<K extends keyof Resources>(key: K, value: Resources[K]): void;
  loadScenario(): void;
  countHint(): void;

  /** 배정하고 성공 여부를 돌려준다. 실패하면 이유를 토스트로 알린다. */
  assign(blockId: string, kind: ResourceKind): boolean;
  setAssignment(a: Assignment): void;
  unassign(blockId: string, kind: ResourceKind): void;
  /** 착수일과(주면) 작업 자리를 옮긴다. 아직 배치가 없으면 빈 배치로 올린다. */
  moveBlock(blockId: string, startDay: number, lane?: number): void;
  /** 착수일을 정하고 작업장 wp의 빈 자리로 옮긴다 */
  moveToWorkplace(blockId: string, startDay: number, wp: number): void;
  /** 고정한 블록은 그대로 두고 나머지 배치를 바꾼다 */
  applyAssignments(a: Assignments): void;
  clearAssignments(): void;
  setSolve(s: SolveResponse | null): void;
  togglePin(blockId: string): void;
  unpinAll(): void;
  setPinSolve(p: PinSolve | null): void;
}

export interface PinSolve {
  blocks: Block[];
  resources: Resources;
  key: string;
  solution: Solution;
}

/** 배치를 바꾸면 자리가 없는 블록에 작업 자리를 채워 넣는다 */
const withLanes = (s: State, assignments: Assignments) => assignLanes(s.blocks, assignments, s.resources, selectCalendar(s));

export const DEFAULT_CALENDAR: CalendarOptions = { weekends: true, holidays: true, extraOff: [], extraOn: [] };

/** 작업하는 날이 바뀌면 지난 최적화 결과는 맞지 않는다 */
const calendarChanged = { solve: null, pinSolve: null };

export const createPlan: Slice<PlanSlice> = (set, get) => ({
  planStart: todayISO(),
  calendar: DEFAULT_CALENDAR,
  blocks: [],
  resources: { ...DEFAULT_RESOURCES },
  assignments: {},
  solve: null,
  pinSolve: null,
  hintCount: 0,

  setPlanStart: (planStart) => set({ planStart, ...calendarChanged }),
  setCalendar: (patch) => set((s) => ({ calendar: { ...s.calendar, ...patch }, ...calendarChanged })),
  toggleOffDay: (day) =>
    set((s) => {
      const iso = toISO(dayToDate(s.planStart, day));
      const info = dayInfo(s.planStart, day, s.calendar);
      const without = (xs: string[]) => xs.filter((x) => x !== iso);
      const c = s.calendar;
      let calendar: CalendarOptions;
      if (info.off === 'manual') calendar = { ...c, extraOff: without(c.extraOff) };
      else if (info.off) calendar = { ...c, extraOn: [...c.extraOn, iso] };
      else if (info.preset) calendar = { ...c, extraOn: without(c.extraOn) };
      else calendar = { ...c, extraOff: [...c.extraOff, iso] };
      return { calendar, ...calendarChanged };
    }),
  setBlocks: (blocks) => set({ blocks, assignments: {}, solve: null, hintCount: 0 }),
  updateBlock: (i, patch) =>
    set((s) => {
      const blocks = [...s.blocks];
      const prev = blocks[i];
      blocks[i] = { ...prev, ...patch };
      const assignments = { ...s.assignments };
      if (patch.id !== undefined && patch.id !== prev.id && assignments[prev.id]) {
        assignments[patch.id] = { ...assignments[prev.id], blockId: patch.id };
        delete assignments[prev.id];
      }
      return { blocks, assignments, solve: null };
    }),
  addBlock: () =>
    set((s) => {
      let n = s.blocks.length + 1;
      while (s.blocks.some((b) => b.id === `NEW-${n}`)) n++;
      return { blocks: [...s.blocks, { id: `NEW-${n}`, dueDay: 1, requiredMH: 8, materialReady: true }], solve: null };
    }),
  removeBlock: (i) =>
    set((s) => {
      const assignments = { ...s.assignments };
      delete assignments[s.blocks[i].id];
      return { blocks: s.blocks.filter((_, j) => j !== i), assignments, solve: null };
    }),
  setResource: (key, value) =>
    set((s) => {
      const resources = { ...s.resources, [key]: value };
      return { resources, assignments: assignLanes(s.blocks, s.assignments, resources, selectCalendar(s)), solve: null };
    }),
  loadScenario: () =>
    set({ blocks: TUTORIAL_BLOCKS.map((b) => ({ ...b })), resources: { ...TUTORIAL_RESOURCES }, assignments: {}, solve: null, hintCount: 0 }),
  countHint: () => set((s) => ({ hintCount: s.hintCount + 1 })),

  assign: (blockId, kind) => {
    const s = get();
    const block = s.blocks.find((b) => b.id === blockId);
    if (!block) return false;
    const reason = assignBlockedReason(block, s.assignments[blockId], kind, s.resources, s.assignments);
    if (reason) {
      s.showToast(`${blockId}: ${reason}`);
      return false;
    }
    const a = { ...(s.assignments[blockId] ?? emptyAssignment(blockId)) };
    if (kind === 'general' || kind === 'skilled') a[kind] += 1;
    else if (kind === 'crane') a.crane = true;
    else a.emergency = true;
    if (a.startDay === null) a.startDay = nextWorkDay(selectCalendar(s), 1);
    set({ assignments: withLanes(s, { ...s.assignments, [blockId]: a }), selectedToken: null });
    return true;
  },
  setAssignment: (a) => set((s) => ({ assignments: withLanes(s, { ...s.assignments, [a.blockId]: { ...a, lane: a.lane ?? s.assignments[a.blockId]?.lane, pinned: a.pinned ?? s.assignments[a.blockId]?.pinned } }) })),
  unassign: (blockId, kind) =>
    set((s) => {
      const prev = s.assignments[blockId];
      if (!prev) return s;
      const a = { ...prev };
      if (kind === 'general' || kind === 'skilled') a[kind] = Math.max(0, a[kind] - 1);
      else if (kind === 'crane') a.crane = false;
      else a.emergency = false;
      const empty = a.general + a.skilled === 0 && !a.crane && !a.emergency;
      const assignments = { ...s.assignments };
      if (empty) delete assignments[blockId];
      else assignments[blockId] = a;
      return { assignments };
    }),
  moveBlock: (blockId, startDay, lane) =>
    set((s) => {
      // 쉬는 날에 놓으면 다음 작업일에 착수한다
      const a = { ...(s.assignments[blockId] ?? emptyAssignment(blockId)), startDay: nextWorkDay(selectCalendar(s), startDay) };
      if (lane !== undefined) a.lane = lane;
      return { assignments: withLanes(s, { ...s.assignments, [blockId]: a }) };
    }),
  moveToWorkplace: (blockId, startDay, wp) => {
    const s = get();
    const block = s.blocks.find((b) => b.id === blockId);
    if (!block) return;
    const cal = selectCalendar(s);
    const start = nextWorkDay(cal, startDay);
    s.moveBlock(blockId, start, seatIn(wp, block, start, s.assignments, s.blocks, s.resources, cal));
  },
  applyAssignments: (assignments) => set((s) => ({ assignments: withLanes(s, { ...assignments, ...pinnedOf(s.assignments) }) })),
  clearAssignments: () => set({ assignments: {} }),
  setSolve: (solve) => set({ solve }),
  togglePin: (blockId) =>
    set((s) => {
      const a = s.assignments[blockId];
      if (!a || a.startDay === null) return s;
      return { assignments: { ...s.assignments, [blockId]: { ...a, pinned: !a.pinned } } };
    }),
  unpinAll: () => set((s) => ({ assignments: Object.fromEntries(Object.entries(s.assignments).map(([k, a]) => [k, { ...a, pinned: false }])) })),
  setPinSolve: (pinSolve) => set({ pinSolve }),
});
