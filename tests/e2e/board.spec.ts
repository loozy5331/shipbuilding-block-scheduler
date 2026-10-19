import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const shot = (page: Page, name: string) => page.screenshot({ path: `test-results/shots/${name}.png`, fullPage: true });

async function drag(page: Page, from: string, to: string, dx = 0) {
  const a = (await page.locator(from).boundingBox())!;
  const b = (await page.locator(to).boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2, { steps: 3 });
  const tx = dx ? a.x + a.width / 2 + dx : b.x + 150;
  const ty = dx ? a.y + a.height / 2 : b.y + b.height / 2;
  await page.mouse.move(tx, ty, { steps: 12 });
  await page.mouse.up();
}

test('튜토리얼 전체 진행', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: '튜토리얼' })).toBeVisible();
  await shot(page, '01-tour-intro');
  for (let i = 1; i < 11; i++) {
    await page.getByTestId('tour-next').click();
    await expect(page.getByTestId('tour-next')).toBeEnabled();
    await shot(page, `01-tour-${String(i).padStart(2, '0')}`);
  }
  await expect(page.locator('.tour-card')).toContainText('추가 자원');
  await page.getByTestId('tour-next').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // 튜토리얼 끝에는 최적 배치 적용 상태
  await expect(page.locator('[data-tour="kpi"]')).toContainText('5 / 5');
});

test('엑셀 업로드 → 자동 배치 → 드래그 배정/이동 → 내보내기', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '건너뛰기' }).click();

  await page.getByTestId('excel-input').setInputFiles(path.resolve('public/sample-tutorial.xlsx'));
  await expect(page.locator('.parse-result')).toContainText('블록 5개 읽음');
  await expect(page.locator('[data-tour="summary"]')).toContainText('80');
  await shot(page, '02-input');

  await page.getByRole('button', { name: '다음: 배치 →' }).click();
  const reset = page.getByRole('button', { name: '초기화' });
  if (await reset.isEnabled()) await reset.click();

  // 수동 배치: 크레인과 작업자 2명을 A-101에
  await drag(page, '[data-testid="chip-crane"]', '[data-testid="row-A-101"]');
  await drag(page, '[data-testid="chip-general"]', '[data-testid="row-A-101"]');
  await drag(page, '[data-testid="chip-general"]', '[data-testid="row-A-101"]');
  await expect(page.getByTestId('bar-A-101')).toContainText('하루 16 MH');

  // B-203도 1일차에 3명 → 일반 작업자 5명으로 초과(빨간 칸)
  await drag(page, '[data-testid="chip-crane"]', '[data-testid="row-B-203"]');
  for (let i = 0; i < 3; i++) await drag(page, '[data-testid="chip-general"]', '[data-testid="row-B-203"]');
  await expect(page.getByTestId('load-general-1')).toHaveClass(/over/);
  await shot(page, '03-manual-overload');

  // 막대를 하루 오른쪽으로 → 초과 해소
  await drag(page, '[data-testid="bar-B-203"]', '[data-testid="bar-B-203"]', 96);
  await expect(page.getByTestId('load-general-1')).not.toHaveClass(/over/);
  await expect(page.getByTestId('load-general-2')).not.toHaveClass(/over/);

  // 아이콘 클릭으로 빼기
  await page.getByRole('button', { name: 'B-203에서 작업자 빼기' }).first().click();
  await expect(page.getByTestId('bar-B-203')).toContainText('하루 16 MH');

  await page.getByRole('button', { name: '자동 배치(최적화)' }).click();
  await expect(page.locator('[data-tour="kpi"]')).toContainText('5 / 5');
  await expect(page.locator('.board-head h1')).toContainText('전 블록 납기 준수 가능');
  await shot(page, '04-optimized');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '엑셀 내보내기' }).click();
  expect((await download).suggestedFilename()).toMatch(/^블록_배치_.*\.xlsx$/);
});

test('자원 부족 시 불가 판정과 추가 자원 제안', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await page.getByRole('button', { name: '샘플 불러오기' }).click();
  await page.getByRole('button', { name: '숙련공 줄이기' }).click();
  await page.getByRole('button', { name: '일반 작업자 줄이기' }).click();
  await page.getByRole('button', { name: '일반 작업자 줄이기' }).click();
  await expect(page.locator('.verdict')).toContainText('불가능');
  await page.getByRole('button', { name: '다음: 배치 →' }).click();
  await page.getByRole('button', { name: '자동 배치(최적화)' }).click();
  await expect(page.locator('.board-head h1')).toContainText('납기 준수 불가');
  await expect(page.locator('[data-tour="whatif"]')).toContainText('대응안 1');
  await shot(page, '05-whatif');
  await page.locator('.whatif button').first().click();
  await page.getByRole('button', { name: '자동 배치(최적화)' }).click();
  await expect(page.locator('.board-head h1')).toContainText('전 블록 납기 준수 가능');
});

test('30블록 엑셀', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await page.getByTestId('excel-input').setInputFiles(path.resolve('public/sample-30-blocks.xlsx'));
  await expect(page.locator('.parse-result')).toContainText('블록 30개 읽음');
  await page.getByRole('button', { name: '다음: 배치 →' }).click();
  await page.getByRole('button', { name: '자동 배치(최적화)' }).click();
  await expect(page.locator('.board-head h1')).not.toContainText('블록 및 작업자 배치');
  await shot(page, '06-thirty');
});

test('모바일 폭에서 가로 스크롤 없음', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await page.getByRole('button', { name: '샘플 불러오기' }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await shot(page, '07-mobile-input');
  await page.getByRole('button', { name: '다음: 배치 →' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await shot(page, '07-mobile-board');
});
