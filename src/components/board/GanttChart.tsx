import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import type { Assignment, Assignments, Block, ResourceKind, Resources } from '../../domain/types';
import type { BlockResult, Evaluation } from '../../domain/evaluate';
import { REASON_LABEL } from '../../domain/labels';
import { assignBlockedReason } from '../../domain/assign';
import { laneCount } from '../../domain/lanes';
import { useStore } from '../../store/schedulerStore';
import { dayToDate, formatMD } from '../../io/dates';
import { CraneIcon, MaterialIcon, SkilledIcon, WorkerIcon } from '../icons/ResourceIcons';

export const COL = 96;
/** 이보다 긴 일정은 "전체 기간 표시"를 눌러야 다 보인다 */
export const MAX_DAYS = 90;

interface DayHeaderProps {
  days: number;
  planStart: string;
  label: string;
  /** 고른 날 (TBM 메시지 대상) */
  focus?: number;
  onPick?(day: number): void;
}

export function DayHeader({ days, planStart, label, focus, onPick }: DayHeaderProps) {
  return (
    <div className="g-row g-header" style={{ gridTemplateColumns: `var(--left) repeat(${days}, ${COL}px)` }}>
      <div className="g-left">{label}</div>
      {Array.from({ length: days }, (_, i) => {
        const cls = `g-day ${i === 0 ? 'today' : ''} ${focus === i + 1 ? 'focus' : ''}`;
        const body = (
          <>
            <b>{i === 0 ? '오늘' : `${i + 1}일`}</b>
            <small>{formatMD(dayToDate(planStart, i + 1))}</small>
          </>
        );
        return onPick ? (
          <button key={i} type="button" className={cls} onClick={() => onPick(i + 1)} title={`${i + 1}일 작업·TBM 보기`} aria-pressed={focus === i + 1}>
            {body}
          </button>
        ) : (
          <div key={i} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

function statusText(res: BlockResult): string | null {
  if (res.status === 'blocked') return `착수 불가 · ${res.blockedReasons.map((r) => REASON_LABEL[r]).join(', ')}`;
  if (res.status === 'conflict') return `${res.laneClash ? '작업장 겹침' : '자원 겹침'}${res.lateDays ? ` · ${res.lateDays}일 지연` : ''}`;
  if (res.status === 'late') return `납기 ${res.lateDays}일 지연`;
  return null;
}

function blockTitle(block: Block, res: BlockResult) {
  const when = res.start !== null ? `${res.start}일 착수${res.end ? ` → ${res.end}일 끝` : ''}` : '미배치';
  return `${block.id}: ${when}. 남은 ${block.dueDay}일 · ${block.requiredMH} MH · ${block.materialReady ? '자재 준비' : '자재 미준비'} · 납기까지 ${res.mhByDue}/${block.requiredMH} MH`;
}

/** 배정된 자원 아이콘. 누르면 뺀다. 필요한데 없는 크레인·비상 자재는 흐린 자리로 보여 준다. */
function AssignedIcons({ block, a, size = 16 }: { block: Block; a: Assignment | undefined; size?: number }) {
  const unassign = useStore((s) => s.unassign);
  const icon = (key: string, kind: ResourceKind, title: string, node: React.ReactNode) => (
    <button
      key={key}
      type="button"
      className="placed"
      title={`${title} 빼기`}
      aria-label={`${block.id}에서 ${title} 빼기`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        unassign(block.id, kind);
      }}
    >
      {node}
    </button>
  );
  return (
    <span className="placed-icons">
      {a?.crane ? (
        icon('crane', 'crane', '크레인', <CraneIcon size={size} />)
      ) : (
        <span className="slot" title="크레인 필요">
          <CraneIcon size={size} />
        </span>
      )}
      {!block.materialReady &&
        (a?.emergency ? (
          icon('em', 'emergency', '비상 자재', <MaterialIcon size={size} />)
        ) : (
          <span className="slot" title="비상 자재 필요">
            <MaterialIcon size={size} />
          </span>
        ))}
      {Array.from({ length: a?.skilled ?? 0 }, (_, i) => icon(`k${i}`, 'skilled', '숙련공', <SkilledIcon size={size} />))}
      {Array.from({ length: a?.general ?? 0 }, (_, i) => icon(`g${i}`, 'general', '작업자', <WorkerIcon size={size} />))}
    </span>
  );
}

/** 자원 아이콘을 끌어 올 때의 판정 (놓을 수 있는지와 이유) */
function useResourceDrop(block: Block, a: Assignment | undefined, assignments: Assignments) {
  const { setNodeRef, isOver } = useDroppable({ id: `blk:${block.id}`, data: { blockId: block.id } });
  const { active } = useDndContext();
  const resources = useStore((s) => s.resources);
  const dragKind = active?.data.current?.kind as ResourceKind | undefined;
  const reason = isOver && dragKind ? assignBlockedReason(block, a, dragKind, resources, assignments) : null;
  const dropCls = isOver && dragKind ? (reason ? 'drop-no' : 'drop-ok') : '';
  return { setNodeRef, reason, dropCls };
}

interface BarProps {
  block: Block;
  res: BlockResult;
  a: Assignment;
  assignments: Assignments;
  days: number;
  lanes: number;
  hinted: boolean;
  onEdit(id: string): void;
}

function Bar({ block, res, a, assignments, days, lanes, hinted, onEdit }: BarProps) {
  const moveBlock = useStore((s) => s.moveBlock);
  const selected = useStore((s) => s.selectedToken);
  const assign = useStore((s) => s.assign);
  const start = res.start ?? 1;
  const drag = useDraggable({ id: `bar:${block.id}`, data: { blockId: block.id, start } });
  const drop = useResourceDrop(block, a, assignments);
  const length = Math.max(1, Math.min(res.duration ?? 1, days - start + 1));
  const shift = drag.transform ? Math.round(drag.transform.x / COL) : 0;
  const status = statusText(res);
  const cls = [
    'g-bar',
    res.status,
    res.lateDays > 0 && 'is-late',
    res.overloaded && 'overloaded',
    drag.isDragging && 'dragging',
    length === 1 && 'short',
    selected && 'selectable',
    hinted && 'hinted',
    drop.dropCls,
  ]
    .filter(Boolean)
    .join(' ');

  if (start > days) {
    return (
      <div className="g-bar out-of-range" style={{ left: (days - 1) * COL + 3, width: COL - 6 }}>
        {block.id} {start}일 착수 →
      </div>
    );
  }

  return (
    <div
      ref={(el) => {
        drag.setNodeRef(el);
        drop.setNodeRef(el);
      }}
      className={cls}
      data-testid={`bar-${block.id}`}
      data-day={drag.isDragging ? `${Math.max(1, start + shift)}일 착수` : undefined}
      title={`${blockTitle(block, res)}. 끌어서 착수일·작업장을 옮깁니다`}
      style={{
        left: (start - 1) * COL + 3,
        width: length * COL - 6,
        transform: drag.transform ? `translate(${drag.transform.x}px, ${drag.transform.y}px)` : undefined,
      }}
      {...drag.listeners}
      {...drag.attributes}
      aria-label={`${block.id} ${start}일 착수. 좌우 방향키로 착수일, 위아래로 작업장 이동, Enter로 편집`}
      tabIndex={0}
      onClick={() => selected && assign(block.id, selected)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          moveBlock(block.id, start + (e.key === 'ArrowRight' ? 1 : -1));
        } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && a.lane !== undefined) {
          e.preventDefault();
          const lane = a.lane + (e.key === 'ArrowDown' ? 1 : -1);
          if (lane >= 0 && lane < lanes) moveBlock(block.id, start, lane);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (selected) assign(block.id, selected);
          else onEdit(block.id);
        }
      }}
    >
      <span className="bar-top">
        <strong>{block.id}</strong>
        {status ? (
          <span className="bar-status">{status}</span>
        ) : (
          <span className="bar-meta">
            {length === 1 ? `${res.dailyMH}MH` : `${res.duration}일 · 하루 ${res.dailyMH} MH`}
          </span>
        )}
        <button
          type="button"
          className="bar-edit"
          title="숫자 편집"
          aria-label={`${block.id} 숫자 편집`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(block.id);
          }}
        >
          ✎
        </button>
      </span>
      <AssignedIcons block={block} a={a} />
      {drop.reason && <span className="drop-reason">{drop.reason}</span>}
    </div>
  );
}

/** 아직 간트에 올리지 않은 블록. 작업장 줄로 끌어 놓거나 자원 아이콘을 놓으면 배치된다. */
function WaitingChip({ block, a, assignments, hinted, onEdit }: { block: Block; a: Assignment | undefined; assignments: Assignments; hinted: boolean; onEdit(id: string): void }) {
  const drag = useDraggable({ id: `wait:${block.id}`, data: { blockId: block.id } });
  const drop = useResourceDrop(block, a, assignments);
  const selected = useStore((s) => s.selectedToken);
  const assign = useStore((s) => s.assign);
  return (
    <div
      ref={(el) => {
        drag.setNodeRef(el);
        drop.setNodeRef(el);
      }}
      className={`wait-chip ${drop.dropCls} ${drag.isDragging ? 'dragging' : ''} ${selected ? 'selectable' : ''} ${hinted ? 'hinted' : ''}`}
      data-testid={`wait-${block.id}`}
      {...drag.listeners}
      {...drag.attributes}
      tabIndex={0}
      aria-label={`${block.id} 대기 블록. 작업장 줄로 끌어 놓거나 Enter로 편집`}
      onClick={() => selected && assign(block.id, selected)}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (selected) assign(block.id, selected);
        else onEdit(block.id);
      }}
    >
      <span className="bar-top">
        <strong>{block.id}</strong>
        <button
          type="button"
          className="bar-edit"
          title="숫자 편집"
          aria-label={`${block.id} 숫자 편집`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(block.id);
          }}
        >
          ✎
        </button>
      </span>
      <small className="muted">
        남은 {block.dueDay}일 · {block.requiredMH} MH
      </small>
      {!block.materialReady && <span className="tag warn">자재 미준비</span>}
      {drop.reason && <span className="drop-reason">{drop.reason}</span>}
    </div>
  );
}

