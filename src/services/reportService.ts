import type { CensoRecord, DashboardData } from '../@types/censo';
import type { ReportChartGroup, ReportFilters, ReportKind, ReportMetric, ReportProfile, ReportRow, ReportView } from '../@types/reports';
import { formatCompetence, maskCpf } from '../utils/format';

export const REPORT_METRICS: Record<ReportKind, ReportMetric[]> = {
  'visao-geral': [
    { key: 'records', label: 'Registros no recenseamento', value: 0, format: 'count' },
    { key: 'completed', label: 'Cadastros concluídos', value: 0, format: 'count' },
    { key: 'peopleInPayroll', label: 'Pessoas na folha', value: 0, format: 'count' },
    { key: 'grossPayments', label: 'Proventos e vencimentos', value: 0, format: 'money' },
  ],
  cadastral: [
    { key: 'records', label: 'Registros no censo', value: 0, format: 'count' },
    { key: 'completed', label: 'Cadastros concluídos', value: 0, format: 'count' },
    { key: 'pending', label: 'Cadastros sem conclusão', value: 0, format: 'count' },
    { key: 'completionRate', label: 'Taxa de conclusão', value: 0, format: 'percent' },
    { key: 'entities', label: 'Entidades', value: 0, format: 'count' },
  ],
  operacional: [
    { key: 'records', label: 'Registros acompanhados', value: 0, format: 'count' },
    { key: 'completed', label: 'Cadastros concluídos', value: 0, format: 'count' },
    { key: 'pending', label: 'Pendências abertas', value: 0, format: 'count' },
    { key: 'completionRate', label: 'Taxa de conclusão', value: 0, format: 'percent' },
    { key: 'entities', label: 'Entidades atendidas', value: 0, format: 'count' },
  ],
  financeiro: [
    { key: 'activeMembers', label: 'Servidores ativos na folha', value: 0, format: 'count' },
    { key: 'beneficiaries', label: 'Beneficiários', value: 0, format: 'count' },
    { key: 'grossPayments', label: 'Proventos e vencimentos', value: 0, format: 'money' },
    { key: 'discounts', label: 'Descontos', value: 0, format: 'money' },
    { key: 'netPayments', label: 'Valor líquido', value: 0, format: 'money' },
    { key: 'employerContribution', label: 'Contribuição patronal', value: 0, format: 'money' },
  ],
};

export const REPORT_PROFILE_METRICS: Record<ReportProfile, Record<ReportKind, string[]>> = {
  gestor: {
    'visao-geral': ['records', 'completed', 'peopleInPayroll', 'grossPayments'],
    cadastral: ['records', 'completed', 'completionRate', 'entities'],
    operacional: ['records', 'pending', 'completionRate'],
    financeiro: ['grossPayments', 'netPayments', 'beneficiaries', 'employerContribution'],
  },
  operador: {
    'visao-geral': ['records', 'completed', 'peopleInPayroll'],
    cadastral: ['records', 'pending', 'completed'],
    operacional: ['pending', 'records', 'completionRate'],
    financeiro: ['activeMembers', 'beneficiaries'],
  },
  auditoria: {
    'visao-geral': ['records', 'completed', 'peopleInPayroll', 'grossPayments'],
    cadastral: ['records', 'completed', 'pending', 'entities'],
    operacional: ['records', 'completed', 'pending', 'completionRate', 'entities'],
    financeiro: ['grossPayments', 'discounts', 'netPayments', 'employerContribution'],
  },
};

export const REPORT_TITLES: Record<ReportKind, { title: string; description: string }> = {
  'visao-geral': {
    title: 'Relatório da visão geral',
    description: 'Painel consolidado do recenseamento e da folha previdenciária.',
  },
  cadastral: { title: 'Relatório cadastral', description: 'Situação e composição dos registros de recenseamento.' },
  operacional: { title: 'Relatório operacional', description: 'Acompanhamento de cadastros, conclusão e pendências.' },
  financeiro: { title: 'Relatório financeiro', description: 'Resumo agregado da folha por grupo previdenciário.' },
};

