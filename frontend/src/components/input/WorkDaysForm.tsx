import { useStore } from '../../store/schedulerStore';
import { dateToDay, formatMD } from '../../io/dates';

const md = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return formatMD(new Date(y, m - 1, d));
};

/** 작업하지 않는 날: 주말·공휴일(사전 등록)과 간트에서 직접 고른 날 */
export function WorkDaysForm() {
  const c = useStore((s) => s.calendar);
  const planStart = useStore((s) => s.planStart);
  const setCalendar = useStore((s) => s.setCalendar);
  // 계획 시작일 전의 날짜는 이제 의미가 없으니 보여 주지 않는다
  const upcoming = (xs: string[]) => xs.filter((iso) => dateToDay(planStart, new Date(`${iso}T00:00`)) >= 1).sort();
  const off = upcoming(c.extraOff);
  const on = upcoming(c.extraOn);

  return (
    <div className="workdays" data-testid="workdays">
      <h4>작업하지 않는 날</h4>
      <label className="check">
        <input type="checkbox" checked={c.weekends} onChange={(e) => setCalendar({ weekends: e.target.checked })} data-testid="skip-weekends" /> 주말(토·일)
      </label>
      <label className="check">
        <input type="checkbox" checked={c.holidays} onChange={(e) => setCalendar({ holidays: e.target.checked })} data-testid="skip-holidays" /> 공휴일
      </label>
      <p className="muted small">
        주말·공휴일은 블록 납기도 그만큼 늦춥니다. 블록 스케줄링의 날짜 칸을 누르면 작업 불가 날짜(천재지변 등)를 지정하며, 이 날은 납기를 바꾸지 않습니다.
      </p>
      {off.length > 0 && (
        <p className="small">
          작업 불가로 지정: {off.map(md).join(', ')}{' '}
          <button type="button" className="btn small ghost" onClick={() => setCalendar({ extraOff: [] })}>
            모두 풀기
          </button>
        </p>
      )}
      {on.length > 0 && (
        <p className="small">
          쉬는 날이지만 작업: {on.map(md).join(', ')}{' '}
          <button type="button" className="btn small ghost" onClick={() => setCalendar({ extraOn: [] })}>
            되돌리기
          </button>
        </p>
      )}
    </div>
  );
}
