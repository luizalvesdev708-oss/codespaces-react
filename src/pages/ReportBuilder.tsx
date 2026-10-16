import type { DashboardData } from '../@types/censo';
import type { ReportKind, ReportProfile } from '../@types/reports';
import ReportExportButtons from '../components/ReportExportButtons';
import DecryptedAnalyticsExport from '../components/DecryptedAnalyticsExport';
import ReportFilterBar from '../components/ReportFilterBar';
import ReportPreview from '../components/ReportPreview';
import { useReportBuilder } from '../hooks/useReportBuilder';
import { formatReportPeriod, REPORT_METRICS, REPORT_VIEWS } from '../services/reportService';

interface ReportBuilderProps {
  data: DashboardData;
  isAdmin?: boolean;
  dashboardFilters?: DashboardData['filters'];
}

export default function ReportBuilder({ data, isAdmin = false, dashboardFilters }: ReportBuilderProps) {
  const report = useReportBuilder(data);
  const categoryLabels: Record<'ACTIVE' | 'RETIRED' | 'PENSIONER', string> = {
    ACTIVE: 'Ativos',
    RETIRED: 'Aposentados',
    PENSIONER: 'Pensionistas',
  };
  const displayDate = (value: string | null) => value
    ? new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')
    : 'Sem limite';
  const pdfDetails = {
    description: report.currentDescription,
    period: formatReportPeriod(report.filters),
    filters: [
      ...(dashboardFilters ? [
        {
          label: 'Período do painel',
          value: `${displayDate(dashboardFilters.from)} a ${displayDate(dashboardFilters.to)}`,
        },
        { label: 'Categoria do painel', value: dashboardFilters.category === 'ALL' ? 'Todas' : categoryLabels[dashboardFilters.category as keyof typeof categoryLabels] ?? dashboardFilters.category },
        { label: 'Regime do painel', value: dashboardFilters.regime ?? 'Todos' },
        { label: 'Fonte do painel', value: dashboardFilters.source ?? 'Todas' },
      ] : []),
      { label: 'Categoria', value: report.filters.regime ? categoryLabels[report.filters.regime] : 'Todas' },
      { label: 'Status', value: report.filters.status || 'Todos' },
      { label: 'Regime previdenciário', value: report.filters.rppsRegime || 'Todos' },
      { label: 'Fonte', value: report.filters.source || 'Todas' },
      { label: 'Cargo', value: report.filters.cargo || 'Todos' },
      { label: 'Entidade', value: report.filters.entidade || 'Todas' },
    ],
    metrics: report.metrics,
  };

  return (
    <div className="report-page">
      <div className="page-heading">
        <div>
          <h1>Gerador de relatórios</h1>
          <p>Monte, revise e exporte relatórios a partir dos dados disponíveis no painel.</p>
        </div>
        <span className="status-badge">Dados do painel</span>
      </div>
      <div className="report-builder-grid">
        <section className="report-builder-controls" aria-label="Configurar relatório">
          <div className="report-control-card">
            <div className="report-control-heading">
              <h2>1. Configure</h2>
              <p>Escolha o foco e a apresentação.</p>
            </div>
            <label className="report-field">
              <span>Tipo de relatório</span>
              <select value={report.kind} onChange={(event) => report.changeKind(event.target.value as ReportKind)}>
                <option value="visao-geral">Visão geral · dashboard</option>
                <option value="cadastral">Cadastral</option>
                <option value="operacional">Operacional</option>
                <option value="financeiro">Financeiro · folha</option>
              </select>
            </label>
            <label className="report-field">
              <span>Perfil da visualização</span>
              <select value={report.profile} onChange={(event) => report.changeProfile(event.target.value as ReportProfile)}>
                <option value="gestor">Gestor · visão consolidada</option>
                <option value="operador">Operador · foco em pendências</option>
                <option value="auditoria">Auditoria · conferência detalhada</option>
              </select>
            </label>
            <p className="report-helper">O perfil aplica uma seleção inicial de indicadores; não altera permissões de acesso.</p>
            <fieldset className="report-choice-group">
              <legend>Métricas</legend>
              {REPORT_METRICS[report.kind].map((metric) => (
                <label className="report-check" key={metric.key}>
                  <input
                    type="checkbox"
                    checked={report.selectedMetrics.includes(metric.key)}
                    onChange={() => report.toggleMetric(metric.key)}
                  />
                  <span>{metric.label}</span>
                </label>
              ))}
            </fieldset>
            <fieldset className="report-choice-group">
              <legend>Exibição</legend>
              {REPORT_VIEWS.map(({ key, label }) => (
                <label className="report-check" key={key}>
                  <input
                    type="checkbox"
                    checked={report.selectedViews.includes(key)}
                    onChange={() => report.toggleView(key)}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>
          </div>
          <ReportFilterBar
            data={data}
            kind={report.kind}
            filters={report.filters}
            onChange={report.setFilters}
            onClear={report.clearFilters}
          />
          <div className="report-export-card">
            <h3>Exportar / compartilhar</h3>
            <p>Os arquivos são gerados localmente no navegador.</p>
            <ReportExportButtons title={report.currentTitle} rows={report.rows} pdfDetails={pdfDetails} disabled={report.loading} />
          </div>
          {isAdmin && <DecryptedAnalyticsExport filters={report.filters} dashboardFilters={dashboardFilters} />}
        </section>
        <div className="report-result">
          {report.selectedMetrics.length === 0 && (
            <p className="report-validation" role="status">
              Selecione ao menos uma métrica para compor os cartões do relatório.
            </p>
          )}
          <ReportPreview
            title={report.currentTitle}
            description={report.currentDescription}
            period={report.kind === 'financeiro'
              ? `${report.period} · competência ${report.financialCompetenceLabel}`
              : report.period}
            metrics={report.metrics}
            rows={report.hasReportData ? report.rows : []}
            selectedViews={report.selectedViews}
            loading={report.loading}
            chartItems={report.chartItems}
            chartGroups={report.chartGroups}
          />
          <p className="report-data-note">
            {report.kind === 'visao-geral'
              ? 'Relatório consolidado com indicadores, situação cadastral, distribuição por cargo, cadastros por data e dados agregados da folha. Os dados financeiros não possuem vínculo individual com os registros cadastrais.'
              : 'Prévia limitada aos dados fornecidos no painel. Informações da folha são agregadas e não possuem vínculo individual com os registros cadastrais.'}
          </p>
        </div>
      </div>
    </div>
  );
}