export const REPORT_VIEWS: Array<{ key: ReportView; label: string }> = [
  { key: 'cards', label: 'Cartões KPI' },
  { key: 'table', label: 'Tabela' },
  { key: 'bar', label: 'Gráfico de barras' },
  { key: 'line', label: 'Gráfico de linhas' },
];

export const INITIAL_REPORT_FILTERS: ReportFilters = {
  from: '2026-03-01',
  to: '2026-08-31',
  status: '',
  cargo: '',
  entidade: '',
  regime: '',
  rppsRegime: '',
  source: '',
};

export const FINANCIAL_COMPETENCE = '2026-03';

function toIsoDate(value: string) {
  const [day, month, year] = value.split('/');
  if (!day || !month || !year) return '';
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function matchesReportDate(value: string, filters: ReportFilters) {
  const date = toIsoDate(value);
  return Boolean(date) && (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to);
}

export function filterCensusRecords(records: CensoRecord[], filters: ReportFilters) {
  return records.filter((record) => (
    matchesReportDate(record.cadastro, filters)
    && (!filters.status || record.status === filters.status)
    && (!filters.cargo || record.cargo === filters.cargo)
    && (!filters.entidade || record.entidade === filters.entidade)
    && (!filters.regime || record.tipo === filters.regime)
    && (!filters.rppsRegime || record.regime === filters.rppsRegime)
    && (!filters.source || record.fonteDados === filters.source)
  ));
}

export function isFinancialCompetenceInRange(
  filters: ReportFilters,
  competence: string | null = FINANCIAL_COMPETENCE,
) {
  if (!competence) return false;
  const month = competence.slice(0, 7);
  return (!filters.from || filters.from.slice(0, 7) <= month)
    && (!filters.to || filters.to.slice(0, 7) >= month);
}

function sumMoney(...values: number[]) {
  return values.reduce((total, value) => {
    if (!Number.isFinite(value)) throw new Error('Valores monetários do relatório devem ser números finitos.');
    return total + Math.round(value * 100);
  }, 0) / 100;
}

function mapCensusRows(records: CensoRecord[], kind: Exclude<ReportKind, 'financeiro'>): ReportRow[] {
  if (kind === 'operacional') {
    return records.map((record) => ({
      Cargo: record.cargo,
      Entidade: record.entidade,
      Status: record.status,
      Cadastro: record.cadastro,
      Conclusão: record.conclusao || '—',
      'Último acesso': record.ultimoAcesso || '—',
    }));
  }
  return records.map((record) => ({
    Nome: record.nome,
    Matrícula: record.matricula,
    CPF: maskCpf(record.cpf),
    Cargo: record.cargo,
    Entidade: record.entidade,
    Cadastro: record.cadastro,
    Status: record.status,
  }));
}

function mapFinancialRows(data: DashboardData): ReportRow[] {
  const { payroll } = data;
  return [
    {
      'Grupo / benefício': 'Servidores ativos',
      Quantidade: payroll.ativos.quantidade,
      'Proventos (R$)': payroll.ativos.proventos,
      'Descontos (R$)': payroll.ativos.descontos,
      'Líquido (R$)': sumMoney(payroll.ativos.proventos, -payroll.ativos.descontos),
      'Contribuição patronal (R$)': payroll.ativos.patronal,
    },
    ...payroll.beneficios.map((benefit) => ({
      'Grupo / benefício': benefit.tipo,
      Quantidade: benefit.quantidade,
      'Proventos (R$)': benefit.vencimentos,
      'Descontos (R$)': benefit.descontos,
      'Líquido (R$)': benefit.liquido,
      'Contribuição patronal (R$)': 0,
    })),
  ];
}

function groupRecords(records: CensoRecord[], getLabel: (record: CensoRecord) => string) {
  const groups = new Map<string, number>();
  records.forEach((record) => {
    const label = getLabel(record);
    groups.set(label, (groups.get(label) ?? 0) + 1);
  });
  return [...groups].map(([label, value]) => ({ label, value }));
}

function mapOverviewReport(
  data: DashboardData,
  records: CensoRecord[],
  financialInRange: boolean,
  competenceLabel = formatCompetence(data.filters ? data.filters.competence : FINANCIAL_COMPETENCE),
) {
  const { censo, payroll } = data;
  const completed = records.filter((record) => record.status === 'Concluído').length;
  const pending = records.filter((record) => record.status === 'Cadastro sem conclusão').length;
  const grossPayments = sumMoney(payroll.ativos.proventos, payroll.total_vencimentos_beneficios);
  const netPayments = sumMoney(payroll.ativos.proventos, -payroll.ativos.descontos, payroll.total_liquido_beneficios);
  const benefitRows = financialInRange ? mapFinancialRows(data).map((row) => ({
    'Seção': 'Folha por grupo',
    'Indicador / grupo': row['Grupo / benefício'] ?? '',
    'Quantidade': row.Quantidade ?? 0,
    'Valor bruto (R$)': row['Proventos (R$)'] ?? 0,
    'Valor líquido (R$)': row['Líquido (R$)'] ?? 0,
    'Taxa (%)': '',
    'Detalhe': `Competência ${competenceLabel}`,
  })) : [];
  const dateGroups = groupRecords(records, (record) => record.cadastro)
    .sort((first, second) => first.label.localeCompare(second.label, 'pt-BR'));
  const roleGroups = groupRecords(records, (record) => record.cargo)
    .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, 'pt-BR'))
    .slice(0, 7);
  const statusGroups = [
    { label: 'Concluídos', value: completed },
    { label: 'Pendentes', value: pending },
    { label: 'Em análise', value: records.filter((record) => record.status === 'Em análise').length },
    { label: 'Recusados', value: records.filter((record) => record.status === 'Recusado').length },
  ];
  const chartGroups: ReportChartGroup[] = [
    {
      title: 'Beneficiários por tipo',
      view: 'bar',
      items: financialInRange
        ? payroll.beneficios.map((benefit) => ({ label: benefit.tipo, value: benefit.quantidade }))
        : [],
    },
    {
      title: 'Vencimentos por grupo',
      view: 'bar',
      items: financialInRange
        ? [
          { label: 'Servidores ativos', value: payroll.ativos.proventos },
          ...payroll.beneficios.map((benefit) => ({ label: benefit.tipo, value: benefit.vencimentos })),
        ]
        : [],
    },
    { title: 'Situação do recenseamento', view: 'bar', items: statusGroups },
    { title: 'Cadastros por data', view: 'line', items: dateGroups },
    { title: 'Principais cargos', view: 'bar', items: roleGroups },
  ];
  const chartRows = chartGroups.flatMap(({ title, items }) => items.map((item) => ({
    'Seção': title,
    'Indicador / grupo': item.label,
    'Quantidade': item.value,
    'Valor bruto (R$)': '',
    'Valor líquido (R$)': '',
    'Taxa (%)': '',
    'Detalhe': '',
  })));
  const rows: ReportRow[] = [
    {
      'Seção': 'Indicadores',
      'Indicador / grupo': 'Registros no recenseamento',
      'Quantidade': records.length,
      'Valor bruto (R$)': '',
      'Valor líquido (R$)': '',
      'Taxa (%)': '',
      'Detalhe': `Período ${censo.data_inicial} a ${censo.data_final}`,
    },
    {
      'Seção': 'Indicadores',
      'Indicador / grupo': 'Cadastros concluídos',
      'Quantidade': completed,
      'Valor bruto (R$)': '',
      'Valor líquido (R$)': '',
      'Taxa (%)': records.length ? completed / records.length * 100 : 0,
      'Detalhe': '',
    },
    {
      'Seção': 'Indicadores',
      'Indicador / grupo': 'Pessoas na folha',
      'Quantidade': financialInRange ? payroll.ativos.quantidade + payroll.beneficiarios : 0,
      'Valor bruto (R$)': '',
      'Valor líquido (R$)': '',
      'Taxa (%)': '',
      'Detalhe': financialInRange ? `Competência ${competenceLabel}` : 'Competência fora do período selecionado',
    },
    {
      'Seção': 'Indicadores',
      'Indicador / grupo': 'Proventos e vencimentos',
      'Quantidade': '',
      'Valor bruto (R$)': financialInRange ? grossPayments : 0,
      'Valor líquido (R$)': financialInRange ? netPayments : 0,
      'Taxa (%)': '',
      'Detalhe': financialInRange ? `Competência ${competenceLabel}` : 'Competência fora do período selecionado',
    },
    ...benefitRows,
    ...chartRows,
  ];

  return { rows, chartGroups };
}

