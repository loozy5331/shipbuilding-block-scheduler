import { useDraggable } from '@dnd-kit/core';
import type { ResourceKind } from '../../domain/types';
import { useStore } from '../../store/schedulerStore';
import { RESOURCE_LABEL, ResourceIcon } from '../icons/ResourceIcons';

function Chip({ kind, sub, disabled }: { kind: ResourceKind; sub: string; disabled: boolean }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: `res:${kind}`, data: { kind }, disabled });
  const selected = useStore((s) => s.selectedToken === kind);
  const selectToken = useStore((s) => s.selectToken);
  const showToast = useStore((s) => s.showToast);
  // 끌기 대신 클릭으로 고른 뒤 블록을 클릭해도 배정된다 (키보드: Enter)
  const onClick = () => {
    if (disabled) return showToast(kind === 'emergency' ? '남은 비상 자재가 없습니다.' : '보유량이 없습니다.');
    selectToken(selected ? null : kind);
    if (!selected) showToast('배정할 블록을 클릭하거나, 블록 줄에 초점을 두고 Enter를 누르세요.');
  };
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`chip ${disabled ? 'disabled' : ''} ${isDragging ? 'dragging' : ''} ${selected ? 'selected' : ''}`}
      data-testid={`chip-${kind}`}
      title={`${RESOURCE_LABEL[kind]}: 블록으로 끌어 놓거나, 클릭한 뒤 블록을 클릭하세요`}
      {...listeners}
      {...attributes}
      aria-pressed={selected}
      aria-disabled={disabled}
      onClick={onClick}
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
        아이콘을 블록(막대·대기 블록)에 끌어 놓거나, 아이콘을 클릭한 뒤 블록을 클릭하세요. 놓인 아이콘을 누르면 뺍니다. 막대를 좌우로 끌면 착수일, 위아래로 끌면 작업장이 바뀝니다.
      </p>
    </div>
  );
}
