import { useMemo, useState } from 'react';
import type { DashboardData, PayrollCategoryTotal, PayrollHistoryEntry } from '../@types/censo';
import MetricCard from '../components/MetricCard';
import { formatCount, formatMoney } from '../utils/format';
import './Overview.css';

type CategoryKey = PayrollCategoryTotal['category'];

interface OverviewProps {
  data: DashboardData;
  category: '' | CategoryKey;
  cargo: string;
  from: string;
  to: string;
  onCategoryChange: (category: '' | CategoryKey) => void;
  onCargoChange: (cargo: string) => void;
  onPeriodChange: (from: string, to: string) => void;
}

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  ACTIVE: 'Ativos',
  RETIRED: 'Aposentados',
  PENSIONER: 'Pensionistas',
};

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  ACTIVE: '#e8731a',
  RETIRED: '#f5a44d',
  PENSIONER: '#f7c477',
};

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

function monthLabel(competence: string): string {
  const [year, month] = competence.split('-');
  const monthName = MONTHS[Number(month) - 1];
  return monthName ? `${monthName} ${year}` : competence;
}

function monthRange(year: string, month: string): [string, string] {
  const monthNumber = Number(month);
  const lastDay = new Date(Date.UTC(Number(year), monthNumber, 0)).getUTCDate();
  const prefix = `${year}-${month.padStart(2, '0')}`;
  return [`${prefix}-01`, `${prefix}-${String(lastDay).padStart(2, '0')}`];
}

function yearRange(year: string): [string, string] {
  return [`${year}-01-01`, `${year}-12-31`];
}

function totalGross(data: DashboardData): number {
  return data.payroll.ativos.proventos + data.payroll.total_vencimentos_beneficios;
}

function totalDiscounts(data: DashboardData): number {
  return data.payroll.ativos.descontos + data.payroll.total_descontos_beneficios;
}

function currentPayrollCount(data: DashboardData): number {
  return data.payroll.ativos.quantidade + data.payroll.beneficiarios;
}

// A folha acumulada soma os proventos de cada competência do ano, sem anualizar meses ausentes.
function yearlyTotals(history: PayrollHistoryEntry[]) {
  const totals = new Map<string, number>();
  history.forEach(({ competence, gross }) => {
    const year = competence.slice(0, 4);
    totals.set(year, (totals.get(year) ?? 0) + gross);
  });
  return [...totals.entries()].sort(([first], [second]) => first.localeCompare(second));
}

function DataNotice({ children }: { children: string }) {
  return <p className="system-dashboard__empty">{children}</p>;
}

