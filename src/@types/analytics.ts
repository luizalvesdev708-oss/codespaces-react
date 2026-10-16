import type { CensusAnalytics } from './censo';

export type AnalyticsExportRow = Record<string, string | number>;

export interface DecryptedAnalyticsReport {
  title: string;
  processedAt: string;
  filters: {
    from: string | null;
    to: string | null;
    regime: string;
    source: string;
    dataScope: string;
  };
  totalRecords: number;
  analytics: CensusAnalytics;
  unavailableMetrics: string[];
  sheets: {
    census: AnalyticsExportRow[];
    insured: AnalyticsExportRow[];
    benefits: AnalyticsExportRow[];
  };
}
