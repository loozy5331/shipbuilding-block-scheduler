import type { Block } from './types';

/** start일에 착수할 때 비상 자재 없이 자재가 있는가. 자재 납기일이 있으면 그날부터 있다 */
export function materialOk(b: Block, start: number | null): boolean {
  if (b.materialDay !== undefined) return (start ?? 1) >= b.materialDay;
  return b.materialReady;
}

/** 자재 납기일을 받으면 준비 여부는 그날로 정한다 (오늘 이전이면 준비, 날짜는 버림) */
export function withMaterialDay(b: Block, materialDay: number | undefined): Block {
  const { materialDay: _old, ...rest } = b;
  void _old;
  if (materialDay === undefined) return rest;
  return materialDay > 1 ? { ...rest, materialDay, materialReady: false } : { ...rest, materialReady: true };
}
