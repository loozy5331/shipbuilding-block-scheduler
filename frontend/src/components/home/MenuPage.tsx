import { useRef, useState } from 'react';
import { MODE_LABEL } from '../../domain/labels';
import { useStore } from '../../store/schedulerStore';
import { FILE_ACCEPT, FILE_TYPES, readBlocksFromFile } from '../../io/excel';
import { LineIcon } from '../icons/LineIcons';
import { ExcelHelpButton } from '../common/ExcelHelp';
import { SettingsDialog } from './SettingsDialog';

/** ② 田자 메뉴 */
export function MenuPage() {
  const mode = useStore((s) => s.mode);
  const setPage = useStore((s) => s.setPage);
  const setBlocks = useStore((s) => s.setBlocks);
  const planStart = useStore((s) => s.planStart);
  const blocks = useStore((s) => s.blocks);
  const startTutorial = useStore((s) => s.startTutorial);
  const openTutorial = useStore((s) => s.openTutorial);
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
      <span className="eyebrow-label">— {MODE_LABEL[mode].name} 모드</span>
      <h1>무엇부터 할까요?</h1>
      <div className="tile-grid">
        <button type="button" className="tile" onClick={() => fileRef.current?.click()} data-testid="tile-upload">
          <LineIcon name="upload" size={34} />
          <strong>엑셀 업로드</strong>
          <small>블록 ID · 납기일 · 필요 작업 시간 · 자재준비 여부</small>
        </button>
        {/* 타일 전체는 예시 불러오기(처음이면 가이드와 함께), 안쪽 버튼은 가이드 다시 받기 */}
        <div className="tile tile-split">
          <button type="button" className="tile-main" onClick={openTutorial} data-testid="tile-tutorial">
            <LineIcon name="play" size={34} />
            <strong>튜토리얼</strong>
            <small>예시 5블록으로 따라 하기</small>
          </button>
          <button type="button" className="btn ghost small tile-sub" onClick={startTutorial} data-testid="tutorial-guide-btn">
            튜토리얼 가이드
          </button>
        </div>
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
