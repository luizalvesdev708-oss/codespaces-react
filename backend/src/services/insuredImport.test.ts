import assert from 'node:assert/strict';
import test from 'node:test';
import { parseInsuredRecord, parseReferencePeriod } from './insuredImport.js';

const record = {
  id_segurado: 'SEG-TEST-000001',
  nome_completo: 'Pessoa Teste',
  cpf: '123.456.789-01',
  data_nascimento: '1978-05-14',
  idade: 48,
  categoria: 'Ativo',
  status_recenseado: 'Recenseado',
  regime: 'IPSS',
  fonte_dados: 'Dados fornecidos',
  'tempo_contribuição_anos': 22,
  valor_salario_base: 8500.5,
  valor_contribuicao: 1020.06,
  valor_beneficio: 0,
  data_ultimo_recenseamento: '2026-02-10',
  periodo_referencia: 'Março/2026 — Agosto/2026',
};

test('maps the source record into validated census and payroll fields', () => {
  const parsed = parseInsuredRecord(record);

  assert.equal(parsed.category, 'ACTIVE');
  assert.equal(parsed.censusStatus, 'COMPLETED');
  assert.equal(parsed.regime, 'IPSS');
  assert.equal(parsed.dataSource, 'Dados fornecidos');
  assert.equal(parsed.contributionYears, '22.00');
  assert.equal(parsed.salary, '8500.50');
  assert.equal(parsed.contribution, '1020.06');
  assert.equal(parsed.ageAtReference, 48);
  assert.equal(parsed.competence.toISOString().slice(0, 10), '2026-08-01');
  assert.equal(parsed.referenceFrom.toISOString().slice(0, 10), '2026-03-01');
  assert.equal(parsed.referenceTo.toISOString().slice(0, 10), '2026-08-31');
});

test('rejects a reversed reference period and invalid records', () => {
  assert.throws(() => parseReferencePeriod('Agosto/2026 — Março/2026'), /início do período/);
  assert.throws(() => parseInsuredRecord({ ...record, categoria: 'Desconhecido' }), /categoria/);
});
