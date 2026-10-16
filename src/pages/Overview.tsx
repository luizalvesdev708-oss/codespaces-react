import type { CSSProperties } from 'react';
import type { DashboardData } from '../@types/censo';
import BarChart from '../components/BarChart';
import MetricCard from '../components/MetricCard';
import TrendChart from '../components/TrendChart';
import { formatCompetence, formatCount, formatMoney, formatPercent } from '../utils/format';
interface OverviewProps { data: DashboardData }

function BenefitDonut({ items }: { items: Array<{ label: string; value: number }> }) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const circumference = 2 * Math.PI * 64;
  let offset = 0;
  const colors = ['#3c77d5', '#d64638', '#e3a400', '#268c5a', '#19a8b3'];
  return <div className="benefit-donut">
    <svg viewBox="0 0 180 180" role="img" aria-label={`Distribuição de ${formatCount(total)} beneficiários por tipo`}>
      <circle cx="90" cy="90" r="64" fill="none" stroke="#d9e0e3" strokeWidth="32" />
      {items.map((item, index) => {
        const segment = total ? (item.value / total) * circumference : 0;
        const circle = <circle key={item.label} cx="90" cy="90" r="64" fill="none" stroke={colors[index % colors.length]} strokeWidth="32" strokeDasharray={`${segment} ${circumference - segment}`} strokeDashoffset={-offset} transform="rotate(-90 90 90)" />;
        offset += segment;
        return circle;
      })}
      <text x="90" y="87" textAnchor="middle" className="benefit-donut__total">{formatCount(total)}</text>
      <text x="90" y="105" textAnchor="middle" className="benefit-donut__label">beneficiários</text>
    </svg>
    <div className="benefit-donut__legend">{items.map((item, index) => <span key={item.label}><i style={{ backgroundColor: colors[index % colors.length] }} />{item.label}<strong>{formatCount(item.value)}</strong></span>)}</div>
  </div>;
}

