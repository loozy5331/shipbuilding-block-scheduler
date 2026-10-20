import type { ResourceKind } from '../../domain/types';
import type { Slice } from '../types';

/** 화면 표시 상태 (토스트 · 선택한 자원 · 간트 표시 범위 · 조립 애니메이션) */
export interface UiSlice {
  /** 90일을 넘는 긴 일정도 모두 표시 */
  showFull: boolean;
  /** 간트에서 접어 둘 쉬는 날 (엑셀 숨긴 열처럼). 주말은 기본으로 접는다 */
  fold: { weekend: boolean; holiday: boolean };
  /** 클릭으로 배정하려고 고른 자원 아이콘 */
  selectedToken: ResourceKind | null;
  /** 블록 조립 애니메이션 재생 중 */
  assemblyShow: boolean;
  toast: { id: number; message: string } | null;

  setShowFull(v: boolean): void;
  setFold(kind: 'weekend' | 'holiday', folded: boolean): void;
  selectToken(k: ResourceKind | null): void;
  showToast(message: string): void;
  /** 결과 페이지로 가면서 (설정이 켜져 있고 움직임 줄이기가 아니면) 조립 애니메이션을 띄운다 */
  goToResult(animate: boolean): void;
  endAssembly(): void;
}

export const createUi: Slice<UiSlice> = (set) => ({
  showFull: false,
  fold: { weekend: true, holiday: false },
  selectedToken: null,
  assemblyShow: false,
  toast: null,

  setShowFull: (showFull) => set({ showFull }),
  setFold: (kind, folded) => set((s) => ({ fold: { ...s.fold, [kind]: folded } })),
  selectToken: (selectedToken) => set({ selectedToken }),
  showToast: (message) => set((s) => ({ toast: { id: (s.toast?.id ?? 0) + 1, message } })),
  goToResult: (animate) => set((s) => ({ page: 'result', assemblyShow: animate && s.settings.animation })),
  endAssembly: () => set({ assemblyShow: false }),
});
