import type { AnalyticsExportRow, DecryptedAnalyticsReport } from '../@types/analytics';

const CATEGORY_LABELS = {
  census: 'Recenseados',
  insured: 'Segurados',
  benefits: 'Benefícios',
} as const;

function safeText(value: string | number): string {
  const text = String(value ?? '');
  if (/^[+-]?\d+(?:\.\d+)?$/.test(text.trim())) return text;
  return /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function safeCell(value: string | number): string | number {
  return typeof value === 'number' ? value : safeText(value);
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function filename(extension: string): string {
  return `relatorio-censo-previdenciario-${new Date().toISOString().slice(0, 10)}.${extension}`;
}

function metadata(report: DecryptedAnalyticsReport): string[][] {
  const age = report.analytics.personnel.idadeMediaAnos;
  const contributionTime = report.analytics.personnel.tempoMedioContribuicaoAnos;
  return [
    ['Relatório', report.title],
    ['Processado em', new Date(report.processedAt).toLocaleString('pt-BR')],
    ['Período', `${report.filters.from ?? 'início'} — ${report.filters.to ?? 'hoje'}`],
    ['Regime', report.filters.regime],
    ['Fonte', report.filters.source],
    ['Escopo temporal', report.filters.dataScope],
    ['Total de registros exportados', String(report.totalRecords)],
    ['Idade média', age === null ? 'Não disponível para os registros selecionados' : `${age.toFixed(2)} anos`],
    ['Tempo médio de contribuição', contributionTime === null ? 'Não disponível para os registros selecionados' : `${contributionTime.toFixed(2)} anos`],
  ];
}

function allRows(report: DecryptedAnalyticsReport): Array<{ Categoria: string } & AnalyticsExportRow> {
  return (Object.entries(report.sheets) as Array<[keyof DecryptedAnalyticsReport['sheets'], AnalyticsExportRow[]]>)
    .flatMap(([key, rows]) => rows.map((row) => ({ Categoria: CATEGORY_LABELS[key], ...row })));
}

function analyticsRows(report: DecryptedAnalyticsReport): Array<Array<string | number>> {
  const { census, personnel, payroll } = report.analytics;
  return [
    ['Registros no censo', census.total],
    ['Recenseados', census.recenseados],
    ['Recenseados (%)', census.recenseadosPercentual],
    ['Pendentes', census.pendentes],
    ['Pendentes (%)', census.pendentesPercentual],
    ['Em análise', census.emAnalise],
    ['Em análise (%)', census.emAnalisePercentual],
    ['Recusados', census.recusados],
    ['Recusados (%)', census.recusadosPercentual],
    ['Segurados ativos', personnel.ativos],
    ['Aposentados', personnel.aposentados],
    ['Pensionistas', personnel.pensionistas],
    ['Total de segurados atuais', personnel.total],
    ['Idade média (anos)', personnel.idadeMediaAnos ?? 'Não disponível'],
    ['Tempo médio de contribuição (anos)', personnel.tempoMedioContribuicaoAnos ?? 'Não disponível'],
    ['Benefícios concedidos', payroll.beneficiosConcedidos],
    ['Folha bruta da competência (R$)', payroll.folhaBruta],
    ['Arrecadação previdenciária (R$)', payroll.arrecadacaoPrevidenciaria],
    ['Projeção anual de contribuições (R$)', payroll.projecaoAnualContribuicoes],
    ['Projeção anual de benefícios (R$)', payroll.projecaoAnualBeneficios],
    ['Projeção anual de saldo (R$)', payroll.projecaoAnualSaldo],
    ...report.unavailableMetrics.map((metric) => ['Não disponível', metric]),
  ];
}

export function buildAnalyticsCsv(report: DecryptedAnalyticsReport): string {
  const rows = allRows(report);
  const columns = [...new Set(['Categoria', ...rows.flatMap((row) => Object.keys(row))])];
  const width = Math.max(columns.length, 2);
  const escape = (value: string | number) => `"${safeText(value).replace(/"/g, '""')}"`;
  const pad = (row: Array<string | number>) => [...row, ...Array(Math.max(0, width - row.length)).fill('')];
  const details = [
    pad(columns),
    ...rows.map((row) => pad(columns.map((column) => row[column] ?? ''))),
  ];
  const metadataRows = metadata(report).map(pad);
  const metrics = [
    pad(['Indicador', 'Valor']),
    ...analyticsRows(report).map(pad),
  ];
  return [...metadataRows, Array(width).fill(''), ...metrics, Array(width).fill(''), ...details]
    .map((row) => row.map(escape).join(';'))
    .join('\r\n');
}

export function exportAnalyticsCsv(report: DecryptedAnalyticsReport): void {
  download(new Blob([`\uFEFF${buildAnalyticsCsv(report)}`], { type: 'text/csv;charset=utf-8' }), filename('csv'));
}

export async function exportAnalyticsExcel(report: DecryptedAnalyticsReport): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Censo Previdenciário';
  workbook.created = new Date(report.processedAt);
  const summary = workbook.addWorksheet('Resumo');
  metadata(report).forEach((row) => summary.addRow(row));
  summary.addRow([]);
  summary.addRow(['Indicador', 'Valor']);
  [
    ['Recenseados', report.analytics.census.recenseados],
    ['Recenseados (%)', report.analytics.census.recenseadosPercentual],
    ['Pendentes', report.analytics.census.pendentes],
    ['Pendentes (%)', report.analytics.census.pendentesPercentual],
    ['Em análise', report.analytics.census.emAnalise],
    ['Em análise (%)', report.analytics.census.emAnalisePercentual],
    ['Recusados', report.analytics.census.recusados],
    ['Recusados (%)', report.analytics.census.recusadosPercentual],
    ['Segurados ativos', report.analytics.personnel.ativos],
    ['Aposentados', report.analytics.personnel.aposentados],
    ['Pensionistas', report.analytics.personnel.pensionistas],
    ['Total de segurados atuais', report.analytics.personnel.total],
    ['Idade média (anos)', report.analytics.personnel.idadeMediaAnos ?? 'Não disponível'],
    ['Tempo médio de contribuição (anos)', report.analytics.personnel.tempoMedioContribuicaoAnos ?? 'Não disponível'],
    ['Benefícios concedidos', report.analytics.payroll.beneficiosConcedidos],
    ['Folha bruta da competência (R$)', report.analytics.payroll.folhaBruta],
    ['Arrecadação previdenciária (R$)', report.analytics.payroll.arrecadacaoPrevidenciaria],
    ['Projeção anual de contribuições (R$)', report.analytics.payroll.projecaoAnualContribuicoes],
    ['Projeção anual de benefícios (R$)', report.analytics.payroll.projecaoAnualBeneficios],
    ['Projeção anual de saldo (R$)', report.analytics.payroll.projecaoAnualSaldo],
  ].forEach((row) => summary.addRow(row));
  report.unavailableMetrics.forEach((item) => summary.addRow(['Não disponível', item]));
  summary.getRow(1).font = { bold: true };
  summary.getColumn(1).width = 38;
  summary.getColumn(2).width = 76;
  summary.views = [{ state: 'frozen', ySplit: 1 }];

  for (const [key, label] of Object.entries(CATEGORY_LABELS) as Array<[keyof typeof CATEGORY_LABELS, string]>) {
    const rows = report.sheets[key];
    const worksheet = workbook.addWorksheet(label);
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    worksheet.addRow(columns);
    rows.forEach((row) => worksheet.addRow(columns.map((column) => safeCell(row[column] ?? ''))));
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF103F50' } };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    if (columns.length) worksheet.autoFilter = { from: 'A1', to: `${worksheet.getColumn(columns.length).letter}1` };
    columns.forEach((column, index) => {
      const width = Math.max(column.length, ...rows.map((row) => String(row[column] ?? '').length));
      worksheet.getColumn(index + 1).width = Math.min(42, Math.max(12, width + 2));
    });
  }

  const bytes = await workbook.xlsx.writeBuffer();
  download(new Blob([new Uint8Array(bytes)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }), filename('xlsx'));
}

export async function exportAnalyticsPdf(report: DecryptedAnalyticsReport): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  const processed = new Date(report.processedAt).toLocaleString('pt-BR');

  document.setFont('helvetica', 'bold');
  document.setFontSize(17);
  document.setTextColor(21, 59, 74);
  document.text(report.title, margin, 16);
  document.setFont('helvetica', 'normal');
  document.setFontSize(8);
  document.setTextColor(75, 92, 98);
  document.text(`Processado em ${processed} · ${report.totalRecords} registros · Regime: ${report.filters.regime} · Fonte: ${report.filters.source}`, margin, 22);
  document.text(`Período: ${report.filters.from ?? 'início'} a ${report.filters.to ?? 'hoje'}`, margin, 27);
  const scopeLines = document.splitTextToSize(`Escopo temporal: ${report.filters.dataScope}`, contentWidth);
  document.text(scopeLines, margin, 32);

  const summaryCards = [
    ['Recenseados', String(report.analytics.census.recenseados)],
    ['Pendentes', String(report.analytics.census.pendentes)],
    ['Em análise', String(report.analytics.census.emAnalise)],
    ['Recusados', String(report.analytics.census.recusados)],
    ['Segurados atuais', String(report.analytics.personnel.total)],
    ['Idade média', report.analytics.personnel.idadeMediaAnos === null ? 'Indisponível' : `${report.analytics.personnel.idadeMediaAnos.toFixed(2)} anos`],
    ['Contribuição média', report.analytics.personnel.tempoMedioContribuicaoAnos === null ? 'Indisponível' : `${report.analytics.personnel.tempoMedioContribuicaoAnos.toFixed(2)} anos`],
    ['Benefícios concedidos', String(report.analytics.payroll.beneficiosConcedidos)],
    ['Folha bruta da competência', `R$ ${report.analytics.payroll.folhaBruta}`],
    ['Arrecadação', `R$ ${report.analytics.payroll.arrecadacaoPrevidenciaria}`],
    ['Saldo anual projetado', `R$ ${report.analytics.payroll.projecaoAnualSaldo}`],
  ];
  const gap = 3;
  const cardsPerRow = 4;
  const cardWidth = (contentWidth - gap * (cardsPerRow - 1)) / cardsPerRow;
  const cardsY = 34 + scopeLines.length * 4;
  summaryCards.forEach(([label, value], index) => {
    const row = Math.floor(index / cardsPerRow);
    const x = margin + (index % cardsPerRow) * (cardWidth + gap);
    const y = cardsY + row * 20;
    document.setFillColor(237, 243, 240);
    document.roundedRect(x, y, cardWidth, 17, 2, 2, 'F');
    document.setFontSize(7);
    document.text(label, x + 2, y + 6);
    document.setFont('helvetica', 'bold');
    document.setFontSize(9);
    document.text(value, x + 2, y + 13);
    document.setFont('helvetica', 'normal');
  });
  const cardRows = Math.ceil(summaryCards.length / cardsPerRow);
  const cardsBottom = cardsY + cardRows * 20 - 3;
  document.setFontSize(7);
  document.text(report.analytics.payroll.premissaProjecao, margin, cardsBottom + 5);
  let y = cardsBottom + 11;

  for (const [key, label] of Object.entries(CATEGORY_LABELS) as Array<[keyof typeof CATEGORY_LABELS, string]>) {
    const rows = report.sheets[key];
    document.setFont('helvetica', 'bold');
    document.setFontSize(11);
    if (y + 12 > pageHeight - margin) {
      document.addPage();
      y = margin;
    }
    document.text(`${label} · ${rows.length} registro(s)`, margin, y);
    y += 5;
    if (!rows.length) {
      document.setFont('helvetica', 'normal');
      document.setFontSize(8);
      document.text('Sem registros para os filtros selecionados.', margin, y + 3);
      y += 10;
      continue;
    }
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const columnWidth = contentWidth / columns.length;
    const drawHeader = () => {
      document.setFillColor(16, 63, 80);
      document.rect(margin, y, contentWidth, 7, 'F');
      document.setFont('helvetica', 'bold');
      document.setFontSize(6);
      document.setTextColor(255, 255, 255);
      columns.forEach((column, index) => {
        const labelText = document.splitTextToSize(column, columnWidth - 2)[0] ?? column;
        document.text(labelText, margin + index * columnWidth + 1, y + 4.5);
      });
      document.setTextColor(45, 63, 70);
      y += 7;
    };
    drawHeader();
    document.setFont('helvetica', 'normal');
    document.setFontSize(5.8);
    for (const row of rows) {
      const cells = columns.map((column) => document.splitTextToSize(String(row[column] ?? ''), columnWidth - 2).slice(0, 2));
      const rowHeight = Math.max(5, ...cells.map((cell) => cell.length * 2.5 + 2));
      if (y + rowHeight > pageHeight - margin) {
        document.addPage();
        y = margin;
        document.setFont('helvetica', 'bold');
        document.setFontSize(9);
        document.text(`${label} · continuação`, margin, y);
        y += 5;
        drawHeader();
        document.setFont('helvetica', 'normal');
        document.setFontSize(5.8);
      }
      if (Math.round(y) % 2 === 0) {
        document.setFillColor(241, 246, 244);
        document.rect(margin, y, contentWidth, rowHeight, 'F');
      }
      cells.forEach((cell, index) => {
        document.text(cell, margin + index * columnWidth + 1, y + 3);
      });
      y += rowHeight;
    }
    y += 8;
  }

  if (report.unavailableMetrics.length) {
    if (y + 14 > pageHeight - margin) {
      document.addPage();
      y = margin;
    }
    document.setFont('helvetica', 'bold');
    document.setFontSize(9);
    document.text('Indicadores indisponíveis', margin, y);
    document.setFont('helvetica', 'normal');
    document.setFontSize(7);
    report.unavailableMetrics.forEach((item) => {
      y += 4;
      document.text(`• ${item}`, margin, y);
    });
  }
  document.save(filename('pdf'));
}
