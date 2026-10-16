import type { ReportRow } from '../@types/reports';
import type { ReportMetric } from '../@types/reports';
import { formatMoney } from './format';

export interface ReportPdfDetails {
  description: string;
  period: string;
  filters: Array<{ label: string; value: string }>;
  metrics: ReportMetric[];
}

function protectSpreadsheetText(value: string) {
  return /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;
}

function cellValue(value: string | number) {
  return typeof value === 'string' ? protectSpreadsheetText(value) : value;
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function filename(title: string, extension: string) {
  const slug = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${slug || 'relatorio-previdenciario'}.${extension}`;
}

export function exportReportCsv(title: string, rows: ReportRow[]) {
  download(new Blob([`\uFEFF${buildReportCsv(rows)}`], { type: 'text/csv;charset=utf-8' }), filename(title, 'csv'));
}

export function buildReportCsv(rows: ReportRow[]) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const escape = (value: string | number) => `"${String(cellValue(value)).replace(/"/g, '""')}"`;
  return [headers, ...rows.map((row) => headers.map((header) => cellValue(row[header] ?? '')))]
    .map((row) => row.map(escape).join(';'))
    .join('\r\n');
}

export async function exportReportExcel(title: string, rows: ReportRow[], details?: ReportPdfDetails) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Censo Previdenciário';
  workbook.created = new Date();
  if (details) {
    const summary = workbook.addWorksheet('Resumo');
    summary.addRow([cellValue(title)]);
    summary.addRow([cellValue(details.description)]);
    summary.addRow(['Processado em', new Date().toLocaleString('pt-BR')]);
    summary.addRow(['Período', cellValue(details.period)]);
    summary.addRow(['Linhas exportadas', rows.length]);
    details.filters.forEach((filter) => summary.addRow([cellValue(filter.label), cellValue(filter.value)]));
    summary.addRow([]);
    const headerRow = 7 + details.filters.length;
    summary.addRow(['Indicador', 'Valor']);
    details.metrics.forEach((metric) => {
      const value = metric.format === 'money'
        ? formatMoney(metric.value)
        : metric.format === 'percent'
          ? `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(metric.value)}%`
          : metric.value;
      summary.addRow([cellValue(metric.label), cellValue(value)]);
    });
    summary.getRow(1).font = { bold: true, size: 16, color: { argb: 'FF103F50' } };
    summary.getRow(headerRow).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summary.getRow(headerRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF103F50' } };
    summary.getColumn(1).width = 40;
    summary.getColumn(2).width = 60;
    summary.views = [{ state: 'frozen', ySplit: headerRow }];
  }
  const worksheet = workbook.addWorksheet('Relatório');
  const headers = rows.length ? Object.keys(rows[0]) : [];
  worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(headers.map((header) => cellValue(row[header] ?? ''))));
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF103F50' } };
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  if (headers.length) worksheet.autoFilter = { from: 'A1', to: `${worksheet.getColumn(headers.length).letter}1` };
  headers.forEach((header, index) => {
    const contentWidth = Math.max(header.length, ...rows.map((row) => String(row[header] ?? '').length));
    worksheet.getColumn(index + 1).width = Math.min(42, Math.max(14, contentWidth + 2));
  });
  const bytes = await workbook.xlsx.writeBuffer();
  download(new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename(title, 'xlsx'));
}

function reportDisplayValue(header: string, value: string | number) {
  return typeof value === 'number' && /r\$|proventos|descontos|líquido|patronal|vencimentos/i.test(header) ? formatMoney(value) : String(value);
}

