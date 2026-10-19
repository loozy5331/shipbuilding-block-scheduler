import { useStore } from '../../store/schedulerStore';
import { Stepper } from '../common/Stepper';
import type { Resources } from '../../domain/types';

/** 가용 자원 목록. 튜토리얼에서는 readOnly로 같은 목록을 값만 보여 준다. */
export function ResourceForm({ readOnly = false }: { readOnly?: boolean }) {
  const r = useStore((s) => s.resources);
  const set = useStore((s) => s.setResource);
  const row = (key: keyof Resources, label: string, unit: string, hint?: string, min = 0) => (
    <div key={key}>
      <dt>
        {label}
        {hint && <small>{hint}</small>}
      </dt>
      <dd>
        {readOnly ? (
          `${r[key]}${unit}`
        ) : (
          <Stepper label={label} unit={unit} value={r[key]} min={min} onChange={(v) => set(key, v)} />
        )}
      </dd>
    </div>
  );

  return (
    <>
      <dl className="resource-list">
        {row('workplaces', '작업장 수', '곳')}
        {row('blocksPerWorkplace', '동시 처리 블록 수', '블록/작업장', '작업장 한 곳에 함께 올리는 블록', 1)}
        {row('generalWorkers', '일반 작업자', '명', `하루 ${r.generalMHPerDay} MH`)}
        {row('skilledWorkers', '숙련공', '명', `하루 ${r.skilledMHPerDay} MH`)}
        {row('cranes', '크레인', '대', '블록마다 1대')}
        {row('emergencyMaterials', '비상 자재', '개', '자재 미준비 블록에')}
      </dl>
      {!readOnly && (
        <details className="advanced">
          <summary>세부 설정</summary>
          <dl className="resource-list">
            {row('generalMHPerDay', '일반 작업자 하루 MH', 'MH', '숙련도: 기본 8', 1)}
            {row('skilledMHPerDay', '숙련공 하루 MH', 'MH', '숙련도: 기본 12', 1)}
            {row('maxCrewPerBlock', '블록당 최대 인원', '명', '한 블록에 동시에 붙는 인원 상한', 1)}
          </dl>
        </details>
      )}
    </>
  );
}
