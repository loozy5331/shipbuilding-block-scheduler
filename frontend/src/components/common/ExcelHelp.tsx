import { useState } from 'react';
import { useStore } from '../../store/schedulerStore';
import { downloadTemplate } from '../../io/excel';
import { LineIcon } from '../icons/LineIcons';
import { Modal } from './Modal';

const COLUMNS = [
  { name: '블록 ID', alias: '블록, ID', value: '블록 이름 (중복 불가)', example: 'A-101' },
  { name: '납기일', alias: '납기, 남은 기간', value: '날짜(2026-10-20, 10/20) 또는 남은 일수(오늘 = 1)', example: '2026-10-20 또는 2' },
  { name: '필요 작업 시간', alias: '필요 공수, 작업시간, MH', value: '필요 공수(MH), 0보다 큰 숫자', example: '24' },
  { name: '자재준비 여부', alias: '자재준비, 자재', value: '준비 / 미준비, Y / N, O / X, 완료 / 미완료', example: '미준비' },
  {
    name: '자재 납기일',
    alias: '자재 납기, 자재 입고일, 자재 입고 예정일',
    value: '자재가 들어오는 날짜. 그날부터 비상 자재 없이 착수하고, 늦어지면 결과의 지연 원인에 적습니다. 비우면 자재준비 여부를 따릅니다',
    example: '2026-10-22',
    optional: true,
  },
];

/** 엑셀 업로드 양식 도움말 */
export function ExcelHelpDialog({ onClose }: { onClose(): void }) {
  const planStart = useStore((s) => s.planStart);
  return (
    <Modal title="엑셀 업로드 양식" onClose={onClose} wide>
      <p className="muted">첫 번째 시트의 표를 읽습니다. 첫 줄(위에서 5줄 안)에 아래 필수 열 4개(자재 납기일은 선택) 이름을 적고, 그 아래에 블록을 한 줄씩 적으세요. 열 순서는 상관없습니다.</p>
      <div className="table-scroll">
        <table className="plain-table help-table">
          <thead>
            <tr>
              <th>열 이름</th>
              <th>이렇게 써도 됨</th>
              <th>값</th>
              <th>예</th>
            </tr>
          </thead>
          <tbody>
            {COLUMNS.map((c) => (
              <tr key={c.name}>
                <td>
                  <b>{c.name}</b> <small className="muted">{'optional' in c ? '선택' : '필수'}</small>
                </td>
                <td className="muted">{c.alias}</td>
                <td>{c.value}</td>
                <td>{c.example}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4>예시</h4>
      <div className="table-scroll">
        <table className="plain-table sheet-example">
          <thead>
            <tr>
              <th />
              <th>A</th>
              <th>B</th>
              <th>C</th>
              <th>D</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>1</th>
              <td>
                <b>블록 ID</b>
              </td>
              <td>
                <b>납기일</b>
              </td>
              <td>
                <b>필요 작업 시간</b>
              </td>
              <td>
                <b>자재준비 여부</b>
              </td>
            </tr>
            <tr>
              <th>2</th>
              <td>A-101</td>
              <td>2026-10-19</td>
              <td>16</td>
              <td>준비</td>
            </tr>
            <tr>
              <th>3</th>
              <td>C-115</td>
              <td>2026-10-21</td>
              <td>12</td>
              <td>미준비</td>
            </tr>
          </tbody>
        </table>
      </div>

      <ul className="help-notes">
        <li>
          파일 형식: .xlsx · .xls · .csv · .numbers(맥 Numbers) · 예시 파일: <a href={`${import.meta.env.BASE_URL}sample-tutorial.xlsx`} download>5블록</a> ·{' '}
          <a href={`${import.meta.env.BASE_URL}sample-30-blocks.xlsx`} download>30블록</a>
        </li>
        <li>납기일이 날짜면 공통 설정 입력의 계획 시작일(오늘)을 1일로 세어 남은 일수로 바꿉니다. 계획 시작일보다 이른 날짜는 오류입니다.</li>
        <li>열 이름 줄이 없으면 A~D 열을 블록 ID · 납기 · 필요 작업 시간 · 자재 순서로 읽습니다.</li>
        <li>자재 납기일 열이 있으면 자재준비 여부 열은 빼도 됩니다(빈 칸 = 이미 준비). 계획 시작일 이전 날짜는 준비된 것으로 봅니다.</li>
        <li>잘못된 줄(ID 중복·빈 값·해석할 수 없는 값)은 건너뛰고, 몇 번째 줄이 왜 틀렸는지 알려 줍니다.</li>
        <li>작업장·작업자·크레인 같은 자원은 엑셀이 아니라 공통 설정 입력 화면에서 정합니다.</li>
      </ul>

      <div className="dialog-actions">
        <button type="button" className="btn ghost" onClick={() => downloadTemplate(planStart)}>
          <LineIcon name="download" size={16} /> 양식 내려받기
        </button>
        <button type="button" className="btn primary" onClick={onClose}>
          닫기
        </button>
      </div>
    </Modal>
  );
}

/** 도움말을 여는 버튼 */
export function ExcelHelpButton({ className = 'btn ghost' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} data-testid="excel-help">
        엑셀 양식 도움말
      </button>
      {open && <ExcelHelpDialog onClose={() => setOpen(false)} />}
    </>
  );
}
