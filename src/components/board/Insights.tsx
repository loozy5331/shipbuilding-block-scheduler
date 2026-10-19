import type { Evaluation } from '../../domain/evaluate';
import type { SolveResponse } from '../../solver';
import { WHATIF_LABEL } from '../../solver/whatif';
import { useStore } from '../../store/schedulerStore';
import { StatCard } from '../common/StatCard';
import { LineIcon } from '../icons/LineIcons';

export function KpiCards({ ev }: { ev: Evaluation }) {
  const k = ev.kpi;
  return (
    <div className="stat-row kpis" data-tour="kpi">
      <StatCard icon="ship" label="블록 납기 준수" value={`${k.onTime} / ${k.total}`} unit="개" sub={`준수율 ${Math.round(k.onTimeRate * 100)}%`} tone={k.onTime === k.total ? 'good' : 'bad'} />
      <StatCard icon="clock" label="총 지연" value={k.totalLateDays} unit="블록·일" sub={k.notRunnable ? `미배치·착수 불가 ${k.notRunnable}개` : '미배치 없음'} tone={k.totalLateDays || k.notRunnable ? 'bad' : 'good'} />
      <StatCard icon="block" label="비상 자재" value={`${k.emergencyUsed} / ${k.emergencyCapacity}`} unit="개" sub="자재 미준비 블록에 사용" tone={k.emergencyUsed > k.emergencyCapacity ? 'bad' : undefined} />
      <StatCard icon="chart" label="자원 초과" value={k.overloadCells} unit="칸" sub={k.overloadCells ? `겹침 블록 ${k.conflicts}개 · 겹친 날 공수 불인정` : '모든 날 용량 안'} tone={k.overloadCells ? 'bad' : 'good'} />
    </div>
  );
}

/** 현재 자원으로 불가능할 때: 원인과 추가 자원 제안 (대응안 1: 추가 자원 투입) */
export function WhatIfCard({ solve }: { solve: SolveResponse }) {
  const setResource = useStore((s) => s.setResource);
  const resources = useStore((s) => s.resources);
  const k = solve.solutions.optimal.kpi;
  return (
    <section className="panel bad" data-tour="whatif">
      <h3>
        <LineIcon name="alert" /> 현재 자원으로는 {k.total - k.onTime}개 블록이 납기를 맞추지 못합니다
      </h3>
      {solve.capacity.issues.length > 0 && (
        <ul className="issues">
          {solve.capacity.issues.map((i, n) => (
            <li key={n}>{i.message}</li>
          ))}
        </ul>
      )}
      <h4>
        <LineIcon name="coins" size={18} /> 대응안 1 · 추가 자원 투입
      </h4>
      {solve.whatIf.length === 0 ? (
        <p className="muted">자원을 하나씩(최대 3) 늘려도 개선되지 않습니다. 납기 조정이나 블록 분할을 검토하세요.</p>
      ) : (
        <ul className="whatif">
          {solve.whatIf.map((w) => (
            <li key={w.key}>
              <span>
                <b>
                  {WHATIF_LABEL[w.key].name} +{w.added}
                  {WHATIF_LABEL[w.key].unit}
                </b>{' '}
                → {w.kpi.onTime}/{w.kpi.total} 납기 준수{w.resolves ? ' ✓ 해소' : ` (지연 ${w.kpi.totalLateDays}일)`}
              </span>
              <button type="button" className="btn small ghost" onClick={() => setResource(w.key, resources[w.key] + w.added)}>
                반영
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
