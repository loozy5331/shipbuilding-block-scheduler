import { evaluate, type Evaluation } from '../../domain/evaluate';
import type { Policy } from '../../domain/types';
import type { SolveResponse } from '../../solver';
import { WHATIF_LABEL } from '../../solver/whatif';
import { useStore } from '../../store/schedulerStore';
import { StatCard } from '../common/StatCard';
import { LineIcon } from '../icons/LineIcons';
import { samePlan } from '../../domain/lanes';

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

const POLICY: Record<Policy, { name: string; desc: string; icon: 'ship' | 'sort' | 'check' }> = {
  input: { name: '입력 순서', desc: '목록(선박) 순서대로 배치', icon: 'ship' },
  edd: { name: '납기 빠른 순', desc: '납기가 급한 블록부터 배치', icon: 'sort' },
  optimal: { name: '최적화', desc: '순서·인원 구성을 탐색해 지연 최소화', icon: 'check' },
};

/** 발표 자료 "변경 전 / 변경 후" 비교 */
export function PolicyCompare({ solve }: { solve: SolveResponse }) {
  const assignments = useStore((s) => s.assignments);
  const apply = useStore((s) => s.applyAssignments);
  const blocks = useStore((s) => s.blocks);
  const resources = useStore((s) => s.resources);
  return (
    <section className="panel" data-tour="policy">
      <h3>
        <span className="eyebrow" /> 배치 정책 비교
      </h3>
      <div className="policy-grid">
        {(Object.keys(POLICY) as Policy[]).map((p) => {
          const sol = solve.solutions[p];
          const ev = evaluate(blocks, resources, sol.assignments);
          const warn = blocks.filter((b) => ev.blocks[b.id].status !== 'ok').map((b) => b.id);
          const active = samePlan(assignments, sol.assignments);
          return (
            <div key={p} className={`policy ${active ? 'active' : ''} ${sol.feasible ? 'good' : 'bad'}`}>
              <div className="policy-head">
                <LineIcon name={POLICY[p].icon} />
                <strong>{POLICY[p].name}</strong>
                {active && <span className="pill">적용 중</span>}
              </div>
              <small className="muted">{POLICY[p].desc}</small>
              <div className="policy-kpi">
                <b>{sol.kpi.onTime}</b>/{sol.kpi.total} 납기 준수 · 지연 {sol.kpi.totalLateDays}일
              </div>
              {warn.length > 0 && (
                <div className="policy-warn">
                  <LineIcon name="alert" size={14} /> 경고 대상: {warn.join(', ')}
                </div>
              )}
              <button type="button" className="btn small" disabled={active} onClick={() => apply(sol.assignments)} data-testid={`apply-${p}`}>
                이 배치 적용
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** 대응안 1: 추가 자원 투입 */
export function WhatIfCard({ solve }: { solve: SolveResponse }) {
  const setResource = useStore((s) => s.setResource);
  const resources = useStore((s) => s.resources);
  if (solve.solutions.optimal.feasible) {
    return (
      <section className="panel good" data-tour="whatif">
        <h3>
          <LineIcon name="check" /> 현재 가용 자원으로 전 블록 납기 준수가 가능합니다
        </h3>
        <p className="muted">추가 비용 없이 작업 순서·인원 배치만으로 해결됩니다. (대응안 2: 작업 우선순위 변경)</p>
      </section>
    );
  }
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
