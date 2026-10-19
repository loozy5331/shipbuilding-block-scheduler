import { useDraggable } from '@dnd-kit/core';
import type { ResourceKind } from '../../domain/types';
import { useStore } from '../../store/schedulerStore';
import { RESOURCE_LABEL, ResourceIcon } from '../icons/ResourceIcons';

function Chip({ kind, sub, disabled }: { kind: ResourceKind; sub: string; disabled: boolean }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `res:${kind}`, data: { kind }, disabled });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`chip ${disabled ? 'disabled' : ''} ${isDragging ? 'dragging' : ''}`}
      data-testid={`chip-${kind}`}
      {...listeners}
      {...attributes}
    >
      <ResourceIcon kind={kind} size={30} />
      <span>
        <strong>{RESOURCE_LABEL[kind]}</strong>
        <small>{sub}</small>
      </span>
    </button>
  );
}

export function ResourcePalette() {
  const r = useStore((s) => s.resources);
  const assignments = useStore((s) => s.assignments);
  const emergencyUsed = Object.values(assignments).filter((a) => a.emergency).length;
  const emergencyLeft = r.emergencyMaterials - emergencyUsed;

  return (
    <div className="palette" data-tour="palette">
      <Chip kind="general" sub={`하루 ${r.generalWorkers}명`} disabled={r.generalWorkers === 0} />
      <Chip kind="skilled" sub={`하루 ${r.skilledWorkers}명`} disabled={r.skilledWorkers === 0} />
      <Chip kind="crane" sub={`${r.cranes}대`} disabled={r.cranes === 0} />
      <Chip kind="emergency" sub={`남은 ${Math.max(0, emergencyLeft)} / ${r.emergencyMaterials}개`} disabled={emergencyLeft <= 0} />
      <p className="palette-help">
        아이콘을 블록 줄로 끌어 놓고, 블록에 놓인 아이콘을 누르면 뺍니다. 막대는 좌우로 끌어 착수일을 옮깁니다.
      </p>
    </div>
  );
}
