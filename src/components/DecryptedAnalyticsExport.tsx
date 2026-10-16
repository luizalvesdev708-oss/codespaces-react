import { useState } from 'react';
import type { ReportFilters } from '../@types/reports';
import type { DecryptedAnalyticsReport } from '../@types/analytics';
import { apiRequest } from '../services/api';
import { exportAnalyticsCsv, exportAnalyticsExcel, exportAnalyticsPdf } from '../utils/analyticsExport';

interface DecryptedAnalyticsExportProps {
  filters: ReportFilters;
  dashboardFilters?: { from: string | null; to: string | null; regime: string | null; source: string | null; category: string; competence: string | null };
}

export default function DecryptedAnalyticsExport({ filters, dashboardFilters }: DecryptedAnalyticsExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');

  const exportReport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    if (!window.confirm('Este arquivo incluirá nomes, CPFs e matrículas descriptografados. Salve-o apenas em local autorizado. Continuar?')) return;
    const from = [filters.from, dashboardFilters?.from].filter((value): value is string => Boolean(value)).sort().at(-1) ?? '';
    const to = [filters.to, dashboardFilters?.to].filter((value): value is string => Boolean(value)).sort()[0] ?? '';
    const globalRegime = dashboardFilters?.regime ?? '';
    const reportRegime = filters.rppsRegime;
    const globalSource = dashboardFilters?.source ?? '';
    if ((from && to && from > to)
      || (globalRegime && reportRegime && globalRegime !== reportRegime)
      || (globalSource && filters.source && globalSource !== filters.source)
      || (dashboardFilters?.category && dashboardFilters.category !== 'ALL' && filters.regime && dashboardFilters.category !== filters.regime)) {
      setError('Os filtros do painel e do relatório não têm interseção. Ajuste o período, categoria, regime ou fonte antes de exportar.');
      return;
    }
    setIsExporting(true);
    setError('');
    try {
      const query = new URLSearchParams();
      if (from) query.set('from', from);
      if (to) query.set('to', to);
      const category = dashboardFilters?.category && dashboardFilters.category !== 'ALL' ? dashboardFilters.category : filters.regime;
      if (category) query.set('category', category);
      if (globalRegime || reportRegime) query.set('regime', globalRegime || reportRegime);
      if (globalSource || filters.source) query.set('source', globalSource || filters.source);
      const result = await apiRequest<DecryptedAnalyticsReport>(`/analytics/decrypted-export?${query.toString()}`);
      if (!result) throw new Error('O servidor não retornou os dados para exportação.');
      if (format === 'csv') exportAnalyticsCsv(result);
      else if (format === 'xlsx') await exportAnalyticsExcel(result);
      else await exportAnalyticsPdf(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível gerar os relatórios.');
    } finally {
      setIsExporting(false);
    }
  };

  return <section className="decrypted-export" aria-label="Exportação administrativa">
    <h3>Exportação administrativa completa</h3>
    <p>Somente ADMIN. O servidor descriptografa apenas durante cada solicitação; arquivos baixados contêm dados pessoais completos. Guarde-os apenas em local autorizado.</p>
    <div className="report-export">
      <button className="button button--primary" type="button" onClick={() => void exportReport('csv')} disabled={isExporting}>{isExporting ? 'Preparando…' : 'CSV completo'}</button>
      <button className="button button--primary" type="button" onClick={() => void exportReport('xlsx')} disabled={isExporting}>{isExporting ? 'Preparando…' : 'Excel completo'}</button>
      <button className="button button--primary" type="button" onClick={() => void exportReport('pdf')} disabled={isExporting}>{isExporting ? 'Preparando…' : 'PDF completo'}</button>
    </div>
    {error && <p role="alert" className="report-export__error">{error}</p>}
  </section>;
}
