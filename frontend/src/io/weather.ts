/** 날짜별 날씨 예보 (Open-Meteo, 키 없음). 예보는 오늘부터 16일까지만 나온다 */

export const WEATHER_SITES = {
  geoje: { name: '거제', lat: 34.88, lon: 128.62 },
  ulsan: { name: '울산', lat: 35.51, lon: 129.42 },
  busan: { name: '부산', lat: 35.1, lon: 129.04 },
  mokpo: { name: '목포·영암', lat: 34.76, lon: 126.4 },
} as const;

export type WeatherSite = keyof typeof WEATHER_SITES | 'off';

export interface DayWeather {
  /** WMO 날씨 코드 */
  code: number;
  /** 강수 확률(%) */
  rain: number | null;
  tmax: number | null;
  tmin: number | null;
  /** 최대 풍속(m/s) */
  wind: number | null;
}

/** 날짜(YYYY-MM-DD) → 날씨 */
export type Forecast = Record<string, DayWeather>;

const TTL = 60 * 60 * 1000;
const cache = new Map<string, { at: number; promise: Promise<Forecast> }>();

interface Daily {
  time: string[];
  weather_code: number[];
  precipitation_probability_max: (number | null)[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  wind_speed_10m_max: (number | null)[];
}

/** 같은 위치는 한 시간 동안 다시 받지 않는다. 실패하면 거부된 Promise (화면에서는 날씨를 빼고 보여 준다) */
export function fetchForecast(site: Exclude<WeatherSite, 'off'>): Promise<Forecast> {
  const hit = cache.get(site);
  if (hit && Date.now() - hit.at < TTL) return hit.promise;
  const { lat, lon } = WEATHER_SITES[site];
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=Asia%2FSeoul&forecast_days=16&wind_speed_unit=ms` +
    '&daily=weather_code,precipitation_probability_max,temperature_2m_max,temperature_2m_min,wind_speed_10m_max';
  const promise = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`날씨 ${res.status}`);
      return res.json() as Promise<{ daily: Daily }>;
    })
    .then(({ daily: d }) => {
      const out: Forecast = {};
      d.time.forEach((iso, i) => {
        out[iso] = { code: d.weather_code[i], rain: d.precipitation_probability_max[i], tmax: d.temperature_2m_max[i], tmin: d.temperature_2m_min[i], wind: d.wind_speed_10m_max[i] };
      });
      return out;
    });
  // 실패한 요청은 캐시에 남기지 않아 다음에 다시 시도한다
  promise.catch(() => cache.delete(site));
  cache.set(site, { at: Date.now(), promise });
  return promise;
}

/** WMO 코드 → 아이콘·이름 */
export function weatherLabel(code: number): { icon: string; name: string } {
  if (code === 0) return { icon: '☀️', name: '맑음' };
  if (code <= 2) return { icon: '⛅', name: '구름 조금' };
  if (code === 3) return { icon: '☁️', name: '흐림' };
  if (code === 45 || code === 48) return { icon: '🌫️', name: '안개' };
  if (code >= 51 && code <= 57) return { icon: '🌦️', name: '이슬비' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { icon: '🌧️', name: '비' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: '🌨️', name: '눈' };
  if (code >= 95) return { icon: '⛈️', name: '뇌우' };
  return { icon: '☁️', name: '흐림' };
}

/** 툴팁·TBM에 쓰는 한 줄 */
export function weatherText(w: DayWeather): string {
  const parts = [weatherLabel(w.code).name];
  if (w.rain !== null) parts.push(`강수 ${w.rain}%`);
  if (w.tmin !== null && w.tmax !== null) parts.push(`${Math.round(w.tmin)}~${Math.round(w.tmax)}℃`);
  if (w.wind !== null) parts.push(`바람 ${Math.round(w.wind)}m/s`);
  return parts.join(' · ');
}
