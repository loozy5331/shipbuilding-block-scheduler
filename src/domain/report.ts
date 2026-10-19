import type { Kpi } from './evaluate';

export interface ReportRow {
  label: string;
  current: number;
  optimal: number;
  /** 클수록 좋은 지표인가 */
  higherIsBetter: boolean;
  unit: string;
}

/** 최적 배치 대비 평가서 */
export function compareReport(current: Kpi, optimal: Kpi): ReportRow[] {
  return [
    { label: '납기 만족 블록 수', current: current.onTime, optimal: optimal.onTime, higherIsBetter: true, unit: '개' },
    { label: '잔여 납기 여유일', current: current.totalSlackDays, optimal: optimal.totalSlackDays, higherIsBetter: true, unit: '일' },
    { label: '총 지연일', current: current.totalLateDays, optimal: optimal.totalLateDays, higherIsBetter: false, unit: '일' },
    { label: '비상 자재 사용', current: current.emergencyUsed, optimal: optimal.emergencyUsed, higherIsBetter: false, unit: '개' },
    { label: '자원 초과', current: current.overloadCells, optimal: optimal.overloadCells, higherIsBetter: false, unit: '칸' },
  ];
}

/** 차이를 최적 기준으로 판정: 'better' | 'same' | 'worse' */
export function judge(row: ReportRow): 'better' | 'same' | 'worse' {
  if (row.current === row.optimal) return 'same';
  return row.current > row.optimal === row.higherIsBetter ? 'better' : 'worse';
}
