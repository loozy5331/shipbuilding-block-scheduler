import type { Evaluation } from '../../domain/evaluate';
import { compareReport, judge } from '../../domain/report';
import type { SolveResponse } from '../../solver';
import { LineIcon } from '../icons/LineIcons';

const MARK = { better: '▲ 더 좋음', same: '= 같음', worse: '▼ 부족' } as const;

/** 핵심 지표와 최적 배치 대비 평가를 한 카드에 (지표마다 현재 값 아래에 최적 값과 판정) */
export function ReportCard({ ev, solve, hintCount }: { ev: Evaluation; solve: SolveResponse | null; hintCount: number | null }) {
  const k = ev.kpi;
  // 최적 배치를 아직 계산 중이면 현재 값만 보여 준다
  const rows = compareReport(k, solve?.solutions.optimal.kpi ?? k);
  const worse = solve ? rows.filter((r) => judge(r) === 'worse').length : 0;
  const notes = [
    k.notRunnable > 0 && `미배치·착수 불가 ${k.notRunnable}개`,
    k.conflicts > 0 && `자원 겹침 블록 ${k.conflicts}개 (겹친 날 공수는 인정하지 않음)`,
    hintCount !== null && `힌트 사용 ${hintCount}회`,
  ].filter(Boolean);

  return (
    <section className={`panel report ${solve && worse === 0 ? 'good' : ''}`} data-tour="report" data-testid="report">
      <div className="report-head">
        <h3>
          <LineIcon name="chart" /> 최적 배치 대비 평가
        </h3>
        <p className={worse ? 'bad' : ''}>
          {!solve ? '최적 배치를 계산하고 있습니다.' : worse === 0 ? '현재 배치가 최적 배치와 같은 수준입니다.' : `최적 배치보다 부족한 항목이 ${worse}개 있습니다.`}
        </p>
      </div>
      <div className="metric-grid" data-tour="kpi">
        {rows.map((r) => {
          const j = solve ? judge(r) : null;
          return (
            <div key={r.label} className={`metric ${j ?? ''}`}>
              <span className="metric-label">{r.label}</span>
              <span className="metric-value">
                {r.current}
                {r.of !== undefined && ` / ${r.of}`}
                <small>{r.unit}</small>
              </span>
              {j && (
                <span className="metric-cmp">
                  최적 {r.optimal}
                  {r.unit} · <b>{MARK[j]}</b>
                </span>
              )}
            </div>
          );
        })}
      </div>
      {notes.length > 0 && <p className="report-notes muted">{notes.join(' · ')}</p>}
    </section>
  );
}
