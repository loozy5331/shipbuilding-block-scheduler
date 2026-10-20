import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../../store/schedulerStore';
import { fetchForecast, type DayWeather, type Forecast } from '../../io/weather';
import { dayToDate, toISO } from '../../io/dates';

/** 설정한 조선소 위치의 예보. 일차 → 날씨 (예보가 없는 날·끔·실패면 undefined) */
export function useWeather(): (day: number) => DayWeather | undefined {
  const site = useStore((s) => s.settings.weatherSite ?? 'geoje');
  const planStart = useStore((s) => s.planStart);
  const [forecast, setForecast] = useState<{ site: string; data: Forecast } | null>(null);

  useEffect(() => {
    if (site === 'off') return;
    let alive = true;
    fetchForecast(site)
      .then((data) => alive && setForecast({ site, data }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [site]);

  return useCallback(
    (day: number) => (forecast && forecast.site === site ? forecast.data[toISO(dayToDate(planStart, day))] : undefined),
    [forecast, site, planStart],
  );
}
