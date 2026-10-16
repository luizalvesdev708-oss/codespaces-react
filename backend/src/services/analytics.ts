import { Decimal } from 'decimal.js';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type CensusStatusCode = 'COMPLETED' | 'PENDING' | 'IN_PROGRESS' | 'REJECTED';

export interface AnalyticsInput {
  censusStatuses: Partial<Record<CensusStatusCode, number>>;
  personnel: { active: number; retired: number; pensioner: number };
  demographics: { birthDates: string[]; contributionYears: string[]; asOfDate: string };
  payroll: {
    grossPayroll: string;
    grossBenefits: string;
    insuredContributions: string;
    employerContributions: string;
  };
}

const money = (value: Decimal) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);

function percentage(part: number, total: number): string {
  if (total <= 0) return '0.00';
  return new Decimal(part).div(total).mul(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
}

function decimal(value: string | null | undefined): Decimal {
  if (value == null || value.trim() === '') return new Decimal(0);
  const result = new Decimal(value);
  if (!result.isFinite()) throw new Error('Analytics monetary values must be finite decimal strings');
  return result;
}

function validDate(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Analytics dates must be valid ISO calendar dates');
  }
  return parsed;
}

function ageAt(birthDate: Date, asOfDate: Date): number {
  let age = asOfDate.getUTCFullYear() - birthDate.getUTCFullYear();
  if (asOfDate.getUTCMonth() < birthDate.getUTCMonth()
    || (asOfDate.getUTCMonth() === birthDate.getUTCMonth() && asOfDate.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return age;
}

function average(values: Decimal[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((result, value) => result.plus(value), new Decimal(0));
  return total.div(values.length).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function calculateCensusAnalytics(input: AnalyticsInput) {
  const completed = input.censusStatuses.COMPLETED ?? 0;
  const pending = input.censusStatuses.PENDING ?? 0;
  const inAnalysis = input.censusStatuses.IN_PROGRESS ?? 0;
  const rejected = input.censusStatuses.REJECTED ?? 0;
  const censusTotal = completed + pending + inAnalysis + rejected;
  const totalPopulation = input.personnel.active + input.personnel.retired + input.personnel.pensioner;
  const grossPayroll = decimal(input.payroll.grossPayroll);
  const grossBenefits = decimal(input.payroll.grossBenefits);
  const contributions = decimal(input.payroll.insuredContributions).plus(input.payroll.employerContributions);
  const asOfDate = validDate(input.demographics.asOfDate);
  const ages = input.demographics.birthDates.map((birthDate) => {
    const age = ageAt(validDate(birthDate), asOfDate);
    if (age < 0) throw new Error('Analytics birth dates must not be in the future');
    return new Decimal(age);
  });
  const contributionYears = input.demographics.contributionYears.map(decimal);

  return {
    census: {
      total: censusTotal,
      recenseados: completed,
      pendentes: pending,
      emAnalise: inAnalysis,
      recusados: rejected,
      recenseadosPercentual: percentage(completed, censusTotal),
      pendentesPercentual: percentage(pending, censusTotal),
      emAnalisePercentual: percentage(inAnalysis, censusTotal),
      recusadosPercentual: percentage(rejected, censusTotal),
    },
    personnel: {
      ativos: input.personnel.active,
      aposentados: input.personnel.retired,
      pensionistas: input.personnel.pensioner,
      total: totalPopulation,
      idadeMediaAnos: average(ages),
      tempoMedioContribuicaoAnos: average(contributionYears),
    },
    payroll: {
      folhaBruta: money(grossPayroll),
      arrecadacaoPrevidenciaria: money(contributions),
      beneficiosConcedidos: input.personnel.retired + input.personnel.pensioner,
      projecaoAnualContribuicoes: money(contributions.mul(12)),
      projecaoAnualBeneficios: money(grossBenefits.mul(12)),
      projecaoAnualSaldo: money(contributions.minus(grossBenefits).mul(12)),
      premissaProjecao: 'Competência consultada multiplicada por 12, sem crescimento, inflação ou novos participantes.',
    },
    indisponiveis: [
      ...(ages.length ? [] : ['Idade média: não há datas de nascimento para os registros selecionados.']),
      ...(contributionYears.length ? [] : ['Tempo médio de contribuição: não há períodos contributivos para os registros selecionados.']),
    ],
  };
}
