import { useMemo } from 'react';
import { useStore } from '../../store/schedulerStore';
import { checkCapacity } from '../../solver/feasibility';
import { StatCard } from '../common/StatCard';
import { LineIcon } from '../icons/LineIcons';

/** 발표 자료 "해야 할 작업은 많은데, 사용할 수 있는 시간은 부족했다" 카드 */
export function CapacitySummary() {
  const blocks = useStore((s) => s.blocks);
  const resources = useStore((s) => s.resources);
  const c = useMemo(() => checkCapacity(blocks, resources), [blocks, resources]);
  const ratio = c.dailyCapacityMH > 0 ? c.totalMH / c.dailyCapacityMH : Infinity;

  return (
    <section className="capacity" data-tour="summary">
      <div className="stat-row">
        <StatCard icon="clipboard" label="배정 대기 작업" value={blocks.length} unit="건" />
        <StatCard icon="clock" label="하루 가용 작업시간" value={c.dailyCapacityMH} unit="MH" sub={c.dailyCapacityMH < c.workforceMH ? `인력 ${c.workforceMH}MH 중 작업장·크레인 제약 반영` : '인력 기준'} />
        <StatCard icon="gear" label="전체 필요 작업시간" value={c.totalMH} unit="MH" />
      </div>
      {blocks.length > 0 && (
        <div className={`verdict ${c.possible ? 'maybe' : 'bad'}`}>
          <LineIcon name={c.possible ? 'bulb' : 'alert'} size={22} />
          <div>
            <strong>
              {Number.isFinite(ratio) ? `하루 가용 자원 대비 작업량 ${ratio.toFixed(1)}배` : '가용 자원이 없습니다'}
              {c.possible ? ' — 배치 순서에 따라 납기 준수 가능성이 있습니다.' : ' — 현재 자원으로는 전 블록 납기 준수가 불가능합니다.'}
            </strong>
            {c.issues.length > 0 && (
              <ul>
                {c.issues.map((i, k) => (
                  <li key={k}>
                    {i.message} {i.blockIds.length <= 6 && <em>({i.blockIds.join(', ')})</em>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
