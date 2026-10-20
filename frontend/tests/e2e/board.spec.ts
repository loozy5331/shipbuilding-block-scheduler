import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { drag, fromFrontend, shot, start, step } from './helpers';

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
  // 최적 값도 전체 블록 수와 함께 보여 준다
  await expect(page.getByTestId('report')).toContainText('최적 5 / 5개');
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

test('작업하지 않는 날: 주말 음영, 날짜 칸을 눌러 작업 불가 지정·해제, 최적화는 그날을 비운다', async ({ page }) => {
  await start(page, 'expert');
  await expect(page.getByTestId('plan-option')).toContainText('최적 배치 (1/');
  // 시작일 10/19(월) → 6·7일이 주말. 주말 칸은 처음에 좁게 접혀 있다
  await expect(page.getByTestId('day-6')).toHaveClass(/folded weekend/);
  expect((await page.getByTestId('day-6').boundingBox())!.width).toBeLessThan(30);
  // 접힌 칸을 누르면 주말 칸이 모두 펼쳐진다
  await page.getByTestId('day-6').click();
  await expect(page.getByTestId('day-6')).toHaveClass(/off weekend/);
  await expect(page.getByTestId('day-7')).toContainText('주말');
  await expect(page.getByTestId('fold-weekend')).toHaveAttribute('aria-pressed', 'false');
  // 펼친 주말 칸의 손잡이로 다시 접고, 왼쪽 위 스위치로도 펼치고 접는다
  await page.getByTestId('fold-handle-7').click();
  await expect(page.getByTestId('day-6')).toHaveClass(/folded weekend/);
  await page.getByTestId('fold-weekend').click();
  await expect(page.getByTestId('day-7')).toHaveClass(/off weekend/);
  await page.getByTestId('fold-weekend').click();
  await expect(page.getByTestId('day-7')).toHaveClass(/folded/);
  // 공휴일은 처음에 펼쳐 두고 같은 방식으로 접는다
  await expect(page.getByTestId('fold-holiday')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('day-5')).not.toHaveClass(/off/);

  // 2일을 작업 불가로: 그날에 걸친 막대는 빗금이 생기고 그만큼 늘어난다
  await page.getByTestId('day-2').click();
  await expect(page.getByTestId('day-2')).toHaveClass(/off manual/);
  await expect(page.locator('.toast')).toContainText('작업 불가 날짜로 지정');
  await expect(page.locator('.g-bar .bar-off').first()).toBeVisible();
  await expect(page.getByTestId('load-general-2')).toHaveAttribute('title', /^2일: 0 \//);

  // 다시 최적화해도 그날에는 착수하지 않는다 (막대 left = (2 - 1) × 96 + 3)
  await page.getByTestId('optimize-btn').click();
  await expect(page.getByTestId('plan-option')).toContainText('최적 배치 (1/');
  await expect(page.locator('.g-bar[style*="left: 99px"]')).toHaveCount(0);
  await expect(page.getByTestId('load-general-2')).toHaveAttribute('title', /^2일: 0 \//);
  await shot(page, '14-off-days');

  // 공통 설정에 지정한 날이 보이고, 모두 풀 수 있다
  await step(page, '공통 설정 입력').click();
  await expect(page.getByTestId('workdays')).toContainText('작업 불가로 지정: 10/20');
  await page.getByTestId('workdays').getByRole('button', { name: '모두 풀기' }).click();
  await expect(page.getByTestId('workdays')).not.toContainText('작업 불가로 지정');
  // 주말을 끄면 6일도 작업일
  await page.getByTestId('skip-weekends').uncheck();
  await page.getByRole('button', { name: '다음: 블록 스케줄링 →' }).click();
  await expect(page.getByTestId('day-6')).not.toHaveClass(/off/);
});

test('숙련자는 최적 배치로 시작하고, 다시 누르면 차선·차차선을 차례로 본다', async ({ page }) => {
  await start(page, 'expert');
  const btn = page.getByTestId('optimize-btn');
  // 들어오자마자 최적 배치가 적용되어 있다
  await expect(page.getByTestId('plan-option')).toContainText('최적 배치 (1/');
  await expect(page.getByTestId('waiting').locator('.g-block')).toHaveCount(0);
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

test('블록을 합의하고 다시 최적화하면 합의 블록은 그대로, 나머지만 다시 배치한다', async ({ page }) => {
  await start(page, 'expert');
  await expect(page.getByTestId('plan-option')).toContainText('최적 배치 (1/');
  // E-320을 최적과 다른 날로 옮기고 고정한다
  const bar = page.getByTestId('bar-E-320');
  await bar.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  const label = (await bar.getAttribute('aria-label'))!;
  const day = label.match(/(\d+)일 착수/)![1];
  const at = new RegExp(`^E-320 ${day}일 착수`);
  await page.getByTestId('pin-E-320').click();
  await expect(page.getByTestId('pin-E-320')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('pin-notice')).toContainText('합의 1개');
  await expect(bar).toHaveClass(/pinned/);
  // 합의한 막대는 방향키로 옮겨지지 않는다
  await bar.focus();
  await page.keyboard.press('ArrowRight');
  await expect(bar).toHaveAttribute('aria-label', at);

  const btn = page.getByTestId('optimize-btn');
  await expect(btn).toHaveText('합의 외 다시 최적화');
  await btn.click();
  await expect(page.getByTestId('plan-option')).toContainText('합의 1개 유지');
  await expect(bar).toHaveAttribute('aria-label', at);
  await expect(page.getByTestId('waiting')).toHaveCount(0);
  await shot(page, '13b-pinned');

  await page.getByRole('button', { name: '합의 모두 풀기' }).click();
  await expect(page.getByTestId('pin-notice')).toHaveCount(0);
  await expect(page.getByTestId('pin-E-320')).toHaveAttribute('aria-pressed', 'false');

  // 공통 설정 입력의 블록 표에서도 합의를 체크한다
  await step(page, '공통 설정 입력').click();
  await page.getByTestId('agree-D-208').check();
  await step(page, '블록 스케줄링').click();
  await expect(page.getByTestId('pin-D-208')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('pin-notice')).toContainText('D-208');
});

test('최적 배치로 줄이 재정렬되면 줄이 새 자리로 미끄러진다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await start(page, 'expert');
  // 숙련자는 최적 배치로 시작하므로, 적용된 뒤 초기화해야 다음 클릭이 다시 최적 배치(1안)가 된다
  await expect(page.getByTestId('plan-option')).toBeVisible();
  await page.getByRole('button', { name: '초기화' }).click();
  await expect(page.getByTestId('waiting').locator('.g-block')).toHaveCount(5);
  // 애니메이션이 짧아 끝난 뒤엔 안 보이므로 animate 호출을 센다
  await page.evaluate(() => {
    const w = window as unknown as { rowMoves: string[] };
    w.rowMoves = [];
    const orig = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, ...args: Parameters<Element['animate']>) {
      const id = (this as HTMLElement).dataset.testid;
      if (id?.startsWith('row-')) w.rowMoves.push(id);
      return orig.apply(this, args);
    };
  });
  await page.getByTestId('optimize-btn').click();
  await expect(page.getByTestId('plan-option')).toContainText('최적 배치 (1/');
  await expect.poll(() => page.evaluate(() => (window as unknown as { rowMoves: string[] }).rowMoves.length)).toBeGreaterThan(0);
});

test('간트 상호작용: 드롭 판정·클릭 배정·착수일 말풍선·숫자 편집', async ({ page }) => {
  await start(page, 'expert');
  await expect(page.getByTestId('plan-option')).toBeVisible();
  // 초기화하면 빈 간트에서 직접 배치한다 (최적 배치가 다시 덮어쓰지 않는다)
  await page.getByRole('button', { name: '초기화' }).click();
  await expect(page.getByTestId('waiting').locator('.g-block')).toHaveCount(5);
  await page.waitForTimeout(300);
  await expect(page.getByTestId('waiting').locator('.g-block')).toHaveCount(5);

  await drag(page, '[data-testid="chip-crane"]', '[data-testid="row-A-101"]');
  // 이미 크레인이 있는 블록 위로 끌면 빨간 표시와 이유, 놓으면 안내
  await drag(page, '[data-testid="chip-crane"]', '[data-testid="row-A-101"]', async () => {
    await expect(page.getByTestId('row-A-101')).toHaveClass(/drop-no/);
    await expect(page.getByTestId('row-A-101')).toContainText('이미 크레인이 있습니다');
    // fullPage 캡처는 창 크기를 바꿔 드래그를 취소시키므로 화면만 찍는다
    await page.screenshot({ path: fromFrontend('test-results/shots/08-drop-no.png') });
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
  await expect(page.getByRole('button', { name: '최적 배치', exact: true })).toHaveCount(0);
  // 신입은 빈 간트에서 직접 배치하며 시작한다
  await expect(page.getByTestId('waiting').locator('.g-block')).toHaveCount(5);
  // 다섯 블록을 작업자 1명 기준으로 한 줄로 이어도(작업일 11일 → 주말 포함 15일) 들어가게, 끌 여유 2칸까지
  await expect(page.locator('.g-header .g-day')).toHaveCount(17);

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
  await page.getByTestId('excel-input').setInputFiles(fromFrontend('public/sample-30-blocks.xlsx'));
  await expect(page.locator('.parse-result')).toContainText('블록 30개 읽음');
  await page.getByRole('button', { name: '다음: 블록 스케줄링 →' }).click();
  await page.getByTestId('optimize-btn').click();
  await expect(page.getByTestId('verdict')).not.toContainText('판정 중');
  await shot(page, '06-thirty');
});

test('용어 옆 i 아이콘에 설명을 띄우고, 최적 배치 기준을 보여 준다', async ({ page }) => {
  await start(page, 'expert');
  // 올리면 뜨고, 벗어나면 닫힌다
  await page.getByTestId('optimal-tip').hover();
  await expect(page.getByRole('tooltip')).toContainText('최적 배치 기준');
  await expect(page.getByRole('tooltip').locator('li')).toHaveCount(7);
  await page.mouse.move(0, 0);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.getByTestId('term-load').click();
  await expect(page.getByRole('tooltip')).toContainText('빨간 칸은 보유량을 넘은 것');

  // 누르면 고정되고, 다시 누르거나 Esc로 닫는다
  await page.getByRole('button', { name: '← 공통 설정 입력' }).click();
  await page.getByTestId('term-mh').click();
  await page.mouse.move(0, 0);
  await expect(page.getByRole('tooltip')).toContainText('한 사람이 한 시간 일한 양');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.getByTestId('term-slots').click();
  await expect(page.getByRole('tooltip')).toContainText('동시 처리 블록 수');
  await page.getByTestId('term-slots').click();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
});
