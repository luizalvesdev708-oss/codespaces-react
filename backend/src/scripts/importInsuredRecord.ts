import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../config/db.js';
import { parseInsuredRecord } from '../services/insuredImport.js';
import { persistInsuredRecord } from '../services/insuredPersistence.js';

async function importRecord(filePath: string) {
  const source = JSON.parse(await readFile(path.resolve(filePath), 'utf8')) as unknown;
  const record = parseInsuredRecord(source);
  await persistInsuredRecord(record);
  console.info(`Importação concluída: 1 segurado, 1 registro de censo e 1 competência atualizados/inseridos (${record.externalId}).`);
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Uso: npm --prefix backend run import:insured -- <arquivo-json>');
  process.exitCode = 2;
} else {
  importRecord(inputPath)
    .catch((error: unknown) => {
      console.error('Não foi possível importar o registro.');
      console.error(error instanceof Error ? error.message : 'Erro inesperado.');
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
