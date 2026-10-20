import type { Evaluation } from '../../domain/evaluate';
import { tbmMessage, workOn } from '../../domain/tbm';
import { useStore } from '../../store/schedulerStore';
import { dayToDate, formatMD } from '../../io/dates';
import { LineIcon } from '../icons/LineIcons';

/** 고른 날의 작업 목록과 TBM 공유 메시지 */
export function TodayPanel({ ev, day, onDay, maxDay }: { ev: Evaluation; day: number; onDay(d: number): void; maxDay: number }) {
  const blocks = useStore((s) => s.blocks);
  const assignments = useStore((s) => s.assignments);
  const r = useStore((s) => s.resources);
  const planStart = useStore((s) => s.planStart);
  const showToast = useStore((s) => s.showToast);
  const work = workOn(day, blocks, assignments, ev, r);
  const message = tbmMessage(day, blocks, assignments, ev, r, planStart);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      showToast('TBM 메시지를 복사했습니다.');
    } catch {
      showToast('복사하지 못했습니다. 메시지를 길게 눌러 직접 복사하세요.');
    }
  };
  const share = () => navigator.share?.({ title: 'TBM', text: message }).catch(() => undefined);

  return (
    <section className="panel today" data-tour="tbm">
      <div className="today-head">
        <h3>
          <LineIcon name="clock" /> {day === 1 ? '오늘' : `${day}일차`} 작업 · {formatMD(dayToDate(planStart, day))}
        </h3>
        <div className="today-nav">
          <button type="button" className="btn small ghost" disabled={day <= 1} onClick={() => onDay(day - 1)} aria-label="전날">
            ←
          </button>
          <button type="button" className="btn small ghost" disabled={day === 1} onClick={() => onDay(1)}>
            오늘
          </button>
          <button type="button" className="btn small ghost" disabled={day >= maxDay} onClick={() => onDay(day + 1)} aria-label="다음 날">
            →
          </button>
        </div>
      </div>
      <div className="today-body">
        <div>
          <h4>작업 블록 {work.length}개</h4>
          {work.length === 0 ? (
            <p className="muted">이날 작업 중인 블록이 없습니다.</p>
          ) : (
            <ul className="today-list">
              {work.map((w) => (
                <li key={w.block.id}>
                  <b>{w.block.id}</b>
                  <span className="muted">{w.workplace === null ? '작업장 미정' : `작업장 ${w.workplace + 1}`}</span>
                  <span>
                    일반 {w.general} · 숙련 {w.skilled}
                    {w.crane ? ' · 크레인' : ''}
                  </span>
                  <span className="muted">
                    {w.nth}/{w.duration}일차
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4>TBM 공유 메시지</h4>
          <pre className="tbm" data-testid="tbm">
            {message}
          </pre>
          <div className="dialog-actions">
            {'share' in navigator && (
              <button type="button" className="btn small ghost" onClick={share}>
                공유
              </button>
            )}
            <button type="button" className="btn small" onClick={copy}>
              복사
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