export default function Overview({ data }: OverviewProps) {
  const { censo, payroll, cargo_counts: cargos, cadastro_counts: datas } = data;
  const completion = censo.registros ? censo.concluidos / censo.registros * 100 : 0;
  const topCargos = Object.entries(cargos).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  const benefits = payroll.beneficios.map((item) => ({ label: item.tipo.replace('Aposentados ', 'Apos. ').replace('Aposentadoria ', 'Apos. '), value: item.quantidade }));
  const grossPayroll = payroll.ativos.proventos + payroll.total_vencimentos_beneficios;
  const netPayroll = payroll.ativos.proventos - payroll.ativos.descontos + payroll.total_liquido_beneficios;
  const analytics = data.analytics;
  const competence = formatCompetence(data.filters ? data.filters.competence : '2026-03-01');
  return <div className="overview-dashboard">
    <div className="overview-dashboard__heading"><div><span className="overview-dashboard__eyebrow">Painel analítico · RPPS</span><h1>Censo Previdenciário</h1><p>Resumo do recenseamento e da folha filtrados</p></div><span className="overview-dashboard__period">Censo · {censo.data_inicial} — {censo.data_final}<br />Folha · {competence}</span></div>
    <section className="metric-grid overview-dashboard__kpis" aria-label="Indicadores principais">
      <MetricCard label="Registros no recenseamento" value={formatCount(censo.registros)} />
      <MetricCard label="Cadastros concluídos" value={formatCount(censo.concluidos)} />
      <MetricCard label="Pessoas na folha¹" value={formatCount(payroll.ativos.quantidade + payroll.beneficiarios)} />
      <MetricCard label="Proventos e vencimentos" value={formatMoney(grossPayroll)} />
    </section>
    {analytics && <section className="metric-grid overview-dashboard__analytics" aria-label="Indicadores calculados">
      <MetricCard label="Recenseados" value={`${formatCount(analytics.census.recenseados)} · ${analytics.census.recenseadosPercentual}%`} />
      <MetricCard label="Pendentes" value={`${formatCount(analytics.census.pendentes)} · ${analytics.census.pendentesPercentual}%`} />
      <MetricCard label="Em análise" value={`${formatCount(analytics.census.emAnalise)} · ${analytics.census.emAnalisePercentual}%`} />
      <MetricCard label="Recusados" value={`${formatCount(analytics.census.recusados)} · ${analytics.census.recusadosPercentual}%`} />
      <MetricCard label="Idade média" value={analytics.personnel.idadeMediaAnos === null ? 'Indisponível' : `${analytics.personnel.idadeMediaAnos.toFixed(2)} anos`} />
      <MetricCard label="Tempo médio de contribuição" value={analytics.personnel.tempoMedioContribuicaoAnos === null ? 'Indisponível' : `${analytics.personnel.tempoMedioContribuicaoAnos.toFixed(2)} anos`} />
      <MetricCard label="Arrecadação previdenciária" value={formatMoney(Number(analytics.payroll.arrecadacaoPrevidenciaria))} />
      <MetricCard label="Projeção anual do saldo¹" value={formatMoney(Number(analytics.payroll.projecaoAnualSaldo))} />
    </section>}
    <div className="overview-dashboard__grid">
      <section className="panel overview-dashboard__panel"><h2 className="panel__title">Beneficiários por tipo</h2><div className="panel__body"><BenefitDonut items={benefits} /></div><p className="dashboard-source">Fonte: folha previdenciária · {competence}</p></section>
      <section className="panel overview-dashboard__panel overview-dashboard__table"><h2 className="panel__title">Resumo da folha por grupo</h2><div className="table-wrap" role="region" aria-label="Resumo da folha; tabela rolável horizontalmente em telas pequenas" tabIndex={0}><table aria-label="Resumo da folha por grupo previdenciário"><thead><tr><th>Grupo / benefício</th><th className="numeric">Qtd.</th><th className="numeric">Vencimentos</th><th className="numeric">Líquido</th></tr></thead><tbody>
        <tr><td>Servidores ativos</td><td className="numeric">{formatCount(payroll.ativos.quantidade)}</td><td className="numeric">{formatMoney(payroll.ativos.proventos)}</td><td className="numeric">{formatMoney(payroll.ativos.proventos - payroll.ativos.descontos)}</td></tr>
        {payroll.beneficios.map((item) => <tr key={item.tipo}><td>{item.tipo}</td><td className="numeric">{formatCount(item.quantidade)}</td><td className="numeric">{formatMoney(item.vencimentos)}</td><td className="numeric">{formatMoney(item.liquido)}</td></tr>)}
        <tr className="overview-dashboard__total"><th>Total bruto / líquido</th><th className="numeric">{formatCount(payroll.ativos.quantidade + payroll.beneficiarios)}</th><th className="numeric">{formatMoney(grossPayroll)}</th><th className="numeric">{formatMoney(netPayroll)}</th></tr>
      </tbody></table></div><p className="dashboard-source">Valores agregados · competência {competence}</p></section>
      <section className="panel overview-dashboard__panel"><h2 className="panel__title">Vencimentos por grupo</h2><div className="panel__body"><BarChart color="blue" items={[{ label: 'Servidores ativos', value: payroll.ativos.proventos, display: formatMoney(payroll.ativos.proventos) }, ...payroll.beneficios.map((item) => ({ label: item.tipo.replace('Aposentados ', 'Apos. ').replace('Aposentadoria ', 'Apos. '), value: item.vencimentos, display: formatMoney(item.vencimentos) }))]} /></div><p className="dashboard-source">Fonte: folha previdenciária · {competence}</p></section>
      <section className="panel overview-dashboard__panel"><h2 className="panel__title">Situação do recenseamento</h2><div className="panel__body status-chart"><div className="donut" style={{ '--completion': `${completion}%` } as CSSProperties}><div><strong>{formatPercent(censo.concluidos, censo.registros)}</strong><span>concluídos</span></div></div><div className="legend-list"><span><i className="legend-dot legend-dot--green" />Recenseados <strong>{formatCount(analytics?.census.recenseados ?? censo.concluidos)}</strong></span><span><i className="legend-dot legend-dot--orange" />Pendentes <strong>{formatCount(analytics?.census.pendentes ?? censo.sem_conclusao)}</strong></span><span>Em análise <strong>{formatCount(analytics?.census.emAnalise ?? 0)}</strong></span><span>Recusados <strong>{formatCount(analytics?.census.recusados ?? 0)}</strong></span></div></div><p className="dashboard-source">Fonte: base do censo · {censo.data_inicial} — {censo.data_final}</p></section>
      <section className="panel overview-dashboard__panel"><h2 className="panel__title">Cadastros por data</h2><div className="panel__body"><TrendChart entries={Object.entries(datas)} /></div><p className="dashboard-source">Fonte: base do censo · registros por data de cadastro</p></section>
      <section className="panel overview-dashboard__panel"><h2 className="panel__title">Principais cargos no recenseamento</h2><div className="panel__body"><BarChart color="blue" items={topCargos.slice(0, 7)} /></div><p className="dashboard-source">Fonte: base do censo · principais cargos</p></section>
    </div>
    <p className="overview-dashboard__note">¹ Projeção estática: competência consultada multiplicada por 12, sem crescimento, inflação ou novos participantes. Idade média e tempo de contribuição não estão disponíveis no modelo atual. A contagem do censo é completa; a tabela de registros mostra até 500 linhas.</p>
  </div>;
}