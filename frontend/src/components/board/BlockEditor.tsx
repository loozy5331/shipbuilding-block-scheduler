import { useState } from 'react';
import { useStore } from '../../store/schedulerStore';
import { emptyAssignment } from '../../domain/types';
import { Modal } from '../common/Modal';
import { laneCount } from '../../domain/lanes';

/** 블록 하나의 착수일·인원·크레인·비상 자재를 숫자로 직접 편집 */
export function BlockEditor({ blockId, onClose }: { blockId: string; onClose(): void }) {
  const block = useStore((s) => s.blocks.find((b) => b.id === blockId))!;
  const assignments = useStore((s) => s.assignments);
  const r = useStore((s) => s.resources);
  const setAssignment = useStore((s) => s.setAssignment);
  const cur = assignments[blockId] ?? emptyAssignment(blockId);
  const lanes = laneCount(r);
  const [form, setForm] = useState({ lane: cur.lane ?? -1, start: cur.startDay ?? 1, general: cur.general, skilled: cur.skilled, crane: cur.crane, emergency: cur.emergency });
  const [error, setError] = useState('');

  const save = () => {
    const ints = [form.start, form.general, form.skilled];
    if (ints.some((v) => !Number.isInteger(v) || v < 0) || form.start < 1) return setError('착수일은 1 이상, 인원은 0 이상의 정수로 입력하세요.');
    if (form.general + form.skilled > r.maxCrewPerBlock) return setError(`블록당 최대 ${r.maxCrewPerBlock}명을 넘습니다.`);
    if (form.general > r.generalWorkers || form.skilled > r.skilledWorkers) return setError('보유 인원보다 많이 배정할 수 없습니다.');
    if (form.crane && r.cranes === 0) return setError('보유 크레인이 없습니다.');
    const otherEmergency = Object.values(assignments).filter((a) => a.emergency && a.blockId !== blockId).length;
    if (form.emergency && otherEmergency >= r.emergencyMaterials) return setError('비상 자재 배정 수가 보유량을 넘습니다.');
    setAssignment({ blockId, lane: form.lane >= 0 ? form.lane : undefined, startDay: form.start, general: form.general, skilled: form.skilled, crane: form.crane, emergency: !block.materialReady && form.emergency });
    onClose();
  };

  const num = (key: 'start' | 'general' | 'skilled', label: string, min: number) => (
    <label>
      {label}
      <input type="number" min={min} value={form[key]} onChange={(e) => setForm({ ...form, [key]: parseInt(e.target.value, 10) })} />
    </label>
  );

  return (
    <Modal title={`${blockId} · 직접 배치`} onClose={onClose}>
      <p className="muted">
        납기 {block.dueDay}일 · 필요 {block.requiredMH} MH · {block.materialReady ? '자재 준비' : '자재 미준비'}
      </p>
      <div className="edit-form">
        <label>
          작업장
          <select value={form.lane} onChange={(e) => setForm({ ...form, lane: parseInt(e.target.value, 10) })}>
            <option value={-1}>자동</option>
            {Array.from({ length: lanes }, (_, i) => (
              <option key={i} value={i}>
                작업장 {Math.floor(i / r.blocksPerWorkplace) + 1}
                {r.blocksPerWorkplace > 1 ? ` · 자리 ${(i % r.blocksPerWorkplace) + 1}` : ''}
              </option>
            ))}
          </select>
        </label>
        {num('start', '착수일(일차)', 1)}
        {num('general', '일반 작업자', 0)}
        {num('skilled', '숙련공', 0)}
      </div>
      <div className="edit-check">
        <label>
          <input type="checkbox" checked={form.crane} onChange={(e) => setForm({ ...form, crane: e.target.checked })} /> 크레인 1대
        </label>
        <label>
          <input type="checkbox" checked={form.emergency} disabled={block.materialReady} onChange={(e) => setForm({ ...form, emergency: e.target.checked })} /> 비상 자재 1개
        </label>
      </div>
      <p className="error-text" role="alert">
        {error}
      </p>
      <div className="dialog-actions">
        <button type="button" className="btn ghost" onClick={onClose}>
          취소
        </button>
        <button type="button" className="btn primary" onClick={save}>
          저장
        </button>
      </div>
    </Modal>
  );
}
