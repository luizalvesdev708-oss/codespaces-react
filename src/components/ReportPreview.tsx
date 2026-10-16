import type { ReportChartGroup, ReportMetric, ReportRow, ReportView } from '../@types/reports';
import { formatCount, formatMoney } from '../utils/format';

interface ReportPreviewProps {
  title: string;
  description: string;
  period: string;
  metrics: ReportMetric[];
  rows: ReportRow[];
  selectedViews: ReportView[];
  loading: boolean;
  chartItems: Array<{ label: string; value: number }>;
  chartGroups?: ReportChartGroup[];
}

const viewLabels: Record<ReportView, string> = { cards: 'Cartões KPI', table: 'Tabela', bar: 'Barras', line: 'Linha' };
const formatCell = (key: string, value: string | number) => {
  if (typeof value !== 'number') return value;
  return /valor|proventos|descontos|líquido|líquido|base|patronal/i.test(key) ? formatMoney(value) : formatCount(value);
};

function Chart({ items, type }: { items: Array<{ label: string; value: number }>; type: 'bar' | 'line' }) {
  if (!items.length) return <p className="empty-state">Sem dados para representar.</p>;
  const max = Math.max(1, ...items.map((item) => item.value));
  const points = items.map((item, index) => ({ ...item, x: 46 + index * (610 / Math.max(1, items.length - 1)), y: 178 - (item.value / max) * 135 }));
  const path = points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ');
  return <div className="report-chart" role="img" aria-label={type === 'bar' ? 'Gráfico de barras do relatório' : 'Gráfico de linha do relatório'}>
    <svg viewBox="0 0 700 230" aria-hidden="true">
      {[40, 85, 130, 178].map((y) => <line key={y} x1="38" y1={y} x2="675" y2={y} className="report-chart__grid" />)}
      {type === 'line' && <path d={path} className="report-chart__line" />}
      {points.map((point, index) => <g key={`${point.label}-${index}`}>
        {type === 'bar' ? <rect x={point.x - Math.min(18, 240 / points.length)} y={point.y} width={Math.min(36, 480 / points.length)} height={178 - point.y} rx="5" className="report-chart__bar" /> : <circle cx={point.x} cy={point.y} r="5" className="report-chart__point" />}
        <text x={point.x} y="202" textAnchor="middle" className="report-chart__label">{point.label.length > 13 ? `${point.label.slice(0, 12)}…` : point.label}</text>
        <text x={point.x} y={Math.max(25, point.y - 8)} textAnchor="middle" className="report-chart__value">{formatCount(point.value)}</text>
      </g>)}
    </svg>
  </div>;
}

export default function ReportPreview({
  title,
  description,
  period,
  metrics,
  rows,
  selectedViews,
  loading,
  chartItems,
  chartGroups,
}: ReportPreviewProps) {
  if (loading) return <section className="report-preview panel" aria-live="polite"><div className="report-loading"><span className="report-spinner" aria-hidden="true" />Preparando pré-visualização…</div></section>;
  const columns = rows.length ? Object.keys(rows[0]) : [];

  return <section className="report-preview panel report-print-area" aria-labelledby="reportPreviewTitle" aria-live="polite">
    <header className="report-preview__heading">
      <div><p className="report-kicker">Pré-visualização do relatório</p><h2 id="reportPreviewTitle">{title}</h2><p>{description}</p></div>
      <div className="report-preview__period"><span>Período</span><strong>{period}</strong></div>
    </header>
    <div className="report-preview__meta"><span>Fonte: dados do painel previdenciário</span><span>Gerado em: {new Date().toLocaleDateString('pt-BR')}</span></div>
    {rows.length === 0 && <div className="report-empty" role="status"><strong>Nenhum dado encontrado</strong><span>Altere o intervalo ou os filtros para gerar uma prévia.</span></div>}
    {rows.length > 0 && <>
      {selectedViews.includes('cards') && <section className="report-preview__section" aria-label="Indicadores do relatório"><h3>Indicadores selecionados</h3><div className="report-metric-grid">{metrics.map((metric) => <article className="report-metric" key={metric.key}><span>{metric.label}</span><strong>{metric.format === 'money' ? formatMoney(metric.value) : metric.format === 'percent' ? `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(metric.value)}%` : formatCount(metric.value)}</strong></article>)}</div></section>}
      {selectedViews.some((view) => view === 'bar' || view === 'line') && (
        <section className="report-preview__section">
          <h3>Visualização gráfica</h3>
          <div className="report-chart-grid">
            {chartGroups
              ? chartGroups
                .filter((group) => selectedViews.includes(group.view))
                .map((group) => (
                  <div key={group.title}>
                    <h4>{group.title}</h4>
                    <Chart items={group.items} type={group.view} />
                  </div>
                ))
              : selectedViews
                .filter((view) => view === 'bar' || view === 'line')
                .map((view) => (
                  <div key={view}>
                    <h4>{viewLabels[view]}</h4>
                    <Chart items={chartItems} type={view} />
                  </div>
                ))}
          </div>
        </section>
      )}
      {selectedViews.includes('table') && <section className="report-preview__section"><h3>Dados do relatório <span>{formatCount(rows.length)} linha(s)</span></h3><div className="report-table-wrap"><table className="report-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column) => <td key={column}>{formatCell(column, row[column])}</td>)}</tr>)}</tbody></table></div></section>}
    </>}
    <footer className="report-preview__footer">Esta prévia minimiza dados pessoais e mascara CPFs. Exportação completa descriptografada é restrita a ADMIN e requer confirmação.</footer>
  </section>;
}
