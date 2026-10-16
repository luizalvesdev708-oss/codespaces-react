import type { RequestHandler } from 'express';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { PersonnelType } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/db.js';
import { calculateIndicators, calculatePayroll } from '../services/actuarial.js';
import { calculateCensusAnalytics } from '../services/analytics.js';
import { decryptPii, maskCpf, maskName } from '../config/encryption.js';

function formatDate(value: Date | null | undefined) {
  return value ? value.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '';
}

function sum(values: Decimal.Value[]) {
  return values.reduce<Decimal>((total, value) => total.plus(String(value)), new Decimal(0)).toDecimalPlaces(2).toNumber();
}

function aggregateCount(value: true | { id?: number; _all?: number } | undefined) {
  if (!value || value === true) return 0;
  return value.id ?? value._all ?? 0;
}

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
});

const dashboardFilterSchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  category: z.nativeEnum(PersonnelType).optional(),
  regime: z.string().trim().min(1).max(80).optional(),
  source: z.string().trim().min(1).max(120).optional(),
}).refine((filter) => !filter.from || !filter.to || filter.from <= filter.to, {
  message: 'The period start must not be after its end',
});

function periodBounds(from?: string, to?: string) {
  return from || to ? {
    ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
    ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
  } : undefined;
}

type CensusWithPeople = Prisma.CensoRegistroGetPayload<{
  include: { servidorAtivo: true; aposentado: true; pensionista: true };
}>;

type DashboardCensusRecord = Prisma.CensoRegistroGetPayload<{
  include: {
    servidorAtivo: { select: { nomeCiphertext: true; cpfCiphertext: true; matriculaCiphertext: true; cargo: true; regime: true; fonteDados: true } };
    aposentado: { select: { nomeCiphertext: true; cpfCiphertext: true; matriculaCiphertext: true; beneficio: true; regime: true; fonteDados: true } };
    pensionista: { select: { nomeCiphertext: true; cpfCiphertext: true; matriculaCiphertext: true; beneficio: true; regime: true; fonteDados: true } };
  };
}>;

function personWhere(regime?: string, source?: string): { regime?: string; fonteDados?: string } {
  return {
    ...(regime ? { regime } : {}),
    ...(source ? { fonteDados: source } : {}),
  };
}

function censusLinkedPersonFilter(regime?: string, source?: string): Prisma.CensoRegistroWhereInput[] {
  const where = personWhere(regime, source);
  return [
    { servidorAtivo: { is: where } },
    { aposentado: { is: where } },
    { pensionista: { is: where } },
  ];
}

function censusLinkedPayrollPeriodFilter(from?: string, to?: string): Prisma.CensoRegistroWhereInput[] {
  const competenceBounds = periodBounds(from, to);
  const referenceOverlap = {
    ...(to ? { periodoReferenciaInicio: { lte: new Date(`${to}T23:59:59.999Z`) } } : {}),
    ...(from ? { periodoReferenciaFim: { gte: new Date(`${from}T00:00:00.000Z`) } } : {}),
  };
  const payrollPeriod = {
    some: {
      OR: [
        ...(competenceBounds ? [{ competencia: competenceBounds }] : []),
        { AND: [referenceOverlap] },
      ],
    },
  };
  return [
    { servidorAtivo: { is: { payroll: payrollPeriod } } },
    { aposentado: { is: { payroll: payrollPeriod } } },
    { pensionista: { is: { payroll: payrollPeriod } } },
  ];
}

function payrollLinkedPersonFilter(regime?: string, source?: string): Prisma.FolhaPagamentoWhereInput[] {
  const where = personWhere(regime, source);
  return [
    { servidorAtivo: { is: where } },
    { aposentado: { is: where } },
    { pensionista: { is: where } },
  ];
}

