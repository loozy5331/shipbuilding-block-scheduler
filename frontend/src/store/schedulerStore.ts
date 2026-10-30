import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { UserMode } from '../domain/types';
import type { State } from './types';
import { createSession, type Page } from './slices/session';
import { createPlan, DEFAULT_CALENDAR } from './slices/plan';
import { createTutorial } from './slices/tutorial';
import { createUi } from './slices/ui';

export { PAGES, type Page, type Settings, type User } from './slices/session';

const storage = createJSONStorage(() => {
  try {
    return window.localStorage;
  } catch {
    return undefined as unknown as Storage;
  }
});

/** 앱 전체 상태. 영역별 정의는 slices/ (session · plan · tutorial · ui) */
export const useStore = create<State>()(
  persist(
    (...a) => ({ ...createSession(...a), ...createPlan(...a), ...createTutorial(...a), ...createUi(...a) }),
    {
      name: 'block-scheduler',
      version: 6,
      storage,
      // v1 → v2: 모드·설정·작업 자리 추가 (자리는 화면에서 채운다). v2 → v3: 페이지 이름 변경. v3 → v4: 튜토리얼 전용 페이지 없앰. v4 → v5: 모드 선택 → 로그인. v5 → v6: 작업하지 않는 날(기본: 주말·공휴일)
      migrate: (persisted) => {
        const s = persisted as State & { page: string; mode: UserMode | null };
        const renamed: Record<string, Page> = { home: 'menu', input: 'setup', board: 'schedule', tutorial: 'menu', mode: 'login' };
        return { ...s, page: renamed[s.page] ?? s.page, mode: s.mode ?? 'expert', user: s.user ?? null, calendar: s.calendar ?? DEFAULT_CALENDAR } as State;
      },
      // 브라우저에 저장하는 항목 (진행 중인 튜토리얼·토스트 등 화면 상태는 저장하지 않는다)
      partialize: (s) => ({
        page: s.page,
        user: s.user,
        mode: s.mode,
        settings: s.settings,
        hintCount: s.hintCount,
        planStart: s.planStart,
        calendar: s.calendar,
        blocks: s.blocks,
        resources: s.resources,
        assignments: s.assignments,
        tutorialSeen: s.tutorialSeen,
        showFull: s.showFull,
        fold: s.fold,
      }),
    },
  ),
);
