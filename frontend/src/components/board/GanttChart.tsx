import { useRef } from 'react';
import { useDndContext, useDroppable } from '@dnd-kit/core';
import type { Assignment, Assignments, Block, ResourceKind } from '../../domain/types';
import type { BlockResult, Evaluation } from '../../domain/evaluate';
import { assignBlockedReason } from '../../domain/assign';
import { materialText } from '../../domain/labels';
import { laneCount, workplaceOf } from '../../domain/lanes';
import { useStore } from '../../store/schedulerStore';
import { dayToDate, formatMD } from '../../io/dates';
import { dayInfo, isWorkDay, type DayInfo } from '../../domain/calendar';
import { useCalendar } from '../../store/evaluation';
import { COL } from './ganttLayout';
import { LineIcon } from '../icons/LineIcons';
import { AssignedIcons, Bar, blockTitle, GhostBar } from './GanttBars';
import { useRowFlip } from './useRowFlip';

export { COL, MAX_DAYS } from './ganttLayout';

const OFF_TEXT = { weekend: '주말', holiday: '공휴일', manual: '작업 불가' } as const;

function dayTitle(md: string, info: DayInfo): string {
  if (info.off === 'manual') return `${md} 작업 불가 (직접 지정, 납기는 그대로). 누르면 작업일로 되돌립니다`;
  if (info.off) return `${md} ${info.holiday ?? '주말'} — 작업하지 않고 납기도 그만큼 늦춰집니다. 누르면 이날도 작업합니다`;
  if (info.preset) return `${md} ${info.holiday ?? '주말'}이지만 작업하는 날로 바꿨습니다. 누르면 다시 쉽니다`;
  return `${md} 누르면 작업 불가 날짜로 지정합니다 (천재지변 등, 납기는 그대로)`;
}

/** 날짜 머리. 쉬는 날은 음영으로 보이고, 누르면 작업 불가 ↔ 작업일을 바꾼다 (튜토리얼 중에는 매일 작업) */
export function DayHeader({ days, planStart, label }: { days: number; planStart: string; label: string }) {
  const options = useStore((s) => s.calendar);
  const touring = useStore((s) => s.tutorialActive);
  const toggle = useStore((s) => s.toggleOffDay);
  const showToast = useStore((s) => s.showToast);
  return (
    <div className="g-row g-header" style={{ gridTemplateColumns: `var(--left) repeat(${days}, ${COL}px)` }}>
      <div className="g-left">{label}</div>
      {Array.from({ length: days }, (_, i) => {
        const day = i + 1;
        const md = formatMD(dayToDate(planStart, day));
        const info: DayInfo = touring ? { off: null, preset: false } : dayInfo(planStart, day, options);
        const cls = ['g-day', i === 0 && 'today', info.off && `off ${info.off}`, !info.off && info.preset && 'restored'].filter(Boolean).join(' ');
        const body = (
          <>
            <b>{i === 0 ? '오늘' : `${day}일`}</b>
            <small>{md}</small>
            {info.off && <em className="off-tag">{info.off === 'holiday' ? info.holiday : OFF_TEXT[info.off]}</em>}
          </>
        );
        if (touring) return <div key={i} className={cls}>{body}</div>;
        return (
          <button
            key={i}
            type="button"
            className={cls}
            data-testid={`day-${day}`}
            title={dayTitle(md, info)}
            aria-pressed={!!info.off}
            onClick={() => {
              toggle(day);
              showToast(info.off ? `${md}: 작업하는 날로 바꿨습니다` : `${md}: 작업 불가 날짜로 지정했습니다 (납기는 그대로)`);
            }}
          >
            {body}
          </button>
        );
      })}
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
  const cal = useCalendar();
  const planStart = useStore((s) => s.planStart);
  const selected = useStore((s) => s.selectedToken);
  const assign = useStore((s) => s.assign);
  const togglePin = useStore((s) => s.togglePin);
  const expert = useStore((s) => s.mode !== 'novice');
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
          {!block.materialReady && <span className="tag warn">{materialText(block, (d) => formatMD(dayToDate(planStart, d)))}</span>}
          <span className="b-tools">
            {expert && !waiting && a && (
              <button
                type="button"
                className={`bar-pin ${a.pinned ? 'on' : ''}`}
                title={a.pinned ? '합의 풀기' : '합의: 다시 최적화해도 이 배치를 그대로 둡니다'}
                aria-label={`${block.id} ${a.pinned ? '합의 풀기' : '합의'}`}
                aria-pressed={!!a.pinned}
                data-testid={`pin-${block.id}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => togglePin(block.id)}
              >
                <LineIcon name="lock" size={14} />
                {a.pinned ? '합의됨' : '합의'}
              </button>
            )}
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
          </span>
        </div>
        <AssignedIcons block={block} a={a} size={18} />
        {reason && <span className="drop-reason">{reason}</span>}
      </div>
      <div className="g-track" style={{ gridColumn: `2 / span ${days}` }}>
        {Array.from({ length: days }, (_, i) => (
          <div key={i} className={`g-cell ${isWorkDay(cal, i + 1) ? '' : 'off'}`} style={{ left: i * COL, width: COL }} />
        ))}
        {res.overDays
          .filter((d) => d <= days)
          .map((d) => (
            <span key={d} className="over-day" style={{ left: (d - 1) * COL, width: COL }} title={`${d}일 자원 용량 초과·겹침`} />
          ))}
        {res.due <= days && <div className="due-line" style={{ left: res.due * COL }} title={`납기: ${res.due}일 끝`} />}
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
  const ref = useRef<HTMLDivElement>(null);
  useRowFlip(ref);
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
    <div ref={ref} className="gantt" data-tour="gantt">
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
