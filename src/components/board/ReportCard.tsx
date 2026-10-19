import type { Evaluation } from '../../domain/evaluate';
import { compareReport, judge } from '../../domain/report';
import type { SolveResponse } from '../../solver';
import { LineIcon } from '../icons/LineIcons';

const MARK = { better: '▲ 최적보다 좋음', same: '= 최적과 같음', worse: '▼ 최적보다 나쁨' } as const;

/** 현재 배치와 최적 배치의 차이 평가서 */
export function ReportCard({ ev, solve, hintCount }: { ev: Evaluation; solve: SolveResponse; hintCount: number | null }) {
  const rows = compareReport(ev.kpi, solve.solutions.optimal.kpi);
  const worse = rows.filter((r) => judge(r) === 'worse').length;
  return (
    <section className={`panel report ${worse ? '' : 'good'}`} data-tour="report" data-testid="report">
      <h3>
        <LineIcon name="chart" /> 최적 배치 대비 평가서
      </h3>
      <p className="muted">{worse === 0 ? '현재 배치가 최적 배치와 같은 수준입니다.' : `최적 배치보다 부족한 항목이 ${worse}개 있습니다.`}</p>
      <table className="report-table">
        <thead>
          <tr>
            <th>항목</th>
            <th>현재</th>
            <th>최적</th>
            <th>판정</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const j = judge(r);
            return (
              <tr key={r.label} className={j}>
                <td>
                  {r.label} <small className="muted">({r.higherIsBetter ? '클수록 좋음' : '작을수록 좋음'})</small>
                </td>
                <td>
                  {r.current}
                  {r.unit}
                </td>
                <td>
                  {r.optimal}
                  {r.unit}
                </td>
                <td>{MARK[j]}</td>
              </tr>
            );
          })}
          {hintCount !== null && (
            <tr>
              <td>힌트 사용</td>
              <td colSpan={3}>{hintCount}회</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