function PayrollDonut({
  items,
  onSelect,
  selectedCategory,
}: {
  items: PayrollCategoryTotal[];
  onSelect: (category: CategoryKey) => void;
  selectedCategory: '' | CategoryKey;
}) {
  const total = items.reduce((sum, item) => sum + item.gross, 0);
  let currentStop = 0;
  const stops = items.map((item) => {
    const start = currentStop;
    currentStop += total ? item.gross / total * 100 : 0;
    return `${CATEGORY_COLORS[item.category]} ${start}% ${currentStop}%`;
  });

  if (!total) return <DataNotice>Sem dados de folha para esta competência.</DataNotice>;

  return (
    <div className="system-dashboard__donut-layout">
      <div
        className="system-dashboard__donut"
        style={{ background: `conic-gradient(${stops.join(', ')})` }}
        role="img"
        aria-label="Participação dos proventos por categoria previdenciária"
      >
        <span><strong>{formatMoney(total)}</strong><small>proventos</small></span>
      </div>
      <div className="system-dashboard__legend">
        {items.map((item) => (
          <button
            className={selectedCategory === item.category ? 'is-selected' : ''}
            key={item.category}
            type="button"
            onClick={() => onSelect(item.category)}
          >
            <i style={{ background: CATEGORY_COLORS[item.category] }} />
            <span>{CATEGORY_LABELS[item.category]}</span>
            <strong>{total ? `${(item.gross / total * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—'}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Overview({
  data,
  category,
  cargo,
  from,
  to,
  onCategoryChange,
  onCargoChange,
  onPeriodChange,
}: OverviewProps) {
  const [showAllCargo, setShowAllCargo] = useState(false);
  const history = data.payroll_history ?? [];
  const years = useMemo(() => [...new Set(history.map((item) => item.competence.slice(0, 4)))].sort(), [history]);
  const yearFromFilter = from.slice(0, 4);
  const selectedYear = yearFromFilter || years.at(-1) || '';
  const selectedMonth = from.length >= 7 && from.slice(0, 7) === to.slice(0, 7) ? from.slice(5, 7) : '';
  const selectedYearForKpi = selectedYear;
  const yearData = history.filter((item) => !selectedYearForKpi || item.competence.startsWith(`${selectedYearForKpi}-`));
  const annual = yearlyTotals(history);
  const annualMax = Math.max(...annual.map(([, value]) => value), 1);
  const monthlyMax = Math.max(...yearData.map((item) => item.gross), 1);
  const cargoItems = Object.entries(data.cargo_counts)
    .map(([label, count]) => ({ label, count }))
    .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label, 'pt-BR'));
  const selectedCompetence = data.filters?.competence;
  const hasCurrentPayroll = selectedCompetence !== null && currentPayrollCount(data) > 0;
  const gross = hasCurrentPayroll ? totalGross(data) : null;
  const discounts = hasCurrentPayroll ? totalDiscounts(data) : null;
  const annualGross = yearData.length ? yearData.reduce((sum, item) => sum + item.gross, 0) : null;
  const categoryTotals = data.payroll_by_category ?? [];
  const totalAnnualRows = yearData.reduce((sum, item) => sum + item.payroll_records, 0);
  const activeCategory = category || '';

  const chooseYear = (year: string) => {
    if (!year) {
      onPeriodChange('', '');
      return;
    }
    const range = yearRange(year);
    onPeriodChange(range[0], range[1]);
  };
  const chooseMonth = (month: string) => {
    const year = selectedYear || years.at(-1);
    if (!year) return;
    const range = month ? monthRange(year, month) : yearRange(year);
    onPeriodChange(range[0], range[1]);
  };
  const selectCategory = (value: CategoryKey) => {
    onCategoryChange(category === value ? '' : value);
  };

  return (
    <div className="system-dashboard">
      <header className="system-dashboard__header">
        <div>
          <span className="system-dashboard__eyebrow">Painel analítico · RPPS</span>
          <h1>Censo Previdenciário</h1>
          <p>Indicadores calculados a partir da folha e do censo do sistema.</p>
        </div>
        <div className="system-dashboard__filters" aria-label="Filtros do painel">
          <label>
            <span>Ano da competência</span>
            <select value={selectedYear} onChange={(event) => chooseYear(event.target.value)}>
              {!years.length && <option value="">Sem dados disponíveis</option>}
              {selectedYear && !years.includes(selectedYear) && <option value={selectedYear}>{selectedYear} · sem dados</option>}
              {years.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label>
            <span>Mês</span>
            <select value={selectedMonth} onChange={(event) => chooseMonth(event.target.value)} disabled={!selectedYear && !years.length}>
              <option value="">Todos os meses</option>
              {history
                .filter((item) => !selectedYear || item.competence.startsWith(`${selectedYear}-`))
                .map((item) => item.competence.slice(5, 7))
                .filter((month, index, all) => all.indexOf(month) === index)
                .sort()
                .map((month) => <option key={month} value={month}>{MONTHS[Number(month) - 1]}</option>)}
              {selectedMonth && !history.some((item) => item.competence.startsWith(`${selectedYear}-${selectedMonth}`))
                && <option value={selectedMonth}>{MONTHS[Number(selectedMonth) - 1]} · sem dados</option>}
            </select>
          </label>
          <label>
            <span>Categoria previdenciária</span>
            <select
              value={category}
              onChange={(event) => onCategoryChange(event.target.value as '' | CategoryKey)}
            >
              <option value="">Todas</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>Cargo</span>
            <select value={cargo} onChange={(event) => onCargoChange(event.target.value)}>
              <option value="">Todos os cargos</option>
              {(data.filterOptions?.cargos ?? Object.keys(data.cargo_counts)).map((job) => <option key={job} value={job}>{job}</option>)}
            </select>
          </label>
          <label>
            <span>Município</span>
            <select disabled value="">
              <option value="">Indisponível na base</option>
            </select>
          </label>
        </div>
      </header>

      {/* Média por vínculo = proventos da competência / vínculos com folha nessa competência. */}
      <section className="system-dashboard__kpis" aria-label="Indicadores principais">
        <MetricCard
          label="Média de proventos por vínculo · competência"
          value={gross === null || !currentPayrollCount(data) ? 'Sem dados' : formatMoney(gross / currentPayrollCount(data))}
        />
        <MetricCard
          label={`Folha acumulada em ${selectedYearForKpi || '—'}`}
          value={annualGross === null ? 'Sem dados' : formatMoney(annualGross)}
        />
        <MetricCard
          label="Descontos previdenciários · competência"
          value={discounts === null ? 'Sem dados' : formatMoney(discounts)}
        />
        <MetricCard
          label="Proventos e vencimentos"
          value={gross === null ? 'Sem dados' : formatMoney(gross)}
        />
      </section>

      <div className="system-dashboard__charts">
        <section className="system-dashboard__card system-dashboard__card--wide">
          <h2>Vínculos ativos por cargo</h2>
          {cargoItems.length ? (
            <div className="system-dashboard__horizontal-bars">
              {cargoItems.slice(0, showAllCargo ? cargoItems.length : 10).map((item) => {
                const maximum = cargoItems[0]?.count ?? 1;
                return (
                  <button
                    key={item.label}
                    type="button"
                    className={cargo === item.label ? 'is-selected' : ''}
                    onClick={() => {
                      onCategoryChange('ACTIVE');
                      onCargoChange(cargo === item.label ? '' : item.label);
                    }}
                  >
                    <span className="system-dashboard__bar-label">{item.label}</span>
                    <span className="system-dashboard__bar-track"><i style={{ width: `${item.count / maximum * 100}%` }} /></span>
                    <strong>{formatCount(item.count)}</strong>
                  </button>
                );
              })}
              {cargoItems.length > 10 && (
                <button
                  className="system-dashboard__show-all"
                  type="button"
                  onClick={() => setShowAllCargo((current) => !current)}
                >
                  {showAllCargo ? 'Ver Top 10' : `Ver todos (${formatCount(cargoItems.length)})`}
                </button>
              )}
            </div>
          ) : <DataNotice>Sem dados de cargo para os filtros escolhidos.</DataNotice>}
        </section>

        <section className="system-dashboard__card">
          <h2>Resumo da folha por grupo</h2>
          {categoryTotals.length ? (
            <div className="system-dashboard__columns">
              {categoryTotals.map((item) => (
                <button
                  type="button"
                  key={item.category}
                  className={category === item.category ? 'is-selected' : ''}
                  onClick={() => selectCategory(item.category)}
                  title={`${CATEGORY_LABELS[item.category]}: ${formatMoney(item.gross)} · ${formatCount(item.count)} vínculos`}
                >
                  <span className="system-dashboard__column-track"><i style={{
                    height: `${Math.max(2, item.gross / Math.max(...categoryTotals.map((entry) => entry.gross), 1) * 100)}%`,
                    background: CATEGORY_COLORS[item.category],
                  }} /></span>
                  <strong>{formatMoney(item.gross)}</strong>
                  <span>{CATEGORY_LABELS[item.category]}</span>
                </button>
              ))}
            </div>
          ) : <DataNotice>Sem dados de folha nesta competência.</DataNotice>}
        </section>

        <section className="system-dashboard__card">
          <h2>Folha acumulada por ano</h2>
          {annual.length ? (
            <>
              <div className="system-dashboard__year-bars">
                {annual.map(([year, value], index) => {
                  const previous = annual[index - 1]?.[1];
                  const growth = previous && previous !== 0 ? ((value - previous) / previous) * 100 : null;
                  return (
                    <button
                      type="button"
                      key={year}
                      className={selectedYear === year ? 'is-selected' : ''}
                      onClick={() => chooseYear(year)}
                    >
                      <span className="system-dashboard__year-bar-track"><i style={{ height: `${Math.max(2, value / annualMax * 100)}%` }} /></span>
                      <strong>{formatMoney(value)}</strong>
                      <span>{year}</span>
                      <small>{growth === null ? 'Sem base YoY' : `${growth >= 0 ? '+' : ''}${growth.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% a/a`}</small>
                    </button>
                  );
                })}
              </div>
              {annual.length < 2 && <DataNotice>Há dados de apenas um ano; crescimento anual não pode ser calculado.</DataNotice>}
            </>
          ) : <DataNotice>Sem dados anuais para o período.</DataNotice>}
        </section>

        <section className="system-dashboard__card">
          <h2>Evolução mensal da folha · {selectedYearForKpi || 'todos os anos'}</h2>
          {yearData.length ? (
            <>
              <div className="system-dashboard__line-chart">
                <svg viewBox="0 0 600 180" role="img" aria-label="Evolução mensal dos proventos da folha">
                  {[25, 75, 125, 155].map((y) => <line key={y} x1="24" x2="576" y1={y} y2={y} />)}
                  {yearData.length > 1 && (
                    <polyline
                      points={yearData.map((item, index) => {
                        const x = 35 + index * (530 / (yearData.length - 1));
                        const y = 145 - item.gross / monthlyMax * 110;
                        return `${x},${y}`;
                      }).join(' ')}
                    />
                  )}
                  {yearData.map((item, index) => {
                    const x = yearData.length > 1 ? 35 + index * (530 / (yearData.length - 1)) : 300;
                    const y = 145 - item.gross / monthlyMax * 110;
                    return <circle key={item.competence} cx={x} cy={y} r="5">
                      <title>{`${monthLabel(item.competence)}: ${formatMoney(item.gross)}`}</title>
                    </circle>;
                  })}
                </svg>
                <div className="system-dashboard__month-labels">
                  {yearData.map((item) => (
                    <button
                      type="button"
                      key={item.competence}
                      className={from.startsWith(item.competence.slice(0, 7)) ? 'is-selected' : ''}
                      onClick={() => {
                        const range = monthRange(item.competence.slice(0, 4), item.competence.slice(5, 7));
                        onPeriodChange(range[0], range[1]);
                      }}
                    >
                      <span>{monthLabel(item.competence)}</span>
                      <strong>{formatMoney(item.gross)}</strong>
                    </button>
                  ))}
                </div>
              </div>
              {yearData.length < 2 && <DataNotice>A série disponível tem uma competência; não há evolução mensal comparável.</DataNotice>}
            </>
          ) : <DataNotice>Sem dados mensais para o período selecionado.</DataNotice>}
        </section>

        <section className="system-dashboard__card">
          <h2>Distribuição da folha por tipo previdenciário</h2>
          <PayrollDonut items={categoryTotals} onSelect={selectCategory} selectedCategory={activeCategory} />
        </section>

        <section className="system-dashboard__card system-dashboard__map-notice">
          <h2>Mapa municipal</h2>
          <p>Mapa adiado conforme solicitado. A base atual não possui cidade, UF ou código IBGE para relacionar folha e localização.</p>
          <p>O IBGE não encontrou “Águas dos Borges” exatamente; o nome semelhante é Olho d’Água do Borges (2408409), ainda sem confirmação.</p>
        </section>
      </div>
      <footer className="system-dashboard__footnote">
        <span>Fonte: folha e censo previdenciário · competência {selectedCompetence ? monthLabel(selectedCompetence.slice(0, 7)) : 'sem dados'}</span>
        <span>{formatCount(totalAnnualRows)} linha(s) de folha no período anual exibido.</span>
      </footer>
      <p className="system-dashboard__data-warning" role="note">
        Atenção: a base atual inclui registros marcados como “Dados sintéticos (teste)”. Os valores são previdenciários e não representam vendas nem faturamento comercial.
      </p>
    </div>
  );
}
