import { useRef, useState } from 'react';
import { useStore } from '../../store/schedulerStore';
import { downloadTemplate, readBlocksFromFile } from '../../io/excel';
import { parsePasted, type ParseResult } from '../../io/parse';
import { LineIcon } from '../icons/LineIcons';
import { TUTORIAL_TITLE } from '../../tutorial/scenario';
import { ExcelHelpButton } from '../common/ExcelHelp';

/** 엑셀 업로드 · 붙여넣기 · 샘플 불러오기 */
export function BlockSource() {
  const planStart = useStore((s) => s.planStart);
  const setBlocks = useStore((s) => s.setBlocks);
  const loadScenario = useStore((s) => s.loadScenario);
  const [paste, setPaste] = useState('');
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
      setResult({ blocks: [], errors: [{ row: 0, message: '엑셀 파일을 읽지 못했습니다. .xlsx / .xls / .csv 파일인지 확인하세요.' }], source: file.name });
    }
  };

  return (
    <div className="block-source">
      <div className="source-head">
        <button type="button" className="btn" onClick={() => { loadScenario(); setResult(null); }}>
          샘플 불러오기
        </button>
        <span className="muted">샘플: {TUTORIAL_TITLE}</span>
        <span className="spacer" />
        <span className="muted">
          예시 엑셀: <a href={`${import.meta.env.BASE_URL}sample-tutorial.xlsx`} download>5블록</a> ·{' '}
          <a href={`${import.meta.env.BASE_URL}sample-30-blocks.xlsx`} download>30블록</a>
        </span>
        <button type="button" className="btn ghost" onClick={() => downloadTemplate(planStart)}>
          <LineIcon name="download" size={16} /> 엑셀 양식
        </button>
        <ExcelHelpButton />
      </div>

      <div className="source-grid">
        <label
          data-tour="upload"
          className={`dropzone ${drag ? 'over' : ''}`}
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
          <LineIcon name="upload" size={28} />
          <strong>엑셀 파일 업로드</strong>
          <small>블록 ID · 납기일 · 필요 작업 시간 · 자재준비 여부</small>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            data-testid="excel-input"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>

        <div className="paste">
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={'엑셀에서 4열(블록 ID · 납기 · 필요 공수 · 자재 준비)을 복사해 여기에 붙여넣으세요.\n예) A-101\t1\t16\t예'}
          />
          <button type="button" className="btn" disabled={!paste.trim()} onClick={() => accept(parsePasted(paste, planStart), '붙여넣기')}>
            붙여넣은 표 읽기
          </button>
        </div>
      </div>

      {result && (
        <div className={`parse-result ${result.errors.length ? 'warn' : 'ok'}`} role="status">
          <strong>{result.source}</strong>: 블록 {result.blocks.length}개 읽음
          {result.errors.length > 0 && (
            <>
              {' '}· 오류 {result.errors.length}건
              <ul>
                {result.errors.slice(0, 8).map((e, i) => (
                  <li key={i}>{e.row > 0 ? `${e.row}행: ` : ''}{e.message}</li>
                ))}
              </ul>
              <small className="muted">열 이름과 값 형식은 '엑셀 양식 도움말'을 확인하세요.</small>
            </>
          )}
        </div>
      )}
    </div>
  );
}