function censusWhere(
  from?: string,
  to?: string,
  category?: PersonnelType,
  regime?: string,
  source?: string,
): Prisma.CensoRegistroWhereInput {
  const bounds = periodBounds(from, to);
  const constraints: Prisma.CensoRegistroWhereInput[] = [];
  if (bounds) {
    constraints.push({
      OR: [
        { dataCadastro: bounds },
        ...censusLinkedPayrollPeriodFilter(from, to),
      ],
    });
  }
  if (regime || source) {
    constraints.push({ OR: censusLinkedPersonFilter(regime, source) });
  }
  return {
    ...(category ? { tipo: category } : {}),
    ...(constraints.length ? { AND: constraints } : {}),
  };
}

function payrollWhere(
  from?: string,
  to?: string,
  category?: PersonnelType,
  regime?: string,
  source?: string,
): Prisma.FolhaPagamentoWhereInput {
  const bounds = periodBounds(from, to);
  return {
    ...(bounds ? { competencia: bounds } : {}),
    ...(category === 'ACTIVE' ? { servidorAtivoId: { not: null } } : {}),
    ...(category === 'RETIRED' ? { aposentadoId: { not: null } } : {}),
    ...(category === 'PENSIONER' ? { pensionistaId: { not: null } } : {}),
    ...(regime || source ? { OR: payrollLinkedPersonFilter(regime, source) } : {}),
  };
}

