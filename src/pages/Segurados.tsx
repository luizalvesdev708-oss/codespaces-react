import type { DashboardData } from '../@types/censo';
import BarChart from '../components/BarChart';
import MetricCard from '../components/MetricCard';
import OfflineInsuredDrafts from '../components/OfflineInsuredDrafts';
import { formatCompetence, formatCount, formatMoney, formatPercent } from '../utils/format';
interface SeguradosProps { data: DashboardData; userId: string; canWrite: boolean; isOnline: boolean }
export default function Segurados({ data, userId, canWrite, isOnline }: SeguradosProps) {
  const { payroll, censo, cargo_counts: cargos } = data;
  const topCargos = Object.entries(cargos).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  const benefits = payroll.beneficios.map(({ tipo, quantidade }) => ({ label: tipo, value: quantidade }));
  const competence = formatCompetence(data.filters ? data.filters.competence : '2026-03-01');
  return <>
    <div className="page-heading"><div><h1>Segurados e base do RPPS</h1><p>Consolidação do recenseamento e da relação de funcionários</p></div><span className="status-badge">Folha · {competence}</span></div>
    <section className="metric-grid"><MetricCard label="Funcionários ativos" value={formatCount(payroll.ativos.quantidade)} /><MetricCard label="Aposentados e pensionistas" value={formatCount(payroll.beneficiarios)} /><MetricCard label="Pessoas na folha" value={formatCount(payroll.ativos.quantidade + payroll.beneficiarios)} /><MetricCard label="Registros no recenseamento" value={formatCount(censo.registros)} /><MetricCard label="Cobertura quantitativa" value={formatPercent(censo.registros, payroll.ativos.quantidade + payroll.beneficiarios)} /><MetricCard label="Entidades no recenseamento" value={formatCount(censo.entidades)} /></section>
    <div className="content-grid"><section className="panel"><h2 className="panel__title">Beneficiários por tipo</h2><div className="panel__body"><BarChart items={benefits} /></div></section>
      <section className="panel"><h2 className="panel__title">Principais cargos no recenseamento</h2><div className="panel__body"><BarChart color="blue" items={topCargos} /></div></section>
      <section className="panel"><h2 className="panel__title">Folha por grupo previdenciário</h2><div className="panel__body"><BarChart color="orange" items={[{ label: 'Ativos', value: payroll.ativos.quantidade }, ...benefits.map((item) => ({ ...item, label: item.label.replace('Aposentados ', 'Apos. ').replace('Aposentadoria ', 'Apos. ') }))]} /></div></section>
      <section className="panel"><h2 className="panel__title">Contribuição patronal · ativos</h2><div className="panel__body"><dl className="detail-list"><div><dt>Valor patronal</dt><dd>{formatMoney(payroll.ativos.patronal)}</dd></div><div><dt>Base de contribuição</dt><dd>{formatMoney(payroll.ativos.base)}</dd></div><div><dt>Descontos</dt><dd>{formatMoney(payroll.ativos.descontos)}</dd></div></dl></div></section>
    </div>
    <OfflineInsuredDrafts userId={userId} canWrite={canWrite} isOnline={isOnline} />
  </>;
}