import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Assignment, Assignments, Block, ResourceKind, Resources, UserMode } from '../domain/types';
import { DEFAULT_RESOURCES, emptyAssignment } from '../domain/types';
import type { SolveResponse } from '../solver';
import { todayISO } from '../io/dates';
import { assignBlockedReason } from '../domain/assign';
import { assignLanes, seatIn } from '../domain/lanes';
import { TUTORIAL_BLOCKS, TUTORIAL_RESOURCES } from '../tutorial/scenario';

/** 유저 여정: 로그인 → 메뉴 → 공통 설정 입력 → 블록 스케줄링 → 결과 */
export type Page = 'login' | 'menu' | 'setup' | 'schedule' | 'result';

export const PAGES: { page: Page; label: string }[] = [
  { page: 'login', label: '로그인' },
  { page: 'menu', label: '메뉴' },
  { page: 'setup', label: '공통 설정 입력' },
  { page: 'schedule', label: '블록 스케줄링' },
  { page: 'result', label: '결과' },
];

export interface Settings {
  /** 간트 위 작업 애니메이션 (준비 중) */
  animation: boolean;
}

/** 로그인한 사용자. guest면 체험하기로 들어온 것 */
export interface User {
  id: string;
  guest: boolean;
}

interface State {
  page: Page;
  user: User | null;
  /** 상단 토글로 언제든 바꾼다 (기본 숙련자) */
  mode: UserMode;
  settings: Settings;
  /** 신입 모드에서 힌트를 받은 횟수 (평가서에 표시) */
  hintCount: number;
  planStart: string;
  blocks: Block[];
  resources: Resources;
  assignments: Assignments;
  /** 마지막 최적화 결과 (블록/자원 입력이 바뀌면 지운다) */
  solve: SolveResponse | null;
  tutorialSeen: boolean;
  /** 튜토리얼 진행 중 (예시 데이터, 공통 설정 입력은 읽기 전용) */
  tutorialActive: boolean;
  /** 가이드가 열린 페이지와 그 페이지 가이드의 몇 번째 단계인지. null이면 가이드 닫힘 */
  tutorialPage: Page | null;
  tutorialStep: number | null;
  /** 가이드를 이미 띄운 페이지 (페이지에 처음 들어올 때 한 번만 자동으로 연다) */
  tutorialGuided: Page[];
  /** 90일을 넘는 긴 일정도 모두 표시 */
  showFull: boolean;
  /** 클릭으로 배정하려고 고른 자원 아이콘 */
  selectedToken: ResourceKind | null;
  toast: { id: number; message: string } | null;

  setPage(p: Page): void;
  setMode(m: UserMode): void;
  /** 로그인(또는 체험하기) 후 처음이면 튜토리얼, 아니면 메뉴로 */
  login(user: User): void;
  logout(): void;
  setSettings(patch: Partial<Settings>): void;
  countHint(): void;
  setPlanStart(d: string): void;
  setBlocks(b: Block[]): void;
  updateBlock(index: number, patch: Partial<Block>): void;
  addBlock(): void;
  removeBlock(index: number): void;
  setResource<K extends keyof Resources>(key: K, value: Resources[K]): void;
  loadScenario(): void;

  /** 배정하고 성공 여부를 돌려준다. 실패하면 이유를 토스트로 알린다. */
  assign(blockId: string, kind: ResourceKind): boolean;
  setAssignment(a: Assignment): void;
  unassign(blockId: string, kind: ResourceKind): void;
  /** 착수일과(주면) 작업 자리를 옮긴다. 아직 배치가 없으면 빈 배치로 올린다. */
  moveBlock(blockId: string, startDay: number, lane?: number): void;
  /** 착수일을 정하고 작업장 wp의 빈 자리로 옮긴다 */
  moveToWorkplace(blockId: string, startDay: number, wp: number): void;
  applyAssignments(a: Assignments): void;
  clearAssignments(): void;
  setSolve(s: SolveResponse | null): void;

  startTutorial(): void;
  setTutorialStep(step: number | null): void;
  /** 이 페이지 가이드를 띄웠다고 표시하고 1단계를 연다 */
  openPageGuide(page: Page): void;
  /** 튜토리얼을 끝낸다 (건너뛰기·마치기) */
  endTutorial(): void;
  setShowFull(v: boolean): void;
  selectToken(k: ResourceKind | null): void;
  showToast(message: string): void;
}

