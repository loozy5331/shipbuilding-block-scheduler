/** 장면 순서와 시작 시각(초). 3D 장면과 화면 위 글자(완료·암전)가 같은 시계를 쓴다 */
export const PHASES = [
  ['flat', 0], // 간트 탑뷰
  ['tilt', 0.6], // 카메라가 기울며 3D로
  ['rise', 1.4], // 막대가 블록으로 솟음
  ['walk', 2.3], // 용접공이 걸어오고 크레인이 블록을 들고 옴
  ['drop', 3.9], // 크레인이 블록을 내려놓음
  ['weld', 4.6], // 용접
  ['seam', 6.4], // 용접부 강조
  ['done', 7.3], // "완료"
  ['black', 8.6], // 암전
  ['out', 9.2], // 결과 화면으로
] as const;
export const END = 9.6;

export type Phase = (typeof PHASES)[number][0];

export const at = (p: Phase): number => PHASES.find(([name]) => name === p)![1];

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** t가 [a, b] 사이 어디쯤인지 0~1 */
export const progress = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
export const easeOut = (x: number) => 1 - (1 - x) ** 3;
export const easeIn = (x: number) => x * x * x;
export const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
