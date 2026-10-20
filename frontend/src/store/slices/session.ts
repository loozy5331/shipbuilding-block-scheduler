import type { UserMode } from '../../domain/types';
import type { Slice } from '../types';
import { guideSeen } from './tutorial';

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
  /** 결과로 넘어갈 때 블록 조립 애니메이션 */
  animation: boolean;
}

/** 로그인한 사용자. guest면 체험하기로 들어온 것 */
export interface User {
  id: string;
  guest: boolean;
  /** 튜토리얼 가이드를 본 적 있음 (가입 계정은 DB에 저장) */
  tutorialSeen?: boolean;
}

/** 화면 이동 · 로그인 · 모드 · 설정 */
export interface SessionSlice {
  page: Page;
  user: User | null;
  /** 상단 토글로 언제든 바꾼다 (기본 숙련자) */
  mode: UserMode;
  settings: Settings;

  setPage(p: Page): void;
  setMode(m: UserMode): void;
  /** 가입 계정이 가이드를 처음 보면 튜토리얼, 아니면(체험하기 포함) 메뉴로 */
  login(user: User): void;
  logout(): void;
  setSettings(patch: Partial<Settings>): void;
}

export const createSession: Slice<SessionSlice> = (set, get) => ({
  page: 'login',
  user: null,
  mode: 'expert',
  settings: { animation: true },

  setPage: (page) => set({ page }),
  setMode: (mode) => set({ mode }),
  login: (user) => {
    set({ user });
    // 체험하기는 둘러보러 온 것이라 가이드를 강제하지 않는다 (튜토리얼 타일을 처음 누르면 가이드)
    if (user.guest || guideSeen(get())) set({ page: 'menu' });
    else get().startTutorial();
  },
  logout: () => set({ user: null, page: 'login', tutorialActive: false, tutorialPage: null, tutorialStep: null, tutorialGuided: [] }),
  setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
});
