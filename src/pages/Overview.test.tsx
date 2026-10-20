import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { DATA } from '../data/mockData';
import Overview from './Overview';

function dashboardData() {
  return {
    ...DATA,
    filters: {
      from: null,
      to: null,
      regime: null,
      source: null,
      category: 'ALL',
      competence: '2026-08-01',
    },
    filterOptions: { cargos: ['Professor'], regimes: [], sources: [] },
    payroll_history: [
      { competence: '2025-08-01', gross: 1_000, discounts: 100, payroll_records: 1 },
      { competence: '2026-08-01', gross: 1_500, discounts: 150, payroll_records: 1 },
    ],
    payroll_by_category: [
      { category: 'ACTIVE' as const, count: 1, gross: 1_000, discounts: 100 },
      { category: 'RETIRED' as const, count: 1, gross: 300, discounts: 30 },
      { category: 'PENSIONER' as const, count: 1, gross: 200, discounts: 20 },
    ],
    cargo_counts: { Professor: 2 },
  };
}

function renderDashboard(data = dashboardData()) {
  const onCategoryChange = vi.fn();
  const onCargoChange = vi.fn();
  const onPeriodChange = vi.fn();
  render(
    <Overview
      data={data}
      category=""
      cargo=""
      from=""
      to=""
      onCategoryChange={onCategoryChange}
      onCargoChange={onCargoChange}
      onPeriodChange={onPeriodChange}
    />,
  );
  return { onCategoryChange, onCargoChange, onPeriodChange };
}

test('calcula KPIs e exibe aviso quando a comparação anual não tem base suficiente', () => {
  const data = dashboardData();
  data.payroll_history = data.payroll_history?.filter((item) => item.competence.startsWith('2026'));
  renderDashboard(data);

  expect(screen.getByText('Folha acumulada em 2026')).toBeDefined();
  expect(screen.getAllByText('R$ 1.500,00').length).toBeGreaterThan(0);
  expect(screen.getByText('Há dados de apenas um ano; crescimento anual não pode ser calculado.')).toBeDefined();
});

test('selecionar categoria, cargo ou ano aplica filtros cruzados', () => {
  const { onCategoryChange, onCargoChange, onPeriodChange } = renderDashboard();

  fireEvent.click(screen.getByRole('button', { name: /2025/ }));
  expect(onPeriodChange).toHaveBeenCalledWith('2025-01-01', '2025-12-31');

  fireEvent.click(screen.getByRole('button', { name: /Professor/u }));
  expect(onCategoryChange).toHaveBeenCalledWith('ACTIVE');
  expect(onCargoChange).toHaveBeenCalledWith('Professor');

  fireEvent.click(screen.getAllByRole('button', { name: /Aposentados/ })[0]!);
  expect(onCategoryChange).toHaveBeenCalledWith('RETIRED');
});

test('mostra períodos vazios sem fabricar totais', () => {
  const data = {
    ...dashboardData(),
    payroll_history: [],
    payroll_by_category: [],
    filters: {
      from: '2027-01-01',
      to: '2027-12-31',
      regime: null,
      source: null,
      category: 'ALL',
      competence: null,
    },
    payroll: {
      ...DATA.payroll,
      ativos: { ...DATA.payroll.ativos, quantidade: 0, proventos: 0, descontos: 0 },
      beneficiarios: 0,
      total_vencimentos_beneficios: 0,
      total_descontos_beneficios: 0,
    },
  };

  render(
    <Overview
      data={data}
      category=""
      cargo=""
      from="2027-01-01"
      to="2027-12-31"
      onCategoryChange={vi.fn()}
      onCargoChange={vi.fn()}
      onPeriodChange={vi.fn()}
    />,
  );

  expect(screen.getAllByText('Sem dados').length).toBeGreaterThan(0);
  expect(screen.getByText('Sem dados mensais para o período selecionado.')).toBeDefined();
});
