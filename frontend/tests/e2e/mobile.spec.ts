import { expect, test } from '@playwright/test';
import { shot, start } from './helpers';

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
