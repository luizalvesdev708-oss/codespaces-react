import { expect, test } from 'vitest';
import { DATA } from '../data/mockData';
import type { CensoRecord } from '../@types/censo';
import {
  buildOverviewReportChartGroups,
  buildReportRows,
  calculateReportMetrics,
  filterCensusRecords,
  INITIAL_REPORT_FILTERS,
  isFinancialCompetenceInRange,
  matchesReportDate,
} from './reportService';

test('applies cadastral filters before creating the report rows', () => {
  const filters = {
    ...INITIAL_REPORT_FILTERS,
    status: 'Cadastro sem conclusão',
  };
  const filteredRecords = filterCensusRecords(DATA.records, filters);

  expect(filteredRecords.length).toBeGreaterThan(0);
  expect(filteredRecords.every((record) => record.status === 'Cadastro sem conclusão')).toBe(true);
  expect(filteredRecords.every((record) => matchesReportDate(record.cadastro, filters))).toBe(true);
});

test('masks personal identifiers in cadastral report rows', () => {
  const privateRecord = { ...DATA.records[0]!, cpf: '123.456.789-01' };
  const rows = buildReportRows(DATA, 'cadastral', [privateRecord], true);

  expect(rows).toHaveLength(1);
  expect(rows[0]?.CPF).toBe('***.***.***-01');
});

test('keeps the financial report limited to its available competence', () => {
  expect(isFinancialCompetenceInRange(INITIAL_REPORT_FILTERS)).toBe(true);
  expect(isFinancialCompetenceInRange({
    ...INITIAL_REPORT_FILTERS,
    from: '2026-04-01',
  })).toBe(false);
  expect(buildReportRows(DATA, 'financeiro', [], false)).toEqual([]);
});

test('uses the selected dashboard competence instead of a fixed month', () => {
  expect(isFinancialCompetenceInRange({
    ...INITIAL_REPORT_FILTERS,
    from: '2026-08-01',
    to: '2026-08-31',
  }, '2026-08-01')).toBe(true);
  expect(isFinancialCompetenceInRange(INITIAL_REPORT_FILTERS, null)).toBe(false);
});

test('builds an overview report with dashboard KPIs, charts, and export rows', () => {
  const records = filterCensusRecords(DATA.records, INITIAL_REPORT_FILTERS);
  const rows = buildReportRows(DATA, 'visao-geral', records, true);
  const chartGroups = buildOverviewReportChartGroups(DATA, records, true);
  const metrics = calculateReportMetrics(
    'visao-geral',
    DATA,
    records,
    ['records', 'completed', 'peopleInPayroll', 'grossPayments'],
    true,
  );

  expect(metrics.map((metric) => metric.key)).toEqual([
    'records',
    'completed',
    'peopleInPayroll',
    'grossPayments',
  ]);
  expect(metrics.find((metric) => metric.key === 'records')?.value).toBe(records.length);
  expect(chartGroups.map((group) => group.title)).toEqual([
    'Beneficiários por tipo',
    'Vencimentos por grupo',
    'Situação do recenseamento',
    'Cadastros por data',
    'Principais cargos',
  ]);
  expect(chartGroups.find((group) => group.title === 'Cadastros por data')?.view).toBe('line');
  expect(rows.some((row) => row['Indicador / grupo'] === 'Proventos e vencimentos')).toBe(true);
  expect(rows.some((row) => row.Seção === 'Principais cargos')).toBe(true);
});

test('omits aggregated payroll details from overview reports when competence is outside the range', () => {
  const filters = { ...INITIAL_REPORT_FILTERS, from: '2026-04-01' };
  const records = filterCensusRecords(DATA.records, filters);
  const rows = buildReportRows(DATA, 'visao-geral', records, false);
  const metrics = calculateReportMetrics(
    'visao-geral',
    DATA,
    records,
    ['peopleInPayroll', 'grossPayments'],
    false,
  );
  const chartGroups = buildOverviewReportChartGroups(DATA, records, false);

  expect(rows.some((row) => row.Seção === 'Folha por grupo')).toBe(false);
  expect(metrics.every((metric) => metric.value === 0)).toBe(true);
  expect(chartGroups.find((group) => group.title === 'Vencimentos por grupo')?.items).toEqual([]);
});

test('counts only pending census records as open pending work', () => {
  const statuses: CensoRecord['status'][] = ['Concluído', 'Cadastro sem conclusão', 'Em análise', 'Recusado'];
  const records = DATA.records.slice(0, statuses.length).map((record, index) => ({
    ...record,
    status: statuses[index]!,
  }));
  const metrics = calculateReportMetrics('cadastral', DATA, records, ['pending', 'completed'], true);

  expect(metrics.find((metric) => metric.key === 'completed')?.value).toBe(1);
  expect(metrics.find((metric) => metric.key === 'pending')?.value).toBe(1);
});

test('filters census data by the actual pension regime and declared data source', () => {
  const sourceRecord = {
    ...DATA.records[0]!,
    regime: 'IPSS',
    fonteDados: 'Dados fornecidos',
  };
  expect(filterCensusRecords([sourceRecord], {
    ...INITIAL_REPORT_FILTERS,
    rppsRegime: 'IPSS',
    source: 'Dados fornecidos',
  })).toEqual([sourceRecord]);
  expect(filterCensusRecords([sourceRecord], {
    ...INITIAL_REPORT_FILTERS,
    rppsRegime: 'RPPS',
  })).toEqual([]);
});