export function buildReportRows(
  data: DashboardData,
  kind: ReportKind,
  records: CensoRecord[],
  financialInRange: boolean,
): ReportRow[] {
  if (kind === 'visao-geral') return mapOverviewReport(data, records, financialInRange).rows;
  if (kind === 'financeiro') return financialInRange ? mapFinancialRows(data) : [];
  return mapCensusRows(records, kind);
}

export function calculateReportMetrics(
  kind: ReportKind,
  data: DashboardData,
  records: CensoRecord[],
  selectedMetrics: string[],
  financialInRange: boolean,
): ReportMetric[] {
  if (kind === 'visao-geral') {
    const completed = records.filter((record) => record.status === 'Concluído').length;
    const values: Record<string, number> = {
      records: records.length,
      completed,
      peopleInPayroll: data.payroll.ativos.quantidade + data.payroll.beneficiarios,
    grossPayments: sumMoney(data.payroll.ativos.proventos, data.payroll.total_vencimentos_beneficios),
    };
    return REPORT_METRICS['visao-geral']
      .filter((metric) => selectedMetrics.includes(metric.key))
      .map((metric) => ({
        ...metric,
        value: metric.key === 'peopleInPayroll' || metric.key === 'grossPayments'
          ? financialInRange ? values[metric.key] : 0
          : values[metric.key] ?? 0,
      }));
  }
  if (kind === 'financeiro') {
    const { payroll } = data;
    const values: Record<string, number> = {
      activeMembers: payroll.ativos.quantidade,
      beneficiaries: payroll.beneficiarios,
      grossPayments: sumMoney(payroll.ativos.proventos, payroll.total_vencimentos_beneficios),
      discounts: sumMoney(payroll.ativos.descontos, payroll.total_descontos_beneficios),
      netPayments: sumMoney(payroll.ativos.proventos, -payroll.ativos.descontos, payroll.total_liquido_beneficios),
      employerContribution: payroll.ativos.patronal,
    };
    return REPORT_METRICS.financeiro
      .filter((metric) => selectedMetrics.includes(metric.key))
      .map((metric) => ({ ...metric, value: financialInRange ? values[metric.key] : 0 }));
  }

  const completed = records.filter((record) => record.status === 'Concluído').length;
  const pending = records.filter((record) => record.status === 'Cadastro sem conclusão').length;
  const values: Record<string, number> = {
    records: records.length,
    completed,
    pending,
    completionRate: records.length ? completed / records.length * 100 : 0,
    entities: new Set(records.map((record) => record.entidade)).size,
  };
  return REPORT_METRICS[kind]
    .filter((metric) => selectedMetrics.includes(metric.key))
    .map((metric) => ({ ...metric, value: values[metric.key] }));
}

