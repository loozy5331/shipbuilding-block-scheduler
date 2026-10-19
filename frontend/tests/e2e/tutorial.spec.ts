import { expect, test } from '@playwright/test';
import { shot, step } from './helpers';

test('튜토리얼 가이드는 계정마다 처음 한 번만 (DB 저장), 튜토리얼 가이드 버튼으로 다시 받는다', async ({ page, browser }) => {
  const id = `tour_${Date.now() % 1e8}`;
  await page.goto('/');
  await page.getByTestId('login-switch').click();
  await page.getByTestId('login-id').fill(id);
  await page.getByTestId('login-password').fill('secret1');
  await page.getByTestId('login-confirm').fill('secret1');
  await page.getByTestId('login-submit').click();
  // 처음이면 가이드
  await expect(page.locator('.tour-card')).toContainText('1 / ');
  await page.getByRole('button', { name: '건너뛰기' }).click();

  // 다른 브라우저(저장소가 빈 상태)에서 로그인해도 가이드 없이 메뉴로
  const other = await browser.newContext({ reducedMotion: 'reduce' });
  const p2 = await other.newPage();
  await p2.goto('/');
  await p2.getByTestId('login-id').fill(id);
  await p2.getByTestId('login-password').fill('secret1');
  await p2.getByTestId('login-submit').click();
  await expect(p2.locator('.tile')).toHaveCount(4);
  await expect(p2.locator('.tour-card')).toHaveCount(0);

  // 튜토리얼 타일: 가이드 없이 예시만, 편집 가능
  await p2.getByTestId('tile-tutorial').click();
  await expect(p2.getByTestId('setup-title')).toBeVisible();
  await expect(p2.locator('.tour-card')).toHaveCount(0);
  await expect(p2.locator('.edit-table input[aria-label="블록 ID"]').first()).toHaveValue('A-101');
  await shot(p2, '16-tutorial-no-guide');

  // 튜토리얼 가이드 버튼: 다시 가이드
  await step(p2, '메뉴').click();
  await shot(p2, '16-menu-tutorial-guide');
  await p2.getByTestId('tutorial-guide-btn').click();
  await expect(p2.locator('.tour-card')).toContainText('1 / ');
  await other.close();
});

test('가이드를 건너뛰면 튜토리얼이 끝나고 지금 페이지에 머문다', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('try-btn').click();
  await page.getByTestId('tour-next').click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('setup-title')).toBeVisible();
  await expect(page.getByTestId('excel-input')).toHaveCount(1);
  // 블록 스케줄링 가이드에서 Esc로 닫아도 그 페이지에 남는다
  await step(page, '메뉴').click();
  await page.getByTestId('tutorial-guide-btn').click();
  for (let i = 0; i < 4; i++) await page.getByTestId('tour-next').click();
  await page.getByRole('button', { name: '다음: 블록 스케줄링 →' }).click();
  await expect(page.locator('.tour-card')).toContainText('1 / ');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(step(page, '블록 스케줄링')).toHaveClass(/on/);
  // 다시 공통 설정 입력으로 돌아와도 같은 화면(표 디자인), 튜토리얼이 끝났으니 편집 가능
  await step(page, '공통 설정 입력').click();
  await expect(page.getByTestId('setup-title')).toBeVisible();
  await expect(page.locator('.setup .plain-table')).toBeVisible();
  await expect(page.locator('.approval, .paper')).toHaveCount(0);
  const ids = page.locator('.edit-table input[aria-label="블록 ID"]');
  await expect(ids.nth(2)).toHaveValue('C-115');
  await expect(ids.first()).toBeEditable();
  await shot(page, '15-setup-after-tour');
});

test('튜토리얼: 가이드는 페이지 안에서만, 페이지는 직접 다음 버튼으로', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('try-btn').click();
  const card = page.locator('.tour-card');
  const next = page.getByTestId('tour-next');
  /** 지금 페이지 가이드를 끝까지 넘기고 (마지막은 확인/마치기), 그동안 페이지가 바뀌지 않는지 본다 */
  const runPage = async (label: string, count: number, lastButton: string) => {
    for (let i = 1; i <= count; i++) {
      await expect(card).toContainText(`${i} / ${count}`);
      await expect(step(page, label)).toHaveClass(/on/);
      await expect(next).toBeEnabled();
      await shot(page, `01-tour-${label}-${i}`);
      if (i === count) await expect(next).toHaveText(lastButton);
      await next.click();
    }
  };

  // 튜토리얼 중에는 위쪽 단계로 건너뛸 수 없다 (지금 페이지만)
  for (const label of ['메뉴', '블록 스케줄링', '결과']) await expect(step(page, label)).toBeDisabled();
  // 공통 설정 입력: 1/4 ~ 4/4, 예시로 채워진 읽기 전용 표
  await expect(page.getByTestId('excel-input')).toHaveCount(0);
  await expect(page.locator('.setup .plain-table')).toContainText('C-115');
  await runPage('공통 설정 입력', 4, '확인');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(step(page, '공통 설정 입력')).toHaveClass(/on/);
  await expect(page.getByTestId('excel-input')).toHaveCount(0);

  await page.getByRole('button', { name: '다음: 블록 스케줄링 →' }).click();
  await runPage('블록 스케줄링', 6, '확인');
  // 지나온 공통 설정 입력으로는 돌아갈 수 있고, 아직 안 간 결과는 막혀 있다
  await expect(step(page, '공통 설정 입력')).toBeEnabled();
  await expect(step(page, '결과')).toBeDisabled();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('[data-tour="kpi"]')).toContainText('5 / 5');

  await page.getByRole('button', { name: '다음: 결과 →' }).click();
  await runPage('결과', 2, '마치기');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // 끝나면 메뉴로
  await expect(page.locator('.tile')).toHaveCount(4);
});