function Lane({ lane, label, wpStart, children, overDays, days }: { lane: number; label: React.ReactNode; wpStart: boolean; children: React.ReactNode; overDays: number[]; days: number }) {
  const { setNodeRef, isOver, active } = useDroppable({ id: `lane:${lane}`, data: { lane } });
  const moving = isOver && /^(bar|wait):/.test(String(active?.id));
  return (
    <div className={`g-row g-lane ${wpStart ? 'wp-start' : ''} ${moving ? 'lane-over' : ''}`} data-testid={`lane-${lane}`} style={{ gridTemplateColumns: `var(--left) repeat(${days}, ${COL}px)` }}>
      <div className="g-left lane-label">{label}</div>
      <div ref={setNodeRef} className="g-track" style={{ gridColumn: `2 / span ${days}` }}>
        {Array.from({ length: days }, (_, i) => (
          <div key={i} className="g-cell" style={{ left: i * COL, width: COL }} />
        ))}
        {overDays
          .filter((d) => d <= days)
          .map((d) => (
            <span key={d} className="over-day" style={{ left: (d - 1) * COL, width: COL }} title={`${d}일 자원 용량 초과·겹침`} />
          ))}
        {children}
      </div>
    </div>
  );
}

/** 간트 위 대기 블록 줄 */
export function WaitingTray({ blocks, assignments, ev, hintBlock, onEdit }: Pick<Props, 'blocks' | 'assignments' | 'ev' | 'hintBlock' | 'onEdit'>) {
  const waiting = blocks.filter((b) => ev.blocks[b.id].start === null);
  return (
    <div className="wait-tray" data-tour="waiting">
      <span className="wait-title">
        대기 블록 <b>{waiting.length}</b>
      </span>
      {waiting.length === 0 ? (
        <span className="muted">모든 블록이 작업장에 배치되었습니다.</span>
      ) : (
        waiting.map((b) => <WaitingChip key={b.id} block={b} a={assignments[b.id]} assignments={assignments} hinted={hintBlock === b.id} onEdit={onEdit} />)
      )}
    </div>
  );
}