export function buildReportChartItems(
  kind: ReportKind,
  records: CensoRecord[],
  rows: ReportRow[],
) {
  if (kind === 'visao-geral') return [];
  if (kind === 'financeiro') {
    return rows.map((row) => ({
      label: String(row['Grupo / benefício']),
      value: Number(row['Proventos (R$)']),
    }));
  }
  const groups = new Map<string, number>();
  records.forEach((record) => {
    const label = kind === 'operacional' ? record.status : record.cadastro;
    groups.set(label, (groups.get(label) ?? 0) + 1);
  });
  return [...groups]
    .map(([label, value]) => ({ label, value }))
    .sort((first, second) => first.label.localeCompare(second.label, 'pt-BR'))
    .slice(0, 12);
}

export function buildOverviewReportChartGroups(
  data: DashboardData,
  records: CensoRecord[],
  financialInRange: boolean,
) {
  return mapOverviewReport(data, records, financialInRange).chartGroups;
}

export function formatReportPeriod(filters: ReportFilters) {
  const from = filters.from ? new Date(`${filters.from}T00:00:00`).toLocaleDateString('pt-BR') : '—';
  const to = filters.to ? new Date(`${filters.to}T00:00:00`).toLocaleDateString('pt-BR') : '—';
  return `${from} a ${to}`;
}
