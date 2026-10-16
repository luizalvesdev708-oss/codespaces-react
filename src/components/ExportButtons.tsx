import type { CensoRecord } from '../@types/censo';
import { maskCpf } from '../utils/format';

interface ExportButtonsProps { records: CensoRecord[] }
const headers = ['Nome', 'Matrícula', 'CPF', 'Cargo', 'Entidade', 'Data de cadastro', 'Conclusão', 'Último acesso', 'Status'];

const protectSpreadsheetText = (value: string) => /^[\t\r ]*[=+\-@]/.test(value) ? `'${value}` : value;

function makeRows(records: CensoRecord[]) {
  return records.map((record) => [
    record.nome, record.matricula, maskCpf(record.cpf), record.cargo, record.entidade,
    record.cadastro, record.conclusao, record.ultimoAcesso, record.status,
  ].map(protectSpreadsheetText));
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function ExportButtons({ records }: ExportButtonsProps) {
  const rows = makeRows(records);

  const exportCsv = () => {
    const escapeCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(';')).join('\r\n');
    download(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), 'censo-previdenciario.csv');
  };

  const exportExcel = async () => {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Censo');
    worksheet.addRow(headers);
    worksheet.addRows(rows);
    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    worksheet.autoFilter = { from: 'A1', to: 'I1' };
    const bytes = await workbook.xlsx.writeBuffer();
    download(new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'censo-previdenciario.xlsx');
  };

  return <div className="export-actions" aria-label="Exportar registros filtrados">
    <button className="button button--export" onClick={exportCsv} type="button" disabled={!records.length}>↓ CSV</button>
    <button className="button button--export" onClick={exportExcel} type="button" disabled={!records.length}>↓ Excel</button>
  </div>;
}