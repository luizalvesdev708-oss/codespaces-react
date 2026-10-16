import 'dotenv/config';
import { Decimal } from 'decimal.js';
import { prisma } from '../config/db.js';
import { encryptPii, hashCpf } from '../config/encryption.js';

const seedPrefix = 'DEMO-SYNTH-';
const seedMarker = 'SYNTHETIC_TEST_DATA';
const batchSize = 500;
const referenceFrom = new Date('2026-03-01T00:00:00.000Z');
const referenceTo = new Date('2026-08-31T00:00:00.000Z');
const competence = new Date('2026-08-01T00:00:00.000Z');
const firstNames = ['Ana', 'Bruno', 'Camila', 'Daniel', 'Elisa', 'Felipe', 'Gisele', 'Heitor', 'Isabela', 'João'];
const middleNames = ['Alves', 'Barbosa', 'Costa', 'Dias', 'Ferreira', 'Gomes', 'Lima', 'Moura', 'Nunes', 'Oliveira'];
const surnames = ['Andrade', 'Barros', 'Carvalho', 'Freitas', 'Mendes', 'Pereira', 'Ribeiro', 'Santos', 'Teixeira', 'Vieira'];
const activeJobs = ['Professor(a)', 'Agente administrativo', 'Técnico(a) de saúde', 'Analista', 'Assistente social'];
const statuses = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'PENDING', 'PENDING', 'IN_PROGRESS', 'IN_PROGRESS', 'REJECTED'] as const;

function assertLocalDevelopmentDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  const url = new URL(databaseUrl);
  const databaseName = url.pathname.replace(/^\//u, '');
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) || databaseName !== 'rpps_dev') {
    throw new Error('Synthetic records may only be inserted into the local rpps_dev database.');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Synthetic test records cannot be inserted when NODE_ENV=production.');
  }
}

