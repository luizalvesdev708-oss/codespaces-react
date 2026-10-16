import type { DashboardData } from '../@types/censo';
import BarChart from '../components/BarChart';
import MetricCard from '../components/MetricCard';
import { formatCompetence, formatCount, formatMoney } from '../utils/format';
interface BeneficiosProps { data: DashboardData }
export default function Beneficios({ data }: BeneficiosProps) {
  const { payroll } = data;
  const competence = formatCompetence(data.filters ? data.filters.competence : '2026-03-01');
  return <>
    <div className="page-heading"><div><h1>Benefícios previdenciários</h1><p>Folha de pagamento analítica · {competence}</p></div><span className="status-badge">{formatCount(payroll.beneficiarios)} beneficiários</span></div>
    <section className="metric-grid"><MetricCard label="Beneficiários" value={formatCount(payroll.beneficiarios)} /><MetricCard label="Vencimentos" value={formatMoney(payroll.total_vencimentos_beneficios)} /><MetricCard label="Descontos" value={formatMoney(payroll.total_descontos_beneficios)} /><MetricCard label="Líquido" value={formatMoney(payroll.total_liquido_beneficios)} /><MetricCard label="Competência" value={competence} /></section>
    <div className="content-grid"><section className="panel"><h2 className="panel__title">Beneficiários por tipo</h2><div className="panel__body"><BarChart items={payroll.beneficios.map((item) => ({ label: item.tipo, value: item.quantidade }))} /></div></section>
      <section className="panel"><h2 className="panel__title">Vencimentos por tipo de benefício</h2><div className="panel__body"><BarChart color="blue" items={payroll.beneficios.map((item) => ({ label: item.tipo, value: item.vencimentos, display: formatMoney(item.vencimentos) }))} /></div></section>
      <section className="panel panel--wide"><h2 className="panel__title">Detalhamento da folha previdenciária</h2><div className="table-wrap"><table><thead><tr><th>Tipo</th><th className="numeric">Qtd.</th><th className="numeric">Vencimentos</th><th className="numeric">Descontos</th><th className="numeric">Líquido</th></tr></thead><tbody>{payroll.beneficios.map((item) => <tr key={item.tipo}><td>{item.tipo}</td><td className="numeric">{formatCount(item.quantidade)}</td><td className="numeric">{formatMoney(item.vencimentos)}</td><td className="numeric">{formatMoney(item.descontos)}</td><td className="numeric">{formatMoney(item.liquido)}</td></tr>)}</tbody></table></div></section>
    </div>
  </>;
}