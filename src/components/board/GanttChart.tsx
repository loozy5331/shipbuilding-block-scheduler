import { useDndContext, useDroppable } from '@dnd-kit/core';
import type { Assignment, Assignments, Block, ResourceKind } from '../../domain/types';
import type { BlockResult, Evaluation } from '../../domain/evaluate';
import { assignBlockedReason } from '../../domain/assign';
import { laneCount, workplaceOf } from '../../domain/lanes';
import { useStore } from '../../store/schedulerStore';
import { dayToDate, formatMD } from '../../io/dates';
import { COL } from './ganttLayout';
import { AssignedIcons, Bar, blockTitle, GhostBar } from './GanttBars';

export { COL, MAX_DAYS } from './ganttLayout';

export function DayHeader({ days, planStart, label }: { days: number; planStart: string; label: string }) {
  return (
    <div className="g-row g-header" style={{ gridTemplateColumns: `var(--left) repeat(${days}, ${COL}px)` }}>
      <div className="g-left">{label}</div>
      {Array.from({ length: days }, (_, i) => (
        <div key={i} className={`g-day ${i === 0 ? 'today' : ''}`}>
          <b>{i === 0 ? '오늘' : `${i + 1}일`}</b>
          <small>{formatMD(dayToDate(planStart, i + 1))}</small>
        </div>
      ))}
    </div>
  );
}

interface RowProps {
  block: Block;
  res: BlockResult;
  a: Assignment | undefined;
  assignments: Assignments;
  days: number;
  workplaces: number;
  hinted: boolean;
  onEdit(id: string): void;
}

/** 블록 한 줄: 왼쪽은 블록 정보와 배정된 자원, 오른쪽은 날짜 칸과 막대 */
function BlockRow({ block, res, a, assignments, days, workplaces, hinted, onEdit }: RowProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `blk:${block.id}`, data: { blockId: block.id } });
  const { active } = useDndContext();
  const resources = useStore((s) => s.resources);
  const selected = useStore((s) => s.selectedToken);
  const assign = useStore((s) => s.assign);
  const waiting = res.start === null;

  const dragKind = active?.data.current?.kind as ResourceKind | undefined;
  const reason = isOver && dragKind ? assignBlockedReason(block, a, dragKind, resources, assignments) : null;
  const dropCls = isOver && dragKind ? (reason ? 'drop-no' : 'drop-ok') : '';

  return (
    <div
      ref={setNodeRef}
      className={`g-row g-block ${dropCls} ${selected ? 'selectable' : ''} ${hinted ? 'hinted' : ''}`}
      data-testid={`row-${block.id}`}
      style={{ gridTemplateColumns: `var(--left) repeat(${days}, ${COL}px)` }}
    >
      <div
        className="g-left"
        tabIndex={0}
        title={waiting ? '오른쪽 점선 막대를 작업장 테두리 안으로 끌어 놓으면 배치됩니다' : blockTitle(block, res)}
        aria-label={`${block.id} 배치 영역`}
        onClick={(e) => {
          if (selected && !(e.target as HTMLElement).closest('button')) assign(block.id, selected);
        }}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
          e.preventDefault();
          if (selected) assign(block.id, selected);
          else onEdit(block.id);
        }}
      >
        <div className="b-title">
          <strong>{block.id}</strong>
          <span className="muted">
            남은 {block.dueDay}일 · {block.requiredMH} MH
          </span>
          {!block.materialReady && <span className="tag warn">자재 미준비</span>}
          <button
            type="button"
            className="bar-edit"
            title="숫자 편집"
            aria-label={`${block.id} 숫자 편집`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onEdit(block.id)}
          >
            ✎
          </button>
        </div>
        <AssignedIcons block={block} a={a} size={18} />
        {reason && <span className="drop-reason">{reason}</span>}
      </div>
      <div className="g-track" style={{ gridColumn: `2 / span ${days}` }}>
        {Array.from({ length: days }, (_, i) => (
          <div key={i} className="g-cell" style={{ left: i * COL, width: COL }} />
        ))}
        {res.overDays
          .filter((d) => d <= days)
          .map((d) => (
            <span key={d} className="over-day" style={{ left: (d - 1) * COL, width: COL }} title={`${d}일 자원 용량 초과·겹침`} />
          ))}
        {block.dueDay <= days && <div className="due-line" style={{ left: block.dueDay * COL }} title={`납기: ${block.dueDay}일 끝`} />}
        {res.start !== null && a && <Bar block={block} res={res} a={a} days={days} workplaces={workplaces} onEdit={onEdit} />}
        {waiting && <GhostBar block={block} days={days} />}
      </div>
    </div>
  );
}

/** 작업장 하나를 테두리로 묶는다. 막대·대기 블록을 이 안에 놓으면 이 작업장으로 옮겨진다. */
function WorkplaceGroup({ wp, count, children }: { wp: number; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver, active } = useDroppable({ id: `wp:${wp}`, data: { wp } });
  const moving = isOver && /^(bar|wait):/.test(String(active?.id));
  return (
    <div ref={setNodeRef} className={`wp-group ${moving ? 'wp-over' : ''}`} data-testid={`wp-${wp}`}>
      <div className="wp-title">
        <strong>작업장 {wp + 1}</strong>
        <span className="muted">블록 {count}</span>
      </div>
      {count === 0 && <div className="wp-empty muted">비어 있음 · 막대나 대기 블록을 여기로 끌어 놓으세요</div>}
      {children}
    </div>
  );
}

interface Props {
  blocks: Block[];
  assignments: Assignments;
  ev: Evaluation;
  days: number;
  hintBlock: string | null;
  onEdit(id: string): void;
}

export function GanttChart({ blocks, assignments, ev, days, hintBlock, onEdit }: Props) {
  const planStart = useStore((s) => s.planStart);
  const r = useStore((s) => s.resources);
  const n = laneCount(r);
  const workplaces = r.workplaces;
  const wpOf = (b: Block) => {
    const lane = assignments[b.id]?.lane;
    return ev.blocks[b.id].start !== null && lane !== undefined && lane < n ? workplaceOf(lane, r) : -1;
  };
  const byStart = (x: Block, y: Block) => (ev.blocks[x.id].start ?? 0) - (ev.blocks[y.id].start ?? 0) || x.id.localeCompare(y.id);
  const row = (b: Block) => (
    <BlockRow
      key={b.id}
      block={b}
      res={ev.blocks[b.id]}
      a={assignments[b.id]}
      assignments={assignments}
      days={days}
      workplaces={workplaces}
      hinted={hintBlock === b.id}
      onEdit={onEdit}
    />
  );
  const waiting = blocks.filter((b) => wpOf(b) === -1);

  return (
    <div className="gantt" data-tour="gantt">
      <DayHeader days={days} planStart={planStart} label="블록 · 배정 자원" />
      {Array.from({ length: workplaces }, (_, wp) => {
        const rows = blocks.filter((b) => wpOf(b) === wp).sort(byStart);
        return (
          <WorkplaceGroup key={wp} wp={wp} count={rows.length}>
            {rows.map(row)}
          </WorkplaceGroup>
        );
      })}
      {waiting.length > 0 && (
        <div className="wp-group waiting-group" data-testid="waiting" data-tour="waiting">
          <div className="wp-title">
            <strong>대기 블록</strong>
            <span className="muted">점선 막대를 작업장으로 끌어 놓거나, 자원 아이콘을 놓으세요</span>
          </div>
          {waiting.map(row)}
        </div>
      )}
    </div>
  );
}
