// 샘플 엑셀 생성: node scripts/make-samples.mjs
import * as XLSX from 'xlsx';
import { writeFileSync } from 'node:fs';

const header = ['블록 ID', '납기일', '필요 작업 시간', '자재준비 여부'];
const write = (name, rows) => {
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '블록');
  writeFileSync(`frontend/public/${name}`, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
};

// 튜토리얼: 납기는 "남은 기간(일)" 숫자로
write('sample-tutorial.xlsx', [
  ['A-101', 1, 16, '완료'],
  ['B-203', 2, 24, '완료'],
  ['C-115', 3, 12, '미완료'],
  ['D-208', 1, 8, '완료'],
  ['E-320', 4, 20, '완료'],
]);

// 30블록: 선박 5척 × 6블록, 결정적 의사난수
let t = 42;
const rand = () => ((t = (t * 1103515245 + 12345) % 2147483648) / 2147483648);
const rows = [];
for (let s = 0; s < 5; s++) {
  for (let k = 0; k < 6; k++) {
    rows.push([`S${s + 1}-${String.fromCharCode(65 + k)}${100 + k * 7 + s}`, 1 + Math.floor(rand() * 12), 8 + 4 * Math.floor(rand() * 9), rand() < 0.2 ? '미준비' : '준비']);
  }
}
write('sample-30-blocks.xlsx', rows);
console.log('ok');