function cpfChecksumDigit(input: string): number {
  const total = [...input].reduce((sum, digit, index) => sum + Number(digit) * (input.length + 1 - index), 0);
  const remainder = (total * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

function syntheticCpf(index: number): string {
  const base = `8${String(index).padStart(8, '0')}`;
  const firstDigit = cpfChecksumDigit(base);
  const secondDigit = cpfChecksumDigit(`${base}${firstDigit}`);
  const deliberatelyInvalidCheckDigit = String((secondDigit + 1) % 10);
  return `${base}${firstDigit}${deliberatelyInvalidCheckDigit}`;
}

function personName(index: number): string {
  return `${firstNames[index % firstNames.length]} ${middleNames[Math.floor(index / 3) % middleNames.length]} ${surnames[Math.floor(index / 7) % surnames.length]} ${String(index + 1).padStart(5, '0')}`;
}

function recordType(index: number): 'ACTIVE' | 'RETIRED' | 'PENSIONER' {
  const group = index % 10;
  if (group < 6) return 'ACTIVE';
  if (group < 8) return 'RETIRED';
  return 'PENSIONER';
}

function censusDate(index: number): Date {
  const month = 2 + (index % 6);
  const day = 1 + (index % 27);
  return new Date(Date.UTC(2026, month, day));
}

function birthDate(index: number): string {
  const year = 1950 + (index % 48);
  const month = 1 + (index % 12);
  const day = 1 + (index % 27);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function money(value: number): Decimal {
  return new Decimal(value).toDecimalPlaces(2);
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < items.length; start += size) result.push(items.slice(start, start + size));
  return result;
}

async function main(): Promise<void> {
  assertLocalDevelopmentDatabase();
  const requestedCount = Number(process.env.SYNTHETIC_RECORD_COUNT ?? 10_000);
  if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > 100_000) {
    throw new Error('SYNTHETIC_RECORD_COUNT must be an integer between 1 and 100000.');
  }

  const startTime = Date.now();
  const inputRows = Array.from({ length: requestedCount }, (_, offset) => {
    const index = offset + 1;
    const type = recordType(offset);
    const externalId = `${seedPrefix}${String(index).padStart(6, '0')}`;
    const cpf = syntheticCpf(index);
    const name = personName(offset);
    const dateOfBirth = birthDate(offset);
    const contributionYears = 2 + (offset % 38);
    const annualContributionYears = contributionYears.toFixed(2);
    const salary = 2_500 + ((offset * 137) % 12_500);
    const benefit = type === 'ACTIVE' ? 0 : 1_800 + ((offset * 83) % 9_000);
    const payrollAmount = type === 'ACTIVE' ? salary : benefit;
    const status = statuses[offset % statuses.length]!;
    const registeredAt = censusDate(offset);
    const monthlyContribution = type === 'ACTIVE' ? money(salary * 0.11) : money(0);
    const commonPerson = {
      idSegurado: externalId,
      nomeCiphertext: encryptPii(name),
      cpfCiphertext: encryptPii(cpf),
      cpfHash: hashCpf(cpf),
      matriculaCiphertext: encryptPii(externalId),
      dataNascimentoCiphertext: encryptPii(dateOfBirth),
      tempoContribuicaoAnos: new Decimal(annualContributionYears),
      regime: 'IPSS',
      fonteDados: 'Dados sintéticos (teste)',
    };
    const census = {
      tipo: type,
      status,
      dataCadastro: registeredAt,
      dataConclusao: status === 'COMPLETED' ? registeredAt : null,
      ultimoAcesso: registeredAt,
      observacao: `${seedMarker}: registro fictício gerado para teste local`,
    };
    const payroll = {
      competencia: competence,
      proventos: money(payrollAmount),
      baseCalculo: type === 'ACTIVE' ? money(salary) : money(0),
      descontos: money(payrollAmount * 0.05),
      irrf: money(payrollAmount * 0.02),
      contribuicaoSegurado: monthlyContribution,
      contribuicaoPatronal: type === 'ACTIVE' ? money(salary * 0.22) : money(0),
      valorBeneficio: money(benefit),
      periodoReferenciaInicio: referenceFrom,
      periodoReferenciaFim: referenceTo,
    };
    const baseRow = { index, type, externalId, census, payroll };
    if (type === 'ACTIVE') {
      return {
        ...baseRow,
        type,
        person: {
          ...commonPerson,
          cargo: `${activeJobs[offset % activeJobs.length]} · dado sintético`,
          admissao: new Date(`${Math.max(1975, 2026 - contributionYears)}-01-01T00:00:00.000Z`),
        },
      };
    }
    if (type === 'RETIRED') {
      return {
        ...baseRow,
        type,
        person: {
          ...commonPerson,
          beneficio: 'Aposentadoria · dado sintético',
          inicioBeneficio: new Date('2020-01-01T00:00:00.000Z'),
        },
      };
    }
    return {
      ...baseRow,
      type,
      person: {
        ...commonPerson,
        beneficio: 'Pensão · dado sintético',
      },
    };
  });

  const grouped = {
    ACTIVE: inputRows.filter((row) => row.type === 'ACTIVE'),
    RETIRED: inputRows.filter((row) => row.type === 'RETIRED'),
    PENSIONER: inputRows.filter((row) => row.type === 'PENSIONER'),
  };
  const existingByType = {
    ACTIVE: new Set((await prisma.servidorAtivo.findMany({
      where: { idSegurado: { in: grouped.ACTIVE.map((row) => row.externalId) } },
      select: { idSegurado: true },
    })).flatMap((person) => person.idSegurado ? [person.idSegurado] : [])),
    RETIRED: new Set((await prisma.aposentado.findMany({
      where: { idSegurado: { in: grouped.RETIRED.map((row) => row.externalId) } },
      select: { idSegurado: true },
    })).flatMap((person) => person.idSegurado ? [person.idSegurado] : [])),
    PENSIONER: new Set((await prisma.pensionista.findMany({
      where: { idSegurado: { in: grouped.PENSIONER.map((row) => row.externalId) } },
      select: { idSegurado: true },
    })).flatMap((person) => person.idSegurado ? [person.idSegurado] : [])),
  };

  for (const batch of chunks(grouped.ACTIVE.filter((row) => !existingByType.ACTIVE.has(row.externalId)), batchSize)) {
    await prisma.servidorAtivo.createMany({ data: batch.map((row) => row.person), skipDuplicates: true });
  }
  for (const batch of chunks(grouped.RETIRED.filter((row) => !existingByType.RETIRED.has(row.externalId)), batchSize)) {
    await prisma.aposentado.createMany({ data: batch.map((row) => row.person), skipDuplicates: true });
  }
  for (const batch of chunks(grouped.PENSIONER.filter((row) => !existingByType.PENSIONER.has(row.externalId)), batchSize)) {
    await prisma.pensionista.createMany({ data: batch.map((row) => row.person), skipDuplicates: true });
  }

  const databasePeople = {
    ACTIVE: await prisma.servidorAtivo.findMany({ where: { idSegurado: { in: grouped.ACTIVE.map((row) => row.externalId) } }, select: { id: true, idSegurado: true } }),
    RETIRED: await prisma.aposentado.findMany({ where: { idSegurado: { in: grouped.RETIRED.map((row) => row.externalId) } }, select: { id: true, idSegurado: true } }),
    PENSIONER: await prisma.pensionista.findMany({ where: { idSegurado: { in: grouped.PENSIONER.map((row) => row.externalId) } }, select: { id: true, idSegurado: true } }),
  };
  const expectedPersonIds = new Map<string, { id: string; type: 'ACTIVE' | 'RETIRED' | 'PENSIONER' }>();
  for (const type of ['ACTIVE', 'RETIRED', 'PENSIONER'] as const) {
    for (const person of databasePeople[type]) {
      if (person.idSegurado) expectedPersonIds.set(person.idSegurado, { id: person.id, type });
    }
  }
  if (expectedPersonIds.size !== requestedCount) {
    throw new Error(`Expected ${requestedCount} seeded people but found ${expectedPersonIds.size}; refusing to create incomplete related records.`);
  }

  let censusCreated = 0;
  let payrollCreated = 0;
  for (const batch of chunks(inputRows, batchSize)) {
    const personIds = batch.flatMap((row) => {
      const person = expectedPersonIds.get(row.externalId);
      return person ? [{ id: person.id, type: row.type }] : [];
    });
    const [activeCensus, retiredCensus, pensionerCensus] = await Promise.all([
      prisma.censoRegistro.findMany({ where: { servidorAtivoId: { in: personIds.filter((person) => person.type === 'ACTIVE').map((person) => person.id) } }, select: { servidorAtivoId: true } }),
      prisma.censoRegistro.findMany({ where: { aposentadoId: { in: personIds.filter((person) => person.type === 'RETIRED').map((person) => person.id) } }, select: { aposentadoId: true } }),
      prisma.censoRegistro.findMany({ where: { pensionistaId: { in: personIds.filter((person) => person.type === 'PENSIONER').map((person) => person.id) } }, select: { pensionistaId: true } }),
    ]);
    const linkedCensus = new Set([
      ...activeCensus.flatMap((record) => record.servidorAtivoId ? [record.servidorAtivoId] : []),
      ...retiredCensus.flatMap((record) => record.aposentadoId ? [record.aposentadoId] : []),
      ...pensionerCensus.flatMap((record) => record.pensionistaId ? [record.pensionistaId] : []),
    ]);
    const censusRows = batch.flatMap((row) => {
      const person = expectedPersonIds.get(row.externalId);
      if (!person || linkedCensus.has(person.id)) return [];
      return [{
        ...row.census,
        servidorAtivoId: row.type === 'ACTIVE' ? person.id : null,
        aposentadoId: row.type === 'RETIRED' ? person.id : null,
        pensionistaId: row.type === 'PENSIONER' ? person.id : null,
      }];
    });
    if (censusRows.length) {
      const result = await prisma.censoRegistro.createMany({ data: censusRows });
      censusCreated += result.count;
    }

    const [activePayroll, retiredPayroll, pensionerPayroll] = await Promise.all([
      prisma.folhaPagamento.findMany({ where: { servidorAtivoId: { in: personIds.filter((person) => person.type === 'ACTIVE').map((person) => person.id) }, competencia: competence }, select: { servidorAtivoId: true } }),
      prisma.folhaPagamento.findMany({ where: { aposentadoId: { in: personIds.filter((person) => person.type === 'RETIRED').map((person) => person.id) }, competencia: competence }, select: { aposentadoId: true } }),
      prisma.folhaPagamento.findMany({ where: { pensionistaId: { in: personIds.filter((person) => person.type === 'PENSIONER').map((person) => person.id) }, competencia: competence }, select: { pensionistaId: true } }),
    ]);
    const linkedPayroll = new Set([
      ...activePayroll.flatMap((record) => record.servidorAtivoId ? [record.servidorAtivoId] : []),
      ...retiredPayroll.flatMap((record) => record.aposentadoId ? [record.aposentadoId] : []),
      ...pensionerPayroll.flatMap((record) => record.pensionistaId ? [record.pensionistaId] : []),
    ]);
    const payrollRows = batch.flatMap((row) => {
      const person = expectedPersonIds.get(row.externalId);
      if (!person || linkedPayroll.has(person.id)) return [];
      return [{
        ...row.payroll,
        servidorAtivoId: row.type === 'ACTIVE' ? person.id : null,
        aposentadoId: row.type === 'RETIRED' ? person.id : null,
        pensionistaId: row.type === 'PENSIONER' ? person.id : null,
      }];
    });
    if (payrollRows.length) {
      const result = await prisma.folhaPagamento.createMany({ data: payrollRows });
      payrollCreated += result.count;
    }
  }

  const [activeCount, retiredCount, pensionerCount, censusCount, payrollCount] = await Promise.all([
    prisma.servidorAtivo.count({ where: { idSegurado: { startsWith: seedPrefix } } }),
    prisma.aposentado.count({ where: { idSegurado: { startsWith: seedPrefix } } }),
    prisma.pensionista.count({ where: { idSegurado: { startsWith: seedPrefix } } }),
    prisma.censoRegistro.count({ where: { observacao: { startsWith: seedMarker } } }),
    prisma.folhaPagamento.count({ where: { competencia: competence, OR: [
      { servidorAtivo: { is: { idSegurado: { startsWith: seedPrefix } } } },
      { aposentado: { is: { idSegurado: { startsWith: seedPrefix } } } },
      { pensionista: { is: { idSegurado: { startsWith: seedPrefix } } } },
    ] } }),
  ]);
  console.info(JSON.stringify({
    result: 'synthetic_seed_complete',
    database: 'rpps_dev',
    requestedRecords: requestedCount,
    records: { active: activeCount, retired: retiredCount, pensioners: pensionerCount, total: activeCount + retiredCount + pensionerCount },
    linkedRecords: { census: censusCount, payroll: payrollCount },
    insertedThisRun: { census: censusCreated, payroll: payrollCreated },
    source: 'Dados sintéticos (teste)',
    durationMs: Date.now() - startTime,
    piiUsesInvalidSyntheticCpfChecksums: true,
  }));
}

main().catch((error: unknown) => {
  console.error('Synthetic data seeding failed.');
  console.error(error instanceof Error ? error.message : 'Unexpected seeding failure.');
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
