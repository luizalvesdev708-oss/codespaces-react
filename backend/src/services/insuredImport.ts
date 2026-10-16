import { z } from 'zod';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
});

const insuredRecordSchema = z.object({
  id_segurado: z.string().trim().min(1).max(80),
  nome_completo: z.string().trim().min(3).max(160),
  cpf: z.string().transform((value) => value.replace(/\D/g, '')).refine((value) => /^\d{11}$/.test(value)),
  data_nascimento: dateOnly,
  idade: z.number().int().min(0).max(130).optional(),
  categoria: z.literal('Ativo'),
  status_recenseado: z.enum(['Recenseado', 'Pendente', 'Não Recenseado', 'Em Análise', 'Recusado']),
  regime: z.string().trim().min(1).max(80),
  fonte_dados: z.string().trim().min(1).max(120),
  'tempo_contribuição_anos': z.number().min(0).max(100),
  valor_salario_base: z.number().min(0),
  valor_contribuicao: z.number().min(0),
  valor_beneficio: z.number().min(0),
  data_ultimo_recenseamento: dateOnly,
  periodo_referencia: z.string().trim().min(1).max(80),
});

const monthNumbers = new Map([
  ['janeiro', 1], ['fevereiro', 2], ['marco', 3], ['abril', 4], ['maio', 5], ['junho', 6],
  ['julho', 7], ['agosto', 8], ['setembro', 9], ['outubro', 10], ['novembro', 11], ['dezembro', 12],
]);

export class InsuredRecordValidationError extends Error {
  readonly status = 400;
}

function parseMonth(value: string): Date {
  const match = /^([a-zá-ú]+)\/(\d{4})$/iu.exec(value.trim());
  const monthName = match?.[1]?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const month = monthName ? monthNumbers.get(monthName) : undefined;
  const year = match?.[2];
  if (!month || !year) throw new InsuredRecordValidationError('Período de referência inválido; use “Mês/AAAA — Mês/AAAA”.');
  return new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`);
}

export function parseReferencePeriod(value: string): { from: Date; to: Date } {
  const parts = value.split(/\s*[—–-]\s*/u);
  if (parts.length !== 2) throw new InsuredRecordValidationError('Período de referência inválido; use “Mês/AAAA — Mês/AAAA”.');
  const from = parseMonth(parts[0]!);
  const toMonth = parseMonth(parts[1]!);
  const to = new Date(Date.UTC(toMonth.getUTCFullYear(), toMonth.getUTCMonth() + 1, 0));
  if (from > to) throw new InsuredRecordValidationError('O início do período de referência deve anteceder seu fim.');
  return { from, to };
}

export function parseInsuredRecord(value: unknown) {
  const result = insuredRecordSchema.safeParse(value);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.') || 'registro'}: ${issue.message}`);
    throw new InsuredRecordValidationError(`Registro inválido: ${issues.join('; ')}`);
  }
  const input = result.data;
  const period = parseReferencePeriod(input.periodo_referencia);
  const referenceDate = new Date(Date.UTC(period.to.getUTCFullYear(), period.to.getUTCMonth() + 1, 0));
  const ageAtReference = referenceDate.getUTCFullYear() - Number(input.data_nascimento.slice(0, 4))
    - (referenceDate.getUTCMonth() + 1 < Number(input.data_nascimento.slice(5, 7))
      || (referenceDate.getUTCMonth() + 1 === Number(input.data_nascimento.slice(5, 7))
        && referenceDate.getUTCDate() < Number(input.data_nascimento.slice(8, 10))) ? 1 : 0);
  if (ageAtReference < 0) throw new InsuredRecordValidationError('A data de nascimento deve ser anterior ao período de referência.');
  const monthlyCompetence = new Date(Date.UTC(period.to.getUTCFullYear(), period.to.getUTCMonth(), 1));
  return {
    externalId: input.id_segurado,
    name: input.nome_completo,
    cpf: input.cpf,
    birthDate: input.data_nascimento,
    contributionYears: input['tempo_contribuição_anos'].toFixed(2),
    category: 'ACTIVE' as const,
    censusStatus: ({
      Recenseado: 'COMPLETED',
      Pendente: 'PENDING',
      'Não Recenseado': 'PENDING',
      'Em Análise': 'IN_PROGRESS',
      Recusado: 'REJECTED',
    } as const)[input.status_recenseado],
    regime: input.regime,
    dataSource: input.fonte_dados,
    salary: input.valor_salario_base.toFixed(2),
    contribution: input.valor_contribuicao.toFixed(2),
    benefit: input.valor_beneficio.toFixed(2),
    lastCensusDate: input.data_ultimo_recenseamento,
    referenceFrom: period.from,
    referenceTo: period.to,
    competence: monthlyCompetence,
    ageAtReference,
  };
}
