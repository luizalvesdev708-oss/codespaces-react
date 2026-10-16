import { useState } from 'react';
import type { ReportRow } from '../@types/reports';
import type { ReportPdfDetails } from '../utils/reportExport';
import { exportReportCsv, exportReportExcel, exportReportPdf } from '../utils/reportExport';

interface ReportExportButtonsProps {
  title: string;
  rows: ReportRow[];
  pdfDetails?: ReportPdfDetails;
  disabled?: boolean;
}

export default function ReportExportButtons({ title, rows, pdfDetails, disabled = false }: ReportExportButtonsProps) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const exportExcel = async () => {
    setExporting(true);
    setError('');
    try {
      await exportReportExcel(title, rows, pdfDetails);
    } catch {
      setError('Não foi possível gerar o Excel. Tente novamente ou use CSV.');
    } finally {
      setExporting(false);
    }
  };
  const exportPdf = async () => {
    setExporting(true);
    setError('');
    try {
      await exportReportPdf(title, rows, pdfDetails);
    } catch {
      setError('Não foi possível gerar o PDF. Tente novamente ou use a impressão do navegador.');
    } finally {
      setExporting(false);
    }
  };

  return <div className="report-export">
    <button className="button button--export" type="button" onClick={() => exportReportCsv(title, rows)} disabled={!rows.length || disabled}>↓ CSV</button>
    <button className="button button--export" type="button" onClick={() => void exportExcel()} disabled={!rows.length || exporting || disabled}>{exporting ? 'Gerando…' : '↓ Excel'}</button>
    <button className="button button--export" type="button" onClick={() => void exportPdf()} disabled={!rows.length || exporting || disabled}>{exporting ? 'Gerando…' : '↓ PDF'}</button>
    <button className="button button--export" type="button" onClick={() => window.print()} disabled={!rows.length || disabled}>Imprimir</button>
    {error && <span className="report-export__error" role="alert">{error}</span>}
  </div>;
}
