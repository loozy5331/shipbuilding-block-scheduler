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

/** 체험하기로 들어가 모드를 고르고(첫 방문이면 튜토리얼 가이드가 열리므로 건너뛴다) 샘플로 블록 스케줄링까지. sample이 아니면 메뉴에서 멈춘다 */
async function start(page: Page, mode: 'expert' | 'novice', sample = true) {
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

test('진입 화면: 로그인 · 체험하기 → 田자 메뉴 → 엑셀 업로드', async ({ page }) => {
  await page.goto('/');
  // 기본은 숙련자, 오른쪽 위 토글로 바꾼다
  await expect(page.getByTestId('mode-expert')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('login-id')).toBeVisible();
  await expect(page.getByTestId('login-password')).toBeVisible();
  await shot(page, '00-login');
  await page.getByTestId('mode-novice').click();
  await page.getByTestId('try-btn').click();
  await page.getByRole('button', { name: '건너뛰기' }).click();
  await step(page, '메뉴').click();
  await expect(page.locator('.tile')).toHaveCount(4);
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

  await page.getByTestId('home-excel-input').setInputFiles(path.resolve('public/sample-tutorial.xlsx'));
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
  await page.getByTestId('tile-tutorial').click();
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

  // 공통 설정 입력: 1/4 ~ 4/4, 예시로 채워진 읽기 전용 표
  await expect(page.getByTestId('excel-input')).toHaveCount(0);
  await expect(page.locator('.setup .plain-table')).toContainText('C-115');
  await runPage('공통 설정 입력', 4, '확인');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(step(page, '공통 설정 입력')).toHaveClass(/on/);
  await expect(page.getByTestId('excel-input')).toHaveCount(0);

  await page.getByRole('button', { name: '다음: 블록 스케줄링 →' }).click();
  await runPage('블록 스케줄링', 6, '확인');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('[data-tour="kpi"]')).toContainText('5 / 5');

  await page.getByRole('button', { name: '다음: 결과 →' }).click();
  await runPage('결과', 2, '마치기');
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
  // 작업자가 없으면 막대는 필요 작업시간 기준 길이(24MH ÷ 8 = 3일), 작업자를 놓을수록 짧아진다
  await expect(page.getByTestId('ghost-B-203')).toContainText('24MH · 3일');
  await drag(page, '[data-testid="chip-crane"]', '[data-testid="row-B-203"]');
  await expect(page.getByTestId('wp-1').getByTestId('bar-B-203')).toBeVisible();
  expect(Math.round((await page.getByTestId('bar-B-203').boundingBox())!.width)).toBe(3 * 96 - 6);
  for (let i = 0; i < 3; i++) await drag(page, '[data-testid="chip-general"]', '[data-testid="row-B-203"]');
  expect(Math.round((await page.getByTestId('bar-B-203').boundingBox())!.width)).toBe(96 - 6);
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

  // 대기 블록의 점선 막대를 작업장 테두리 안으로 끌어 놓기
  const ghost = (await page.getByTestId('ghost-E-320').boundingBox())!;
  const wp0b = (await page.getByTestId('wp-0').boundingBox())!;
  await drag(page, '[data-testid="ghost-E-320"]', { dy: wp0b.y + wp0b.height / 2 - (ghost.y + ghost.height / 2) }, async () => {
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

test('최적 배치를 다시 누르면 차선·차차선을 차례로 본다', async ({ page }) => {
  await start(page, 'expert');
  const btn = page.getByTestId('optimize-btn');
  await btn.click();
  await expect(page.getByTestId('plan-option')).toContainText('최적 배치 (1/');
  const first = await page.getByTestId('plan-option').innerText();
  const total = Number(first.match(/\(1\/(\d)\)/)![1]);
  expect(total).toBeGreaterThan(1);
  expect(total).toBeLessThanOrEqual(3);
  await expect(btn).toHaveText(`다음 최적배치 후보 (1/${total})`);
  await btn.click();
  await expect(page.getByTestId('plan-option')).toContainText(`차선 (2/${total})`);
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
    await expect(page.locator('.asm.p-done')).toBeVisible({ timeout: 9000 });
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
