import { reportTutorialSeen } from '../../io/auth';
import type { Slice, State } from '../types';
import type { Page } from './session';

/** 튜토리얼 가이드 진행 상태 */
export interface TutorialSlice {
  /** 체험하기(게스트)로 튜토리얼 가이드를 본 적 있음. 가입 계정은 user.tutorialSeen(DB)을 쓴다 */
  tutorialSeen: boolean;
  /** 튜토리얼 진행 중 (예시 데이터, 공통 설정 입력은 읽기 전용) */
  tutorialActive: boolean;
  /** 가이드가 열린 페이지와 그 페이지 가이드의 몇 번째 단계인지. null이면 가이드 닫힘 */
  tutorialPage: Page | null;
  tutorialStep: number | null;
  /** 가이드를 이미 띄운 페이지 (페이지에 처음 들어올 때 한 번만 자동으로 연다) */
  tutorialGuided: Page[];

  /** 튜토리얼 가이드와 함께 예시로 시작 */
  startTutorial(): void;
  /** 메뉴의 튜토리얼: 가이드를 처음 보면 가이드와 함께, 이미 봤으면 예시만 불러온다 */
  openTutorial(): void;
  setTutorialStep(step: number | null): void;
  /** 이 페이지 가이드를 띄웠다고 표시하고 1단계를 연다 */
  openPageGuide(page: Page): void;
  /** 튜토리얼을 끝낸다 (건너뛰기·마치기) */
  endTutorial(): void;
}

/** 가입 계정은 DB 기록, 체험하기는 이 브라우저 기록으로 튜토리얼 가이드를 봤는지 판단한다 */
export function guideSeen(s: Pick<State, 'user' | 'tutorialSeen'>): boolean {
  return s.user && !s.user.guest ? s.user.tutorialSeen === true : s.tutorialSeen;
}

export const createTutorial: Slice<TutorialSlice> = (set, get) => ({
  tutorialSeen: false,
  tutorialActive: false,
  tutorialPage: null,
  tutorialStep: null,
  tutorialGuided: [],

  startTutorial: () => {
    get().loadScenario();
    set({ tutorialActive: true, tutorialGuided: ['setup'], tutorialPage: 'setup', tutorialStep: 0, page: 'setup' });
  },
  openTutorial: () => {
    if (!guideSeen(get())) return get().startTutorial();
    get().loadScenario();
    set({ page: 'setup' });
  },
  setTutorialStep: (tutorialStep) => set({ tutorialStep }),
  openPageGuide: (page) => set((s) => ({ tutorialGuided: [...s.tutorialGuided, page], tutorialPage: page, tutorialStep: 0 })),
  // 끝내도 지금 페이지에 그대로 머문다
  endTutorial: () => {
    const { user } = get();
    if (user && !user.guest && !user.tutorialSeen) reportTutorialSeen(user.id);
    set({
      tutorialActive: false,
      // 튜토리얼은 매일 작업하는 달력이었으니 지난 최적화 결과는 버린다
      solve: null,
      pinSolve: null,
      tutorialPage: null,
      tutorialStep: null,
      tutorialGuided: [],
      ...(user && !user.guest ? { user: { ...user, tutorialSeen: true } } : { tutorialSeen: true }),
    });
  },
});
