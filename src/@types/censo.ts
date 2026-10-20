export type PageKey = 'overview' | 'cadastro' | 'segurados' | 'beneficios' | 'contribuicoes' | 'relatorios';
export interface CensoRecord {
  cpf: string; nome: string; matricula: string; entidade: string; cargo: string;
  cadastro: string; conclusao: string; ultimoAcesso: string;
  status: 'Concluído' | 'Cadastro sem conclusão' | 'Em análise' | 'Recusado';
  tipo?: 'ACTIVE' | 'RETIRED' | 'PENSIONER';
  regime?: string;
  fonteDados?: string;
}
export interface CensusAnalytics {
  census: {
    total: number; recenseados: number; pendentes: number; emAnalise: number; recusados: number;
    recenseadosPercentual: string; pendentesPercentual: string;
    emAnalisePercentual: string; recusadosPercentual: string;
  };
  personnel: {
    ativos: number; aposentados: number; pensionistas: number; total: number;
    idadeMediaAnos: number | null; tempoMedioContribuicaoAnos: number | null;
  };
  payroll: {
    folhaBruta: string; arrecadacaoPrevidenciaria: string; beneficiosConcedidos: number;
    projecaoAnualContribuicoes: string; projecaoAnualBeneficios: string; projecaoAnualSaldo: string;
    premissaProjecao: string;
  };
  indisponiveis: string[];
}
export interface CensusSummary {
  registros: number; concluidos: number; sem_conclusao: number; entidades: number;
  data_inicial: string; data_final: string;
}
export interface ActivePayroll { quantidade: number; proventos: number; base: number; descontos: number; patronal: number }
export interface BenefitPayroll { tipo: string; quantidade: number; vencimentos: number; descontos: number; liquido: number }
export interface PayrollData {
  ativos: ActivePayroll; beneficios: BenefitPayroll[]; beneficiarios: number;
  total_vencimentos_beneficios: number; total_descontos_beneficios: number; total_liquido_beneficios: number;
}
export interface PayrollHistoryEntry {
  competence: string;
  gross: number;
  discounts: number;
  payroll_records: number;
}
export interface PayrollCategoryTotal {
  category: 'ACTIVE' | 'RETIRED' | 'PENSIONER';
  count: number;
  gross: number;
  discounts: number;
}
export interface DashboardData {
  records: CensoRecord[]; cargo_counts: Record<string, number>; cadastro_counts: Record<string, number>;
  payroll: PayrollData; censo: CensusSummary;
  payroll_history?: PayrollHistoryEntry[];
  payroll_by_category?: PayrollCategoryTotal[];
  analytics?: CensusAnalytics;
  filters?: {
    from: string | null; to: string | null; regime: string | null; source: string | null; cargo?: string | null;
    category: string; competence: string | null;
  };
  filterOptions?: { cargos?: string[]; regimes: string[]; sources: string[] };
}