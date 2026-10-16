import type { DashboardData } from '../@types/censo';
import type { ReportFilters, ReportKind } from '../@types/reports';
import { formatCompetence } from '../utils/format';

interface ReportFilterBarProps {
  data: DashboardData;
  kind: ReportKind;
  filters: ReportFilters;
  onChange: (filters: ReportFilters) => void;
  onClear: () => void;
}

export default function ReportFilterBar({ data, kind, filters, onChange, onClear }: ReportFilterBarProps) {
  const isFinancial = kind === 'financeiro';
  const competence = formatCompetence(data.filters ? data.filters.competence : '2026-03-01');
  const update = (field: keyof ReportFilters, value: string) => onChange({ ...filters, [field]: value });

  return <section className="report-filter-bar" aria-label="Filtros do relatório">
    <div className="report-filter-heading"><div><h3>Filtros do relatório</h3><p>Atualize o intervalo e refine os dados da prévia.</p></div><button type="button" className="button button--quiet" onClick={onClear}>Limpar filtros</button></div>
    <div className="report-filter-grid">
      <label className="report-field"><span>De</span><input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => update('from', event.target.value)} /></label>
      <label className="report-field"><span>Até</span><input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => update('to', event.target.value)} /></label>
      <label className="report-field"><span>Status</span><select value={filters.status} disabled={isFinancial} onChange={(event) => update('status', event.target.value)}><option value="">Todos os status</option><option>Concluído</option><option>Cadastro sem conclusão</option><option>Em análise</option><option>Recusado</option></select></label>
      <label className="report-field"><span>Categoria previdenciária</span><select value={filters.regime} disabled={isFinancial} onChange={(event) => update('regime', event.target.value as ReportFilters['regime'])}><option value="">Todas</option><option value="ACTIVE">Ativos</option><option value="RETIRED">Aposentados</option><option value="PENSIONER">Pensionistas</option></select></label>
      <label className="report-field"><span>Regime previdenciário</span><select value={filters.rppsRegime} disabled={isFinancial} onChange={(event) => update('rppsRegime', event.target.value)}><option value="">Todos</option>{(data.filterOptions?.regimes ?? []).map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="report-field"><span>Fonte</span><select value={filters.source} disabled={isFinancial} onChange={(event) => update('source', event.target.value)}><option value="">Todas</option>{(data.filterOptions?.sources ?? []).map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="report-field"><span>Cargo</span><select value={filters.cargo} disabled={isFinancial} onChange={(event) => update('cargo', event.target.value)}><option value="">Todos os cargos</option>{Object.keys(data.cargo_counts).sort((a, b) => a.localeCompare(b, 'pt-BR')).map((cargo) => <option key={cargo}>{cargo}</option>)}</select></label>
      <label className="report-field"><span>Entidade</span><select value={filters.entidade} disabled={isFinancial} onChange={(event) => update('entidade', event.target.value)}><option value="">Todas as entidades</option>{[...new Set(data.records.map((record) => record.entidade))].sort((a, b) => a.localeCompare(b, 'pt-BR')).map((entidade) => <option key={entidade}>{entidade}</option>)}</select></label>
    </div>
    {!isFinancial && <p className="report-filter-note">Categoria, regime previdenciário e fonte são aplicados aos registros com esses campos preenchidos; sem seleção, todos os valores são incluídos.</p>}
    {isFinancial && <p className="report-filter-note">Status, categoria, cargo e entidade não existem no detalhe financeiro agregado e não são aplicados.</p>}
    {kind === 'visao-geral' && <p className="report-filter-note">Os filtros cadastrais refinam status, cargo, entidade e data do recenseamento. Os dados financeiros continuam agregados e só são incluídos quando o período selecionado contém {competence}.</p>}
  </section>;
}
