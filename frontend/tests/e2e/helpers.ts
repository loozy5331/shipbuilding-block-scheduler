import { expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

/** frontend/ 기준 경로 (playwright를 어느 폴더에서 실행하든 같은 파일을 가리키도록) */
export const fromFrontend = (rel: string) => fileURLToPath(new URL(`../../${rel}`, import.meta.url));

export const shot = (page: Page, name: string) => page.screenshot({ path: fromFrontend(`test-results/shots/${name}.png`), fullPage: true });

/** from 요소를 끌어 to 요소 가운데(또는 dx·dy만큼 옆)에 놓는다. hold: 놓기 전에 실행 */
export async function drag(page: Page, from: string, to: string | { dx?: number; dy?: number }, hold?: () => Promise<void>) {
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

export const step = (page: Page, label: string) => page.locator('.steps button', { hasText: label });

/** 체험하기로 들어가 모드를 고르고(첫 방문이면 튜토리얼 가이드가 열리므로 건너뛴다) 샘플로 블록 스케줄링까지. sample이 아니면 메뉴에서 멈춘다 */
export async function start(page: Page, mode: 'expert' | 'novice', sample = true) {
  await page.goto('/');
  await page.getByTestId(`mode-${mode}`).click();
  await page.getByTestId('try-btn').click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page.getByTestId('setup-title')).toBeVisible();
  if (!sample) {
    await step(page, '메뉴').click();
    await expect(page.locator('.tile')).toHaveCount(4);
    return;
  }
  await page.getByRole('button', { name: '샘플 불러오기' }).click();
  await page.getByRole('button', { name: '다음: 블록 스케줄링 →' }).click();
}
