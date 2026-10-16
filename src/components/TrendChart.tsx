interface TrendChartProps { entries: [string, number][] }

const chart = {
  left: 42,
  right: 370,
  top: 22,
  bottom: 137,
  labelY: 165,
};

function dateValue(value: string): number {
  const [day, month, year] = value.split('/').map(Number);
  if (!day || !month || !year) return Number.NaN;
  return Date.UTC(year, month - 1, day);
}

function sortDates([left]: [string, number], [right]: [string, number]): number {
  const leftDate = dateValue(left);
  const rightDate = dateValue(right);
  if (Number.isNaN(leftDate) || Number.isNaN(rightDate)) return left.localeCompare(right, 'pt-BR');
  return leftDate - rightDate;
}

function shortDate(value: string): string {
  const [day, month] = value.split('/');
  return day && month ? `${day}/${month}` : value;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value);
}

export default function TrendChart({ entries }: TrendChartProps) {
  const ordered = [...entries].sort(sortDates);
  if (!ordered.length) {
    return <p className="trend-chart__empty">Não há cadastros no período selecionado.</p>;
  }

  const maximum = ordered.reduce((highest, [, value]) => Math.max(highest, value), 0);
  const minimum = ordered.reduce((lowest, [, value]) => Math.min(lowest, value), Number.POSITIVE_INFINITY);
  const range = maximum - minimum;
  const points = ordered.map(([date, value], index) => ({
    date,
    value,
    x: ordered.length > 1
      ? chart.left + index * ((chart.right - chart.left) / (ordered.length - 1))
      : (chart.left + chart.right) / 2,
    y: range === 0
      ? (chart.top + chart.bottom) / 2
      : chart.bottom - ((value - minimum) / range) * (chart.bottom - chart.top),
  }));
  const line = points.map(({ x, y }, index) => `${index ? 'L' : 'M'} ${x} ${y}`).join(' ');

  const tickCount = Math.min(5, points.length);
  const tickIndexes = Array.from({ length: tickCount }, (_, index) => (
    tickCount === 1 ? 0 : Math.round(index * (points.length - 1) / (tickCount - 1))
  ));
  const maxIndex = points.reduce((best, point, index) => (
    point.value > points[best]!.value ? index : best
  ), 0);
  const valueLabelIndexes = [...new Set([0, maxIndex, points.length - 1])];

  return <div className="trend-chart" role="img" aria-label={`Cadastros por data: ${formatCount(ordered.reduce((total, [, value]) => total + value, 0))} registros em ${ordered.length} datas`}>
    <svg viewBox="0 0 400 180" preserveAspectRatio="none" aria-hidden="true">
      {[0, 0.5, 1].map((fraction) => {
        const y = chart.bottom - fraction * (chart.bottom - chart.top);
        const value = minimum + range * fraction;
        return <g key={fraction}>
          <line x1={chart.left} x2={chart.right} y1={y} y2={y} className="trend-chart__grid" />
          <text x={chart.left - 7} y={y + 3} textAnchor="end" className="trend-chart__axis-value">{formatCount(value)}</text>
        </g>;
      })}
      <path d={line} className="trend-chart__line" />
      {points.map(({ date, value, x, y }) => <circle key={date} cx={x} cy={y} r={points.length <= 30 ? 2.5 : 1.5} className="trend-chart__point">
        <title>{`${date}: ${formatCount(value)} cadastros`}</title>
      </circle>)}
      {valueLabelIndexes.map((index) => {
        const point = points[index]!;
        const anchor = index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle';
        const x = index === 0 ? point.x + 2 : index === points.length - 1 ? point.x - 2 : point.x;
        return <text key={`value-${point.date}`} x={x} y={Math.max(chart.top - 7, point.y - 8)} textAnchor={anchor} className="trend-chart__value">
          {formatCount(point.value)}
        </text>;
      })}
      {tickIndexes.map((index) => {
        const point = points[index]!;
        const anchor = index === 0 ? 'start' : index === tickIndexes.length - 1 ? 'end' : 'middle';
        return <text key={`date-${point.date}`} x={point.x} y={chart.labelY} textAnchor={anchor} className="trend-chart__label">
          {shortDate(point.date)}
        </text>;
      })}
    </svg>
  </div>;
}
