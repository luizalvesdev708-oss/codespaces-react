import { describe, expect, it } from 'vitest';
import type { DecryptedAnalyticsReport } from '../@types/analytics';
import { buildAnalyticsCsv } from './analyticsExport';

const report: DecryptedAnalyticsReport = {
  title: 'Relatório de teste',
  processedAt: '2026-04-01T12:00:00.000Z',
  filters: {
    from: null,
    to: null,
    regime: 'ALL',
    source: 'Banco de dados',
    dataScope: 'Posição atual',
  },
  totalRecords: 1,
  analytics: {
    census: {
      total: 1,
      recenseados: 1,
      pendentes: 0,
      emAnalise: 0,
      recusados: 0,
      recenseadosPercentual: '100.00',
      pendentesPercentual: '0.00',
      emAnalisePercentual: '0.00',
      recusadosPercentual: '0.00',
    },
    personnel: {
      ativos: 1,
      aposentados: 0,
      pensionistas: 0,
      total: 1,
      idadeMediaAnos: null,
      tempoMedioContribuicaoAnos: null,
    },
    payroll: {
      folhaBruta: '10.00',
      arrecadacaoPrevidenciaria: '2.00',
      beneficiosConcedidos: 0,
      projecaoAnualContribuicoes: '24.00',
      projecaoAnualBeneficios: '0.00',
      projecaoAnualSaldo: '24.00',
      premissaProjecao: 'Competência multiplicada por 12.',
    },
    indisponiveis: [],
  },
  unavailableMetrics: [],
  sheets: {
    census: [{ nome: '=1+1', cpf: '12345678901' }],
    insured: [],
    benefits: [],
  },
};

describe('analytics CSV export', () => {
  it('pads metadata rows to the detail-table width and protects formula cells', () => {
    const csv = buildAnalyticsCsv(report);
    const lines = csv.split('\r\n');

    expect(new Set(lines.map((line) => line.split(';').length)).size).toBe(1);
    expect(csv).toContain(`"'=1+1"`);
  });

  it('keeps a consistent metadata width when all sheets are empty', () => {
    const emptyReport: DecryptedAnalyticsReport = {
      ...report,
      totalRecords: 0,
      sheets: { census: [], insured: [], benefits: [] },
    };
    const lines = buildAnalyticsCsv(emptyReport).split('\r\n');

    expect(new Set(lines.map((line) => line.split(';').length)).size).toBe(1);
  });

  it('preserves legitimate negative numeric values in exported financial data', () => {
    const csv = buildAnalyticsCsv({
      ...report,
      sheets: { census: [{ saldo: '-12.34' }], insured: [], benefits: [] },
    });

    expect(csv).toContain('"-12.34"');
    expect(csv).not.toContain(`"'-12.34"`);
  });
});
