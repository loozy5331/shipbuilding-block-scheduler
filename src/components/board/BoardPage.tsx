import { useMemo, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent, type Modifier } from '@dnd-kit/core';
import type { ResourceKind } from '../../domain/types';
import { evaluate } from '../../domain/evaluate';
import { useStore } from '../../store/schedulerStore';
import { runSolve } from '../../store/actions';
import { exportSchedule } from '../../io/excel';
import { ResourceIcon } from '../icons/ResourceIcons';
import { LineIcon } from '../icons/LineIcons';
import { ResourcePalette } from './ResourcePalette';
import { COL, GanttChart } from './GanttChart';
import { Legend, LoadGrid } from './LoadGrid';
import { KpiCards, PolicyCompare, WhatIfCard } from './Insights';

/** 막대는 가로로만, 하루 단위로 스냅 */
const barModifier: Modifier = ({ transform, active }) =>
  String(active?.id).startsWith('bar:') ? { ...transform, x: Math.round(transform.x / COL) * COL, y: 0 } : transform;

export function BoardPage() {
  const blocks = useStore((s) => s.blocks);
  const resources = useStore((s) => s.resources);
  const assignments = useStore((s) => s.assignments);
  const planStart = useStore((s) => s.planStart);
  const solve = useStore((s) => s.solve);
  const assign = useStore((s) => s.assign);
  const moveBlock = useStore((s) => s.moveBlock);
  const clear = useStore((s) => s.clearAssignments);
  const setPage = useStore((s) => s.setPage);
  const [dragKind, setDragKind] = useState<ResourceKind | null>(null);
  const [busy, setBusy] = useState(false);

  const ev = useMemo(() => evaluate(blocks, resources, assignments), [blocks, resources, assignments]);
  // 막대를 오른쪽으로 더 끌 수 있도록 여유 열을 둔다
  const days = ev.horizon + 2;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragStart = (e: DragStartEvent) => setDragKind((e.active.data.current?.kind as ResourceKind) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setDragKind(null);
    const id = String(e.active.id);
    if (id.startsWith('res:')) {
      const target = e.over?.data.current?.blockId as string | undefined;
      if (target) assign(target, id.slice(4) as ResourceKind);
    } else if (id.startsWith('bar:')) {
      const blockId = id.slice(4);
      const shift = Math.round(e.delta.x / COL);
      const a = assignments[blockId];
      if (shift !== 0 && a?.startDay) moveBlock(blockId, a.startDay + shift);
    }
  };

  const optimize = async () => {
    setBusy(true);
    try {
      await runSolve('optimal');
    } finally {
      setBusy(false);
    }
  };

  const verdict = solve ? (solve.solutions.optimal.feasible ? 'good' : 'bad') : null;

  return (
    <div className="board">
      <div className="board-head">
        <div>
          <span className="eyebrow-label">— 02. 배치</span>
          <h1>
            {verdict === 'good' && (
              <>
                현재 가용 자원으로 <em>전 블록 납기 준수 가능</em>
              </>
            )}
            {verdict === 'bad' && (
              <>
                현재 가용 자원으로는 <em className="bad">납기 준수 불가</em>
              </>
            )}
            {verdict === null && <>블록 및 작업자 배치</>}
          </h1>
        </div>
        <div className="board-actions">
          <button type="button" className="btn ghost" onClick={() => setPage('input')}>
            ← 입력 수정
          </button>
          <button type="button" className="btn ghost" onClick={clear} disabled={Object.keys(assignments).length === 0}>
            초기화
          </button>
          <button type="button" className="btn ghost" onClick={() => exportSchedule(blocks, resources, assignments, planStart)}>
            <LineIcon name="download" size={16} /> 엑셀 내보내기
          </button>
          <button type="button" className="btn primary" onClick={optimize} disabled={busy || blocks.length === 0} data-tour="optimize">
            {busy ? '계산 중…' : '자동 배치(최적화)'}
          </button>
        </div>
      </div>

      <KpiCards ev={ev} />

      <DndContext sensors={sensors} modifiers={[barModifier]} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragKind(null)}>
        <ResourcePalette />
        <div className="gantt-scroll">
          <GanttChart ev={ev} days={days} />
          <LoadGrid ev={ev} days={days} />
        </div>
        <DragOverlay dropAnimation={null}>{dragKind && <div className="drag-ghost"><ResourceIcon kind={dragKind} size={36} /></div>}</DragOverlay>
      </DndContext>
      <Legend />

      {solve ? (
        <div className="insights">
          <PolicyCompare solve={solve} />
          <WhatIfCard solve={solve} />
        </div>
      ) : (
        <div className="panel muted-panel">
          <LineIcon name="bulb" />
          <span>
            <b>자동 배치(최적화)</b>를 누르면 현재 자원으로 가능한지 판정하고, 입력 순서 · 납기 빠른 순 · 최적화 배치를 비교합니다.
          </span>
        </div>
      )}
    </div>
  );
}
