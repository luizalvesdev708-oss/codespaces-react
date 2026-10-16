import { Decimal } from 'decimal.js';
import { prisma } from '../config/db.js';
import { decryptPii, encryptPii, hashCpf } from '../config/encryption.js';
import type { parseInsuredRecord } from './insuredImport.js';

type InsuredRecord = ReturnType<typeof parseInsuredRecord>;

export async function persistInsuredRecord(record: InsuredRecord): Promise<void> {
  const cpfHash = hashCpf(record.cpf);
  const lastCensusDate = new Date(`${record.lastCensusDate}T00:00:00.000Z`);
  const personFields = {
    idSegurado: record.externalId,
    nomeCiphertext: encryptPii(record.name),
    cpfCiphertext: encryptPii(record.cpf),
    cpfHash,
    matriculaCiphertext: encryptPii(record.externalId),
    dataNascimentoCiphertext: encryptPii(record.birthDate),
    tempoContribuicaoAnos: new Decimal(record.contributionYears),
    regime: record.regime,
    fonteDados: record.dataSource,
    cargo: 'Não informado',
  };
  const salary = new Decimal(record.salary);
  const contribution = new Decimal(record.contribution);
  const benefit = new Decimal(record.benefit);

  await prisma.$transaction(async (transaction) => {
    const [byExternalId, byCpf] = await Promise.all([
      transaction.servidorAtivo.findUnique({ where: { idSegurado: record.externalId } }),
      transaction.servidorAtivo.findUnique({ where: { cpfHash } }),
    ]);
    if (byExternalId && byCpf && byExternalId.id !== byCpf.id) {
      throw new Error('O identificador externo e o CPF correspondem a registros distintos; gravação interrompida.');
    }
    const existing = byExternalId ?? byCpf;
    if (existing && existing.cpfHash !== cpfHash) {
      throw new Error('O identificador externo já pertence a outro CPF; gravação interrompida.');
    }

    const person = existing
      ? await transaction.servidorAtivo.update({ where: { id: existing.id }, data: personFields })
      : await transaction.servidorAtivo.create({ data: personFields });
    const census = await transaction.censoRegistro.findFirst({
      where: { servidorAtivoId: person.id },
      orderBy: { createdAt: 'desc' },
    });
    const censusFields = {
      tipo: record.category,
      status: record.censusStatus,
      dataCadastro: lastCensusDate,
      dataConclusao: record.censusStatus === 'COMPLETED' ? lastCensusDate : null,
      ultimoAcesso: lastCensusDate,
      servidorAtivoId: person.id,
      aposentadoId: null,
      pensionistaId: null,
    };
    if (census) await transaction.censoRegistro.update({ where: { id: census.id }, data: censusFields });
    else await transaction.censoRegistro.create({ data: censusFields });

    const existingPayroll = await transaction.folhaPagamento.findFirst({
      where: { servidorAtivoId: person.id, competencia: record.competence },
      orderBy: { createdAt: 'desc' },
    });
    const payrollFields = {
      competencia: record.competence,
      proventos: salary,
      baseCalculo: salary,
      descontos: new Decimal(0),
      irrf: new Decimal(0),
      contribuicaoSegurado: contribution,
      contribuicaoPatronal: new Decimal(0),
      valorBeneficio: benefit,
      periodoReferenciaInicio: record.referenceFrom,
      periodoReferenciaFim: record.referenceTo,
      servidorAtivoId: person.id,
      aposentadoId: null,
      pensionistaId: null,
    };
    if (existingPayroll) {
      await transaction.folhaPagamento.update({ where: { id: existingPayroll.id }, data: payrollFields });
    } else {
      await transaction.folhaPagamento.create({ data: payrollFields });
    }
    if (!person.dataNascimentoCiphertext) throw new Error('A data de nascimento não foi persistida.');
    const storedBirthDate = decryptPii(person.dataNascimentoCiphertext);
    if (storedBirthDate !== record.birthDate) throw new Error('A verificação da data de nascimento falhou.');
  });
}
