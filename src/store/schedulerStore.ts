import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Assignments, Block, ResourceKind, Resources } from '../domain/types';
import { DEFAULT_RESOURCES, emptyAssignment } from '../domain/types';
import type { SolveResponse } from '../solver';
import { todayISO } from '../io/dates';
import { TUTORIAL_BLOCKS, TUTORIAL_RESOURCES } from '../tutorial/scenario';

export type Page = 'input' | 'board';

interface State {
  page: Page;
  planStart: string;
  blocks: Block[];
  resources: Resources;
  assignments: Assignments;
  /** 마지막 최적화 결과 (블록/자원 입력이 바뀌면 지운다) */
  solve: SolveResponse | null;
  tutorialSeen: boolean;
  tutorialStep: number | null;

  setPage(p: Page): void;
  setPlanStart(d: string): void;
  setBlocks(b: Block[]): void;
  updateBlock(index: number, patch: Partial<Block>): void;
  addBlock(): void;
  removeBlock(index: number): void;
  setResource<K extends keyof Resources>(key: K, value: Resources[K]): void;
  loadScenario(): void;

  assign(blockId: string, kind: ResourceKind): void;
  unassign(blockId: string, kind: ResourceKind): void;
  moveBlock(blockId: string, startDay: number): void;
  applyAssignments(a: Assignments): void;
  clearAssignments(): void;
  setSolve(s: SolveResponse | null): void;

  startTutorial(): void;
  setTutorialStep(step: number | null): void;
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
      page: 'input',
      planStart: todayISO(),
      blocks: [],
      resources: { ...DEFAULT_RESOURCES },
      assignments: {},
      solve: null,
      tutorialSeen: false,
      tutorialStep: null,

      setPage: (page) => set({ page }),
      setPlanStart: (planStart) => set({ planStart }),
      setBlocks: (blocks) => set({ blocks, assignments: {}, solve: null }),
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
      setResource: (key, value) => set((s) => ({ resources: { ...s.resources, [key]: value }, solve: null })),
      loadScenario: () =>
        set({ blocks: TUTORIAL_BLOCKS.map((b) => ({ ...b })), resources: { ...TUTORIAL_RESOURCES }, assignments: {}, solve: null }),

      assign: (blockId, kind) =>
        set((s) => {
          const a = { ...(s.assignments[blockId] ?? emptyAssignment(blockId)) };
          const crew = a.general + a.skilled;
          if (kind === 'general' || kind === 'skilled') {
            if (crew >= s.resources.maxCrewPerBlock) return s;
            a[kind] += 1;
          } else if (kind === 'crane') a.crane = true;
          else {
            const block = s.blocks.find((b) => b.id === blockId);
            if (!block || block.materialReady) return s;
            a.emergency = true;
          }
          if (a.startDay === null) a.startDay = 1;
          return { assignments: { ...s.assignments, [blockId]: a } };
        }),
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
      moveBlock: (blockId, startDay) =>
        set((s) => {
          const a = s.assignments[blockId];
          if (!a) return s;
          return { assignments: { ...s.assignments, [blockId]: { ...a, startDay: Math.max(1, startDay) } } };
        }),
      applyAssignments: (assignments) => set({ assignments }),
      clearAssignments: () => set({ assignments: {} }),
      setSolve: (solve) => set({ solve }),

      startTutorial: () => {
        get().loadScenario();
        set({ tutorialStep: 0, page: 'input' });
      },
      setTutorialStep: (tutorialStep) => set(tutorialStep === null ? { tutorialStep, tutorialSeen: true } : { tutorialStep }),
    }),
    {
      name: 'block-scheduler',
      version: 1,
      storage,
      partialize: (s) => ({
        page: s.page,
        planStart: s.planStart,
        blocks: s.blocks,
        resources: s.resources,
        assignments: s.assignments,
        tutorialSeen: s.tutorialSeen,
      }),
    },
  ),
);
