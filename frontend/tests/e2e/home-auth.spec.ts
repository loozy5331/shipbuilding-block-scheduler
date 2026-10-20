import { expect, test } from '@playwright/test';
import { fromFrontend, shot } from './helpers';

test('진입 화면: 로그인 · 체험하기 → 田자 메뉴 → 엑셀 업로드', async ({ page }) => {
  await page.goto('/');
  // 기본은 숙련자, 오른쪽 위 토글로 바꾼다
  await expect(page.getByTestId('mode-expert')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('login-id')).toBeVisible();
  await expect(page.getByTestId('login-password')).toBeVisible();
  await shot(page, '00-login');
  await page.getByTestId('mode-novice').click();
  // 체험하기는 처음이어도 가이드 없이 메뉴로
  await page.getByTestId('try-btn').click();
  await expect(page.locator('.tile')).toHaveCount(4);
  await expect(page.locator('.tour-card')).toHaveCount(0);
  // 로그인 후에는 모드를 표시만 한다
  await expect(page.locator('.mode-chip')).toHaveText('신입');
  await expect(page.locator('.mode-toggle')).toHaveCount(0);
  await shot(page, '00-home');

  await page.getByTestId('tile-settings').click();
  const dlg = page.getByRole('dialog', { name: '설정' });
  await dlg.getByRole('switch').uncheck();
  await expect(dlg.getByRole('button', { name: '숙련자' })).toHaveCount(0);
  await dlg.getByRole('button', { name: '닫기' }).click();

  // 엑셀 양식 도움말: 필수 열과 예시, 양식 내려받기
  await page.getByTestId('excel-help').click();
  const help = page.getByRole('dialog', { name: '엑셀 업로드 양식' });
  for (const col of ['블록 ID', '납기일', '필요 작업 시간', '자재준비 여부']) await expect(help).toContainText(col);
  const template = page.waitForEvent('download');
  await help.getByRole('button', { name: '양식 내려받기' }).click();
  expect((await template).suggestedFilename()).toBe('블록_입력_양식.xlsx');
  await shot(page, '14-excel-help');
  await help.getByRole('button', { name: '닫기' }).click();

  await page.getByTestId('home-excel-input').setInputFiles(fromFrontend('public/sample-tutorial.xlsx'));
  await expect(page.locator('.toast')).toContainText('블록 5개 읽음');
  await expect(page.locator('[data-tour="summary"]')).toContainText('80');
});

test('회원가입 → 로그아웃 → 아이디·비밀번호로 로그인', async ({ page }) => {
  const id = `user_${Date.now() % 1e8}`;
  await page.goto('/');
  await page.getByTestId('login-switch').click();
  await expect(page.getByRole('heading', { name: '회원가입' })).toBeVisible();
  await page.getByTestId('login-id').fill(id);
  await page.getByTestId('login-password').fill('secret1');
  await page.getByTestId('login-confirm').fill('secret2');
  await page.getByTestId('login-submit').click();
  await expect(page.getByRole('alert')).toHaveText('비밀번호가 서로 다릅니다.');
  await page.getByTestId('login-confirm').fill('secret1');
  await shot(page, '00-signup');
  await page.getByTestId('login-submit').click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await expect(page.locator('.user-chip')).toContainText(id);

  await page.getByTestId('logout-btn').click();
  await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
  // 같은 아이디로 다시 가입할 수 없다
  await page.getByTestId('login-switch').click();
  await page.getByTestId('login-id').fill(id);
  await page.getByTestId('login-password').fill('secret1');
  await page.getByTestId('login-confirm').fill('secret1');
  await page.getByTestId('login-submit').click();
  await expect(page.getByRole('alert')).toHaveText('이미 있는 아이디입니다.');
  await page.getByTestId('login-switch').click();

  await page.getByTestId('login-id').fill(id);
  await page.getByTestId('login-password').fill('wrong12');
  await page.getByTestId('login-submit').click();
  await expect(page.getByRole('alert')).toHaveText('아이디 또는 비밀번호가 올바르지 않습니다.');
  await page.getByTestId('login-password').fill('secret1');
  await page.getByTestId('login-submit').click();
  // 튜토리얼은 이미 봤으니 메뉴로
  await expect(page.locator('.tile')).toHaveCount(4);
  await expect(page.locator('.user-chip')).toContainText(id);
});
