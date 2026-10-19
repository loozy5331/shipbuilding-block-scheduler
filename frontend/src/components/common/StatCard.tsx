import type { ReactNode } from 'react';
import { IconBadge } from '../icons/LineIcons';

type IconName = Parameters<typeof IconBadge>[0]['name'];

export function StatCard({ icon, label, value, unit, sub, tone }: { icon: IconName; label: string; value: ReactNode; unit?: string; sub?: ReactNode; tone?: 'good' | 'bad' }) {
  return (
    <div className={`stat-card ${tone ?? ''}`}>
      <IconBadge name={icon} />
      <div className="stat-body">
        <span className="stat-label">{label}</span>
        <span className="stat-value">
          {value}
          {unit && <small>{unit}</small>}
        </span>
        {sub && <span className="stat-sub">{sub}</span>}
      </div>
    </div>
  );
}
