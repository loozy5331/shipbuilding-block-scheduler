import { useMemo, useState } from 'react';
import {
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from '@dnd-kit/core';
import type { ResourceKind } from '../../domain/types';
import { workplaceOf } from '../../domain/lanes';
import { useStore } from '../../store/schedulerStore';
import type { Columns } from './ganttLayout';

/** 막대(대기 블록의 점선 막대 포함)는 날짜 칸 경계로 스냅하고 1일 앞으로는 못 간다. 위아래로는 다른 작업장으로 옮길 수 있다. */
const barModifier =
  (cols: Columns): Modifier =>
  ({ transform, active }) => {
    if (!/^(bar|wait):/.test(String(active?.id))) return transform;
    const start = (active?.data.current?.start as number) ?? 1;
    return { ...transform, x: cols.left(cols.moved(start, transform.x)) - cols.left(start) };
  };

/** 자원 아이콘은 블록 줄에, 막대·대기 블록은 작업장 테두리 안에만 놓인다 */
const collide: CollisionDetection = (args) => {
  const prefix = String(args.active.id).startsWith('res:') ? 'blk:' : 'wp:';
  const scoped = { ...args, droppableContainers: args.droppableContainers.filter((c) => String(c.id).startsWith(prefix)) };
  const hits = pointerWithin(scoped);
  return hits.length ? hits : rectIntersection(scoped);
};

/**
 * 간트 드래그 & 드롭. 끄는 대상의 id 접두어로 구분한다:
 * `res:<자원>` 자원 아이콘 → 블록 줄에 배정, `bar:<블록>` 막대 → 착수일·작업장 이동, `wait:<블록>` 대기 블록 → 간트에 올림
 */
export function useBoardDnd(cols: Columns) {
  const [dragKind, setDragKind] = useState<ResourceKind | null>(null);
  const modifier = useMemo(() => barModifier(cols), [cols]);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    setDragKind(id.startsWith('res:') ? (e.active.data.current?.kind as ResourceKind) : null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setDragKind(null);
    const s = useStore.getState();
    const id = String(e.active.id);
    const wp = e.over?.data.current?.wp as number | undefined;
    if (id.startsWith('res:')) {
      const target = e.over?.data.current?.blockId as string | undefined;
      if (target) s.assign(target, id.slice(4) as ResourceKind);
    } else if (id.startsWith('bar:')) {
      const blockId = id.slice(4);
      const a = s.assignments[blockId];
      if (!a?.startDay) return;
      const start = cols.moved(a.startDay, e.delta.x);
      const fromWp = a.lane === undefined ? -1 : workplaceOf(a.lane, s.resources);
      if (wp !== undefined && wp !== fromWp) s.moveToWorkplace(blockId, start, wp);
      else if (start !== a.startDay) s.moveBlock(blockId, start);
    } else if (id.startsWith('wait:') && wp !== undefined) {
      // 점선 막대는 1일에서 출발한다
      s.moveToWorkplace(id.slice(5), cols.moved(1, e.delta.x), wp);
    }
  };

  return {
    dragKind,
    dndProps: { sensors, collisionDetection: collide, modifiers: [modifier], onDragStart, onDragEnd, onDragCancel: () => setDragKind(null) },
  };
}
