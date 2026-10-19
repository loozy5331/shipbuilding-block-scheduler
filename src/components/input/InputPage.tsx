import { useStore } from '../../store/schedulerStore';
import { BlockSource } from './BlockSource';
import { BlockTable } from './BlockTable';
import { CapacitySummary } from './CapacitySummary';
import { ResourceForm } from './ResourceForm';

export function InputPage() {
  const blocks = useStore((s) => s.blocks);
  const planStart = useStore((s) => s.planStart);
  const setPlanStart = useStore((s) => s.setPlanStart);
  const setPage = useStore((s) => s.setPage);
  const hasDup = new Set(blocks.map((b) => b.id)).size !== blocks.length || blocks.some((b) => !b.id);

  return (
    <div className="paper">
      <header className="paper-head">
        <div>
          <small className="muted">조립 공정 생산관리</small>
          <h1>블 록 일 정 입 력</h1>
          <div className="paper-meta">
            <span>
              블록 <b>{blocks.length}개</b>
            </span>
            <label>
              계획 시작일(오늘){' '}
              <input type="date" value={planStart} onChange={(e) => e.target.value && setPlanStart(e.target.value)} />
            </label>
          </div>
        </div>
        <table className="approval" aria-hidden="true">
          <tbody>
            <tr>
              <th>작성</th>
              <th>승인</th>
              <th>평가</th>
            </tr>
            <tr>
              <td />
              <td />
              <td />
            </tr>
          </tbody>
        </table>
      </header>

      <CapacitySummary />

      <section className="paper-section">
        <h2>1. 블록</h2>
        <BlockSource />
        <BlockTable />
      </section>

      <section className="paper-section">
        <h2>2. 자원</h2>
        <ResourceForm />
      </section>

      <div className="paper-foot">
        <button type="button" className="btn primary" data-tour="next" disabled={blocks.length === 0 || hasDup} onClick={() => setPage('board')}>
          다음: 배치 →
        </button>
        {hasDup && <span className="error-text">블록 ID가 비었거나 중복되었습니다.</span>}
      </div>
    </div>
  );
}
