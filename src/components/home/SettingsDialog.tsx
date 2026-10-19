import { useStore } from '../../store/schedulerStore';
import { Modal } from '../common/Modal';

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
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn primary" onClick={onClose}>
          닫기
        </button>
      </div>
    </Modal>
  );
}
