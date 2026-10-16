import type { RequestHandler } from 'express';
import { PersonnelType, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { decryptPii, encryptPii, hashCpf, maskCpf, maskName } from '../config/encryption.js';
import { parseInsuredRecord } from '../services/insuredImport.js';
import { persistInsuredRecord } from '../services/insuredPersistence.js';

const typeSchema = z.enum(['ACTIVE', 'RETIRED', 'PENSIONER']);
const createSchema = z.object({
  nome: z.string().trim().min(3).max(160),
  cpf: z.string().transform((value) => value.replace(/\D/g, '')).refine((value) => /^\d{11}$/.test(value), 'CPF must contain 11 digits'),
  matricula: z.string().trim().min(1).max(80),
  cargo: z.string().trim().max(120).optional(),
  beneficio: z.string().trim().max(120).optional(),
  admissao: z.coerce.date().optional(),
  inicioBeneficio: z.coerce.date().optional(),
});
const updateSchema = createSchema.partial().refine((value) => Object.keys(value).length > 0, 'At least one field is required');

type SafePerson = { id: string; tipo: PersonnelType; nome: string; cpf: string; matricula: string; createdAt: Date };
type EncryptedFields = { nomeCiphertext: string; cpfCiphertext: string; cpfHash: string; matriculaCiphertext: string };

function safePerson(record: { id: string; nomeCiphertext: string; cpfCiphertext: string; matriculaCiphertext: string; createdAt: Date }, tipo: PersonnelType): SafePerson {
  return {
    id: record.id,
    tipo,
    nome: maskName(decryptPii(record.nomeCiphertext)),
    cpf: maskCpf(decryptPii(record.cpfCiphertext)),
    matricula: `***${decryptPii(record.matriculaCiphertext).slice(-3)}`,
    createdAt: record.createdAt,
  };
}

function encryptedFields(input: z.infer<typeof createSchema>): EncryptedFields {
  return {
    nomeCiphertext: encryptPii(input.nome),
    cpfCiphertext: encryptPii(input.cpf),
    cpfHash: hashCpf(input.cpf),
    matriculaCiphertext: encryptPii(input.matricula),
  };
}

function parseType(value: unknown): PersonnelType { return typeSchema.parse(value); }

export const listPersonnel: RequestHandler = async (request, response, next) => {
  try {
    const type = parseType(request.params.type);
    const take = Math.min(Math.max(Number(request.query.take) || 100, 1), 500);
    const records = type === 'ACTIVE'
      ? await prisma.servidorAtivo.findMany({ take, orderBy: { createdAt: 'desc' } })
      : type === 'RETIRED'
        ? await prisma.aposentado.findMany({ take, orderBy: { createdAt: 'desc' } })
        : await prisma.pensionista.findMany({ take, orderBy: { createdAt: 'desc' } });
    response.json(records.map((record) => safePerson(record, type)));
  } catch (error) { next(error); }
};

export const createPersonnel: RequestHandler = async (request, response, next) => {
  try {
    const type = parseType(request.params.type);
    const input = createSchema.parse(request.body);
    const fields = encryptedFields(input);
    const created = type === 'ACTIVE'
      ? await prisma.servidorAtivo.create({ data: { ...fields, cargo: input.cargo ?? '', ...(input.admissao ? { admissao: input.admissao } : {}) } })
      : type === 'RETIRED'
        ? await prisma.aposentado.create({ data: { ...fields, beneficio: input.beneficio ?? '', ...(input.inicioBeneficio ? { inicioBeneficio: input.inicioBeneficio } : {}) } })
        : await prisma.pensionista.create({ data: { ...fields, beneficio: input.beneficio ?? '' } });
    response.status(201).json(safePerson(created, type));
  } catch (error) { next(error); }
};

export const createInsuredRecord: RequestHandler = async (request, response, next) => {
  try {
    const record = parseInsuredRecord(request.body);
    await persistInsuredRecord(record);
    response.status(201).json({
      idSegurado: record.externalId,
      status: record.censusStatus,
      competencia: record.competence.toISOString().slice(0, 10),
    });
  } catch (error) { next(error); }
};

export const updatePersonnel: RequestHandler = async (request, response, next) => {
  try {
    const type = parseType(request.params.type);
    const input = updateSchema.parse(request.body);
    const data: Record<string, unknown> = {};
    if (input.nome) data.nomeCiphertext = encryptPii(input.nome);
    if (input.cpf) { data.cpfCiphertext = encryptPii(input.cpf); data.cpfHash = hashCpf(input.cpf); }
    if (input.matricula) data.matriculaCiphertext = encryptPii(input.matricula);
    if (type === 'ACTIVE') {
      if (input.cargo !== undefined) data.cargo = input.cargo;
      if (input.admissao !== undefined) data.admissao = input.admissao;
    } else if (input.beneficio !== undefined) data.beneficio = input.beneficio;
    if (type === 'RETIRED' && input.inicioBeneficio !== undefined) data.inicioBeneficio = input.inicioBeneficio;

    const id = z.string().uuid().parse(request.params.id);
    const updated = type === 'ACTIVE'
      ? await prisma.servidorAtivo.update({ where: { id }, data: data as Prisma.ServidorAtivoUpdateInput })
      : type === 'RETIRED'
        ? await prisma.aposentado.update({ where: { id }, data: data as Prisma.AposentadoUpdateInput })
        : await prisma.pensionista.update({ where: { id }, data: data as Prisma.PensionistaUpdateInput });
    response.json(safePerson(updated, type));
  } catch (error) { next(error); }
};

export const deletePersonnel: RequestHandler = async (request, response, next) => {
  try {
    const type = parseType(request.params.type);
    const id = z.string().uuid().parse(request.params.id);
    if (type === 'ACTIVE') await prisma.servidorAtivo.delete({ where: { id } });
    else if (type === 'RETIRED') await prisma.aposentado.delete({ where: { id } });
    else await prisma.pensionista.delete({ where: { id } });
    response.status(204).end();
  } catch (error) { next(error); }
};