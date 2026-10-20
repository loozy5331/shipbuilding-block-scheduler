import { useStore } from '../../store/schedulerStore';
import { dateToDay, dayToDate, formatMD, toISO } from '../../io/dates';
import { withMaterialDay } from '../../domain/material';
import { materialText } from '../../domain/labels';
import { effectiveDue } from '../../domain/calendar';
import { useCalendar } from '../../store/evaluation';
import { DueShift } from '../common/DueShift';
import { Term } from '../common/InfoTip';

/** 블록 작업 표. 튜토리얼에서는 readOnly로 같은 표를 글자만 보여 준다. */
export function BlockTable({ readOnly = false }: { readOnly?: boolean }) {
  const blocks = useStore((s) => s.blocks);
  const planStart = useStore((s) => s.planStart);
  const updateBlock = useStore((s) => s.updateBlock);
  const removeBlock = useStore((s) => s.removeBlock);
  const addBlock = useStore((s) => s.addBlock);
  const assignments = useStore((s) => s.assignments);
  const togglePin = useStore((s) => s.togglePin);
  // 합의는 숙련자만: 현장과 합의된 블록은 다시 최적화해도 그대로 둔다
  const agree = useStore((s) => s.mode !== 'novice') && !readOnly;
  const ids = blocks.map((b) => b.id);
  const cal = useCalendar();
  // 납기 날짜는 주말·공휴일만큼 미룬 실제 납기로 보여 준다
  const due = (b: (typeof blocks)[number]) => {
    const d = effectiveDue(cal, b.dueDay);
    return (
      <>
        <span className="muted">({formatMD(dayToDate(planStart, d))})</span>
        <DueShift block={b} due={d} />
      </>
    );
  };

  return (
    <div className="table-scroll">
      <table className={`plain-table ${readOnly ? '' : 'edit-table'}`}>
        <thead>
          <tr>
            <th>블록 ID</th>
            <th>
              납기(남은 일, 오늘 = 1) <Term k="due" />
            </th>
            <th className="num">
              필요 작업 시간 <Term k="mh" />
            </th>
            <th>
              자재 <Term k="material" />
            </th>
            <th>
              자재 납기일 <Term k="materialDay" />
            </th>
            {agree && (
              <th>
                합의 <Term k="agree" />
              </th>
            )}
            {!readOnly && <th />}
          </tr>
        </thead>
        <tbody>
          {blocks.length === 0 && (
            <tr>
              <td colSpan={7} className="muted">
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
                  {b.dueDay} {due(b)}
                </td>
                <td className="num">{b.requiredMH} MH</td>
                <td>{b.materialReady ? '준비' : <span className="tag warn">미준비</span>}</td>
                <td>{b.materialDay !== undefined ? materialText(b, (d) => formatMD(dayToDate(planStart, d))) : '-'}</td>
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
                  {due(b)}
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
                    onChange={(e) => updateBlock(i, { materialReady: e.target.value === 'y', materialDay: undefined })}
                  >
                    <option value="y">준비</option>
                    <option value="n">미준비</option>
                  </select>
                </td>
                <td>
                  <input
                    aria-label={`${b.id} 자재 납기일`}
                    className="cell-input date"
                    type="date"
                    data-testid={`material-day-${b.id}`}
                    value={b.materialDay !== undefined ? toISO(dayToDate(planStart, b.materialDay)) : ''}
                    onChange={(e) => {
                      const [y, m, d] = e.target.value.split('-').map(Number);
                      const day = e.target.value ? dateToDay(planStart, new Date(y, m - 1, d)) : undefined;
                      updateBlock(i, { ...withMaterialDay(b, day), materialDay: day !== undefined && day > 1 ? day : undefined });
                    }}
                  />
                </td>
                {agree && (
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`${b.id} 합의`}
                      data-testid={`agree-${b.id}`}
                      checked={!!assignments[b.id]?.pinned}
                      disabled={assignments[b.id]?.startDay == null}
                      title={assignments[b.id]?.startDay == null ? '블록 스케줄링에서 배치한 뒤 합의할 수 있습니다' : '합의: 다시 최적화해도 이 배치를 그대로 둡니다'}
                      onChange={() => togglePin(b.id)}
                    />
                  </td>
                )}
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
