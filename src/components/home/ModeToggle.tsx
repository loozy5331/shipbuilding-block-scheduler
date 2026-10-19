import type { UserMode } from '../../domain/types';
import { MODE_LABEL } from '../../domain/labels';
import { useStore } from '../../store/schedulerStore';

/** 숙련자·신입 토글. 로그인 페이지의 상단 바에서만 고른다 */
export function ModeToggle() {
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  return (
    <div className={`seg mode-toggle ${mode}`} role="group" aria-label="사용자 모드">
      {(Object.keys(MODE_LABEL) as UserMode[]).map((m) => (
        <button key={m} type="button" className={mode === m ? 'on' : ''} aria-pressed={mode === m} onClick={() => setMode(m)} data-testid={`mode-${m}`}>
          {MODE_LABEL[m].name}
        </button>
      ))}
    </div>
  );
}
