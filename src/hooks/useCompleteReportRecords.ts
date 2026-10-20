import { useEffect, useState } from 'react';
import type { CensoRecord, DashboardData } from '../@types/censo';
import { apiRequest } from '../services/api';

interface ReportRecordsPage {
  records: CensoRecord[];
  total: number;
  page: number;
  pageSize: number;
}

interface ReportRecordsState {
  records: CensoRecord[];
  loading: boolean;
  error: string;
}

const PAGE_SIZE = 1_000;
const PAGE_CONCURRENCY = 5;

function reportRecordsUrl(data: DashboardData, page: number) {
  const filters = data.filters;
  if (!filters) return '';
  const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.category && filters.category !== 'ALL') params.set('category', filters.category);
  if (filters.regime) params.set('regime', filters.regime);
  if (filters.source) params.set('source', filters.source);
  if (filters.cargo) params.set('cargo', filters.cargo);
  return `/reports/census-records?${params.toString()}`;
}

export function useCompleteReportRecords(data: DashboardData, userId: string) {
  const [retryToken, setRetryToken] = useState(0);
  const isOffline = !window.navigator.onLine;
  const [state, setState] = useState<ReportRecordsState>({
    records: data.records,
    loading: false,
    error: '',
  });

  useEffect(() => {
    const expectedTotal = data.censo.registros;
    const initialRecords = data.records;
    if (!data.filters || expectedTotal <= initialRecords.length) {
      setState({ records: initialRecords, loading: false, error: '' });
      return;
    }
    const controller = new AbortController();
    const fetchCompleteRecords = async () => {
      setState({ records: initialRecords, loading: true, error: '' });
      try {
        const firstPage = await apiRequest<ReportRecordsPage>(reportRecordsUrl(data, 1), {
          signal: controller.signal,
        }, userId);
        if (!firstPage || !Array.isArray(firstPage.records)
          || !Number.isSafeInteger(firstPage.total) || firstPage.total < 0) {
          throw new Error('Resposta inválida ao carregar os registros do relatório.');
        }
        const pages: ReportRecordsPage[] = [firstPage];
        const pageCount = Math.ceil(firstPage.total / PAGE_SIZE);
        for (let firstPageNumber = 2; firstPageNumber <= pageCount; firstPageNumber += PAGE_CONCURRENCY) {
          const pageNumbers = Array.from(
            { length: Math.min(PAGE_CONCURRENCY, pageCount - firstPageNumber + 1) },
            (_, index) => firstPageNumber + index,
          );
          const nextPages = await Promise.all(pageNumbers.map((page) => apiRequest<ReportRecordsPage>(
            reportRecordsUrl(data, page),
            { signal: controller.signal },
            userId,
          )));
          const validPages = nextPages.filter(
            (page): page is ReportRecordsPage => Boolean(page && Array.isArray(page.records)),
          );
          if (validPages.length !== nextPages.length) {
            throw new Error('Resposta inválida ao carregar os registros do relatório.');
          }
          pages.push(...validPages);
        }
        const records = pages.flatMap((page) => page.records);
        if (records.length !== firstPage.total || firstPage.total !== expectedTotal) {
          throw new Error('A quantidade de registros mudou durante a geração. Atualize os dados e tente novamente.');
        }
        setState({ records, loading: false, error: '' });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          records: initialRecords,
          loading: false,
          error: isOffline
            ? 'A prévia offline está limitada aos registros salvos neste dispositivo.'
            : error instanceof Error ? error.message : 'Não foi possível carregar todos os registros do relatório.',
        });
      }
    };

    void fetchCompleteRecords();
    return () => controller.abort();
  }, [data, isOffline, retryToken, userId]);

  return {
    ...state,
    retry: () => setRetryToken((token) => token + 1),
  };
}
