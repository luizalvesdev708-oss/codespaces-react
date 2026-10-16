import type { DashboardData } from '../@types/censo';
import BarChart from '../components/BarChart';
import MetricCard from '../components/MetricCard';
import { formatCompetence, formatMoney, formatPercent } from '../utils/format';
interface ContribuicoesProps { data: DashboardData }
export default function Contribuicoes({ data }: ContribuicoesProps) {
  const { ativos } = data.payroll;
  const competence = formatCompetence(data.filters ? data.filters.competence : '2026-03-01');
  return <>
    <div className="page-heading"><div><h1>Contribuições e base previdenciária</h1><p>Relação de funcionários do RPPS · {competence}</p></div><span className="status-badge">{ativos.quantidade} ativos</span></div>
    <section className="metric-grid"><MetricCard label="Funcionários" value={ativos.quantidade} /><MetricCard label="Proventos" value={formatMoney(ativos.proventos)} /><MetricCard label="Valor base" value={formatMoney(ativos.base)} /><MetricCard label="Descontos" value={formatMoney(ativos.descontos)} /><MetricCard label="Contribuição patronal" value={formatMoney(ativos.patronal)} /><MetricCard label="Líquido estimado" value={formatMoney(ativos.proventos - ativos.descontos)} /></section>
    <div className="content-grid"><section className="panel"><h2 className="panel__title">Proventos, base, descontos e patronal</h2><div className="panel__body"><BarChart color="blue" items={[{ label: 'Proventos', value: ativos.proventos, display: formatMoney(ativos.proventos) }, { label: 'Valor base', value: ativos.base, display: formatMoney(ativos.base) }, { label: 'Descontos', value: ativos.descontos, display: formatMoney(ativos.descontos) }, { label: 'Patronal', value: ativos.patronal, display: formatMoney(ativos.patronal) }]} /></div></section>
      <section className="panel"><h2 className="panel__title">Indicadores da folha ativa</h2><div className="panel__body"><dl className="detail-list"><div><dt>Base / proventos</dt><dd>{formatPercent(ativos.base, ativos.proventos)}</dd></div><div><dt>Descontos / proventos</dt><dd>{formatPercent(ativos.descontos, ativos.proventos)}</dd></div><div><dt>Patronal / base</dt><dd>{formatPercent(ativos.patronal, ativos.base)}</dd></div></dl></div></section>
    </div><p className="note">Valores consolidados informados na Relação de Funcionários do RPPS, competência {competence}.</p>
  </>;
}