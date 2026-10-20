import { useMemo } from 'react';
import { useStore } from '../../store/schedulerStore';
import { useCalendar } from '../../store/evaluation';
import { checkCapacity } from '../../solver/feasibility';
import { LineIcon } from '../icons/LineIcons';

/** 공통 설정 입력의 상태 칸: 판정이 먼저, 그 아래 "해야 할 작업은 많은데, 사용할 수 있는 시간은 부족했다" 비교 */
export function CapacitySummary() {
  const blocks = useStore((s) => s.blocks);
  const resources = useStore((s) => s.resources);
  const cal = useCalendar();
  const c = useMemo(() => checkCapacity(blocks, resources, cal), [blocks, resources, cal]);
  const ratio = c.dailyCapacityMH > 0 ? c.totalMH / c.dailyCapacityMH : Infinity;
  const max = Math.max(c.totalMH, c.dailyCapacityMH, 1);

  return (
    <section className="capacity" data-tour="summary">
      {blocks.length === 0 ? (
        <div className="verdict empty">
          <LineIcon name="clipboard" size={22} />
          <div>
            <strong>블록 작업을 입력하세요</strong>
            <p>입력하면 지금 자원으로 납기를 맞출 수 있는지 바로 판정합니다.</p>
          </div>
        </div>
      ) : (
        <div className={`verdict ${c.possible ? 'maybe' : 'bad'}`}>
          <LineIcon name={c.possible ? 'bulb' : 'alert'} size={22} />
          <div>
            <strong>{c.possible ? '납기 준수 가능성 있음' : '전 블록 납기 준수 불가능'}</strong>
            <p>
              {Number.isFinite(ratio) ? `하루 가용 자원 대비 작업량 ${ratio.toFixed(1)}배. ` : '가용 자원이 없습니다. '}
              {c.possible ? '배치 순서에 따라 납기를 맞출 수 있습니다.' : '현재 자원으로는 전 블록 납기 준수가 불가능합니다.'}
            </p>
            {c.issues.length > 0 && (
              <details open={c.issues.length <= 2}>
                <summary>확인할 점 {c.issues.length}건</summary>
                <ul>
                  {c.issues.map((i, k) => (
                    <li key={k}>
                      {i.message} {i.blockIds.length <= 6 && <em>({i.blockIds.join(', ')})</em>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
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
          <dt>전체 필요 작업시간</dt>
          <dd>
            {c.totalMH}
            <small>MH</small>
          </dd>
          <span className="mh-bar need" style={{ width: `${(c.totalMH / max) * 100}%` }} />
        </div>
        <div className="mh">
          <dt>하루 가용 작업시간</dt>
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
