import { useDeferredValue, useMemo, useState } from 'react';
import type { DashboardData } from '../@types/censo';
import type { ReportFilters, ReportKind, ReportProfile, ReportView } from '../@types/reports';
import {
  buildOverviewReportChartGroups,
  buildReportChartItems,
  buildReportRows,
  calculateReportMetrics,
  FINANCIAL_COMPETENCE,
  filterCensusRecords,
  formatReportPeriod,
  INITIAL_REPORT_FILTERS,
  isFinancialCompetenceInRange,
  REPORT_PROFILE_METRICS,
  REPORT_TITLES,
} from '../services/reportService';
import { formatCompetence } from '../utils/format';

export function useReportBuilder(data: DashboardData) {
  const [kind, setKind] = useState<ReportKind>('cadastral');
  const [profile, setProfile] = useState<ReportProfile>('gestor');
  const [filters, setFilters] = useState<ReportFilters>(INITIAL_REPORT_FILTERS);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(REPORT_PROFILE_METRICS.gestor.cadastral);
  const [selectedViews, setSelectedViews] = useState<ReportView[]>(['cards', 'table', 'bar']);
  const deferredFilters = useDeferredValue(filters);
  const loading = filters !== deferredFilters;

  const filteredRecords = useMemo(
    () => filterCensusRecords(data.records, deferredFilters),
    [data.records, deferredFilters],
  );
  const financeCompetence = data.filters ? data.filters.competence : FINANCIAL_COMPETENCE;
  const financialCompetenceLabel = formatCompetence(financeCompetence);
  const financialInRange = isFinancialCompetenceInRange(deferredFilters, financeCompetence);
  const reportRecords = kind === 'financeiro' ? [] : filteredRecords;
  const hasReportData = kind === 'financeiro' || kind === 'visao-geral'
    ? financialInRange || reportRecords.length > 0
    : reportRecords.length > 0;

  const rows = useMemo(
    () => buildReportRows(data, kind, reportRecords, financialInRange),
    [data, financialInRange, kind, reportRecords],
  );
  const metrics = useMemo(
    () => calculateReportMetrics(kind, data, reportRecords, selectedMetrics, financialInRange),
    [data, financialInRange, kind, reportRecords, selectedMetrics],
  );
  const chartItems = useMemo(
    () => buildReportChartItems(kind, reportRecords, rows),
    [kind, reportRecords, rows],
  );
  const chartGroups = useMemo(
    () => kind === 'visao-geral'
      ? buildOverviewReportChartGroups(data, reportRecords, financialInRange)
      : undefined,
    [data, financialInRange, kind, reportRecords],
  );

  const changeKind = (nextKind: ReportKind) => {
    setKind(nextKind);
    setSelectedMetrics(REPORT_PROFILE_METRICS[profile][nextKind]);
    if (nextKind === 'visao-geral') {
      setSelectedViews((current) => current.includes('line') ? current : [...current, 'line']);
    }
  };
  const changeProfile = (nextProfile: ReportProfile) => {
    setProfile(nextProfile);
    setSelectedMetrics(REPORT_PROFILE_METRICS[nextProfile][kind]);
  };
  const toggleMetric = (metric: string) => {
    setSelectedMetrics((current) => current.includes(metric)
      ? current.filter((item) => item !== metric)
      : [...current, metric]);
  };
  const toggleView = (view: ReportView) => {
    setSelectedViews((current) => current.includes(view)
      ? current.filter((item) => item !== view)
      : [...current, view]);
  };
  const clearFilters = () => setFilters(INITIAL_REPORT_FILTERS);

  return {
    kind,
    profile,
    filters,
    setFilters,
    selectedMetrics,
    selectedViews,
    loading,
    reportRecords,
    hasReportData,
    rows,
    metrics,
    chartItems,
    chartGroups,
    period: formatReportPeriod(filters),
    currentTitle: REPORT_TITLES[kind].title,
    currentDescription: kind === 'financeiro' || kind === 'visao-geral'
      ? `${REPORT_TITLES[kind].description} Competência financeira disponível: ${financialCompetenceLabel}.`
      : REPORT_TITLES[kind].description,
    financialCompetenceLabel,
    changeKind,
    changeProfile,
    toggleMetric,
    toggleView,
    clearFilters,
  };
}
