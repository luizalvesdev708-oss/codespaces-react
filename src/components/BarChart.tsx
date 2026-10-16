import { formatCount } from '../utils/format';
export interface BarChartItem { label: string; value: number; display?: string }
interface BarChartProps { items: BarChartItem[]; color?: 'green' | 'blue' | 'orange' }
export default function BarChart({ items, color = 'green' }: BarChartProps) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return <div className={`bar-chart bar-chart--${color}`} role="img" aria-label="Gráfico de barras">{items.map((item) => <div className="bar-chart__row" key={item.label}><span className="bar-chart__label" title={item.label}>{item.label}</span><span className="bar-chart__track"><span style={{ width: `${(item.value / max) * 100}%` }} /></span><strong className="bar-chart__value">{item.display ?? formatCount(item.value)}</strong></div>)}</div>;
}