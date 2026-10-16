import type { RequestHandler } from 'express';
import { CensusStatus, PersonnelType } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/db.js';

const registrationSchema = z.object({
  tipo: z.nativeEnum(PersonnelType),
  pessoaId: z.string().uuid(),
  status: z.nativeEnum(CensusStatus).default('PENDING'),
  observacao: z.string().trim().max(1000).optional(),
});

export const listCensus: RequestHandler = async (_request, response, next) => {
  try {
    const records = await prisma.censoRegistro.findMany({ take: 500, orderBy: { dataCadastro: 'desc' } });
    response.json(records.map(({ id, tipo, status, dataCadastro, dataConclusao, ultimoAcesso }) => ({ id, tipo, status, dataCadastro, dataConclusao, ultimoAcesso })));
  } catch (error) { next(error); }
};

export const createCensus: RequestHandler = async (request, response, next) => {
  try {
    const input = registrationSchema.parse(request.body);
    const data = {
      tipo: input.tipo,
      status: input.status,
      ...(input.observacao ? { observacao: input.observacao } : {}),
      servidorAtivoId: input.tipo === 'ACTIVE' ? input.pessoaId : null,
      aposentadoId: input.tipo === 'RETIRED' ? input.pessoaId : null,
      pensionistaId: input.tipo === 'PENSIONER' ? input.pessoaId : null,
    };
    const created = await prisma.censoRegistro.create({ data });
    response.status(201).json(created);
  } catch (error) { next(error); }
};