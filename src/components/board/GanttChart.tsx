import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Assignment, Block } from '../../domain/types';
import type { BlockResult, Evaluation } from '../../domain/evaluate';
import { useStore } from '../../store/schedulerStore';
import { dayToDate, formatMD } from '../../io/dates';
import { CraneIcon, MaterialIcon, SkilledIcon, WorkerIcon } from '../icons/ResourceIcons';

export const COL = 96;

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

const REASON: Record<string, string> = { noCrane: '크레인 없음', noMaterial: '자재 없음', noCrew: '작업자 없음' };

function Bar({ block, res }: { block: Block; res: BlockResult }) {
  const { setNodeRef, listeners, attributes, transform, isDragging } = useDraggable({ id: `bar:${block.id}`, data: { blockId: block.id } });
  const start = res.start ?? 1;
  const width = (res.duration ?? 1) * COL - 6;
  const short = (res.duration ?? 1) === 1;
  const cls = [
    'g-bar',
    res.status === 'late' && 'late',
    res.status === 'blocked' && 'blocked',
    res.overloaded && 'overloaded',
    isDragging && 'dragging',
    short && 'short',
  ]
    .filter(Boolean)
    .join(' ');
  const label =
    res.status === 'blocked' ? (
      `착수 불가 · ${res.blockedReasons.map((r) => REASON[r]).join(', ')}`
    ) : (
      <>
        <b>{res.duration}일</b>
        {short ? '' : ' · '}
        <span>하루 {res.dailyMH} MH</span>
      </>
    );
  return (
    <div
      ref={setNodeRef}
      className={cls}
      data-testid={`bar-${block.id}`}
      title={`${block.id}: ${start}일차 착수${res.end ? ` ~ ${res.end}일차 종료` : ''}${res.lateDays ? ` (납기 ${res.lateDays}일 지연)` : ''}`}
      style={{ left: (start - 1) * COL + 3, width, transform: transform ? `translateX(${transform.x}px)` : undefined }}
      {...listeners}
      {...attributes}
    >
      {label}
    </div>
  );
}

function AssignedIcons({ block, a }: { block: Block; a: Assignment | undefined }) {
  const unassign = useStore((s) => s.unassign);
  const btn = (key: string, title: string, onClick: () => void, icon: React.ReactNode) => (
    <button key={key} type="button" className="placed" title={`${title} 빼기`} aria-label={`${block.id}에서 ${title} 빼기`} onClick={onClick}>
      {icon}
    </button>
  );
  return (
    <div className="placed-icons">
      {a?.crane ? btn('crane', '크레인', () => unassign(block.id, 'crane'), <CraneIcon size={26} />) : <span className="slot" title="크레인 필요"><CraneIcon size={26} /></span>}
      {!block.materialReady &&
        (a?.emergency ? (
          btn('em', '비상 자재', () => unassign(block.id, 'emergency'), <MaterialIcon size={26} />)
        ) : (
          <span className="slot" title="비상 자재 필요">
            <MaterialIcon size={26} />
          </span>
        ))}
      <span className="sep" />
      {Array.from({ length: a?.skilled ?? 0 }, (_, i) => btn(`k${i}`, '숙련공', () => unassign(block.id, 'skilled'), <SkilledIcon size={26} />))}
      {Array.from({ length: a?.general ?? 0 }, (_, i) => btn(`g${i}`, '작업자', () => unassign(block.id, 'general'), <WorkerIcon size={26} />))}
      {!a?.general && !a?.skilled && <span className="hint">작업자를 끌어 놓으세요</span>}
    </div>
  );
}

function BlockRow({ block, res, a, days }: { block: Block; res: BlockResult; a: Assignment | undefined; days: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: `row:${block.id}`, data: { blockId: block.id } });
  const pct = Math.round((res.mhByDue / block.requiredMH) * 100);
  return (
    <div
      ref={setNodeRef}
      className={`g-row g-block ${isOver ? 'drop-over' : ''}`}
      data-testid={`row-${block.id}`}
      style={{ gridTemplateColumns: `var(--left) repeat(${days}, ${COL}px)` }}
    >
      <div className="g-left">
        <div className="b-title">
          <strong>{block.id}</strong>
          <span className="muted">
            남은 {block.dueDay}일 · {block.requiredMH} MH
          </span>
          <span className={`tag ${block.materialReady ? '' : 'warn'}`}>{block.materialReady ? '자재 준비' : '자재 미준비'}</span>
        </div>
        <AssignedIcons block={block} a={a} />
        <div className={`progress ${pct >= 100 ? 'full' : res.mhByDue > 0 ? 'part' : ''}`}>
          <span style={{ width: `${Math.min(100, pct)}%` }} />
          <em>
            납기까지 {res.mhByDue} / {block.requiredMH} MH
          </em>
        </div>
      </div>
      <div className="g-track" style={{ gridColumn: `2 / span ${days}` }}>
        {Array.from({ length: days }, (_, i) => (
          <div key={i} className="g-cell" style={{ left: i * COL, width: COL }} />
        ))}
        <div className="due-line" style={{ left: block.dueDay * COL }} title={`납기: ${block.dueDay}일차 끝`} />
        {res.start !== null && <Bar block={block} res={res} />}
      </div>
    </div>
  );
}

export function GanttChart({ ev, days }: { ev: Evaluation; days: number }) {
  const blocks = useStore((s) => s.blocks);
  const assignments = useStore((s) => s.assignments);
  const planStart = useStore((s) => s.planStart);
  return (
    <div className="gantt" data-tour="gantt">
      <DayHeader days={days} planStart={planStart} label="블록 · 사전 요건 · 작업자" />
      {blocks.map((b) => (
        <BlockRow key={b.id} block={b} res={ev.blocks[b.id]} a={assignments[b.id]} days={days} />
      ))}
    </div>
  );
}
