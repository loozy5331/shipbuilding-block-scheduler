import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
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
import { evaluate } from '../../domain/evaluate';
import { nextHint, type Hint } from '../../domain/hint';
import { useStore } from '../../store/schedulerStore';
import { runSolve } from '../../store/actions';
import { exportSchedule } from '../../io/excel';
import { ResourceIcon } from '../icons/ResourceIcons';
import { LineIcon } from '../icons/LineIcons';
import { ResourcePalette } from './ResourcePalette';
import { COL, GanttChart, MAX_DAYS, WaitingTray } from './GanttChart';
import { Legend, LoadGrid } from './LoadGrid';
import { KpiCards, PolicyCompare, WhatIfCard } from './Insights';
import { BlockEditor } from './BlockEditor';
import { TodayPanel } from './TodayPanel';
import { ReportCard } from './ReportCard';

/** 막대는 하루 단위로 스냅하고 1일 앞으로는 못 간다. 위아래로는 다른 작업장으로 옮길 수 있다. */
const barModifier: Modifier = ({ transform, active }) => {
  if (!String(active?.id).startsWith('bar:')) return transform;
  const start = (active?.data.current?.start as number) ?? 1;
  return { ...transform, x: Math.max((1 - start) * COL, Math.round(transform.x / COL) * COL) };
};

/** 자원 아이콘은 블록(막대·대기 블록)에, 막대·대기 블록은 작업장 줄에만 놓인다 */
const collide: CollisionDetection = (args) => {
  const prefix = String(args.active.id).startsWith('res:') ? 'blk:' : 'lane:';
  const scoped = { ...args, droppableContainers: args.droppableContainers.filter((c) => String(c.id).startsWith(prefix)) };
  const hits = pointerWithin(scoped);
  return hits.length ? hits : rectIntersection(scoped);
};

function pointerX(e: Event | null): number {
  if (!e) return 0;
  if ('touches' in e) return (e as TouchEvent).touches[0]?.clientX ?? 0;
  return (e as MouseEvent).clientX;
}

