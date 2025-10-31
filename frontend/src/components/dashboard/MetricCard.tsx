import { clsx } from 'clsx';
import './metricCard.css';

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: 'blue' | 'pink' | 'purple';
}

export function MetricCard({ label, value, icon, accent = 'blue' }: MetricCardProps) {
  return (
    <div className={clsx('metric-card', `metric-card--${accent}`)}>
      <div className="metric-card__icon">{icon}</div>
      <div className="metric-card__content">
        <span className="metric-card__label">{label}</span>
        <strong className="metric-card__value">{value}</strong>
      </div>
    </div>
  );
}
