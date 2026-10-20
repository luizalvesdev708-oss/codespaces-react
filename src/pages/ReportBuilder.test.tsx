import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { DATA } from '../data/mockData';
import ReportBuilder from './ReportBuilder';
import { buildReportCsv } from '../utils/reportExport';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('monta prévia cadastral com filtros e sem CPF completo', () => {
  render(<ReportBuilder data={DATA} />);
  expect(screen.getByRole('heading', { name: 'Relatório cadastral' })).toBeDefined();
  expect(screen.getByText('01/03/2026 a 31/08/2026')).toBeDefined();
  const table = screen.getByRole('table');
  expect(within(table).getAllByRole('row').length).toBeGreaterThan(1);
  expect(within(table).getAllByText('***.***.***-78').length).toBeGreaterThan(0);
  expect(screen.queryByText('123.456.789-01')).toBeNull();

  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Concluído' } });
  expect(screen.getByRole('status').textContent).toContain('Nenhum dado encontrado');
});

test('monta relatório financeiro agregado para competência disponível', () => {
  const { container } = render(<ReportBuilder data={DATA} />);
  fireEvent.change(screen.getByLabelText('Tipo de relatório'), { target: { value: 'financeiro' } });
  expect(screen.getByRole('heading', { name: 'Relatório financeiro' })).toBeDefined();
  expect(screen.getByText('Servidores ativos')).toBeDefined();
  expect(screen.getByText(/não existem no detalhe financeiro/)).toBeDefined();
  const grossPayments = [...container.querySelectorAll('.report-metric')].find((metric) => metric.textContent?.includes('Proventos e vencimentos'));
  expect(grossPayments?.textContent).toContain('484.678,98');
});

test('gera relatório da visão geral com painéis e exportação habilitada', () => {
  render(<ReportBuilder data={DATA} />);
  fireEvent.change(screen.getByLabelText('Tipo de relatório'), { target: { value: 'visao-geral' } });

  expect(screen.getByRole('heading', { name: 'Relatório da visão geral' })).toBeDefined();
  expect(screen.getByRole('heading', { name: 'Beneficiários por tipo' })).toBeDefined();
  expect(screen.getByRole('heading', { name: 'Vencimentos por grupo' })).toBeDefined();
  expect(screen.getByRole('heading', { name: 'Situação do recenseamento' })).toBeDefined();
  expect(screen.getByRole('heading', { name: 'Cadastros por data' })).toBeDefined();
  expect(screen.getByRole('heading', { name: 'Principais cargos' })).toBeDefined();
  expect(screen.getByRole('button', { name: '↓ CSV' }).hasAttribute('disabled')).toBe(false);
  expect(screen.getByRole('button', { name: '↓ Excel' }).hasAttribute('disabled')).toBe(false);
  expect(screen.getByRole('button', { name: '↓ PDF' }).hasAttribute('disabled')).toBe(false);
});

test('carrega todas as páginas para exportar mais registros que o limite do dashboard', async () => {
  const record = { ...DATA.records[0], cadastro: '15/03/2026' };
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), window.location.origin);
    const page = Number(url.searchParams.get('page'));
    const count = page === 1 ? 1_000 : 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        records: Array.from({ length: count }, () => record),
        total: 1_001,
        page,
        pageSize: 1_000,
      }),
    } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  const filteredData = {
    ...DATA,
    records: DATA.records.slice(0, 500),
    censo: { ...DATA.censo, registros: 1_001 },
    filters: {
      from: null,
      to: null,
      regime: null,
      source: null,
      category: 'ALL',
      competence: null,
    },
  };

  render(<ReportBuilder data={filteredData} />);

  expect(await screen.findByText(/Exibindo as primeiras 500 linhas/)).toBeDefined();
  expect(screen.getByText('1.001 linha(s)')).toBeDefined();
  expect(screen.getByRole('button', { name: '↓ CSV' }).hasAttribute('disabled')).toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(501);
});

test('usa páginas de relatório previamente salvas quando o navegador está offline', async () => {
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
  const record = { ...DATA.records[0], cadastro: '15/03/2026' };
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), window.location.origin);
    const page = Number(url.searchParams.get('page'));
    return {
      ok: true,
      status: 200,
      json: async () => ({
        records: page === 1 ? Array.from({ length: 1_000 }, () => record) : [record],
        total: 1_001,
        page,
        pageSize: 1_000,
      }),
    } as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  const filteredData = {
    ...DATA,
    records: DATA.records.slice(0, 500),
    censo: { ...DATA.censo, registros: 1_001 },
    filters: {
      from: null,
      to: null,
      regime: null,
      source: null,
      category: 'ALL',
      competence: null,
    },
  };

  render(<ReportBuilder data={filteredData} userId="user-1" />);

  expect(await screen.findByText('1.001 linha(s)')).toBeDefined();
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('CSV protege conteúdo interpretável como fórmula e preserva valores numéricos', () => {
  const csv = buildReportCsv([{ Nome: '=HYPERLINK("https://exemplo")', Quantidade: 12 }]);
  expect(csv).toContain(`"'=HYPERLINK(""https://exemplo"")"`);
  expect(csv).toContain('"12"');
});
