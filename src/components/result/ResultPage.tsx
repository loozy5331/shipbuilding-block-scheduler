import { useEffect, useState } from 'react';
import { useEvaluation } from '../../store/evaluation';
import { verdictText } from '../../domain/labels';
import { laneCount, workplaceOf } from '../../domain/lanes';
import { useStore } from '../../store/schedulerStore';
import { runSolve } from '../../store/actions';
import { exportSchedule } from '../../io/excel';
import { dayToDate, formatMD } from '../../io/dates';
import { LineIcon } from '../icons/LineIcons';
import { KpiCards } from '../board/Insights';
import { TodayPanel } from './TodayPanel';
import { ReportCard } from './ReportCard';

/** ⑤ 블록 스케줄 결과: 배치표, 오늘 작업·TBM, 최적 대비 평가서, 엑셀 저장 */
export function ResultPage() {
  const blocks = useStore((s) => s.blocks);
  const resources = useStore((s) => s.resources);
  const assignments = useStore((s) => s.assignments);
  const planStart = useStore((s) => s.planStart);
  const solve = useStore((s) => s.solve);
  const mode = useStore((s) => s.mode);
  const hintCount = useStore((s) => s.hintCount);
  const setPage = useStore((s) => s.setPage);
  const [day, setDay] = useState(1);
  const ev = useEvaluation();
  const expert = mode !== 'novice';
  const lanes = laneCount(resources);
  const date = (d: number | null) => (d === null ? '-' : formatMD(dayToDate(planStart, d)));

  // 평가서에 필요한 최적 배치
  useEffect(() => {
    if (!solve && blocks.length > 0) runSolve(null).catch(() => undefined);
  }, [solve, blocks, resources]);

  return (
    <div className="board">
      <div className="board-head">
        <div>
          <span className="eyebrow-label">— 결과</span>
          <h1>
            블록 스케줄 결과 · 납기 준수{' '}
            <em className={ev.kpi.onTime === ev.kpi.total ? '' : 'bad'}>
              {ev.kpi.onTime}/{ev.kpi.total}
            </em>
          </h1>
        </div>
        <div className="board-actions">
          <button type="button" className="btn ghost" onClick={() => setPage('schedule')}>
            ← 블록 스케줄링
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => exportSchedule(blocks, resources, assignments, planStart, { optimal: solve?.solutions.optimal.assignments, hintCount: expert ? undefined : hintCount })}
          >
            <LineIcon name="download" size={16} /> 엑셀 저장
          </button>
        </div>
      </div>

      <KpiCards ev={ev} />

      <section className="panel">
        <h3>
          <LineIcon name="clipboard" /> 배치표
        </h3>
        <div className="table-scroll">
          <table className="report-table plan-table" data-testid="plan-table">
            <thead>
              <tr>
                <th>블록 ID</th>
                <th>작업장</th>
                <th>작업 기간</th>
                <th>작업자 수</th>
                <th>크레인·비상 자재</th>
                <th>판정</th>
              </tr>
            </thead>
            <tbody>
              {[...blocks]
                .sort((a, b) => (ev.blocks[a.id].start ?? Infinity) - (ev.blocks[b.id].start ?? Infinity) || a.id.localeCompare(b.id))
                .map((b) => {
                  const a = assignments[b.id];
                  const x = ev.blocks[b.id];
                  return (
                    <tr key={b.id} className={x.status === 'ok' ? '' : 'worse'}>
                      <td>
                        <b>{b.id}</b>
                      </td>
                      <td>{x.start !== null && a?.lane !== undefined && a.lane < lanes ? `작업장 ${workplaceOf(a.lane, resources) + 1}` : '-'}</td>
                      <td>
                        {x.start === null ? '-' : `${date(x.start)} ~ ${date(x.end)}`}
                        {x.duration ? <small className="muted"> ({x.duration}일)</small> : null}
                      </td>
                      <td>
                        {(a?.general ?? 0) + (a?.skilled ?? 0)}명
                        {a?.skilled ? <small className="muted"> (숙련 {a.skilled})</small> : null}
                      </td>
                      <td>{[a?.crane && '크레인', a?.emergency && '비상 자재'].filter(Boolean).join(' · ') || '-'}</td>
                      <td>{verdictText(x)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 한 줄: 왼쪽 최적 대비 평가서, 오른쪽 TBM 메시지 */}
      <div className="result-row">
        {solve ? (
          <ReportCard ev={ev} solve={solve} hintCount={expert ? null : hintCount} />
        ) : (
          <div className="panel muted-panel">
            <LineIcon name="bulb" />
            <span>최적 배치를 계산하고 있습니다.</span>
          </div>
        )}
        <TodayPanel ev={ev} day={day} onDay={setDay} maxDay={ev.horizon} />
      </div>
    </div>
  );
}
