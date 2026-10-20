import { useEffect, useState } from 'react';
import { useCalendar, useEvaluation } from '../../store/evaluation';
import { verdictText } from '../../domain/labels';
import { laneCount, workplaceOf } from '../../domain/lanes';
import { useStore } from '../../store/schedulerStore';
import { runSolve } from '../../store/actions';
import { exportSchedule } from '../../io/excel';
import { dayToDate, formatMD } from '../../io/dates';
import { LineIcon } from '../icons/LineIcons';
import { TodayPanel } from './TodayPanel';
import { ReportCard } from './ReportCard';
import { DueShift } from '../common/DueShift';
import { delayCauses } from '../../domain/causes';
import { materialText } from '../../domain/labels';

/** ⑤ 블록 스케줄 결과: 최적 대비 평가 → 배치표 → 날짜별 작업·TBM, 엑셀 저장 */
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
  const cal = useCalendar();
  const expert = mode !== 'novice';
  const lanes = laneCount(resources);
  const date = (d: number | null) => (d === null ? '-' : formatMD(dayToDate(planStart, d)));
  const wpOf = (id: string) => {
    const lane = assignments[id]?.lane;
    return ev.blocks[id].start !== null && lane !== undefined && lane < lanes ? workplaceOf(lane, resources) : null;
  };
  const usedWorkplaces = new Set(blocks.map((b) => wpOf(b.id)).filter((w) => w !== null)).size;
  const rows = [...blocks].sort((a, b) => (ev.blocks[a.id].start ?? Infinity) - (ev.blocks[b.id].start ?? Infinity) || a.id.localeCompare(b.id));

  // 평가서에 필요한 최적 배치
  useEffect(() => {
    if (!solve && blocks.length > 0) runSolve(null).catch(() => undefined);
  }, [solve, blocks, resources]);

  return (
    <div className="board result">
      <div className="board-head">
        <div>
          <span className="eyebrow-label">— 결과</span>
          <h1>
            블록 스케줄 결과 · 납기 준수{' '}
            <em className={ev.kpi.onTime === ev.kpi.total ? '' : 'bad'}>
              {ev.kpi.onTime}/{ev.kpi.total}
            </em>
          </h1>
          <p className="result-sub muted" data-testid="result-sub">
            블록 {blocks.length}개
            {ev.kpi.makespan > 0 && (
              <>
                {' '}
                · {date(1)} ~ {date(ev.kpi.makespan)} ({ev.kpi.makespan}일)
              </>
            )}{' '}
            · 작업장 {usedWorkplaces}/{resources.workplaces}곳 사용
          </p>
        </div>
        <div className="board-actions">
          <button type="button" className="btn ghost" onClick={() => setPage('schedule')}>
            ← 블록 스케줄링
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => exportSchedule(blocks, resources, assignments, planStart, { optimal: solve?.solutions.optimal.assignments, hintCount: expert ? undefined : hintCount, cal })}
          >
            <LineIcon name="download" size={16} /> 엑셀 저장
          </button>
        </div>
      </div>

      <ReportCard ev={ev} solve={solve} hintCount={expert ? null : hintCount} />

      <section className="panel">
        <h3>
          <LineIcon name="clipboard" /> 배치표 <small className="muted">착수 순</small>
        </h3>
        <div className="table-scroll">
          <table className="report-table plan-table" data-testid="plan-table">
            <thead>
              <tr>
                <th>블록</th>
                <th>판정</th>
                <th>작업장</th>
                <th>작업 기간</th>
                <th>납기</th>
                <th>투입 인원</th>
                <th>크레인·비상 자재</th>
                <th>지연 원인</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const a = assignments[b.id];
                const x = ev.blocks[b.id];
                const wp = wpOf(b.id);
                const crew = [a?.general && `일반 ${a.general}`, a?.skilled && `숙련 ${a.skilled}`].filter(Boolean).join(' · ');
                const causes = delayCauses(b, ev, assignments, cal, (d) => date(d));
                return (
                  <tr key={b.id}>
                    <th scope="row">{b.id}</th>
                    <td>
                      <span className={`status-chip ${x.status}`}>{verdictText(x)}</span>
                    </td>
                    <td>{wp === null ? '-' : `작업장 ${wp + 1}`}</td>
                    <td>
                      {x.start === null ? '-' : x.start === x.end ? date(x.start) : `${date(x.start)} ~ ${date(x.end)}`}
                      {x.duration ? <small className="muted"> ({x.duration}일)</small> : null}
                    </td>
                    <td>
                      {date(x.due)}
                      <DueShift block={b} due={x.due} />
                      {x.status === 'ok' && <small className="muted"> ({x.slackDays > 0 ? `여유 ${x.slackDays}일` : '당일 완료'})</small>}
                    </td>
                    <td>{crew || '-'}</td>
                    <td>{[a?.crane && '크레인', a?.emergency && '비상 자재'].filter(Boolean).join(' · ') || '-'}</td>
                    <td className="causes">
                      {causes.length ? (
                        <ul>
                          {causes.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="muted">{b.materialDay !== undefined ? materialText(b, (d) => date(d)) : '-'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <TodayPanel ev={ev} day={day} onDay={setDay} maxDay={ev.horizon} />
    </div>
  );
}
