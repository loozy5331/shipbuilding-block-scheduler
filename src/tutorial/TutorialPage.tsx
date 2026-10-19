import { useMemo, useState } from 'react';
import { evaluate } from '../domain/evaluate';
import { useStore } from '../store/schedulerStore';
import { dayToDate, formatMD } from '../io/dates';
import { CapacitySummary } from '../components/input/CapacitySummary';
import { BoardPage } from '../components/board/BoardPage';
import { TodayPanel } from '../components/result/TodayPanel';
import { TUTORIAL_TITLE } from './scenario';

/** 튜토리얼의 블록 작업 표 (읽기 전용) */
function BlockList() {
  const blocks = useStore((s) => s.blocks);
  const planStart = useStore((s) => s.planStart);
  return (
    <section className="panel" data-tour="blocks">
      <h3>블록 작업</h3>
      <div className="table-scroll">
        <table className="plain-table">
          <thead>
            <tr>
              <th>블록 ID</th>
              <th>납기</th>
              <th className="num">필요 작업 시간</th>
              <th>자재</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((b) => (
              <tr key={b.id}>
                <td>
                  <b>{b.id}</b>
                </td>
                <td>
                  {b.dueDay === 1 ? '오늘' : `${b.dueDay}일째`} <span className="muted">({formatMD(dayToDate(planStart, b.dueDay))})</span>
                </td>
                <td className="num">{b.requiredMH} MH</td>
                <td>{b.materialReady ? '준비' : <span className="tag warn">미준비</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ResourceList() {
  const r = useStore((s) => s.resources);
  const items = [
    ['작업장', `${r.workplaces}곳`],
    ['일반 작업자', `${r.generalWorkers}명 (하루 ${r.generalMHPerDay}MH)`],
    ['숙련공', `${r.skilledWorkers}명 (하루 ${r.skilledMHPerDay}MH)`],
    ['크레인', `${r.cranes}대`],
    ['비상 자재', `${r.emergencyMaterials}개`],
  ];
  return (
    <section className="panel" data-tour="resources">
      <h3>가용 자원</h3>
      <dl className="resource-list">
        {items.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** 튜토리얼 전용 한 페이지: 문제 → 블록·자원 → 배치 → TBM. 페이지를 오가지 않는다. */
export function TutorialPage() {
  const blocks = useStore((s) => s.blocks);
  const resources = useStore((s) => s.resources);
  const assignments = useStore((s) => s.assignments);
  const setStep = useStore((s) => s.setTutorialStep);
  const [day, setDay] = useState(1);
  const ev = useMemo(() => evaluate(blocks, resources, assignments), [blocks, resources, assignments]);

  return (
    <div className="board tutorial-page">
      <div className="board-head">
        <div>
          <span className="eyebrow-label">— 튜토리얼</span>
          <h1>{TUTORIAL_TITLE}</h1>
        </div>
        <div className="board-actions">
          <button type="button" className="btn ghost" onClick={() => setStep(null)}>
            튜토리얼 끝내기
          </button>
        </div>
      </div>
      <CapacitySummary />
      <div className="tutorial-grid">
        <BlockList />
        <ResourceList />
      </div>
      <BoardPage embedded />
      <TodayPanel ev={ev} day={day} onDay={setDay} maxDay={ev.horizon} />
    </div>
  );
}
