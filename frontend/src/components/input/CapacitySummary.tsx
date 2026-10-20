import { useMemo } from 'react';
import { useStore } from '../../store/schedulerStore';
import { useCalendar } from '../../store/evaluation';
import { checkCapacity } from '../../solver/feasibility';
import { LineIcon } from '../icons/LineIcons';
import { Term } from '../common/InfoTip';

/** 공통 설정 입력의 상태 칸: "해야 할 작업은 많은데, 사용할 수 있는 시간은 부족했다" 비교 */
export function CapacitySummary() {
  const blocks = useStore((s) => s.blocks);
  const resources = useStore((s) => s.resources);
  const cal = useCalendar();
  const c = useMemo(() => checkCapacity(blocks, resources, cal), [blocks, resources, cal]);
  const max = Math.max(c.totalMH, c.dailyCapacityMH, 1);

  return (
    <section className="capacity" data-tour="summary">
      {/* 납기 준수 여부는 여기서 어림하지 않는다: 실제 배치(블록 스케줄링) 판정과 어긋나기 때문 */}
      {blocks.length === 0 && (
        <div className="verdict empty">
          <LineIcon name="clipboard" size={22} />
          <div>
            <strong>블록 작업을 입력하세요</strong>
            <p>납기 준수 여부는 다음 단계인 블록 스케줄링에서 실제 배치로 판정합니다.</p>
          </div>
        </div>
      )}

      <dl className="side-stats">
        <div>
          <dt>배정 대기 작업</dt>
          <dd>
            {blocks.length}
            <small>건</small>
          </dd>
        </div>
        <div className="mh">
          <dt>
            전체 필요 작업시간 <Term k="totalMH" />
          </dt>
          <dd>
            {c.totalMH}
            <small>MH</small>
          </dd>
          <span className="mh-bar need" style={{ width: `${(c.totalMH / max) * 100}%` }} />
        </div>
        <div className="mh">
          <dt>
            하루 가용 작업시간 <Term k="dailyMH" />
          </dt>
          <dd>
            {c.dailyCapacityMH}
            <small>MH</small>
          </dd>
          <span className="mh-bar cap" style={{ width: `${(c.dailyCapacityMH / max) * 100}%` }} />
          <small className="muted">{c.dailyCapacityMH < c.workforceMH ? `인력 ${c.workforceMH}MH 중 작업장·크레인 제약 반영` : '인력 기준'}</small>
        </div>
      </dl>
    </section>
  );
}
