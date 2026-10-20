import { buildCalendar, NO_OFF, type Calendar } from '../domain/calendar';
import type { State } from './types';

type Input = Pick<State, 'planStart' | 'calendar' | 'tutorialActive'>;
let cache: { planStart: string; options: State['calendar']; cal: Calendar } | null = null;

/** 작업하지 않는 날. 튜토리얼은 발표 자료의 1~5일 예시를 그대로 따라가도록 매일 작업한다 */
export function selectCalendar(s: Input): Calendar {
  if (s.tutorialActive) return NO_OFF;
  if (!cache || cache.planStart !== s.planStart || cache.options !== s.calendar) {
    cache = { planStart: s.planStart, options: s.calendar, cal: buildCalendar(s.planStart, s.calendar) };
  }
  return cache.cal;
}
