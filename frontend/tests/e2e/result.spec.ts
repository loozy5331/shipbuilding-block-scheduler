import { expect, test } from '@playwright/test';
import { shot, start, step } from './helpers';

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

test.describe('조립 애니메이션', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('결과로 넘어갈 때 재생하고, 건너뛰거나 설정에서 끌 수 있다', async ({ page }) => {
    await start(page, 'expert');
    await page.getByTestId('optimize-btn').click();
    await expect(page.getByTestId('plan-option')).toBeVisible();
    await page.getByRole('button', { name: '다음: 결과 →' }).click();
    const show = page.getByTestId('assembly-show');
    await expect(show).toBeVisible();
    await expect(show).toContainText('블록 조립');
    await page.waitForTimeout(3300);
    await shot(page, '08-assembly');
    await page.getByTestId('assembly-skip').click();
    await expect(show).toHaveCount(0);
    await expect(page.getByTestId('plan-table')).toBeVisible();

    // 끝까지 두면 저절로 닫힌다
    await page.getByRole('button', { name: '← 블록 스케줄링' }).click();
    await page.getByRole('button', { name: '다음: 결과 →' }).click();
    await expect(page.locator('.asm.p-done')).toBeVisible({ timeout: 20000 });
    await expect(show).toHaveCount(0, { timeout: 4000 });

    // 설정에서 끄면 바로 결과
    await step(page, '메뉴').click();
    await page.getByTestId('tile-settings').click();
    await page.getByRole('dialog', { name: '설정' }).getByRole('switch').uncheck();
    await page.getByRole('button', { name: '닫기' }).click();
    await step(page, '블록 스케줄링').click();
    await page.getByRole('button', { name: '다음: 결과 →' }).click();
    await expect(page.getByTestId('plan-table')).toBeVisible();
    await expect(show).toHaveCount(0);
  });
});
