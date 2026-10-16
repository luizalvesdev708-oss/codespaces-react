import type { PageKey } from '../@types/censo';
import type { ReportFilters } from '../@types/reports';
interface FiltersProps {
  page: PageKey; cargos: string[]; cargo: string; status: string; search: string;
  onCargoChange: (value: string) => void; onStatusChange: (value: string) => void;
  onSearchChange: (value: string) => void; onClear: () => void;
  periodFrom: string; periodTo: string; regime: ReportFilters['regime'];
  institutionalRegime: string; source: string; regimes: string[]; sources: string[];
  onPeriodFromChange: (value: string) => void; onPeriodToChange: (value: string) => void;
  onRegimeChange: (value: ReportFilters['regime']) => void;
  onInstitutionalRegimeChange: (value: string) => void; onSourceChange: (value: string) => void;
  onClearGlobal: () => void;
  showClear?: boolean;
}
export default function Filters(props: FiltersProps) {
  return <>
    <div className="filters filters--summary" aria-label="Filtros do painel">
      <label className="filter-field"><span>De</span><input aria-label="Período inicial do painel" type="date" value={props.periodFrom} max={props.periodTo || undefined} onChange={(event) => props.onPeriodFromChange(event.target.value)} /></label>
      <label className="filter-field"><span>Até</span><input aria-label="Período final do painel" type="date" value={props.periodTo} min={props.periodFrom || undefined} onChange={(event) => props.onPeriodToChange(event.target.value)} /></label>
      <label className="filter-field"><span>Categoria</span><select value={props.regime} onChange={(event) => props.onRegimeChange(event.target.value as ReportFilters['regime'])}>
        <option value="">Todos</option><option value="ACTIVE">Ativos</option><option value="RETIRED">Aposentados</option><option value="PENSIONER">Pensionistas</option>
      </select></label>
      <label className="filter-field"><span>Regime previdenciário</span><select value={props.institutionalRegime} onChange={(event) => props.onInstitutionalRegimeChange(event.target.value)}><option value="">Todos</option>{props.regimes.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="filter-field"><span>Fonte</span><select value={props.source} onChange={(event) => props.onSourceChange(event.target.value)}><option value="">Todas</option>{props.sources.map((item) => <option key={item}>{item}</option>)}</select></label>
      <button className="button button--quiet" onClick={props.onClearGlobal} type="button">Limpar filtros globais</button>
    </div>
    {props.page !== 'cadastro' ? null : <div className="filters" aria-label="Filtros do cadastro">
    <label className="filter-field"><span>Cargo</span><select value={props.cargo} onChange={(event) => props.onCargoChange(event.target.value)}><option value="">Todos</option>{props.cargos.map((item) => <option key={item}>{item}</option>)}</select></label>
    <label className="filter-field"><span>Situação</span><select value={props.status} onChange={(event) => props.onStatusChange(event.target.value)}><option value="">Todas</option><option>Concluído</option><option>Cadastro sem conclusão</option><option>Em análise</option><option>Recusado</option></select></label>
    <label className="filter-field filter-field--search"><span>Busca</span><input type="search" value={props.search} onChange={(event) => props.onSearchChange(event.target.value)} placeholder="Nome, matrícula ou CPF" /></label>
    {props.showClear !== false && <button className="button button--quiet" onClick={props.onClear} type="button">Limpar</button>}
    </div>}
  </>;
}