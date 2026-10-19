import { useStore } from '../../store/schedulerStore';
import { Stepper } from '../common/Stepper';
import type { Resources } from '../../domain/types';

export function ResourceForm() {
  const r = useStore((s) => s.resources);
  const set = useStore((s) => s.setResource);
  const field = (key: keyof Resources, label: string, unit: string, hint?: string, min = 0) => (
    <Stepper key={key} label={label} hint={hint} unit={unit} value={r[key]} min={min} onChange={(v) => set(key, v)} />
  );

  return (
    <div data-tour="resources">
      <div className="resource-grid">
        {field('workplaces', '작업장 수', '곳')}
        {field('blocksPerWorkplace', '동시 처리 블록 수', '블록/작업장', '작업장 한 곳에 함께 올리는 블록', 1)}
        {field('generalWorkers', '일반 작업자', '명', `하루 ${r.generalMHPerDay} MH`)}
        {field('skilledWorkers', '숙련공', '명', `하루 ${r.skilledMHPerDay} MH`)}
        {field('cranes', '크레인', '대', '블록마다 1대')}
        {field('emergencyMaterials', '비상 자재', '개', '자재 미준비 블록에')}
      </div>
      <details className="advanced">
        <summary>세부 설정</summary>
        <div className="resource-grid">
          {field('generalMHPerDay', '일반 작업자 하루 MH', 'MH', '숙련도: 기본 8', 1)}
          {field('skilledMHPerDay', '숙련공 하루 MH', 'MH', '숙련도: 기본 12', 1)}
          {field('maxCrewPerBlock', '블록당 최대 인원', '명', '한 블록에 동시에 붙는 인원 상한', 1)}
        </div>
      </details>
    </div>
  );
}
