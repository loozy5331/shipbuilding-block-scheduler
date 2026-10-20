import type { ReactNode } from 'react';

/**
 * 좌: 입력, 우: 상태(스크롤해도 따라오는 고정 칸). 좁은 화면에서는 상태가 위로 올라간다.
 * 탭 순서는 입력부터이므로 DOM은 입력이 먼저다.
 */
export function SideLayout({ side, foot, children }: { side: ReactNode; foot?: ReactNode; children: ReactNode }) {
  return (
    <div className="side-layout">
      <div className="side-main">{children}</div>
      <aside className="side" aria-label="상태">
        <div className="side-body">{side}</div>
        {foot && <div className="side-foot">{foot}</div>}
      </aside>
    </div>
  );
}
