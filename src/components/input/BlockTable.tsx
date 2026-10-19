import { useStore } from '../../store/schedulerStore';
import { dayToDate, formatMD } from '../../io/dates';

/** 블록 작업 표. 튜토리얼에서는 readOnly로 같은 표를 글자만 보여 준다. */
export function BlockTable({ readOnly = false }: { readOnly?: boolean }) {
  const blocks = useStore((s) => s.blocks);
  const planStart = useStore((s) => s.planStart);
  const updateBlock = useStore((s) => s.updateBlock);
  const removeBlock = useStore((s) => s.removeBlock);
  const addBlock = useStore((s) => s.addBlock);
  const ids = blocks.map((b) => b.id);
  const date = (day: number) => <span className="muted">({formatMD(dayToDate(planStart, day))})</span>;

  return (
    <div className="table-scroll">
      <table className={`plain-table ${readOnly ? '' : 'edit-table'}`}>
        <thead>
          <tr>
            <th>블록 ID</th>
            <th>납기(남은 일, 오늘 = 1)</th>
            <th className="num">필요 작업 시간</th>
            <th>자재</th>
            {!readOnly && <th />}
          </tr>
        </thead>
        <tbody>
          {blocks.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                아직 블록이 없습니다. 엑셀을 올리거나 샘플을 불러오세요.
              </td>
            </tr>
          )}
          {blocks.map((b, i) =>
            readOnly ? (
              <tr key={i}>
                <td>
                  <b>{b.id}</b>
                </td>
                <td>
                  {b.dueDay} {date(b.dueDay)}
                </td>
                <td className="num">{b.requiredMH} MH</td>
                <td>{b.materialReady ? '준비' : <span className="tag warn">미준비</span>}</td>
              </tr>
            ) : (
              <tr key={i}>
                <td>
                  <input
                    aria-label="블록 ID"
                    className={`cell-input id ${ids.indexOf(b.id) !== i || !b.id ? 'invalid' : ''}`}
                    value={b.id}
                    onChange={(e) => updateBlock(i, { id: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    aria-label="남은 기간"
                    className="cell-input"
                    type="number"
                    min={1}
                    value={b.dueDay}
                    onChange={(e) => updateBlock(i, { dueDay: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  />{' '}
                  {date(b.dueDay)}
                </td>
                <td className="num">
                  <input
                    aria-label="필요 공수"
                    className="cell-input"
                    type="number"
                    min={1}
                    value={b.requiredMH}
                    onChange={(e) => updateBlock(i, { requiredMH: Math.max(1, parseFloat(e.target.value) || 1) })}
                  />{' '}
                  MH
                </td>
                <td>
                  <select
                    aria-label="자재"
                    className={`cell-input ${b.materialReady ? '' : 'not-ready'}`}
                    value={b.materialReady ? 'y' : 'n'}
                    onChange={(e) => updateBlock(i, { materialReady: e.target.value === 'y' })}
                  >
                    <option value="y">준비</option>
                    <option value="n">미준비</option>
                  </select>
                </td>
                <td>
                  <button type="button" className="icon-btn" aria-label={`${b.id} 삭제`} onClick={() => removeBlock(i)}>
                    ×
                  </button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      {!readOnly && (
        <button type="button" className="add-row" onClick={addBlock}>
          + 줄 더하기
        </button>
      )}
    </div>
  );
}
