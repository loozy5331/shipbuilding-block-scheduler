import type { ResourceKind } from '../../domain/types';

interface P {
  size?: number;
}

/** 노란 안전모 작업자 */
export function WorkerIcon({ size = 28, helmet = '#F2B705', star = false }: P & { helmet?: string; star?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M6 30c0-6 4.5-9 10-9s10 3 10 9z" fill="#2B3445" />
      <path d="M13 21l3 4 3-4" fill="#F4F4F4" />
      <circle cx="16" cy="15" r="5.6" fill="#F3C9A0" />
      <path d="M9 13.2c0-4.6 3.1-7.6 7-7.6s7 3 7 7.6z" fill={helmet} stroke="#1E2533" strokeWidth="1" />
      <rect x="7.4" y="12.6" width="17.2" height="2.2" rx="1.1" fill={helmet} stroke="#1E2533" strokeWidth="1" />
      <rect x="15.2" y="5.8" width="1.6" height="7" fill="#1E2533" opacity=".35" />
      {star && (
        <path
          d="M16 6.6l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z"
          fill="#FFE27A"
          stroke="#1E2533"
          strokeWidth=".5"
        />
      )}
    </svg>
  );
}

export function SkilledIcon({ size = 28 }: P) {
  return <WorkerIcon size={size} helmet="#7B5CC9" star />;
}

/** 빨간 갠트리 크레인 */
export function CraneIcon({ size = 28 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect x="2.5" y="2.5" width="27" height="27" rx="5" fill="#FFF4EC" stroke="#E07A2E" strokeWidth="1.6" />
      <g fill="none" stroke="#C8373A" strokeWidth="2.2" strokeLinecap="round">
        <path d="M8 26V8M24 26V8M6 8h20" />
        <path d="M8 13l4-5M24 13l-4-5" strokeWidth="1.4" />
      </g>
      <path d="M16 8v8" stroke="#1E2533" strokeWidth="1.2" />
      <path d="M14 16h4l-.6 3h-2.8z" fill="#1E2533" />
      <rect x="12" y="20" width="8" height="5" rx=".8" fill="#9AA6B2" stroke="#1E2533" strokeWidth=".8" />
      <path d="M5 26h22" stroke="#1E2533" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** 비상 자재 상자 */
export function MaterialIcon({ size = 28 }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 10l12-6 12 6v13l-12 6-12-6z" fill="#E7C79A" stroke="#7A5A2E" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M4 10l12 6 12-6M16 16v13" fill="none" stroke="#7A5A2E" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M10 7l12 6v4" fill="none" stroke="#C9A36E" strokeWidth="1.6" />
      <circle cx="23" cy="21" r="5" fill="#fff" stroke="#C8373A" strokeWidth="1.2" />
      <path d="M23 18.2v5.6M20.2 21h5.6" stroke="#C8373A" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function ResourceIcon({ kind, size }: P & { kind: ResourceKind }) {
  switch (kind) {
    case 'general':
      return <WorkerIcon size={size} />;
    case 'skilled':
      return <SkilledIcon size={size} />;
    case 'crane':
      return <CraneIcon size={size} />;
    case 'emergency':
      return <MaterialIcon size={size} />;
  }
}

export const RESOURCE_LABEL: Record<ResourceKind, string> = {
  general: '작업자',
  skilled: '숙련공',
  crane: '크레인',
  emergency: '비상 자재',
};
