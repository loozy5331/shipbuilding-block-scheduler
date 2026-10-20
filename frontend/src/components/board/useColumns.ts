import { useMemo } from 'react';
import { useStore } from '../../store/schedulerStore';
import { dayInfo } from '../../domain/calendar';
import { buildColumns, type Columns } from './ganttLayout';

/** 날짜 칸 배치: 주말·공휴일은 설정에 따라 접는다 (직접 지정한 작업 불가일은 눈에 띄게 펼쳐 둔다) */
export function useColumns(days: number): Columns {
  const planStart = useStore((s) => s.planStart);
  const calendar = useStore((s) => s.calendar);
  const touring = useStore((s) => s.tutorialActive);
  const fold = useStore((s) => s.fold);
  return useMemo(
    () =>
      buildColumns(days, (d) => {
        if (touring) return false;
        const off = dayInfo(planStart, d, calendar).off;
        return (off === 'weekend' && fold.weekend) || (off === 'holiday' && fold.holiday);
      }),
    [days, planStart, calendar, touring, fold],
  );
}
