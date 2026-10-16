import { afterEach, expect, test, vi } from 'vitest';
import { exportReportExcel, exportReportPdf } from './reportExport';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('exports a paginated PDF with report context and all detail rows', async () => {
  let exportedBlob: Blob | undefined;
  const createObjectUrl = vi.fn((blob: Blob) => {
    exportedBlob = blob;
    return 'blob:report-test';
  });
  vi.stubGlobal('URL', {
    createObjectURL: createObjectUrl,
    revokeObjectURL: vi.fn(),
  });
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const rows = Array.from({ length: 90 }, (_, index) => ({
    Nome: `Segurado sintético ${index + 1}`,
    Status: 'Concluído',
    Detalhe: `Linha detalhada ${index + 1} com informações da competência`,
  }));

  await exportReportPdf('Relatório cadastral', rows, {
    description: 'Situação dos registros de recenseamento',
    period: '01/03/2026 a 31/08/2026',
    filters: [{ label: 'Regime', value: 'IPSS' }, { label: 'Fonte', value: 'Dados sintéticos' }],
    metrics: [{ key: 'records', label: 'Registros', value: rows.length, format: 'count' }],
  });

  expect(click).toHaveBeenCalledOnce();
  expect(createObjectUrl).toHaveBeenCalledOnce();
  expect(exportedBlob?.type).toBe('application/pdf');
  const reader = new FileReader();
  const pdfHeader = new Promise<string>((resolve, reject) => {
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result as ArrayBuffer).slice(0, 5);
      resolve(String.fromCharCode(...bytes));
    };
    reader.onerror = () => reject(reader.error);
  });
  reader.readAsArrayBuffer(exportedBlob!);
  expect(await pdfHeader).toBe('%PDF-');
});

test('does not create an empty PDF for a report without rows', async () => {
  const createObjectUrl = vi.fn();
  vi.stubGlobal('URL', { createObjectURL: createObjectUrl, revokeObjectURL: vi.fn() });

  await exportReportPdf('Relatório vazio', []);

  expect(createObjectUrl).not.toHaveBeenCalled();
});

test('exports Excel with a summary sheet and a complete detail sheet', async () => {
  let exportedBlob: Blob | undefined;
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn((blob: Blob) => {
      exportedBlob = blob;
      return 'blob:report-test';
    }),
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const rows = [{ Nome: 'Segurado sintético', CPF: '***.***.***-01' }];

  await exportReportExcel('Relatório cadastral', rows, {
    description: 'Situação dos registros de recenseamento',
    period: '01/03/2026 a 31/08/2026',
    filters: [{ label: 'Regime', value: 'IPSS' }],
    metrics: [{ key: 'records', label: 'Registros', value: 1, format: 'count' }],
  });

  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.default.Workbook();
  const reader = new FileReader();
  const bytes = new Promise<ArrayBuffer>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
  });
  reader.readAsArrayBuffer(exportedBlob!);
  await workbook.xlsx.load(await bytes);
  expect(workbook.worksheets.map((worksheet) => worksheet.name)).toEqual(['Resumo', 'Relatório']);
  expect(workbook.getWorksheet('Resumo')?.getCell('A1').value).toBe('Relatório cadastral');
  expect(workbook.getWorksheet('Relatório')?.getCell('A2').value).toBe('Segurado sintético');
});
