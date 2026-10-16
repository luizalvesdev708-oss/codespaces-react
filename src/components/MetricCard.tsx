interface MetricCardProps { label: string; value: string | number }
export default function MetricCard({ label, value }: MetricCardProps) {
  return <article className="metric-card bg-rpps-card border-rpps-border"><span className="metric-card__label">{label}</span><strong className="metric-card__value">{value}</strong></article>;
}