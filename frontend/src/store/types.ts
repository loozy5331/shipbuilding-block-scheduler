import type { StateCreator } from 'zustand';
import type { SessionSlice } from './slices/session';
import type { PlanSlice } from './slices/plan';
import type { TutorialSlice } from './slices/tutorial';
import type { UiSlice } from './slices/ui';

export type State = SessionSlice & PlanSlice & TutorialSlice & UiSlice;

/** 각 영역(slice)은 전체 State를 읽고 쓸 수 있다 */
export type Slice<T> = StateCreator<State, [['zustand/persist', unknown]], [], T>;