export async function exportReportPdf(title: string, rows: ReportRow[], details?: ReportPdfDetails) {
  if (!rows.length) return;
  const { jsPDF } = await import('jspdf');
  const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const headers = Object.keys(rows[0]);
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 13;
  const tableWidth = pageWidth - margin * 2;
  const pageBottom = pageHeight - 12;
  const columnWeights = headers.map((header) => {
    if (/detalhe|observa[cç][aã]o|descri[cç][aã]o/i.test(header)) return 2.1;
    if (/nome|benef[ií]cio|indicador|grupo|cargo|entidade/i.test(header)) return 1.8;
    if (/cpf|matr[ií]cula|status|data|compet[eê]ncia|quantidade|qtd/i.test(header)) return 1.05;
    return 1.25;
  });
  const totalWeight = columnWeights.reduce((total, weight) => total + weight, 0);
  const widths = columnWeights.map((weight) => weight * tableWidth / totalWeight);
  const headerHeight = 9;
  const lineHeight = 3.1;
  const drawTableHeader = (y: number) => {
    document.setFillColor(16, 63, 80);
    document.rect(margin, y, tableWidth, headerHeight, 'F');
    document.setFont('helvetica', 'bold');
    document.setFontSize(7);
    document.setTextColor(255, 255, 255);
    let x = margin;
    headers.forEach((header, index) => {
      const headerLines = document.splitTextToSize(header, widths[index]! - 3).slice(0, 2);
      document.text(headerLines, x + 1.5, y + 3.5);
      x += widths[index]!;
    });
    document.setTextColor(40, 55, 60);
    return y + headerHeight;
  };

  let y = margin;
  document.setFillColor(16, 63, 80);
  document.roundedRect(margin, y, tableWidth, 25, 2, 2, 'F');
  document.setFont('helvetica', 'bold');
  document.setFontSize(17);
  document.setTextColor(255, 255, 255);
  document.text(title, margin + 5, y + 8);
  document.setFont('helvetica', 'normal');
  document.setFontSize(8);
  document.setTextColor(228, 239, 239);
  const description = details?.description ?? 'Relatório do Censo Previdenciário';
  document.text(document.splitTextToSize(description, tableWidth - 10).slice(0, 1), margin + 5, y + 14);
  document.setFontSize(7);
  document.text(
    `Processado em ${new Date().toLocaleString('pt-BR')} · ${rows.length} linha(s) exportada(s)`,
    margin + 5,
    y + 20,
  );
  y += 30;

  const metaColumnWidth = (tableWidth - 6) / 2;
  const filterPairs = [
    { label: 'Período', value: details?.period ?? 'Não informado' },
    ...(details?.filters ?? []),
  ];
  document.setFont('helvetica', 'normal');
  document.setFontSize(7);
  const metaLines = filterPairs.map(({ label, value }) => ({
    label,
    value,
    lines: document.splitTextToSize(`${label}: ${value}`, metaColumnWidth - 6),
  }));
  const metaRows = Math.ceil(metaLines.length / 2);
  const metaHeight = metaRows ? Math.max(12, metaRows * 8 + 4) : 0;
  if (metaHeight) {
    document.setFillColor(241, 246, 244);
    document.roundedRect(margin, y, tableWidth, metaHeight, 1.5, 1.5, 'F');
    document.setTextColor(48, 71, 79);
    metaLines.forEach((item, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = margin + 3 + column * (metaColumnWidth + 6);
      const textY = y + 5 + row * 8;
      document.text(item.lines.slice(0, 2), x, textY);
    });
    y += metaHeight + 4;
  }

  const metrics = details?.metrics ?? [];
  if (metrics.length) {
    const gap = 2;
    const cardsPerRow = Math.min(4, metrics.length);
    const cardWidth = (tableWidth - gap * (cardsPerRow - 1)) / cardsPerRow;
    metrics.forEach((metric, index) => {
      const row = Math.floor(index / cardsPerRow);
      const column = index % cardsPerRow;
      const x = margin + column * (cardWidth + gap);
      const cardY = y + row * 17;
      document.setFillColor(234, 241, 239);
      document.roundedRect(x, cardY, cardWidth, 14, 1.5, 1.5, 'F');
      document.setFont('helvetica', 'normal');
      document.setFontSize(6.5);
      document.setTextColor(82, 101, 105);
      document.text(document.splitTextToSize(metric.label, cardWidth - 4).slice(0, 1), x + 2, cardY + 5);
      const value = metric.format === 'money'
        ? formatMoney(metric.value)
        : metric.format === 'percent'
          ? `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(metric.value)}%`
          : new Intl.NumberFormat('pt-BR').format(metric.value);
      document.setFont('helvetica', 'bold');
      document.setFontSize(9);
      document.setTextColor(21, 59, 74);
      document.text(document.splitTextToSize(value, cardWidth - 4).slice(0, 1), x + 2, cardY + 11);
    });
    y += Math.ceil(metrics.length / cardsPerRow) * 17 + 3;
  }

  const drawRunningHeader = () => {
    document.setFont('helvetica', 'bold');
    document.setFontSize(8);
    document.setTextColor(21, 59, 74);
    document.text(title, margin, 10);
    document.setFont('helvetica', 'normal');
    document.setFontSize(6.5);
    document.setTextColor(100, 115, 120);
    document.text('Continuação do relatório', margin, 14);
    return drawTableHeader(18);
  };
  const addPage = () => {
    document.addPage();
    y = drawRunningHeader();
  };

  document.setFont('helvetica', 'bold');
  document.setFontSize(10);
  document.setTextColor(21, 59, 74);
  document.text('Dados detalhados', margin, y + 4);
  y += 7;
  y = drawTableHeader(y);

  rows.forEach((row, rowIndex) => {
    const cells = headers.map((header, index) => document.splitTextToSize(
      reportDisplayValue(header, row[header] ?? ''),
      widths[index]! - 3,
    ));
    const fullHeight = Math.max(6, Math.max(...cells.map((lines) => lines.length)) * lineHeight + 2);
    if (y + fullHeight > pageBottom && y > 25) addPage();
    let remaining = cells;
    let fragment = 0;
    while (remaining.some((lines) => lines.length > 0)) {
      const availableLines = Math.max(1, Math.floor((pageBottom - y - 2) / lineHeight));
      const lineCount = Math.min(availableLines, Math.max(...remaining.map((lines) => lines.length)));
      const rowHeight = Math.max(6, lineCount * lineHeight + 2);
      if (rowIndex % 2 === 0 && fragment === 0) {
        document.setFillColor(241, 246, 244);
        document.rect(margin, y, tableWidth, rowHeight, 'F');
      }
      document.setFont('helvetica', 'normal');
      document.setFontSize(7);
      document.setTextColor(45, 63, 70);
      let x = margin;
      remaining.forEach((lines, index) => {
        const currentLines = lines.slice(0, lineCount);
        if (currentLines.length) document.text(currentLines, x + 1.5, y + 3.8);
        x += widths[index]!;
      });
      document.setDrawColor(218, 228, 224);
      document.line(margin, y + rowHeight, margin + tableWidth, y + rowHeight);
      y += rowHeight;
      remaining = remaining.map((lines) => lines.slice(lineCount));
      fragment += 1;
      if (remaining.some((lines) => lines.length > 0)) addPage();
    }
  });

  document.setFont('helvetica', 'bold');
  const pageCount = document.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    document.setPage(page);
    document.setDrawColor(213, 223, 220);
    document.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9);
    document.setFont('helvetica', 'normal');
    document.setFontSize(6.5);
    document.setTextColor(100, 115, 120);
    document.text('Censo Previdenciário · dados pessoais minimizados', margin, pageHeight - 5);
    document.text(`Página ${page} de ${pageCount}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
  }
  download(document.output('blob'), filename(title, 'pdf'));
}
