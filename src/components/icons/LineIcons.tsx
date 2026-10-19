/** 발표 자료의 원형 배경 위 라인 아이콘 */
type Name = 'ship' | 'block' | 'yard' | 'clock' | 'clipboard' | 'gear' | 'bulb' | 'chart' | 'alert' | 'check' | 'sort' | 'coins' | 'upload' | 'download';

const PATHS: Record<Name, string> = {
  ship: 'M12 3v4M9 7h6v4H9zM4 14l8-3 8 3-2 5H6zM3 21c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1',
  block: 'M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8M7 4.5v2M17 4.5v2',
  yard: 'M4 21V5h3v16M7 6h11v3M15 9v3M3 21h18M10 21v-5l4-2 4 2v5M12 21v-3h2v3',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  clipboard: 'M9 4h6v3H9zM7 5H5v16h14V5h-2M8 11h8M8 15h5M8 11l0 0',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3zM12 0v1M4 4l1 1M20 4l-1 1',
  chart: 'M5 20V12h3v8zM10.5 20V8h3v12zM16 20V4h3v16z',
  alert: 'M12 3l10 18H2zM12 10v5M12 18v.5',
  check: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM7 12l3.5 3.5L17 9',
  sort: 'M4 5h10v4H4zM4 14h10v4H4zM19 6v12M16 15l3 3 3-3',
  coins: 'M4 14c0-1 2-2 5-2s5 1 5 2-2 2-5 2-5-1-5-2zM4 14v4c0 1 2 2 5 2s5-1 5-2v-4M10 8c0-1 2-2 5-2s5 1 5 2-2 2-5 2-5-1-5-2zM10 8v4M20 8v8c0 1-2 2-5 2',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
  download: 'M12 4v12M7 11l5 5 5-5M4 16v4h16v-4',
};

export function LineIcon({ name, size = 24, color = 'currentColor' }: { name: Name; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

export function IconBadge({ name, size = 48 }: { name: Name; size?: number }) {
  return (
    <span className="icon-badge" style={{ width: size, height: size }}>
      <LineIcon name={name} size={size * 0.52} />
    </span>
  );
}
