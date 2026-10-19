import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/shots/${name}.png`, fullPage: true });

/** from 요소를 끌어 to 요소 가운데(또는 dx·dy만큼 옆)에 놓는다. hold: 놓기 전에 실행 */
async function drag(page: Page, from: string, to: string | { dx?: number; dy?: number }, hold?: () => Promise<void>) {
  const a = (await page.locator(from).boundingBox())!;
  const ax = a.x + Math.min(a.width / 2, 40);
  const ay = a.y + a.height / 2;
  let tx: number;
  let ty: number;
  if (typeof to === 'string') {
    const b = (await page.locator(to).boundingBox())!;
    tx = b.x + Math.min(b.width / 2, 40);
    ty = b.y + b.height / 2;
  } else {
    tx = ax + (to.dx ?? 0);
    ty = ay + (to.dy ?? 0);
  }
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await page.mouse.move(ax + 10, ay, { steps: 3 });
  await page.mouse.move(tx, ty, { steps: 12 });
  await hold?.();
  await page.mouse.up();
  // dnd-kit은 드래그가 끝난 뒤 잠깐 클릭을 삼킨다
  await page.waitForTimeout(80);
}

const step = (page: Page, label: string) => page.locator('.steps button', { hasText: label });

/** 모드를 고르고(첫 방문이면 튜토리얼 가이드가 열리므로 건너뛴다) 샘플로 블록 스케줄링까지. sample이 아니면 메뉴에서 멈춘다 */
async function start(page: Page, mode: 'expert' | 'novice', sample = true) {
  await page.goto('/');
  await page.getByTestId(`mode-${mode}`).click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page.locator('.paper-head h1')).toHaveText('공 통 설 정 입 력');
  if (!sample) {
    await step(page, '메뉴').click();
    await expect(page.locator('.tile')).toHaveCount(4);
    return;
  }
  await page.getByRole('button', { name: '샘플 불러오기' }).click();
  await page.getByRole('button', { name: '다음: 블록 스케줄링 →' }).click();
}

test('진입 화면: 모드 선택 → 田자 메뉴 → 엑셀 업로드', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('mode-expert')).toBeVisible();
  await shot(page, '00-mode');
  await page.getByTestId('mode-novice').click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await step(page, '메뉴').click();
  await expect(page.locator('.tile')).toHaveCount(4);
  await expect(page.locator('.mode-chip')).toHaveText('신입');
  await shot(page, '00-home');

  await page.getByTestId('tile-settings').click();
  const dlg = page.getByRole('dialog', { name: '설정' });
  await dlg.getByRole('switch').uncheck();
  await dlg.getByRole('button', { name: '숙련자' }).click();
  await dlg.getByRole('button', { name: '닫기' }).click();
  await expect(page.locator('.mode-chip')).toHaveText('숙련자');

  // 엑셀 양식 도움말: 필수 열과 예시, 양식 내려받기
  await page.getByTestId('excel-help').click();
  const help = page.getByRole('dialog', { name: '엑셀 업로드 양식' });
  for (const col of ['블록 ID', '납기일', '필요 작업 시간', '자재준비 여부']) await expect(help).toContainText(col);
  const template = page.waitForEvent('download');
  await help.getByRole('button', { name: '양식 내려받기' }).click();
  expect((await template).suggestedFilename()).toBe('블록_입력_양식.xlsx');
  await shot(page, '14-excel-help');
  await help.getByRole('button', { name: '닫기' }).click();

  await page.getByTestId('home-excel-input').setInputFiles(path.resolve('public/sample-tutorial.xlsx'));
  await expect(page.locator('.toast')).toContainText('블록 5개 읽음');
  await expect(page.locator('[data-tour="summary"]')).toContainText('80');
});

test('가이드를 건너뛰어도 지금 페이지에 머문다', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('mode-expert').click();
  await page.getByTestId('tour-next').click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.paper-head h1')).toHaveText('공 통 설 정 입 력');
  // 스케줄링 단계에서 Esc로 닫아도 그 페이지에 남는다
  await step(page, '메뉴').click();
  await page.getByTestId('tile-tutorial').click();
  for (let i = 0; i < 5; i++) await page.getByTestId('tour-next').click();
  await expect(page.getByTestId('verdict')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(step(page, '블록 스케줄링')).toHaveClass(/on/);
});

test('튜토리얼: 공통 설정 입력(채워짐) → 블록 스케줄링 → 결과 순서로 진행', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('mode-expert').click();
  await expect(page.getByRole('dialog', { name: '튜토리얼' })).toBeVisible();
  await shot(page, '01-tour-intro');
  const order = ['공통 설정 입력', '블록 스케줄링', '결과'];
  const seen: string[] = [];
  for (let i = 0; i < 12; i++) {
    if (i > 0) await page.getByTestId('tour-next').click();
    await expect(page.getByTestId('tour-next')).toBeEnabled();
    const current = (await page.locator('.steps button.on .step-label').innerText()).trim();
    seen.push(current);
    // 공통 설정 입력에서는 채워진 블록·자원만 보이고 엑셀 업로드 같은 입력 기능은 없다
    if (current === '공통 설정 입력') {
      await expect(page.getByTestId('excel-input')).toHaveCount(0);
      await expect(page.locator('.plain-table')).toContainText('C-115');
    }
    await shot(page, `01-tour-${String(i).padStart(2, '0')}`);
  }
  // 페이지는 앞으로만 넘어간다
  const idx = seen.map((p) => order.indexOf(p));
  expect(idx.every((v, k) => v >= 0 && (k === 0 || v >= idx[k - 1]))).toBe(true);
  expect(new Set(seen)).toEqual(new Set(order));
  await expect(page.locator('.tour-card')).toContainText('평가서');
  await expect(page.locator('[data-tour="kpi"]')).toContainText('5 / 5');
  await page.getByTestId('tour-next').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // 끝나면 메뉴로
  await expect(page.locator('.tile')).toHaveCount(4);
});

test('즉시 판정 → 대기 블록 배치 → 드래그 배정·이동·작업장 변경 → 최적 배치 → 내보내기', async ({ page }) => {
  await start(page, 'expert');
  // 버튼을 누르지 않아도 가능/불가를 판정한다
  await expect(page.getByTestId('verdict')).toContainText('전 블록 납기 준수 가능');
  const reset = page.getByRole('button', { name: '초기화' });
  if (await reset.isEnabled()) await reset.click();
  await expect(page.getByTestId('waiting').locator('.g-block')).toHaveCount(5);

  // 대기 블록에 크레인을 놓으면 1일차 빈 작업장에 올라간다
  await drag(page, '[data-testid="chip-crane"]', '[data-testid="row-A-101"]');
  await expect(page.getByTestId('wp-0').getByTestId('bar-A-101')).toBeVisible();
  await drag(page, '[data-testid="chip-general"]', '[data-testid="row-A-101"]');
  await drag(page, '[data-testid="chip-general"]', '[data-testid="row-A-101"]');
  await expect(page.getByTestId('bar-A-101')).toContainText('16MH');

  // B-203도 1일차(작업장 2)에 일반 3명 → 보유 2명 초과(빨간 칸)
  await drag(page, '[data-testid="chip-crane"]', '[data-testid="row-B-203"]');
  await expect(page.getByTestId('wp-1').getByTestId('bar-B-203')).toBeVisible();
  for (let i = 0; i < 3; i++) await drag(page, '[data-testid="chip-general"]', '[data-testid="row-B-203"]');
  await expect(page.getByTestId('load-general-1')).toHaveClass(/over/);
  await shot(page, '03-manual-overload');

  // 막대를 하루 오른쪽으로 → 초과 해소
  await drag(page, '[data-testid="bar-B-203"]', { dx: 96 });
  await expect(page.getByTestId('load-general-1')).not.toHaveClass(/over/);
  await expect(page.getByTestId('bar-B-203')).toHaveAttribute('title', /^B-203: 2일 착수/);

  // 위로 끌어 작업장 1로 옮긴다 (A-101은 1일에 끝나므로 겹치지 않음)
  const wp0 = (await page.getByTestId('wp-0').boundingBox())!;
  const bar = (await page.getByTestId('bar-B-203').boundingBox())!;
  await drag(page, '[data-testid="bar-B-203"]', { dy: wp0.y + wp0.height / 2 - (bar.y + bar.height / 2) }, async () => {
    await expect(page.getByTestId('wp-0')).toHaveClass(/wp-over/);
  });
  await expect(page.getByTestId('wp-0').getByTestId('bar-B-203')).toBeVisible();
  await expect(page.getByTestId('bar-B-203')).toHaveAttribute('title', /^B-203: 2일 착수/);

  // 같은 작업장에서 날짜가 겹치면 작업장 겹침
  await page.getByTestId('bar-B-203').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('bar-B-203')).toContainText('작업장 겹침');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('wp-1').getByTestId('bar-B-203')).toBeVisible();
  await expect(page.getByTestId('bar-B-203')).not.toContainText('작업장 겹침');

  // 대기 블록을 작업장 테두리 안으로 끌어 놓기
  await drag(page, '[data-testid="row-E-320"] .g-left', '[data-testid="wp-0"] .wp-title', async () => {
    await expect(page.getByTestId('wp-0')).toHaveClass(/wp-over/);
  });
  await expect(page.getByTestId('wp-0').getByTestId('row-E-320')).toBeVisible();

  await page.getByTestId('optimize-btn').click();
  await expect(page.locator('[data-tour="kpi"]')).toContainText('5 / 5');
  await expect(page.getByTestId('waiting')).toHaveCount(0);
  await expect(page.getByTestId('plan-option')).toContainText('최적 배치 (1/');
  await shot(page, '04-optimized');

  await page.getByRole('button', { name: '다음: 결과 →' }).click();
  await expect(page.getByTestId('report')).toContainText('현재 배치가 최적 배치와 같은 수준');
  await expect(page.getByTestId('plan-table')).toContainText('작업장 1');
  await shot(page, '12-result');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '엑셀 저장' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^블록_배치_.*\.xlsx$/);
  const wb = XLSX.read(readFileSync(await file.path()));
  expect(wb.SheetNames).toEqual(['배치표', '일별 자원 부하', '요약', 'TBM', '평가서']);
  const plan = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets['배치표']);
  expect(plan[0]).toHaveProperty('작업장');
  expect(plan[0]).toHaveProperty('작업자 수');
  expect(String(XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets.TBM)[0]['TBM 메시지'])).toContain('[TBM]');
});

test('최적 배치를 다시 누르면 착수 순서가 다른 차선책을 차례로 본다', async ({ page }) => {
  await start(page, 'expert');
  const btn = page.getByTestId('optimize-btn');
  await btn.click();
  await expect(page.getByTestId('plan-option')).toContainText('최적 배치 (1/');
  const first = await page.getByTestId('plan-option').innerText();
  const total = Number(first.match(/\(1\/(\d)\)/)![1]);
  expect(total).toBeGreaterThan(1);
  expect(total).toBeLessThanOrEqual(4);
  await expect(btn).toHaveText(`다음 안 보기 (1/${total})`);
  await btn.click();
  await expect(page.getByTestId('plan-option')).toContainText(`차선책 1 (2/${total})`);
  expect(await page.getByTestId('plan-option').innerText()).not.toBe(first);
  await shot(page, '13-alternative');
  // 끝까지 넘기면 다시 최적 배치
  for (let i = 2; i < total; i++) await btn.click();
  await btn.click();
  await expect(page.getByTestId('plan-option')).toContainText('최적 배치 (1/');
});

test('간트 상호작용: 드롭 판정·클릭 배정·착수일 말풍선·숫자 편집', async ({ page }) => {
  await start(page, 'expert');
  await expect(page.getByTestId('waiting').locator('.g-block')).toHaveCount(5);

  await drag(page, '[data-testid="chip-crane"]', '[data-testid="row-A-101"]');
  // 이미 크레인이 있는 블록 위로 끌면 빨간 표시와 이유, 놓으면 안내
  await drag(page, '[data-testid="chip-crane"]', '[data-testid="row-A-101"]', async () => {
    await expect(page.getByTestId('row-A-101')).toHaveClass(/drop-no/);
    await expect(page.getByTestId('row-A-101')).toContainText('이미 크레인이 있습니다');
    // fullPage 캡처는 창 크기를 바꿔 드래그를 취소시키므로 화면만 찍는다
    await page.screenshot({ path: 'test-results/shots/08-drop-no.png' });
  });
  await expect(page.locator('.toast')).toContainText('이미 크레인이 있습니다');

  // 아이콘 클릭 → 블록 클릭으로 배정
  for (let i = 0; i < 2; i++) {
    await page.getByTestId('chip-general').click();
    await expect(page.getByTestId('chip-general')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('row-A-101').locator('.b-title strong').click();
  }
  await expect(page.getByTestId('bar-A-101')).toContainText('16MH');

  // 숫자 편집: 한도 초과는 막고, 정상 값은 저장
  await page.getByRole('button', { name: 'B-203 숫자 편집' }).click();
  const dlg = page.getByRole('dialog', { name: 'B-203 · 직접 배치' });
  await dlg.getByLabel('일반 작업자').fill('4');
  await dlg.getByRole('button', { name: '저장' }).click();
  await expect(dlg).toContainText('블록당 최대 3명');
  await dlg.getByLabel('일반 작업자').fill('1');
  await dlg.getByLabel('숙련공').fill('2');
  await dlg.getByLabel('크레인 1대').check();
  await dlg.getByLabel('작업장').selectOption({ label: '작업장 2' });
  await dlg.getByRole('button', { name: '저장' }).click();
  await expect(dlg).toHaveCount(0);

  // 1일에 일반 3명 > 보유 2명 → 자원 겹침, 겹친 날 공수 불인정
  await expect(page.getByTestId('wp-1').getByTestId('bar-B-203')).toHaveClass(/conflict/);
  await expect(page.getByTestId('bar-B-203')).toHaveAttribute('title', /납기까지 0\/24 MH/);
  await shot(page, '09-conflict');

  // 끄는 동안 착수일 말풍선
  await drag(page, '[data-testid="bar-B-203"]', { dx: 96 }, () => expect(page.getByTestId('bar-B-203')).toHaveAttribute('data-day', '2일 착수'));
  await expect(page.getByTestId('bar-B-203')).not.toHaveClass(/conflict/);

  // 1일 앞으로는 못 간다
  await page.getByTestId('bar-A-101').focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('bar-A-101')).toHaveAttribute('title', /^A-101: 1일 착수/);
});

test('신입 모드: 최적 배치 대신 단계적 힌트', async ({ page }) => {
  await start(page, 'novice');
  await expect(page.getByRole('button', { name: '최적 배치' })).toHaveCount(0);

  await page.getByTestId('hint-btn').click();
  await expect(page.getByTestId('hint')).toContainText('힌트 1');
  await shot(page, '10-hint');
  // 힌트대로 바꾸다 보면 최적과 같아진다
  for (let i = 0; i < 8; i++) {
    const apply = page.getByTestId('hint').getByRole('button', { name: '이대로 바꾸기' });
    if (!(await apply.count())) break;
    await apply.click();
    await page.getByTestId('hint-btn').click();
  }
  await expect(page.getByTestId('hint')).toContainText('최적 배치만큼 좋습니다');
  await expect(page.locator('[data-tour="kpi"]')).toContainText('5 / 5');
  await page.getByRole('button', { name: '다음: 결과 →' }).click();
  await expect(page.getByTestId('report')).toContainText('힌트 사용');
});

test('오늘 작업과 TBM 메시지', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await start(page, 'expert');
  await page.getByTestId('optimize-btn').click();
  await page.getByRole('button', { name: '다음: 결과 →' }).click();
  await expect(page.getByTestId('tbm')).toContainText('[TBM]');
  await expect(page.getByTestId('tbm')).toContainText('작업장 1');
  await page.getByRole('button', { name: '다음 날' }).click();
  await expect(page.locator('[data-tour="tbm"] h3')).toContainText('2일차');
  await page.locator('[data-tour="tbm"]').getByRole('button', { name: '복사' }).click();
  await expect(page.locator('.toast')).toContainText('TBM 메시지를 복사했습니다');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('[TBM]');
  await shot(page, '11-tbm');
});

test('자원 부족 시 즉시 불가 판정과 추가 자원 제안', async ({ page }) => {
  await start(page, 'expert');
  await page.getByRole('button', { name: '← 공통 설정 입력' }).click();
  await page.getByRole('button', { name: '숙련공 줄이기' }).click();
  await page.getByRole('button', { name: '일반 작업자 줄이기' }).click();
  await page.getByRole('button', { name: '일반 작업자 줄이기' }).click();
  await expect(page.locator('.verdict')).toContainText('불가능');
  await page.getByRole('button', { name: '다음: 블록 스케줄링 →' }).click();
  await expect(page.getByTestId('verdict')).toContainText('납기 준수 불가');
  await expect(page.locator('[data-tour="whatif"]')).toContainText('대응안 1');
  await shot(page, '05-whatif');
  await page.locator('.whatif button').first().click();
  await expect(page.getByTestId('verdict')).toContainText('전 블록 납기 준수 가능');
});

test('30블록 엑셀', async ({ page }) => {
  await start(page, 'expert', false);
  await page.getByRole('button', { name: /이어서 하기|직접 입력하기/ }).click();
  await page.getByTestId('excel-input').setInputFiles(path.resolve('public/sample-30-blocks.xlsx'));
  await expect(page.locator('.parse-result')).toContainText('블록 30개 읽음');
  await page.getByRole('button', { name: '다음: 블록 스케줄링 →' }).click();
  await page.getByTestId('optimize-btn').click();
  await expect(page.getByTestId('verdict')).not.toContainText('판정 중');
  await shot(page, '06-thirty');
});

test('모바일 폭에서 가로 스크롤 없음', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await start(page, 'novice', false);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  // 田자: 두 칸씩 두 줄, 촬영이 설정보다 앞
  await expect(page.locator('.tile').nth(2)).toContainText('블록 작업 촬영');
  await expect(page.locator('.tile').nth(3)).toContainText('설정');
  const tiles = await page.locator('.tile').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(tiles[0]).toBe(tiles[1]);
  expect(tiles[2]).toBe(tiles[3]);
  expect(tiles[2]).toBeGreaterThan(tiles[0]);
  expect(await overflow()).toBeLessThanOrEqual(0);
  await shot(page, '07-mobile-home');
  await page.getByRole('button', { name: /직접 입력하기|이어서 하기/ }).click();
  await page.getByRole('button', { name: '샘플 불러오기' }).click();
  expect(await overflow()).toBeLessThanOrEqual(0);
  await shot(page, '07-mobile-input');
  await page.getByRole('button', { name: '다음: 블록 스케줄링 →' }).click();
  await page.getByTestId('hint-btn').click();
  expect(await overflow()).toBeLessThanOrEqual(0);
  await shot(page, '07-mobile-board');
  await page.getByRole('button', { name: '다음: 결과 →' }).click();
  await expect(page.getByTestId('tbm')).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
  await shot(page, '07-mobile-result');
});
