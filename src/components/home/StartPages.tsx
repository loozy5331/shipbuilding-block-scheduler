import { useRef, useState } from 'react';
import type { UserMode } from '../../domain/types';
import { useStore } from '../../store/schedulerStore';
import { FILE_ACCEPT, FILE_TYPES, readBlocksFromFile } from '../../io/excel';
import { requestAuth } from '../../io/auth';
import { LineIcon } from '../icons/LineIcons';
import { Modal } from '../common/Modal';
import { ExcelHelpButton } from '../common/ExcelHelp';

const MODE: Record<UserMode, { name: string; desc: string }> = {
  expert: { name: '숙련자', desc: '최적 배치 버튼으로 바로 계산' },
  novice: { name: '신입', desc: '직접 배치하고 힌트로 배우기' },
};

/** 숙련자·신입 토글. 로그인 페이지의 상단 바에서만 고른다 */
export function ModeToggle() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  return (
    <div className={`seg mode-toggle ${mode}`} role="group" aria-label="사용자 모드">
      {(Object.keys(MODE) as UserMode[]).map((m) => (
        <button key={m} type="button" className={mode === m ? 'on' : ''} aria-pressed={mode === m} onClick={() => setMode(m)} data-testid={`mode-${m}`}>
          {MODE[m].name}
        </button>
      ))}
    </div>
  );
}

function SettingsDialog({ onClose }: { onClose(): void }) {
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

/** ① 로그인 (아이디·비밀번호) · 회원가입 · 체험하기 */
export function LoginPage() {
  const login = useStore((s) => s.login);
  const showToast = useStore((s) => s.showToast);
  const [signup, setSignup] = useState(false);
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const switchForm = () => {
    setSignup(!signup);
    setPassword('');
    setConfirm('');
    setError('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim() || !password) return setError('아이디와 비밀번호를 입력하세요.');
    if (signup && password !== confirm) return setError('비밀번호가 서로 다릅니다.');
    setBusy(true);
    try {
      const user = await requestAuth(signup ? 'signup' : 'login', id.trim(), password);
      if (signup) showToast(`${user}님, 가입을 환영합니다.`);
      login({ id: user, guest: false });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="home">
      <span className="eyebrow-label">— 조립 공정 생산관리</span>
      <h1>{signup ? '회원가입' : '로그인'}</h1>
      <form className="login-form" onSubmit={submit} noValidate>
        <label>
          아이디
          <input value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" placeholder={signup ? '영문·숫자·밑줄 3~20자' : undefined} data-testid="login-id" />
        </label>
        <label>
          비밀번호
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={signup ? 'new-password' : 'current-password'}
            placeholder={signup ? '6자 이상' : undefined}
            data-testid="login-password"
          />
        </label>
        {signup && (
          <label>
            비밀번호 확인
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" data-testid="login-confirm" />
          </label>
        )}
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn primary" disabled={busy} data-testid="login-submit">
          {signup ? '가입하고 시작하기' : '로그인'}
        </button>
        <p className="login-switch muted">
          {signup ? '이미 계정이 있나요? ' : '계정이 없나요? '}
          <button type="button" className="link-btn" onClick={switchForm} data-testid="login-switch">
            {signup ? '로그인' : '회원가입'}
          </button>
        </p>
      </form>
      <div className="login-divider">
        <span>또는</span>
      </div>
      <button type="button" className="btn ghost login-guest" onClick={() => login({ id: '체험', guest: true })} data-testid="try-btn">
        체험하기
      </button>
      <p className="muted">숙련자·신입 모드는 오른쪽 위에서 고릅니다 (로그인 후에는 바꿀 수 없음).</p>
    </div>
  );
}

/** ② 田자 메뉴 */
export function MenuPage() {
  const mode = useStore((s) => s.mode);
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
      if (r.blocks.length === 0) return showToast(`${file.name}: 읽은 블록이 없습니다. ${r.errors[0]?.message ?? ''} '엑셀 양식 도움말'을 확인하세요.`);
      setBlocks(r.blocks);
      showToast(`${file.name}: 블록 ${r.blocks.length}개 읽음${r.errors.length ? ` · 오류 ${r.errors.length}건` : ''}`);
      setPage('setup');
    } catch {
      showToast(`엑셀 파일을 읽지 못했습니다. ${FILE_TYPES} 파일인지 확인하세요.`);
    }
  };

  return (
    <div className="home">
      <span className="eyebrow-label">— {MODE[mode].name} 모드</span>
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
          <small>애니메이션</small>
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        hidden
        accept={FILE_ACCEPT}
        data-testid="home-excel-input"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <ExcelHelpButton className="link-btn" />
      <button type="button" className="btn ghost" onClick={() => setPage('setup')}>
        {blocks.length ? `이어서 하기 (블록 ${blocks.length}개) →` : '직접 입력하기 →'}
      </button>
      {settings && <SettingsDialog onClose={() => setSettings(false)} />}
    </div>
  );
}
