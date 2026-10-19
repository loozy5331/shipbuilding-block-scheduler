import { useRef, useState } from 'react';
import { useStore } from '../../store/schedulerStore';
import { downloadTemplate, FILE_ACCEPT, FILE_TYPES, readBlocksFromFile } from '../../io/excel';
import { parsePasted, type ParseResult } from '../../io/parse';
import { LineIcon } from '../icons/LineIcons';
import { TUTORIAL_TITLE } from '../../tutorial/scenario';
import { ExcelHelpButton } from '../common/ExcelHelp';
import { Modal } from '../common/Modal';

/** 블록 표 위 도구 줄: 엑셀 업로드(끌어 놓기 가능) · 붙여넣기 · 샘플 · 양식 · 도움말 */
export function BlockSource() {
  const planStart = useStore((s) => s.planStart);
  const setBlocks = useStore((s) => s.setBlocks);
  const loadScenario = useStore((s) => s.loadScenario);
  const [paste, setPaste] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [result, setResult] = useState<(ParseResult & { source: string }) | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const accept = (r: ParseResult, source: string) => {
    setResult({ ...r, source });
    if (r.blocks.length > 0) setBlocks(r.blocks);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      accept(await readBlocksFromFile(file, planStart), file.name);
    } catch {
      setResult({ blocks: [], errors: [{ row: 0, message: `엑셀 파일을 읽지 못했습니다. ${FILE_TYPES} 파일인지 확인하세요.` }], source: file.name });
    }
  };

  return (
    <>
      <div
        className={`source-bar ${drag ? 'over' : ''}`}
        data-tour="upload"
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          onFile(e.dataTransfer.files[0]);
        }}
      >
        <button type="button" className="btn small" onClick={() => fileRef.current?.click()}>
          <LineIcon name="upload" size={16} /> 엑셀 업로드
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          accept={FILE_ACCEPT}
          data-testid="excel-input"
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <button type="button" className="btn small ghost" onClick={() => setPasteOpen(true)}>
          붙여넣기
        </button>
        <button
          type="button"
          className="btn small ghost"
          title={`샘플: ${TUTORIAL_TITLE}`}
          onClick={() => {
            loadScenario();
            setResult(null);
          }}
        >
          샘플 불러오기
        </button>
        <button type="button" className="btn small ghost" onClick={() => downloadTemplate(planStart)}>
          <LineIcon name="download" size={16} /> 엑셀 양식
        </button>
        <ExcelHelpButton className="btn small ghost" />
        <span className="muted drop-hint">엑셀 파일을 이 줄에 끌어 놓아도 됩니다</span>
      </div>

      {result && (
        <div className={`parse-result ${result.errors.length ? 'warn' : 'ok'}`} role="status">
          <strong>{result.source}</strong>: 블록 {result.blocks.length}개 읽음
          {result.errors.length > 0 && (
            <>
              {' '}· 오류 {result.errors.length}건
              <ul>
                {result.errors.slice(0, 8).map((e, i) => (
                  <li key={i}>
                    {e.row > 0 ? `${e.row}행: ` : ''}
                    {e.message}
                  </li>
                ))}
              </ul>
              <small className="muted">열 이름과 값 형식은 '엑셀 양식 도움말'을 확인하세요.</small>
            </>
          )}
        </div>
      )}

      {pasteOpen && (
        <Modal title="엑셀 셀 붙여넣기" onClose={() => setPasteOpen(false)}>
          <p className="muted">엑셀에서 4열(블록 ID · 납기 · 필요 공수 · 자재 준비)을 복사해 붙여넣으세요. 열 이름 줄은 있어도 되고 없어도 됩니다.</p>
          <textarea className="paste-area" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'예) A-101\t1\t16\t준비'} />
          <div className="dialog-actions">
            <button type="button" className="btn ghost" onClick={() => setPasteOpen(false)}>
              취소
            </button>
            <button
              type="button"
              className="btn primary"
              disabled={!paste.trim()}
              onClick={() => {
                accept(parsePasted(paste, planStart), '붙여넣기');
                setPasteOpen(false);
              }}
            >
              붙여넣은 표 읽기
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
