import { useStore } from '../../store/schedulerStore';
import { Modal } from '../common/Modal';
import { WEATHER_SITES, type WeatherSite } from '../../io/weather';

/** 메뉴의 설정 */
export function SettingsDialog({ onClose }: { onClose(): void }) {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  return (
    <Modal title="설정" onClose={onClose}>
      <div className="settings">
        <label className="switch-row">
          <span>
            <strong>조립 애니메이션</strong>
            <small className="muted">결과로 넘어갈 때 블록 조립 장면 재생</small>
          </span>
          <input type="checkbox" role="switch" checked={settings.animation} onChange={(e) => setSettings({ animation: e.target.checked })} />
        </label>
        <label className="switch-row">
          <span>
            <strong>날씨 예보 위치</strong>
            <small className="muted">간트 날짜 칸과 TBM에 날씨 표시 (Open-Meteo, 16일 예보)</small>
          </span>
          <select value={settings.weatherSite ?? 'geoje'} onChange={(e) => setSettings({ weatherSite: e.target.value as WeatherSite })} data-testid="weather-site">
            {Object.entries(WEATHER_SITES).map(([key, s]) => (
              <option key={key} value={key}>
                {s.name}
              </option>
            ))}
            <option value="off">표시 안 함</option>
          </select>
        </label>
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn primary" onClick={onClose}>
          닫기
        </button>
      </div>
    </Modal>
  );
}
