import type { Evaluation } from '../../domain/evaluate';
import type { LoadKind } from '../../domain/types';
import type { Columns } from './ganttLayout';
import { isWorkDay } from '../../domain/calendar';
import { useCalendar } from '../../store/evaluation';
import { Term } from '../common/InfoTip';

const LABEL: Record<LoadKind, { name: string; unit: string }> = {
  slots: { name: '동시 처리 블록', unit: '블록' },
  general: { name: '일반 작업자', unit: '명' },
  skilled: { name: '숙련공', unit: '명' },
  crane: { name: '크레인', unit: '대' },
};

/** 네모 한 칸 = 용량 1. 채운 칸 = 쓰는 양, 빨간 칸 = 용량을 넘은 양 */
export function LoadGrid({ ev, cols }: { ev: Evaluation; cols: Columns }) {
  const cal = useCalendar();
  return (
    <div className="load" data-tour="load">
      <div className="load-title">
        <strong>
          자원 부하 <Term k="load" />
        </strong>
        <span className="muted">네모 한 칸 = 용량 1. 채운 칸 = 쓰는 양, 빨간 칸 = 용량을 넘은 양</span>
      </div>
      {ev.load.map((row) => (
        <div key={row.kind} className="g-row load-row" style={{ gridTemplateColumns: `var(--left) ${cols.template}` }}>
          <div className="g-left">
            <strong>{LABEL[row.kind].name}</strong>
            <span className="muted">
              용량 {row.capacity}
              {LABEL[row.kind].unit}
            </span>
          </div>
          {Array.from({ length: cols.days }, (_, d) => {
            // 접힌 날은 쉬는 날이라 쓰는 자원이 없다
            if (cols.folded(d + 1)) return <div key={d} className="load-cell off folded" />;
            const used = row.usage[d] ?? 0;
            const n = Math.max(row.capacity, used);
            const over = used > row.capacity;
            return (
              <div
                key={d}
                className={`load-cell ${over ? 'over' : ''} ${isWorkDay(cal, d + 1) ? '' : 'off'}`}
                data-testid={`load-${row.kind}-${d + 1}`}
                title={`${d + 1}일: ${used} / ${row.capacity}`}
              >
                <div className="squares" style={{ gridTemplateColumns: `repeat(${Math.min(n, 5) || 1}, 12px)` }}>
                  {Array.from({ length: n }, (_, i) => (
                    <i key={i} className={i < Math.min(used, row.capacity) ? 'used' : i >= row.capacity ? 'excess' : ''} />
                  ))}
                </div>
                {over && (
                  <small className="over-count">
                    {used}/{row.capacity}
                  </small>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function Legend() {
  return (
    <div className="legend">
      <span>
        <i className="lg-bar ok" /> 납기 안
      </span>
      <span>
        <i className="lg-bar late" /> 납기 지연
      </span>
      <span>
        <i className="lg-bar overloaded" /> 자원 겹침(그날 용량 초과)
      </span>
      <span>
        <i className="lg-bar blocked" /> 착수 불가(사전 요건 없음)
      </span>
      <span>
        <i className="lg-bar ghost" /> 대기(작업자 1명 기준 길이)
      </span>
      <span>
        <i className="lg-due" /> 납기(그날 끝)
      </span>
      <span>
        자원 부하 한 칸 = 1 <i className="sq used" /> 쓰는 것 <i className="sq" /> 남는 것 <i className="sq excess" /> 넘친 것
      </span>
    </div>
  );
}
