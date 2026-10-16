export type ReportKind = 'visao-geral' | 'cadastral' | 'operacional' | 'financeiro';
export type ReportProfile = 'gestor' | 'operador' | 'auditoria';
export type ReportView = 'cards' | 'table' | 'bar' | 'line';
export type ReportValueFormat = 'count' | 'percent' | 'money';

export interface ReportMetric {
  key: string;
  label: string;
  value: number;
  format: ReportValueFormat;
}

export interface ReportChartGroup {
  title: string;
  view: Extract<ReportView, 'bar' | 'line'>;
  items: Array<{ label: string; value: number }>;
}

export type ReportRow = Record<string, string | number>;

export interface ReportFilters {
  from: string;
  to: string;
  status: string;
  cargo: string;
  entidade: string;
  regime: '' | 'ACTIVE' | 'RETIRED' | 'PENSIONER';
  rppsRegime: string;
  source: string;
}
