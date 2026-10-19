import { useDraggable } from '@dnd-kit/core';
import type { Assignment, Block, ResourceKind } from '../../domain/types';
import { nominalDuration, type BlockResult } from '../../domain/evaluate';
import { REASON_LABEL } from '../../domain/labels';
import { workplaceOf } from '../../domain/lanes';
import { useStore } from '../../store/schedulerStore';
import { CraneIcon, MaterialIcon, SkilledIcon, WorkerIcon } from '../icons/ResourceIcons';
import { COL } from './ganttLayout';

function statusText(res: BlockResult): string | null {
  if (res.status === 'blocked') return `착수 불가 · ${res.blockedReasons.map((r) => REASON_LABEL[r]).join(', ')}`;
  if (res.status === 'conflict') return `${res.laneClash ? '작업장 겹침' : '자원 겹침'}${res.lateDays ? ` · ${res.lateDays}일 지연` : ''}`;
  if (res.status === 'late') return `납기 ${res.lateDays}일 지연`;
  return null;
}

export function blockTitle(block: Block, res: BlockResult) {
  const when = res.start !== null ? `${res.start}일 착수${res.end ? ` → ${res.end}일 끝` : ''}` : '미배치';
  return `${block.id}: ${when}. 남은 ${block.dueDay}일 · ${block.requiredMH} MH · ${block.materialReady ? '자재 준비' : '자재 미준비'} · 납기까지 ${res.mhByDue}/${block.requiredMH} MH`;
}

/** 배정된 자원 아이콘. 누르면 뺀다. 필요한데 없는 크레인·비상 자재는 흐린 자리로 보여 준다. */
export function AssignedIcons({ block, a, size = 16 }: { block: Block; a: Assignment | undefined; size?: number }) {
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

interface BarProps {
  block: Block;
  res: BlockResult;
  a: Assignment;
  days: number;
  workplaces: number;
  onEdit(id: string): void;
}

/** 작업 기간 막대. 좌우로 끌면 착수일, 위아래로 다른 작업장 테두리 안에 놓으면 작업장이 바뀐다. */
export function Bar({ block, res, a, days, workplaces, onEdit }: BarProps) {
  const moveToWorkplace = useStore((s) => s.moveToWorkplace);
  const moveBlock = useStore((s) => s.moveBlock);
  const resources = useStore((s) => s.resources);
  const start = res.start ?? 1;
  const drag = useDraggable({ id: `bar:${block.id}`, data: { blockId: block.id, start } });
  const length = Math.max(1, Math.min(res.duration ?? 1, days - start + 1));
  const shift = drag.transform ? Math.round(drag.transform.x / COL) : 0;
  const status = statusText(res);
  const cls = ['g-bar', res.status, res.lateDays > 0 && 'is-late', res.overloaded && 'overloaded', drag.isDragging && 'dragging', length === 1 && 'short']
    .filter(Boolean)
    .join(' ');

  if (start > days) {
    return (
      <div className="g-bar out-of-range" style={{ left: (days - 1) * COL + 3, width: COL - 6 }}>
        {start}일 착수 →
      </div>
    );
  }

  return (
    <div
      ref={drag.setNodeRef}
      className={cls}
      data-testid={`bar-${block.id}`}
      data-day={drag.isDragging ? `${Math.max(1, start + shift)}일 착수` : undefined}
      title={`${blockTitle(block, res)}. 좌우로 끌면 착수일, 다른 작업장으로 끌면 작업장이 바뀝니다`}
      style={{
        left: (start - 1) * COL + 3,
        width: length * COL - 6,
        transform: drag.transform ? `translate(${drag.transform.x}px, ${drag.transform.y}px)` : undefined,
      }}
      {...drag.listeners}
      {...drag.attributes}
      aria-label={`${block.id} ${start}일 착수. 좌우 방향키로 착수일, 위아래로 작업장 이동, Enter로 편집`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          moveBlock(block.id, start + (e.key === 'ArrowRight' ? 1 : -1));
        } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && a.lane !== undefined) {
          e.preventDefault();
          const wp = workplaceOf(a.lane, resources) + (e.key === 'ArrowDown' ? 1 : -1);
          if (wp >= 0 && wp < workplaces) moveToWorkplace(block.id, start, wp);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          onEdit(block.id);
        }
      }}
    >
      {status ?? (length === 1 ? `${res.duration}일 · ${res.dailyMH}MH` : `${res.duration}일 · 하루 ${res.dailyMH} MH`)}
    </div>
  );
}

/** 아직 배치하지 않은 블록의 점선 막대: 1일 착수, 필요 작업시간 ÷ 8시간 길이. 작업장 테두리로 끌어 놓으면 배치된다. */
export function GhostBar({ block, days }: { block: Block; days: number }) {
  const r = useStore((s) => s.resources);
  const drag = useDraggable({ id: `wait:${block.id}`, data: { blockId: block.id, start: 1 } });
  const nominal = nominalDuration(block.requiredMH, r);
  const length = Math.min(nominal, days);
  const shift = drag.transform ? Math.round(drag.transform.x / COL) : 0;
  return (
    <div
      ref={drag.setNodeRef}
      className={`g-bar ghost ${length === 1 ? 'short' : ''} ${drag.isDragging ? 'dragging' : ''}`}
      data-testid={`ghost-${block.id}`}
      data-day={drag.isDragging ? `${1 + shift}일 착수` : undefined}
      title={`${block.id}: 필요 ${block.requiredMH} MH = 작업자 1명(하루 ${r.generalMHPerDay}MH) 기준 ${nominal}일. 작업장 테두리 안으로 끌어 놓으면 배치되고, 작업자를 놓을수록 짧아집니다`}
      style={{ left: 3, width: length * COL - 6, transform: drag.transform ? `translate(${drag.transform.x}px, ${drag.transform.y}px)` : undefined }}
      {...drag.listeners}
      {...drag.attributes}
      aria-label={`${block.id} 대기 블록. 작업장으로 끌어 놓아 배치`}
    >
      {block.requiredMH}MH · {nominal}일
    </div>
  );
}