function periodEndDate(competence: Date | null, fallback = new Date()): string {
  const date = competence ?? fallback;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

function ageOn(birthDate: string, referenceDate: string): number {
  const birth = new Date(`${birthDate}T00:00:00.000Z`);
  const reference = new Date(`${referenceDate}T00:00:00.000Z`);
  let age = reference.getUTCFullYear() - birth.getUTCFullYear();
  if (reference.getUTCMonth() < birth.getUTCMonth()
    || (reference.getUTCMonth() === birth.getUTCMonth() && reference.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

function demographicsInput(
  people: Array<{ dataNascimentoCiphertext: string | null; tempoContribuicaoAnos: Decimal | null }>,
  asOfDate: string,
) {
  return {
    birthDates: people.flatMap((person) => person.dataNascimentoCiphertext
      ? [decryptPii(person.dataNascimentoCiphertext)]
      : []),
    contributionYears: people.flatMap((person) => person.tempoContribuicaoAnos
      ? [person.tempoContribuicaoAnos.toString()]
      : []),
    asOfDate,
  };
}

function formatCpf(cpf: string) {
  const digits = cpf.replace(/\D/g, '');
  return digits.length === 11 ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}` : cpf;
}

function readableName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export const dashboardData: RequestHandler = async (request, response, next) => {
  try {
    const filters = dashboardFilterSchema.parse(request.query);
    const censusQuery = censusWhere(filters.from, filters.to, filters.category, filters.regime, filters.source);
    const payrollQuery = payrollWhere(filters.from, filters.to, filters.category, filters.regime, filters.source);
    const latestPayroll = await prisma.folhaPagamento.aggregate({ where: payrollQuery, _max: { competencia: true } });
    const competence = latestPayroll._max.competencia;
    const censusRecordsQuery = prisma.censoRegistro.findMany({
      where: censusQuery,
      take: 500,
      orderBy: { dataCadastro: 'desc' },
      include: {
        servidorAtivo: { select: { nomeCiphertext: true, cpfCiphertext: true, matriculaCiphertext: true, cargo: true, regime: true, fonteDados: true } },
        aposentado: { select: { nomeCiphertext: true, cpfCiphertext: true, matriculaCiphertext: true, beneficio: true, regime: true, fonteDados: true } },
        pensionista: { select: { nomeCiphertext: true, cpfCiphertext: true, matriculaCiphertext: true, beneficio: true, regime: true, fonteDados: true } },
      },
    });
    const payrollRecordsQuery = prisma.folhaPagamento.findMany({
      where: competence ? { ...payrollQuery, competencia: competence } : { ...payrollQuery, id: '00000000-0000-0000-0000-000000000000' },
      include: {
        servidorAtivo: { select: { id: true } },
        aposentado: { select: { beneficio: true } },
        pensionista: { select: { beneficio: true } },
      },
    });
    const activeWhere = personWhere(filters.regime, filters.source);
    const [censusTotal, censusByStatus, censusDates, censusRecordsRaw, activePeople, payrollRecords, activeCount, retiredCount, pensionerCount, activeDemographics, retiredDemographics, pensionerDemographics, activeRegimes, retiredRegimes, pensionerRegimes, activeSources, retiredSources, pensionerSources] = await Promise.all([
      prisma.censoRegistro.count({ where: censusQuery }),
      prisma.censoRegistro.groupBy({ by: ['status'], where: censusQuery, _count: { _all: true } }),
      prisma.censoRegistro.findMany({ where: censusQuery, select: { dataCadastro: true }, orderBy: { dataCadastro: 'asc' }, take: 5000 }),
      censusRecordsQuery,
      prisma.servidorAtivo.groupBy({ by: ['cargo'], where: activeWhere, _count: { _all: true }, orderBy: { _count: { id: 'desc' } }, take: 100 }),
      payrollRecordsQuery,
      prisma.servidorAtivo.count({ where: activeWhere }),
      prisma.aposentado.count({ where: personWhere(filters.regime, filters.source) }),
      prisma.pensionista.count({ where: personWhere(filters.regime, filters.source) }),
      prisma.servidorAtivo.findMany({ where: activeWhere, select: { dataNascimentoCiphertext: true, tempoContribuicaoAnos: true } }),
      prisma.aposentado.findMany({ where: personWhere(filters.regime, filters.source), select: { dataNascimentoCiphertext: true, tempoContribuicaoAnos: true } }),
      prisma.pensionista.findMany({ where: personWhere(filters.regime, filters.source), select: { dataNascimentoCiphertext: true, tempoContribuicaoAnos: true } }),
      prisma.servidorAtivo.findMany({ where: { regime: { not: null } }, distinct: ['regime'], select: { regime: true } }),
      prisma.aposentado.findMany({ where: { regime: { not: null } }, distinct: ['regime'], select: { regime: true } }),
      prisma.pensionista.findMany({ where: { regime: { not: null } }, distinct: ['regime'], select: { regime: true } }),
      prisma.servidorAtivo.findMany({ where: { fonteDados: { not: null } }, distinct: ['fonteDados'], select: { fonteDados: true } }),
      prisma.aposentado.findMany({ where: { fonteDados: { not: null } }, distinct: ['fonteDados'], select: { fonteDados: true } }),
      prisma.pensionista.findMany({ where: { fonteDados: { not: null } }, distinct: ['fonteDados'], select: { fonteDados: true } }),
    ]);
    const censusRecords = censusRecordsRaw as DashboardCensusRecord[];

    const statusCounts = Object.fromEntries(censusByStatus.map((item) => [item.status, item._count._all]));
    const completed = statusCounts.COMPLETED ?? 0;
    const cadastroCounts: Record<string, number> = {};
    censusDates.forEach(({ dataCadastro }) => {
      const key = formatDate(dataCadastro);
      cadastroCounts[key] = (cadastroCounts[key] ?? 0) + 1;
    });
    const activePayrollRecords = payrollRecords.filter((item) => item.servidorAtivoId);
    const benefitPayrollRecords = payrollRecords.filter((item) => !item.servidorAtivoId);
    const benefitGroups = new Map<string, typeof benefitPayrollRecords>();
    benefitPayrollRecords.forEach((item) => {
      const benefitType = item.aposentado?.beneficio ?? item.pensionista?.beneficio ?? 'Benefício não informado';
      benefitGroups.set(benefitType, [...(benefitGroups.get(benefitType) ?? []), item]);
    });
    const benefits = [...benefitGroups.entries()].map(([tipo, records]) => ({
      tipo,
      quantidade: records.length,
      vencimentos: sum(records.map((item) => item.proventos)),
      descontos: sum(records.map((item) => item.descontos)),
      liquido: sum(records.map((item) => item.proventos.minus(item.descontos))),
    }));
    const activeProventos = sum(activePayrollRecords.map((item) => item.proventos));
    const activeDescontos = sum(activePayrollRecords.map((item) => item.descontos));
    const totalBenefitsGross = sum(benefits.map((item) => item.vencimentos));
    const totalBenefitsDiscounts = sum(benefits.map((item) => item.descontos));
    const totalBenefitsNet = sum(benefits.map((item) => item.liquido));
    const dates = censusDates.map((item) => item.dataCadastro);

    response.json({
      records: censusRecords.map((record) => {
        const person = record.servidorAtivo ?? record.aposentado ?? record.pensionista;
        const fullName = person ? decryptPii(person.nomeCiphertext) : '';
        const cpf = person ? decryptPii(person.cpfCiphertext) : '';
        const matricula = person ? decryptPii(person.matriculaCiphertext) : '';
        return {
          cpf: maskCpf(cpf),
          nome: fullName ? maskName(fullName) : 'Segurado sem vínculo',
          matricula: matricula ? `***${matricula.slice(-3)}` : '***',
          tipo: record.tipo,
          regime: person?.regime ?? '',
          fonteDados: person?.fonteDados ?? '',
          entidade: 'Não informada',
          cargo: record.servidorAtivo?.cargo ?? record.aposentado?.beneficio ?? record.pensionista?.beneficio ?? 'Não informado',
          cadastro: formatDate(record.dataCadastro),
          conclusao: formatDate(record.dataConclusao),
          ultimoAcesso: formatDate(record.ultimoAcesso),
          status: record.status === 'COMPLETED'
            ? 'Concluído'
            : record.status === 'IN_PROGRESS'
              ? 'Em análise'
              : record.status === 'REJECTED'
                ? 'Recusado'
                : 'Cadastro sem conclusão',
        };
      }),
      cargo_counts: Object.fromEntries((filters.category && filters.category !== 'ACTIVE' ? [] : activePeople).map((item) => [item.cargo, aggregateCount(item._count)])),
      cadastro_counts: cadastroCounts,
      payroll: {
        ativos: {
          quantidade: activePayrollRecords.length,
          proventos: activeProventos,
          base: sum(activePayrollRecords.map((item) => item.baseCalculo)),
          descontos: activeDescontos,
          patronal: sum(activePayrollRecords.map((item) => item.contribuicaoPatronal)),
        },
        beneficios: benefits,
        beneficiarios: benefits.reduce((total, item) => total + item.quantidade, 0),
        total_vencimentos_beneficios: totalBenefitsGross,
        total_descontos_beneficios: totalBenefitsDiscounts,
        total_liquido_beneficios: totalBenefitsNet,
      },
      censo: {
        registros: censusTotal,
        concluidos: completed,
        sem_conclusao: statusCounts.PENDING ?? 0,
        entidades: 0,
        data_inicial: formatDate(dates[0]),
        data_final: formatDate(dates.at(-1)),
      },
      analytics: calculateCensusAnalytics({
        censusStatuses: statusCounts,
        personnel: {
          active: !filters.category || filters.category === 'ACTIVE' ? activeCount : 0,
          retired: !filters.category || filters.category === 'RETIRED' ? retiredCount : 0,
          pensioner: !filters.category || filters.category === 'PENSIONER' ? pensionerCount : 0,
        },
        demographics: demographicsInput([
          ...(!filters.category || filters.category === 'ACTIVE' ? activeDemographics : []),
          ...(!filters.category || filters.category === 'RETIRED' ? retiredDemographics : []),
          ...(!filters.category || filters.category === 'PENSIONER' ? pensionerDemographics : []),
        ], periodEndDate(competence)),
        payroll: {
          grossPayroll: sum(payrollRecords.map((item) => item.proventos)).toFixed(2),
          grossBenefits: sum([
            ...benefitPayrollRecords.map((item) => item.proventos),
            ...activePayrollRecords.map((item) => item.valorBeneficio),
          ]).toFixed(2),
          insuredContributions: sum(payrollRecords.map((item) => item.contribuicaoSegurado)).toFixed(2),
          employerContributions: sum(payrollRecords.map((item) => item.contribuicaoPatronal)).toFixed(2),
        },
      }),
      filters: {
        from: filters.from ?? null,
        to: filters.to ?? null,
        regime: filters.regime ?? null,
        source: filters.source ?? null,
        category: filters.category ?? 'ALL',
        competence: competence?.toISOString().slice(0, 10) ?? null,
      },
      filterOptions: {
        regimes: [...new Set([...activeRegimes, ...retiredRegimes, ...pensionerRegimes].flatMap((item) => item.regime ?? []))].sort(),
        sources: [...new Set([...activeSources, ...retiredSources, ...pensionerSources].flatMap((item) => item.fonteDados ?? []))].sort(),
      },
    });
  } catch (error) {
    next(error);
  }
};

const exportFilterSchema = dashboardFilterSchema;

export const decryptedAnalyticsExport: RequestHandler = async (request, response, next) => {
  try {
    const filters = exportFilterSchema.parse(request.query);
    const censusQuery = censusWhere(filters.from, filters.to, filters.category, filters.regime, filters.source);
    const payrollQuery = payrollWhere(filters.from, filters.to, filters.category, filters.regime, filters.source);
    const insuredWhere = personWhere(filters.regime, filters.source);
    const [censusRaw, activeAll, retiredAll, pensionersAll, latestPayroll] = await Promise.all([
      prisma.censoRegistro.findMany({
        where: censusQuery,
        orderBy: { dataCadastro: 'asc' },
        include: {
          servidorAtivo: true,
          aposentado: true,
          pensionista: true,
        },
      }),
      prisma.servidorAtivo.findMany({ where: insuredWhere }),
      prisma.aposentado.findMany({ where: insuredWhere }),
      prisma.pensionista.findMany({ where: insuredWhere }),
      prisma.folhaPagamento.aggregate({ where: payrollQuery, _max: { competencia: true } }),
    ]);
    const payroll = latestPayroll._max.competencia
      ? await prisma.folhaPagamento.findMany({
        where: { ...payrollQuery, competencia: latestPayroll._max.competencia },
        orderBy: { competencia: 'asc' },
        include: {
          servidorAtivo: true,
          aposentado: true,
          pensionista: true,
        },
      })
      : [];
    const census = censusRaw as CensusWithPeople[];
    const active = !filters.category || filters.category === 'ACTIVE' ? activeAll : [];
    const retired = !filters.category || filters.category === 'RETIRED' ? retiredAll : [];
    const pensioners = !filters.category || filters.category === 'PENSIONER' ? pensionersAll : [];
    const reportReferenceDate = periodEndDate(latestPayroll._max.competencia);
    const personRow = (person: {
      id: string;
      idSegurado?: string | null;
      nomeCiphertext: string;
      cpfCiphertext: string;
      matriculaCiphertext: string;
      dataNascimentoCiphertext?: string | null;
      tempoContribuicaoAnos?: Decimal | null;
      regime?: string | null;
      fonteDados?: string | null;
    }, tipo: string, extra: Record<string, string | number> = {}) => {
      const birthDate = person.dataNascimentoCiphertext ? decryptPii(person.dataNascimentoCiphertext) : '';
      return {
      id: person.id,
      idSegurado: person.idSegurado ?? '',
      tipo,
      nome: readableName(decryptPii(person.nomeCiphertext)),
      cpf: formatCpf(decryptPii(person.cpfCiphertext)),
      matricula: decryptPii(person.matriculaCiphertext).trim(),
      dataNascimento: birthDate,
      idade: birthDate ? ageOn(birthDate, reportReferenceDate) : '',
      tempoContribuicaoAnos: person.tempoContribuicaoAnos?.toFixed(2) ?? '',
      regime: person.regime ?? '',
      fonteDados: person.fonteDados ?? '',
      ...extra,
      };
    };
    const censusRows = census.map((record) => {
      const person = record.servidorAtivo ?? record.aposentado ?? record.pensionista;
      return {
        ...(person ? personRow(person, record.tipo) : { id: '', tipo: record.tipo, nome: 'Segurado sem vínculo', cpf: '', matricula: '' }),
        status: record.status,
        cadastro: formatDate(record.dataCadastro),
        conclusao: formatDate(record.dataConclusao),
        ultimoAcesso: formatDate(record.ultimoAcesso),
        observacao: record.observacao ?? '',
      };
    });
    const insuredRows = [
      ...active.map((person) => {
        const payrollRecord = payroll.find((item) => item.servidorAtivoId === person.id);
        return personRow(person, 'ACTIVE', {
          cargo: person.cargo,
          admissao: formatDate(person.admissao),
          salarioBase: payrollRecord?.baseCalculo.toFixed(2) ?? '',
          contribuicao: payrollRecord?.contribuicaoSegurado.toFixed(2) ?? '',
          valorBeneficio: payrollRecord?.valorBeneficio.toFixed(2) ?? '',
          competencia: payrollRecord ? formatDate(payrollRecord.competencia) : '',
          periodoReferenciaInicio: formatDate(payrollRecord?.periodoReferenciaInicio),
          periodoReferenciaFim: formatDate(payrollRecord?.periodoReferenciaFim),
        });
      }),
      ...retired.map((person) => personRow(person, 'RETIRED', { beneficio: person.beneficio, inicioBeneficio: formatDate(person.inicioBeneficio) })),
      ...pensioners.map((person) => personRow(person, 'PENSIONER', { beneficio: person.beneficio })),
    ];
    const benefitRows = payroll.filter((item) => !item.servidorAtivoId).map((item) => {
      const person = item.aposentado ?? item.pensionista;
      return {
        ...(person ? personRow(person, item.aposentado ? 'RETIRED' : 'PENSIONER') : { id: '', tipo: 'UNKNOWN', nome: '', cpf: '', matricula: '' }),
        competencia: formatDate(item.competencia),
        proventos: item.proventos.toFixed(2),
        descontos: item.descontos.toFixed(2),
        liquido: item.proventos.minus(item.descontos).toDecimalPlaces(2).toFixed(2),
        valorBeneficio: item.valorBeneficio.toFixed(2),
        periodoReferenciaInicio: formatDate(item.periodoReferenciaInicio),
        periodoReferenciaFim: formatDate(item.periodoReferenciaFim),
      };
    });
    const exportPeople = [...active, ...retired, ...pensioners];
    const statuses = await prisma.censoRegistro.groupBy({ by: ['status'], where: censusQuery, _count: { _all: true } });
    const analytics = calculateCensusAnalytics({
      censusStatuses: Object.fromEntries(statuses.map((item) => [item.status, item._count._all])),
      personnel: { active: active.length, retired: retired.length, pensioner: pensioners.length },
      demographics: demographicsInput(exportPeople, reportReferenceDate),
      payroll: {
        grossPayroll: sum(payroll.map((item) => item.proventos)).toFixed(2),
        grossBenefits: sum([
          ...payroll.filter((item) => !item.servidorAtivoId).map((item) => item.proventos),
          ...payroll.filter((item) => item.servidorAtivoId).map((item) => item.valorBeneficio),
        ]).toFixed(2),
        insuredContributions: sum(payroll.map((item) => item.contribuicaoSegurado)).toFixed(2),
        employerContributions: sum(payroll.map((item) => item.contribuicaoPatronal)).toFixed(2),
      },
    });
    const processedAt = new Date().toISOString();
    console.info(JSON.stringify({
      event: 'decrypted_analytics_export',
      actorId: request.authUser?.sub ?? 'unknown',
      processedAt,
      filters: {
        from: filters.from ?? null,
        to: filters.to ?? null,
        category: filters.category ?? 'ALL',
        regime: filters.regime ?? 'ALL',
        source: filters.source ?? 'ALL',
      },
      recordCounts: { census: censusRows.length, insured: insuredRows.length, benefits: benefitRows.length },
    }));
    response.setHeader('Cache-Control', 'no-store, private');
    response.setHeader('Pragma', 'no-cache');
    response.json({
      title: 'Relatório do Censo Previdenciário',
      processedAt,
      filters: {
        from: filters.from ?? null,
        to: filters.to ?? null,
        regime: filters.regime ?? 'ALL',
        source: filters.source ?? 'Banco de dados',
        dataScope: 'Período aplicado aos registros do censo e à competência mais recente da folha dentro do intervalo; a lista de segurados representa a posição atual, sem histórico cadastral temporal.',
      },
      totalRecords: censusRows.length + insuredRows.length + benefitRows.length,
      analytics,
      unavailableMetrics: analytics.indisponiveis,
      sheets: { census: censusRows, insured: insuredRows, benefits: benefitRows },
    });
  } catch (error) {
    next(error);
  }
};

const calculationSchema = z.object({
    tipo: z.enum(['ACTIVE', 'RETIRED', 'PENSIONER']),
  proventos: z.string().regex(/^\d+(\.\d{1,2})?$/),
  baseCalculo: z.string().regex(/^\d+(\.\d{1,2})?$/),
  descontosAdicionais: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0'),
  deducoesLegais: z.string().regex(/^\d+(\.\d{1,2})?$/).default('0'),
});

export const calculate: RequestHandler = async (request, response, next) => {
  try {
    const input = calculationSchema.parse(request.body);
    const today = new Date();
    const config = await prisma.actuarialConfig.findFirst({
      where: { vigenciaInicio: { lte: today }, OR: [{ vigenciaFim: null }, { vigenciaFim: { gte: today } }] },
      include: { irrfBrackets: { orderBy: { limiteInferior: 'asc' } } },
      orderBy: { vigenciaInicio: 'desc' },
    });
    if (!config) { response.status(503).json({ error: 'No actuarial configuration is effective for the current date' }); return; }
    const result = calculatePayroll({
      ...input,
      aliquotaSegurado: (input.tipo === 'ACTIVE' ? config.aliquotaAtivo : input.tipo === 'RETIRED' ? config.aliquotaAposentado : config.aliquotaPensionista).toString(),
      aliquotaPatronal: config.aliquotaPatronal.toString(),
      tetoPrevidenciario: config.tetoPrevidenciario?.toString() ?? null,
      isencaoBeneficioAte: config.isencaoBeneficioAte.toString(),
      irrfBrackets: config.irrfBrackets.map((bracket) => ({
        lower: bracket.limiteInferior.toString(),
        upper: bracket.limiteSuperior?.toString() ?? null,
        rate: bracket.aliquota.toString(),
        deduction: bracket.parcelaDeduzir.toString(),
      })),
    });
    response.json({ vigencia: config.vigenciaInicio, ...result });
  } catch (error) { next(error); }
};

export const dashboardSummary: RequestHandler = async (_request, response, next) => {
  try {
    const [records, active, retired, pensioners, payroll, censusByStatus, recentCensus] = await Promise.all([
      prisma.censoRegistro.count(),
      prisma.servidorAtivo.count(),
      prisma.aposentado.count(),
      prisma.pensionista.count(),
      prisma.folhaPagamento.aggregate({ _sum: { proventos: true, baseCalculo: true, descontos: true, irrf: true, contribuicaoPatronal: true } }),
      prisma.censoRegistro.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.censoRegistro.findMany({ select: { dataCadastro: true }, orderBy: { dataCadastro: 'desc' }, take: 1000 }),
    ]);
    const totals = {
      proventos: payroll._sum.proventos?.toString() ?? '0.00',
      base: payroll._sum.baseCalculo?.toString() ?? '0.00',
      descontos: payroll._sum.descontos?.toString() ?? '0.00',
      patronal: payroll._sum.contribuicaoPatronal?.toString() ?? '0.00',
    };
    const trend = new Map<string, number>();
    for (const item of recentCensus) {
      const key = item.dataCadastro.toISOString().slice(0, 10);
      trend.set(key, (trend.get(key) ?? 0) + 1);
    }
    response.json({
      counts: { census: records, active, retired, pensioners, coveredPeople: active + retired + pensioners },
      censusByStatus: censusByStatus.map((item) => ({ status: item.status, count: item._count.id })),
      payroll: totals,
        indicators: calculateIndicators({ registrosCenso: records, totalAtivos: active, totalInativos: retired + pensioners, baseCalculo: totals.base, proventos: totals.proventos, descontos: totals.descontos, patronal: totals.patronal }),
      trend: [...trend.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, count]) => ({ date, count })),
    });
  } catch (error) { next(error); }
};