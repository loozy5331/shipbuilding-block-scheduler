import { useEffect, useState } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { useCalendar, useEvaluation } from '../../store/evaluation';
import { selectCalendar } from '../../store/calendar';
import { nextHint, type Hint } from '../../domain/hint';
import { pinKey, pinnedOf, samePlan, startOrder } from '../../domain/lanes';
import { useStore } from '../../store/schedulerStore';
import { runPinnedSolve, runSolve } from '../../store/actions';
import { ResourceIcon } from '../icons/ResourceIcons';
import { LineIcon } from '../icons/LineIcons';
import { ResourcePalette } from './ResourcePalette';
import { GanttChart, MAX_DAYS } from './GanttChart';
import { ganttDays } from './ganttLayout';
import { useBoardDnd } from './useBoardDnd';
import { Legend, LoadGrid } from './LoadGrid';
import { KpiCards, WhatIfCard } from './Insights';
import { BlockEditor } from './BlockEditor';
import { prefersReducedMotion } from '../assembly/AssemblyShow';

const PLAN_NAME = ['최적 배치', '차선', '차차선'];

export function BoardPage() {
  const blocks = useStore((s) => s.blocks);
  const resources = useStore((s) => s.resources);
  const assignments = useStore((s) => s.assignments);
  const solve = useStore((s) => s.solve);
  const pinSolve = useStore((s) => s.pinSolve);
  const unpinAll = useStore((s) => s.unpinAll);
  const mode = useStore((s) => s.mode);
  const hintCount = useStore((s) => s.hintCount);
  const setPage = useStore((s) => s.setPage);
  const goToResult = useStore((s) => s.goToResult);
  const clear = useStore((s) => s.clearAssignments);
  const showFull = useStore((s) => s.showFull);
  const setShowFull = useStore((s) => s.setShowFull);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<Hint | null>(null);

  const ev = useEvaluation();
  // 모든 블록을 한 줄로 이어도 들어갈 만큼 그리고, 너무 길면 90일까지만 그린다
  const cal = useCalendar();
  const needed = ganttDays(blocks, resources, ev, cal);
  const days = showFull ? needed : Math.min(MAX_DAYS, needed);

  // 이전 버전에서 저장된 배치는 작업 자리가 없으므로 채운다
  useEffect(() => {
    if (Object.values(assignments).some((a) => a.startDay !== null && a.lane === undefined)) useStore.getState().applyAssignments(assignments);
  }, [assignments]);

  // 입력이 바뀌면 바로 가능/불가를 판정한다. 숙련자는 아직 아무것도 배치하지 않았으면 최적 배치로 시작한다
  // (직접 고친 배치·초기화한 상태는 덮어쓰지 않고, 튜토리얼은 빈 상태에서 따라 한다)
  useEffect(() => {
    if (solve || blocks.length === 0) return;
    const s = useStore.getState();
    const startOptimal = s.mode !== 'novice' && !s.tutorialActive && Object.keys(s.assignments).length === 0;
    runSolve(startOptimal ? 'optimal' : null).catch(() => undefined);
  }, [solve, blocks, resources]);

  // 배치가 바뀌면 지난 힌트는 낡는다
  useEffect(() => setHint(null), [assignments]);

  const { dragKind, dndProps } = useBoardDnd();

  // 고정한 블록이 있으면 그 블록은 두고 다시 최적화한 결과를 쓴다
  const pinned = Object.keys(pinnedOf(assignments));
  const pinFresh = pinSolve && pinSolve.blocks === blocks && pinSolve.resources === resources && pinSolve.key === pinKey(pinnedOf(assignments));
  const best = pinned.length > 0 ? (pinFresh ? pinSolve.solution : null) : (solve?.solutions.optimal ?? null);
  // 최적 배치 + 차선책. 지금 적용된 안이 몇 번째인지 (직접 고쳤으면 -1)
  const options = best ? [best, ...(best.alternatives ?? [])] : [];
  const applied = options.findIndex((o) => samePlan(assignments, o.assignments));

  /** 처음엔 최적 배치, 다시 누르면 차선책을 차례로 보여 준다 (현장 사정으로 먼저 해야 할 블록이 있을 수 있음) */
  const optimize = async () => {
    setBusy(true);
    try {
      const top = Object.keys(pinnedOf(useStore.getState().assignments)).length > 0 ? await runPinnedSolve() : (await runSolve(null)).solutions.optimal;
      const opts = [top, ...(top.alternatives ?? [])];
      const cur = opts.findIndex((o) => samePlan(useStore.getState().assignments, o.assignments));
      // 보고 있던 안이 후보가 아니었으면(직접 고침·고정 변경) 최적부터
      useStore.getState().applyAssignments(opts[applied < 0 ? 0 : (cur + 1) % opts.length].assignments);
    } finally {
      setBusy(false);
    }
  };

  const askHint = async () => {
    setBusy(true);
    try {
      const res = await runSolve(null);
      const s = useStore.getState();
      setHint(nextHint(s.blocks, s.resources, s.assignments, res.solutions.optimal.assignments, selectCalendar(s)));
      s.countHint();
    } finally {
      setBusy(false);
    }
  };

  const optimizeLabel =
    applied >= 0 && options.length > 1 ? `다음 최적배치 후보 (${applied + 1}/${options.length})` : pinned.length > 0 ? '합의 외 다시 최적화' : '최적 배치';
  const verdict = solve ? (solve.solutions.optimal.feasible ? 'good' : 'bad') : null;
  const expert = mode !== 'novice';

  return (
    <div className="board">
      <div className="board-head">
        <div>
          <span className="eyebrow-label">— 블록 스케줄링 · {expert ? '숙련자' : '신입'} 모드</span>
          <h1 data-testid="verdict" data-tour="verdict">
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
          <button type="button" className="btn ghost" onClick={() => setPage('setup')}>
            ← 공통 설정 입력
          </button>
          <button type="button" className="btn ghost" onClick={clear} disabled={Object.keys(assignments).length === 0}>
            초기화
          </button>
          {expert ? (
            <button type="button" className="btn primary" onClick={optimize} disabled={busy || blocks.length === 0} data-tour="optimize" data-testid="optimize-btn">
              {busy ? '계산 중…' : optimizeLabel}
            </button>
          ) : (
            <button type="button" className="btn primary" onClick={askHint} disabled={busy || blocks.length === 0} data-tour="optimize" data-testid="hint-btn">
              <LineIcon name="bulb" size={16} /> {busy ? '계산 중…' : '힌트'}
            </button>
          )}
          <button type="button" className="btn primary" onClick={() => goToResult(!prefersReducedMotion())} disabled={blocks.length === 0}>
            다음: 결과 →
          </button>
        </div>
      </div>

      {expert && applied >= 0 && options.length > 0 && (
        <div className="notice alt" role="status" data-testid="plan-option">
          <p>
            <b>{PLAN_NAME[applied]}</b> ({applied + 1}/{options.length}){pinned.length > 0 && <> · 합의 {pinned.length}개 유지</>} · 납기 준수 {options[applied].kpi.onTime}/
            {options[applied].kpi.total} · 지연 {options[applied].kpi.totalLateDays}일 · 착수 순서: {startOrder(options[applied].assignments).join(' → ')}
          </p>
          <small className="muted">
            {options.length > 1
              ? '버튼을 다시 누르면 착수 순서가 다른 안을 봅니다. 차선책도 모두 최소 요건(자재·크레인·작업자, 자원 초과 없음)을 만족합니다. 현장 사정으로 먼저 해야 할 블록이 있으면 차선책을 고르세요.'
              : '최소 요건(자재·크레인·작업자, 자원 초과 없음)을 만족하는 차선책이 없습니다.'}
          </small>
        </div>
      )}

      {expert && pinned.length > 0 && (
        <div className="notice pin" role="status" data-testid="pin-notice">
          <LineIcon name="lock" size={18} />
          <p>
            <b>합의 {pinned.length}개</b> · {pinned.join(', ')} — 최적화를 누르면 합의한 블록은 그대로 두고 나머지만 다시 배치합니다.
          </p>
          <button type="button" className="btn small ghost" onClick={unpinAll}>
            합의 모두 풀기
          </button>
        </div>
      )}

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

      <DndContext {...dndProps}>
        <ResourcePalette />
        <div className="gantt-scroll">
          <GanttChart
            blocks={blocks}
            assignments={assignments}
            ev={ev}
            days={days}
            hintBlock={hint?.blockId ?? null}
            onEdit={setEditing}
          />
          <LoadGrid ev={ev} days={days} />
        </div>
        <DragOverlay dropAnimation={null}>
          {dragKind && (
            <div className="drag-ghost">
              <ResourceIcon kind={dragKind} size={36} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
      <Legend />

      {/* 가능 여부는 위 제목에 있으므로, 불가능할 때만 추가 자원 제안을 보여 준다 */}
      {solve && !solve.solutions.optimal.feasible && <WhatIfCard solve={solve} />}

      {editing && <BlockEditor blockId={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
