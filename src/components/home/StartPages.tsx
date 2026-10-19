import { useRef, useState } from 'react';
import type { UserMode } from '../../domain/types';
import { useStore } from '../../store/schedulerStore';
import { readBlocksFromFile } from '../../io/excel';
import { LineIcon } from '../icons/LineIcons';
import { Modal } from '../common/Modal';

const MODE: Record<UserMode, { name: string; desc: string }> = {
  expert: { name: '숙련자', desc: '최적 배치 버튼으로 바로 계산' },
  novice: { name: '신입', desc: '직접 배치하고 힌트로 배우기' },
};

function SettingsDialog({ onClose }: { onClose(): void }) {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  return (
    <Modal title="설정" onClose={onClose}>
      <div className="settings">
        <label className="switch-row">
          <span>
            <strong>작업 애니메이션</strong>
            <small className="muted">간트 위 작업자·크레인 애니메이션 (준비 중)</small>
          </span>
          <input type="checkbox" role="switch" checked={settings.animation} onChange={(e) => setSettings({ animation: e.target.checked })} />
        </label>
        <div className="switch-row">
          <span>
            <strong>사용자 모드</strong>
            <small className="muted">{mode ? MODE[mode].desc : '모드를 고르세요'}</small>
          </span>
          <div className="seg">
            {(Object.keys(MODE) as UserMode[]).map((m) => (
              <button key={m} type="button" className={mode === m ? 'on' : ''} aria-pressed={mode === m} onClick={() => setMode(m)}>
                {MODE[m].name}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn primary" onClick={onClose}>
          닫기
        </button>
      </div>
    </Modal>
  );
}

/** ① 모드 선택 (로그인은 추후) */
export function ModePage() {
  const setMode = useStore((s) => s.setMode);
  const setPage = useStore((s) => s.setPage);
  const tutorialSeen = useStore((s) => s.tutorialSeen);
  const startTutorial = useStore((s) => s.startTutorial);

  const choose = (m: UserMode) => {
    setMode(m);
    // 처음이면 튜토리얼부터
    if (tutorialSeen) setPage('menu');
    else startTutorial();
  };

  return (
    <div className="home">
      <span className="eyebrow-label">— 조립 공정 생산관리</span>
      <h1>누가 배치하나요?</h1>
      <div className="mode-pick">
        {(Object.keys(MODE) as UserMode[]).map((m) => (
          <button key={m} type="button" className={`mode-btn ${m}`} onClick={() => choose(m)} data-testid={`mode-${m}`}>
            <strong>{MODE[m].name}</strong>
            <small>{MODE[m].desc}</small>
          </button>
        ))}
      </div>
      <p className="muted">로그인은 추후 지원 예정입니다.</p>
    </div>
  );
}

/** ② 田자 메뉴 */
export function MenuPage() {
  const mode = useStore((s) => s.mode) ?? 'expert';
  const setPage = useStore((s) => s.setPage);
  const setBlocks = useStore((s) => s.setBlocks);
  const planStart = useStore((s) => s.planStart);
  const blocks = useStore((s) => s.blocks);
  const startTutorial = useStore((s) => s.startTutorial);
  const showToast = useStore((s) => s.showToast);
  const [settings, setSettings] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const r = await readBlocksFromFile(file, planStart);
      if (r.blocks.length === 0) return showToast(`${file.name}: 읽은 블록이 없습니다. ${r.errors[0]?.message ?? ''}`);
      setBlocks(r.blocks);
      showToast(`${file.name}: 블록 ${r.blocks.length}개 읽음${r.errors.length ? ` · 오류 ${r.errors.length}건` : ''}`);
      setPage('setup');
    } catch {
      showToast('엑셀 파일을 읽지 못했습니다. .xlsx / .xls / .csv 파일인지 확인하세요.');
    }
  };

  return (
    <div className="home">
      <span className="eyebrow-label">
        — {MODE[mode].name} 모드 ·{' '}
        <button type="button" className="link-btn" onClick={() => setPage('mode')}>
          모드 변경
        </button>
      </span>
      <h1>무엇부터 할까요?</h1>
      <div className="tile-grid">
        <button type="button" className="tile" onClick={() => fileRef.current?.click()} data-testid="tile-upload">
          <LineIcon name="upload" size={34} />
          <strong>엑셀 업로드</strong>
          <small>블록 ID · 납기일 · 필요 작업 시간 · 자재준비 여부</small>
        </button>
        <button type="button" className="tile" onClick={startTutorial} data-testid="tile-tutorial">
          <LineIcon name="play" size={34} />
          <strong>튜토리얼</strong>
          <small>예시 5블록으로 따라 하기</small>
        </button>
        <button type="button" className="tile" disabled title="준비 중">
          <LineIcon name="camera" size={34} />
          <strong>블록 작업 촬영</strong>
          <small>사진으로 엑셀 만들기 · 준비 중</small>
        </button>
        <button type="button" className="tile" onClick={() => setSettings(true)} data-testid="tile-settings">
          <LineIcon name="gear" size={34} />
          <strong>설정</strong>
          <small>애니메이션 · 모드</small>
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        hidden
        accept=".xlsx,.xls,.csv"
        data-testid="home-excel-input"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <button type="button" className="btn ghost" onClick={() => setPage('setup')}>
        {blocks.length ? `이어서 하기 (블록 ${blocks.length}개) →` : '직접 입력하기 →'}
      </button>
      {settings && <SettingsDialog onClose={() => setSettings(false)} />}
    </div>
  );
}