export function BoardPage() {
  const blocks = useStore((s) => s.blocks);
  const resources = useStore((s) => s.resources);
  const assignments = useStore((s) => s.assignments);
  const planStart = useStore((s) => s.planStart);
  const solve = useStore((s) => s.solve);
  const mode = useStore((s) => s.mode);
  const hintCount = useStore((s) => s.hintCount);
  const touring = useStore((s) => s.tutorialStep !== null);
  const assign = useStore((s) => s.assign);
  const moveBlock = useStore((s) => s.moveBlock);
  const clear = useStore((s) => s.clearAssignments);
  const showFull = useStore((s) => s.showFull);
  const setShowFull = useStore((s) => s.setShowFull);
  const [drag, setDrag] = useState<{ kind?: ResourceKind; blockId?: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<Hint | null>(null);
  const [focusDay, setFocusDay] = useState(1);

  const ev = useMemo(() => evaluate(blocks, resources, assignments), [blocks, resources, assignments]);
  // 막대를 오른쪽으로 더 끌 수 있도록 여유 열을 두고, 너무 길면 90일까지만 그린다
  const needed = ev.horizon + 2;
  const days = showFull ? needed : Math.min(MAX_DAYS, needed);

  // 이전 버전에서 저장된 배치는 작업 자리가 없으므로 채운다
  useEffect(() => {
    if (Object.values(assignments).some((a) => a.startDay !== null && a.lane === undefined)) useStore.getState().applyAssignments(assignments);
  }, [assignments]);

  // 입력이 바뀌면 바로 가능/불가를 판정한다 (배치는 바꾸지 않음)
  useEffect(() => {
    if (!solve && blocks.length > 0) runSolve(null).catch(() => undefined);
  }, [solve, blocks, resources]);

  // 배치가 바뀌면 지난 힌트는 낡는다
  useEffect(() => setHint(null), [assignments]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    if (id.startsWith('res:')) setDrag({ kind: e.active.data.current?.kind as ResourceKind });
    else if (id.startsWith('wait:')) setDrag({ blockId: id.slice(5) });
    else setDrag(null);
  };
  const onDragEnd = (e: DragEndEvent) => {
    setDrag(null);
    const id = String(e.active.id);
    const lane = e.over?.data.current?.lane as number | undefined;
    if (id.startsWith('res:')) {
      const target = e.over?.data.current?.blockId as string | undefined;
      if (target) assign(target, id.slice(4) as ResourceKind);
    } else if (id.startsWith('bar:')) {
      const blockId = id.slice(4);
      const a = assignments[blockId];
      if (!a?.startDay) return;
      const shift = Math.round(e.delta.x / COL);
      const toLane = lane !== undefined && lane >= 0 ? lane : a.lane;
      if (shift !== 0 || toLane !== a.lane) moveBlock(blockId, a.startDay + shift, toLane);
    } else if (id.startsWith('wait:') && e.over && lane !== undefined && lane >= 0) {
      const x = pointerX(e.activatorEvent) + e.delta.x;
      moveBlock(id.slice(5), Math.floor((x - e.over.rect.left) / COL) + 1, lane);
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

  const askHint = async () => {
    setBusy(true);
    try {
      const res = await runSolve(null);
      const s = useStore.getState();
      setHint(nextHint(s.blocks, s.resources, s.assignments, res.solutions.optimal.assignments));
      s.countHint();
    } finally {
      setBusy(false);
    }
  };

  const verdict = solve ? (solve.solutions.optimal.feasible ? 'good' : 'bad') : null;
  const expert = mode !== 'novice';

  return (
    <div className="board">
      <div className="board-head">
        <div>
          <span className="eyebrow-label">
            — 02. 배치 · {expert ? '숙련자' : '신입'} 모드
          </span>
          <h1 data-testid="verdict">
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
            {verdict === null && <>가용 자원으로 가능한지 판정 중…</>}
          </h1>
        </div>
        <div className="board-actions">
          <button type="button" className="btn ghost" onClick={() => useStore.getState().setPage('input')}>
            ← 입력 수정
          </button>
          <button type="button" className="btn ghost" onClick={clear} disabled={Object.keys(assignments).length === 0}>
            초기화
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => exportSchedule(blocks, resources, assignments, planStart, { optimal: solve?.solutions.optimal.assignments, hintCount: expert ? undefined : hintCount })}
          >
            <LineIcon name="download" size={16} /> 엑셀 내보내기
          </button>
          {expert ? (
            <button type="button" className="btn primary" onClick={optimize} disabled={busy || blocks.length === 0} data-tour="optimize">
              {busy ? '계산 중…' : '최적 배치'}
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={askHint} disabled={busy || blocks.length === 0} data-tour="optimize" data-testid="hint-btn">
              <LineIcon name="bulb" size={16} /> {busy ? '계산 중…' : '힌트'}
            </button>
          )}
        </div>
      </div>

      {hint && (
        <div className="notice hint" role="status" data-testid="hint">
          <LineIcon name="bulb" size={18} />
          <p>
            <b>힌트 {hintCount}</b> · {hint.message}
          </p>
          {hint.next && (
            <button type="button" className="btn small" onClick={() => useStore.getState().applyAssignments(hint.next!)}>
              이대로 바꾸기
            </button>
          )}
          <button type="button" className="btn small ghost" onClick={() => setHint(null)}>
            닫기
          </button>
        </div>
      )}

      <KpiCards ev={ev} />
      {!showFull && needed > MAX_DAYS && (
        <div className="notice warn">
          표시는 1~{days}일로 제한했습니다. 자원 충돌·KPI는 {ev.horizon}일까지 전체 배치를 분석합니다.{' '}
          <button type="button" className="btn small ghost" onClick={() => setShowFull(true)}>
            전체 기간 표시
          </button>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={collide} modifiers={[barModifier]} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDrag(null)}>
        <ResourcePalette />
        <WaitingTray blocks={blocks} assignments={assignments} ev={ev} hintBlock={hint?.blockId ?? null} onEdit={setEditing} />
        <div className="gantt-scroll">
          <GanttChart
            blocks={blocks}
            assignments={assignments}
            ev={ev}
            days={days}
            focusDay={focusDay}
            hintBlock={hint?.blockId ?? null}
            onFocusDay={setFocusDay}
            onEdit={setEditing}
          />
          <LoadGrid ev={ev} days={days} />
        </div>
        <DragOverlay dropAnimation={null}>
          {drag?.kind && (
            <div className="drag-ghost">
              <ResourceIcon kind={drag.kind} size={36} />
            </div>
          )}
          {drag?.blockId && <div className="drag-ghost block-ghost">{drag.blockId}</div>}
        </DragOverlay>
      </DndContext>
      <Legend />

      <TodayPanel ev={ev} day={focusDay} onDay={setFocusDay} maxDay={ev.horizon} />

      {solve ? (
        <>
          <ReportCard ev={ev} solve={solve} hintCount={expert ? null : hintCount} />
          <div className="insights">
            {(expert || touring) && <PolicyCompare solve={solve} />}
            <WhatIfCard solve={solve} />
          </div>
        </>
      ) : (
        <div className="panel muted-panel">
          <LineIcon name="bulb" />
          <span>가용 자원으로 전 블록 납기 준수가 가능한지 계산하고 있습니다.</span>
        </div>
      )}

      {editing && <BlockEditor blockId={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
