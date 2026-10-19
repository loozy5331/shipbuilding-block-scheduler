import { useState } from 'react';
import { useStore } from '../../store/schedulerStore';
import { requestAuth } from '../../io/auth';

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
      if (signup) showToast(`${user.id}님, 가입을 환영합니다.`);
      login({ id: user.id, guest: false, tutorialSeen: user.tutorialSeen });
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
