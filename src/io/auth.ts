/** 로그인 API 호출. 실패하면 서버 메시지(없으면 연결 오류)를 담아 던진다 */
export async function requestAuth(kind: 'login' | 'signup', id: string, password: string): Promise<{ id: string; tutorialSeen: boolean }> {
  let res: Response;
  try {
    res = await fetch(`/api/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password }),
    });
  } catch {
    throw new Error('서버에 연결하지 못했습니다. 체험하기로 둘러보세요.');
  }
  const data = (await res.json().catch(() => ({}))) as { id?: string; tutorialSeen?: boolean; message?: string };
  if (!res.ok || !data.id) throw new Error(data.message ?? '서버에 연결하지 못했습니다. 체험하기로 둘러보세요.');
  return { id: data.id, tutorialSeen: data.tutorialSeen === true };
}

/** 튜토리얼 가이드를 봤다고 서버(DB)에 기록한다. 실패해도 진행에는 지장이 없으니 무시한다 */
export function reportTutorialSeen(id: string): void {
  fetch('/api/tutorial-seen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => undefined);
}