const storage = createJSONStorage(() => {
  try {
    return window.localStorage;
  } catch {
    return undefined as unknown as Storage;
  }
});

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      page: 'login',
      user: null,
      mode: 'expert',
      settings: { animation: true },
      hintCount: 0,
      planStart: todayISO(),
      blocks: [],
      resources: { ...DEFAULT_RESOURCES },
      assignments: {},
      solve: null,
      tutorialSeen: false,
      tutorialActive: false,
      tutorialPage: null,
      tutorialStep: null,
      tutorialGuided: [],
      showFull: false,
      selectedToken: null,
      toast: null,

      setPage: (page) => set({ page }),
      setMode: (mode) => set({ mode }),
      login: (user) => {
        set({ user });
        if (get().tutorialSeen) set({ page: 'menu' });
        else get().startTutorial();
      },
      logout: () => set({ user: null, page: 'login', tutorialActive: false, tutorialPage: null, tutorialStep: null, tutorialGuided: [] }),
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      countHint: () => set((s) => ({ hintCount: s.hintCount + 1 })),
      setPlanStart: (planStart) => set({ planStart }),
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
          return { resources, assignments: assignLanes(s.blocks, s.assignments, resources), solve: null };
        }),
      loadScenario: () =>
        set({ blocks: TUTORIAL_BLOCKS.map((b) => ({ ...b })), resources: { ...TUTORIAL_RESOURCES }, assignments: {}, solve: null, hintCount: 0 }),

      assign: (blockId, kind) => {
        const s = get();
        const block = s.blocks.find((b) => b.id === blockId);
        if (!block) return false;
        const reason = assignBlockedReason(block, s.assignments[blockId], kind, s.resources, s.assignments);
        if (reason) {
          get().showToast(`${blockId}: ${reason}`);
          return false;
        }
        const a = { ...(s.assignments[blockId] ?? emptyAssignment(blockId)) };
        if (kind === 'general' || kind === 'skilled') a[kind] += 1;
        else if (kind === 'crane') a.crane = true;
        else a.emergency = true;
        if (a.startDay === null) a.startDay = 1;
        set({ assignments: assignLanes(s.blocks, { ...s.assignments, [blockId]: a }, s.resources), selectedToken: null });
        return true;
      },
      setAssignment: (a) =>
        set((s) => ({ assignments: assignLanes(s.blocks, { ...s.assignments, [a.blockId]: { ...a, lane: a.lane ?? s.assignments[a.blockId]?.lane } }, s.resources) })),
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
          const a = { ...(s.assignments[blockId] ?? emptyAssignment(blockId)), startDay: Math.max(1, startDay) };
          if (lane !== undefined) a.lane = lane;
          return { assignments: assignLanes(s.blocks, { ...s.assignments, [blockId]: a }, s.resources) };
        }),
      moveToWorkplace: (blockId, startDay, wp) => {
        const s = get();
        const block = s.blocks.find((b) => b.id === blockId);
        if (!block) return;
        const start = Math.max(1, startDay);
        s.moveBlock(blockId, start, seatIn(wp, block, start, s.assignments, s.blocks, s.resources));
      },
      applyAssignments: (assignments) => set((s) => ({ assignments: assignLanes(s.blocks, assignments, s.resources) })),
      clearAssignments: () => set({ assignments: {} }),
      setSolve: (solve) => set({ solve }),

      startTutorial: () => {
        get().loadScenario();
        set({ tutorialActive: true, tutorialGuided: ['setup'], tutorialPage: 'setup', tutorialStep: 0, page: 'setup' });
      },
      setTutorialStep: (tutorialStep) => set({ tutorialStep }),
      openPageGuide: (page) => set((s) => ({ tutorialGuided: [...s.tutorialGuided, page], tutorialPage: page, tutorialStep: 0 })),
      // 끝내도 지금 페이지에 그대로 머문다
      endTutorial: () => set({ tutorialActive: false, tutorialPage: null, tutorialStep: null, tutorialGuided: [], tutorialSeen: true }),
      setShowFull: (showFull) => set({ showFull }),
      selectToken: (selectedToken) => set({ selectedToken }),
      showToast: (message) => set((s) => ({ toast: { id: (s.toast?.id ?? 0) + 1, message } })),
    }),
    {
      name: 'block-scheduler',
      version: 5,
      storage,
      // v1 → v2: 모드·설정·작업 자리 추가 (자리는 화면에서 채운다). v2 → v3: 페이지 이름 변경. v3 → v4: 튜토리얼 전용 페이지 없앰. v4 → v5: 모드 선택 → 로그인
      migrate: (persisted) => {
        const s = persisted as State & { page: string; mode: UserMode | null };
        const renamed: Record<string, Page> = { home: 'menu', input: 'setup', board: 'schedule', tutorial: 'menu', mode: 'login' };
        return { ...s, page: renamed[s.page] ?? s.page, mode: s.mode ?? 'expert', user: s.user ?? null } as State;
      },
      partialize: (s) => ({
        page: s.page,
        user: s.user,
        mode: s.mode,
        settings: s.settings,
        hintCount: s.hintCount,
        planStart: s.planStart,
        blocks: s.blocks,
        resources: s.resources,
        assignments: s.assignments,
        tutorialSeen: s.tutorialSeen,
        showFull: s.showFull,
      }),
    },
  ),
);
