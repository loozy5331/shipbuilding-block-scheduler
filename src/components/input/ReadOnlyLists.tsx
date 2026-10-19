import { useStore } from '../../store/schedulerStore';
import { dayToDate, formatMD } from '../../io/dates';

/** 블록 작업 표 (읽기 전용, 튜토리얼에서 사용) */
export function BlockList() {
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

/** 가용 자원 목록 (읽기 전용) */
export function ResourceList() {
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
