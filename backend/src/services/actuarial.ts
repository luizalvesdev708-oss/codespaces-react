import { Decimal } from 'decimal.js';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const zero = new Decimal(0);
const money = (value: Decimal) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);

export interface TaxBracketInput {
  lower: string;
  upper: string | null;
  rate: string;
  deduction: string;
}

export interface PayrollInput {
  tipo: 'ACTIVE' | 'RETIRED' | 'PENSIONER';
  proventos: string;
  baseCalculo: string;
  descontosAdicionais: string;
  deducoesLegais: string;
  aliquotaSegurado: string;
  aliquotaPatronal: string;
  tetoPrevidenciario?: string | null;
  isencaoBeneficioAte: string;
  irrfBrackets: TaxBracketInput[];
}

export function calculatePayroll(input: PayrollInput) {
  const proventos = new Decimal(input.proventos);
  const reportedBase = new Decimal(input.baseCalculo);
  const cap = input.tetoPrevidenciario ? new Decimal(input.tetoPrevidenciario) : null;
  const base = input.tipo === 'ACTIVE' && cap ? Decimal.min(reportedBase, cap) : reportedBase;
  const otherDeductions = new Decimal(input.descontosAdicionais);
  const taxDeductions = new Decimal(input.deducoesLegais);
  const employeeRate = new Decimal(input.aliquotaSegurado);
  const employerRate = new Decimal(input.aliquotaPatronal);
  if ([proventos, base, otherDeductions, taxDeductions, employeeRate, employerRate].some((value) => !value.isFinite() || value.isNegative())) {
    throw new Error('Payroll inputs must be finite and non-negative');
  }
  if (employeeRate.greaterThan(1) || employerRate.greaterThan(1)) throw new Error('Contribution rates must be fractions from 0 to 1');

  const taxableBase = Decimal.max(base.minus(taxDeductions), zero);
  const bracket = [...input.irrfBrackets]
    .sort((left, right) => new Decimal(left.lower).comparedTo(right.lower))
    .find((item) => taxableBase.greaterThanOrEqualTo(item.lower) && (item.upper === null || taxableBase.lessThan(item.upper)));
  if (!bracket) throw new Error('No effective IRRF bracket configured for this taxable base');
  const irrf = Decimal.max(taxableBase.mul(bracket.rate).minus(bracket.deduction), zero);
  const exemption = input.tipo === 'ACTIVE' ? zero : new Decimal(input.isencaoBeneficioAte);
  const contributionBase = Decimal.max(base.minus(exemption), zero);
  const employeeContribution = contributionBase.mul(employeeRate);
  const employerContribution = input.tipo === 'ACTIVE' ? base.mul(employerRate) : zero;
  const net = proventos.minus(otherDeductions).minus(employeeContribution).minus(irrf);

  return {
    massaSalarial: money(proventos),
    baseCalculo: money(base),
    baseContributiva: money(contributionBase),
    descontos: money(otherDeductions.plus(employeeContribution).plus(irrf)),
    irrf: money(irrf),
    contribuicaoSegurado: money(employeeContribution),
    contribuicaoPatronal: money(employerContribution),
    liquido: money(net),
  };
}

export function calculateIndicators(input: {
  registrosCenso: number; totalAtivos: number; totalInativos: number;
  baseCalculo: string; proventos: string; descontos: string; patronal: string;
}) {
  const population = input.totalAtivos + input.totalInativos;
  const ratio = (value: string, total: string) => {
    const denominator = new Decimal(total);
    return denominator.isZero() ? '0.00' : new Decimal(value).div(denominator).mul(100).toDecimalPlaces(2).toFixed(2);
  };
  return {
    coberturaCensoPercentual: population ? new Decimal(input.registrosCenso).div(population).mul(100).toDecimalPlaces(2).toFixed(2) : '0.00',
    baseSobreProventosPercentual: ratio(input.baseCalculo, input.proventos),
    descontosSobreProventosPercentual: ratio(input.descontos, input.proventos),
    patronalSobreBasePercentual: ratio(input.patronal, input.baseCalculo),
  };
}