interface Props {
  blocks: Block[];
  assignments: Assignments;
  ev: Evaluation;
  days: number;
  focusDay: number;
  hintBlock: string | null;
  onFocusDay(day: number): void;
  onEdit(id: string): void;
}

export function GanttChart({ blocks, assignments, ev, days, focusDay, hintBlock, onFocusDay, onEdit }: Props) {
  const planStart = useStore((s) => s.planStart);
  const r: Resources = useStore((s) => s.resources);
  const n = laneCount(r);
  const placed = blocks.filter((b) => ev.blocks[b.id].start !== null);
  const laneOf = (b: Block) => {
    const lane = assignments[b.id]?.lane;
    return lane !== undefined && lane < n ? lane : -1;
  };

  const bars = (lane: number) =>
    placed
      .filter((b) => laneOf(b) === lane)
      .map((b) => (
        <span key={b.id}>
          {b.dueDay <= days && <div className="due-tick" style={{ left: b.dueDay * COL }} title={`${b.id} 납기: ${b.dueDay}일 끝`} />}
          <Bar block={b} res={ev.blocks[b.id]} a={assignments[b.id]} assignments={assignments} days={days} lanes={n} hinted={hintBlock === b.id} onEdit={onEdit} />
        </span>
      ));
  const overDaysOf = (lane: number) => [...new Set(placed.filter((b) => laneOf(b) === lane).flatMap((b) => ev.blocks[b.id].overDays))];
  const unplacedLane = placed.some((b) => laneOf(b) === -1);

  return (
    <div className="gantt" data-tour="gantt">
      <DayHeader days={days} planStart={planStart} label="작업장 · 작업 자리" focus={focusDay} onPick={onFocusDay} />
      {Array.from({ length: n }, (_, lane) => {
        const wp = Math.floor(lane / r.blocksPerWorkplace);
        const seat = lane % r.blocksPerWorkplace;
        const label = (
          <>
            <strong>작업장 {wp + 1}</strong>
            {r.blocksPerWorkplace > 1 && <span className="muted">자리 {seat + 1}</span>}
          </>
        );
        return (
          <Lane key={lane} lane={lane} label={label} wpStart={lane > 0 && seat === 0} overDays={overDaysOf(lane)} days={days}>
            {bars(lane)}
          </Lane>
        );
      })}
      {unplacedLane && (
        <Lane lane={-1} label={<strong>작업장 없음</strong>} wpStart overDays={overDaysOf(-1)} days={days}>
          {bars(-1)}
        </Lane>
      )}
    </div>
  );
}
