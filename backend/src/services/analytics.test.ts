import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateCensusAnalytics } from './analytics.js';

test('calculates status percentages and payroll projections with two decimal places', () => {
  const result = calculateCensusAnalytics({
    censusStatuses: { COMPLETED: 6, PENDING: 2, IN_PROGRESS: 1, REJECTED: 1 },
    personnel: { active: 20, retired: 3, pensioner: 2 },
    demographics: {
      birthDates: ['1978-05-14', '1980-10-20'],
      contributionYears: ['22.00', '18.00'],
      asOfDate: '2026-08-31',
    },
    payroll: {
      grossPayroll: '2234.56',
      grossBenefits: '1234.56',
      insuredContributions: '100.10',
      employerContributions: '199.90',
    },
  });

  assert.deepEqual(result.census, {
    total: 10,
    recenseados: 6,
    pendentes: 2,
    emAnalise: 1,
    recusados: 1,
    recenseadosPercentual: '60.00',
    pendentesPercentual: '20.00',
    emAnalisePercentual: '10.00',
    recusadosPercentual: '10.00',
  });
  assert.equal(result.personnel.total, 25);
  assert.equal(result.personnel.idadeMediaAnos, 46.5);
  assert.equal(result.personnel.tempoMedioContribuicaoAnos, 20);
  assert.equal(result.payroll.folhaBruta, '2234.56');
  assert.equal(result.payroll.arrecadacaoPrevidenciaria, '300.00');
  assert.equal(result.payroll.projecaoAnualContribuicoes, '3600.00');
  assert.equal(result.payroll.projecaoAnualBeneficios, '14814.72');
  assert.equal(result.payroll.projecaoAnualSaldo, '-11214.72');
});

test('returns zero percentages and safe monetary totals when there is no data', () => {
  const result = calculateCensusAnalytics({
    censusStatuses: {},
    personnel: { active: 0, retired: 0, pensioner: 0 },
    demographics: { birthDates: [], contributionYears: [], asOfDate: '2026-08-31' },
    payroll: { grossPayroll: '0', grossBenefits: '0', insuredContributions: '', employerContributions: '0.00' },
  });

  assert.equal(result.census.recenseadosPercentual, '0.00');
  assert.equal(result.payroll.arrecadacaoPrevidenciaria, '0.00');
  assert.equal(result.payroll.projecaoAnualSaldo, '0.00');
});
