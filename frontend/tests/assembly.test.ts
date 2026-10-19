import { describe, expect, it } from 'vitest';
import { buildScene } from '../src/components/assembly/scene';
import { TUTORIAL_BLOCKS, TUTORIAL_RESOURCES } from '../src/tutorial/scenario';
import type { Assignments } from '../src/domain/types';

const a = (blockId: string, startDay: number | null, lane: number) => ({ blockId, startDay, general: 2, skilled: 0, crane: true, emergency: false, lane });

describe('조립 장면', () => {
  it('블록이 가장 많은 작업 자리의 첫 블록과 그다음 블록을 고른다', () => {
    const plan: Assignments = {
      'A-101': a('A-101', 1, 1),
      'D-208': a('D-208', 1, 0),
      'B-203': a('B-203', 2, 0),
      'C-115': a('C-115', 4, 0),
    };
    const scene = buildScene(TUTORIAL_BLOCKS, TUTORIAL_RESOURCES, plan)!;
    expect(scene.hero).toBe('D-208');
    expect(scene.partner).toBe('B-203');
    expect(scene.bars.map((b) => b.id)).toEqual(['A-101', 'D-208', 'B-203', 'C-115']);
  });

  it('자리에 블록이 하나뿐이면 다른 블록을 붙이고, 배치가 없으면 장면이 없다', () => {
    const one = buildScene(TUTORIAL_BLOCKS, TUTORIAL_RESOURCES, { 'A-101': a('A-101', 1, 0), 'E-320': a('E-320', 3, 1) })!;
    expect(one.hero).toBe('A-101');
    expect(one.partner).toBe('E-320');
    expect(buildScene(TUTORIAL_BLOCKS, TUTORIAL_RESOURCES, { 'A-101': a('A-101', null, 0) })).toBeNull();
  });
});
