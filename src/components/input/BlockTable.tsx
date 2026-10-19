import { useStore } from '../../store/schedulerStore';
import { dayToDate, formatMD } from '../../io/dates';

export function BlockTable() {
  const blocks = useStore((s) => s.blocks);
  const planStart = useStore((s) => s.planStart);
  const updateBlock = useStore((s) => s.updateBlock);
  const removeBlock = useStore((s) => s.removeBlock);
  const addBlock = useStore((s) => s.addBlock);
  const ids = blocks.map((b) => b.id);

  return (
    <div className="block-table" data-tour="blocks">
      <div className="bt-row bt-head">
        <span>블록 ID</span>
        <span>남은 기간(일, 오늘 포함)</span>
        <span>필요 공수(MH)</span>
        <span>자재</span>
        <span />
      </div>
      {blocks.length === 0 && <p className="empty">아직 블록이 없습니다. 엑셀을 올리거나 샘플을 불러오세요.</p>}
      {blocks.map((b, i) => {
        const dup = ids.indexOf(b.id) !== i;
        return (
          <div className="bt-row" key={i}>
            <input aria-label="블록 ID" className={dup || !b.id ? 'invalid' : ''} value={b.id} onChange={(e) => updateBlock(i, { id: e.target.value })} />
            <div className="with-hint">
              <input
                aria-label="남은 기간"
                type="number"
                min={1}
                value={b.dueDay}
                onChange={(e) => updateBlock(i, { dueDay: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              />
              <small>{formatMD(dayToDate(planStart, b.dueDay))}</small>
            </div>
            <input
              aria-label="필요 공수"
              type="number"
              min={1}
              value={b.requiredMH}
              onChange={(e) => updateBlock(i, { requiredMH: Math.max(1, parseFloat(e.target.value) || 1) })}
            />
            <select aria-label="자재" className={b.materialReady ? '' : 'not-ready'} value={b.materialReady ? 'y' : 'n'} onChange={(e) => updateBlock(i, { materialReady: e.target.value === 'y' })}>
              <option value="y">준비</option>
              <option value="n">미준비</option>
            </select>
            <button type="button" className="icon-btn" aria-label={`${b.id} 삭제`} onClick={() => removeBlock(i)}>
              ×
            </button>
          </div>
        );
      })}
      <button type="button" className="add-row" onClick={addBlock}>
        + 줄 더하기
      </button>
    </div>
  );
}
