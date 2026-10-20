import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { DashboardData, PageKey } from './@types/censo';
import Filters from './components/Filters';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import ConnectionStatus from './components/ConnectionStatus';
import PwaControls from './components/PwaControls';
import Beneficios from './pages/Beneficios';
import Cadastro from './pages/Cadastro';
import Contribuicoes from './pages/Contribuicoes';
import Login from './pages/Login';
import Overview from './pages/Overview';
import ReportBuilder from './pages/ReportBuilder';
import Segurados from './pages/Segurados';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useCensusFilters } from './hooks/useCensusFilters';
import { useOfflineSync } from './hooks/useOfflineSync';
import { ApiError, apiRequest } from './services/api';
import { readDashboardSnapshot, saveDashboardSnapshot } from './services/offlineStore';
import './App.css';

const EMPTY_DASHBOARD_DATA: DashboardData = {
  records: [],
  cargo_counts: {},
  cadastro_counts: {},
  payroll: {
    ativos: { quantidade: 0, proventos: 0, base: 0, descontos: 0, patronal: 0 },
    beneficios: [],
    beneficiarios: 0,
    total_vencimentos_beneficios: 0,
    total_descontos_beneficios: 0,
    total_liquido_beneficios: 0,
  },
  censo: { registros: 0, concluidos: 0, sem_conclusao: 0, entidades: 0, data_inicial: '', data_final: '' },
};

function useBrowserPath() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const updatePath = () => setPath(window.location.pathname);
    window.addEventListener('popstate', updatePath);
    return () => window.removeEventListener('popstate', updatePath);
  }, []);

  const navigate = useCallback((nextPath: string, replace = false) => {
    if (replace) window.history.replaceState({}, '', nextPath);
    else window.history.pushState({}, '', nextPath);
    setPath(nextPath);
  }, []);

  return { path, navigate };
}

function SessionLoading() {
  return (
    <main className="auth-loading" role="status" aria-live="polite">
      <span className="login-spinner" aria-hidden="true" />
      <span>Verificando sua sessão…</span>
    </main>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();
  const { path, navigate } = useBrowserPath();

  useEffect(() => {
    if (isLoading) return;
    if (user && path !== '/') navigate('/', true);
    else if (!user && path !== '/login') navigate('/login', true);
  }, [isLoading, navigate, path, user]);

  if (isLoading || (user && path !== '/') || (!user && path !== '/login')) {
    return <SessionLoading />;
  }
  return user ? <Dashboard /> : <Login />;
}

function Dashboard() {
  const { user, logout, isOfflineSession } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [isUsingLocalData, setIsUsingLocalData] = useState(false);
  const [page, setPage] = useState<PageKey>('overview');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [areFiltersOpen, setAreFiltersOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [regime, setRegime] = useState<'' | 'ACTIVE' | 'RETIRED' | 'PENSIONER'>('');
  const [institutionalRegime, setInstitutionalRegime] = useState('');
  const [source, setSource] = useState('');
  const dashboardRequest = useRef(0);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const menuCloseButton = useRef<HTMLButtonElement>(null);
  const filterCloseButton = useRef<HTMLButtonElement>(null);
  const filterTrigger = useRef<HTMLButtonElement>(null);
  const censusFilters = useCensusFilters(data ?? EMPTY_DASHBOARD_DATA);
  const offlineSync = useOfflineSync(user?.sub ?? '');
  const previousPendingCount = useRef(offlineSync.pendingCount);

  const loadDashboard = useCallback(async () => {
    const requestNumber = ++dashboardRequest.current;
    setIsDashboardLoading(true);
    setDashboardError('');
    try {
      if (!navigator.onLine && user && !periodFrom && !periodTo && !regime && !institutionalRegime && !source && !censusFilters.cargo) {
        const cachedData = await readDashboardSnapshot(user.sub);
        if (requestNumber !== dashboardRequest.current) return;
        const cachedFiltersMatch = cachedData?.filters
          && cachedData.filters.from === null
          && cachedData.filters.to === null
          && cachedData.filters.category === 'ALL'
          && cachedData.filters.regime === null
          && cachedData.filters.source === null
          && !cachedData.filters.cargo;
        if (cachedData && cachedFiltersMatch) {
          setData(cachedData);
          setIsUsingLocalData(true);
          return;
        }
        setDashboardError('Você está offline e ainda não há dados do painel salvos neste dispositivo.');
        return;
      }
      if (!navigator.onLine && user) {
        setDashboardError('Os filtros escolhidos exigem conexão. Limpe os filtros ou reconecte-se à internet.');
        return;
      }
      const params = new URLSearchParams();
      if (periodFrom) params.set('from', periodFrom);
      if (periodTo) params.set('to', periodTo);
      if (regime) params.set('category', regime);
      if (institutionalRegime) params.set('regime', institutionalRegime);
      if (source) params.set('source', source);
      if (censusFilters.cargo) params.set('cargo', censusFilters.cargo);
      const query = params.toString();
      const result = await apiRequest<DashboardData>(`/dashboard/data${query ? `?${query}` : ''}`, {}, user?.sub);
      if (requestNumber !== dashboardRequest.current) return;
      if (!result) throw new ApiError('O serviço não retornou os dados do painel.', 502);
      setData(result);
      setIsUsingLocalData(false);
      if (user && !periodFrom && !periodTo && !regime && !institutionalRegime && !source && !censusFilters.cargo) {
        try {
          await saveDashboardSnapshot(user.sub, result);
        } catch (error) {
          console.warn('Não foi possível salvar o painel para uso offline.', error);
        }
      }
    } catch (error) {
      if (requestNumber !== dashboardRequest.current) return;
      if (error instanceof ApiError && error.status === 0 && user) {
        try {
          const cachedData = await readDashboardSnapshot(user.sub);
          if (requestNumber !== dashboardRequest.current) return;
          const cachedFiltersMatch = cachedData?.filters
            && cachedData.filters.from === (periodFrom || null)
            && cachedData.filters.to === (periodTo || null)
            && cachedData.filters.category === (regime || 'ALL')
            && cachedData.filters.regime === (institutionalRegime || null)
            && cachedData.filters.source === (source || null)
            && cachedData.filters.cargo === (censusFilters.cargo || null);
          if (cachedData && cachedFiltersMatch) {
            setData(cachedData);
            setIsUsingLocalData(true);
            setDashboardError('');
            return;
          }
        } catch (storageError) {
          console.error('Não foi possível ler o painel salvo localmente.', storageError);
        }
      }
      setDashboardError(error instanceof Error ? error.message : 'Não foi possível carregar os dados do painel.');
    } finally {
      if (requestNumber === dashboardRequest.current) setIsDashboardLoading(false);
    }
  }, [censusFilters.cargo, periodFrom, periodTo, regime, institutionalRegime, source, user]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  useEffect(() => {
    if (offlineSync.pendingCount > 0) previousPendingCount.current = offlineSync.pendingCount;
    if (previousPendingCount.current > 0
      && offlineSync.pendingCount === 0
      && !isOfflineSession
      && navigator.onLine) {
      previousPendingCount.current = 0;
      void loadDashboard();
    }
  }, [isOfflineSession, loadDashboard, offlineSync.pendingCount]);

  useEffect(() => {
    if (!isUsingLocalData) return;
    const refreshWhenOnline = () => void loadDashboard();
    window.addEventListener('online', refreshWhenOnline);
    return () => window.removeEventListener('online', refreshWhenOnline);
  }, [isUsingLocalData, loadDashboard]);

  const closeMenu = () => {
    setIsMenuOpen(false);
    menuTrigger.current?.focus();
  };
  const closeFilters = () => {
    setAreFiltersOpen(false);
    filterTrigger.current?.focus();
  };
  const handleLogout = async () => {
    if (offlineSync.mutations.length > 0
      && !window.confirm('Sair apagará os dados salvos e os rascunhos offline deste usuário neste dispositivo. Alterações ainda não sincronizadas serão perdidas. Deseja continuar?')) {
      return;
    }
    setLogoutError('');
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      setLogoutError(error instanceof Error
        ? `Não foi possível encerrar a sessão: ${error.message}`
        : 'Não foi possível encerrar a sessão. Tente novamente.');
    } finally {
      setIsLoggingOut(false);
    }
  };
  const filterProps = {
    page,
    cargos: data?.filterOptions?.cargos ?? censusFilters.cargos,
    cargo: censusFilters.cargo,
    status: censusFilters.status,
    search: censusFilters.search,
    onCargoChange: censusFilters.setCargo,
    onStatusChange: censusFilters.setStatus,
    onSearchChange: censusFilters.setSearch,
    onClear: censusFilters.clear,
    periodFrom,
    periodTo,
    regime,
    institutionalRegime,
    source,
    regimes: data?.filterOptions?.regimes ?? [],
    sources: data?.filterOptions?.sources ?? [],
    onPeriodFromChange: setPeriodFrom,
    onPeriodToChange: setPeriodTo,
    onRegimeChange: (value: '' | 'ACTIVE' | 'RETIRED' | 'PENSIONER') => {
      setRegime(value);
      if (value !== 'ACTIVE') censusFilters.setCargo('');
    },
    onInstitutionalRegimeChange: setInstitutionalRegime,
    onSourceChange: setSource,
    onClearGlobal: () => {
      setPeriodFrom('');
      setPeriodTo('');
      setRegime('');
      setInstitutionalRegime('');
      setSource('');
    },
  };

  useEffect(() => {
    if (!isMenuOpen) return;
    menuCloseButton.current?.focus();
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isMenuOpen]);

  useEffect(() => {
    if (!areFiltersOpen) return;
    filterCloseButton.current?.focus();
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') closeFilters();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [areFiltersOpen]);

  const handleFilterBackdropMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) closeFilters();
  };
  const trapFilterDialogFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return;
    const controls = event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  if (isDashboardLoading) return <SessionLoading />;
  if (dashboardError || !data) {
    return <main className="dashboard-error" role="alert">
      <h1>Não foi possível carregar o painel</h1>
      <p>{dashboardError || 'O serviço não retornou dados.'}</p>
      <button className="button button--primary" type="button" onClick={() => void loadDashboard()}>Tentar novamente</button>
    </main>;
  }

  return (
    <div className="app-shell bg-rpps-paper text-rpps-ink">
      <ConnectionStatus
        isOnline={offlineSync.isOnline && !isOfflineSession}
        isSyncing={offlineSync.isSyncing}
        isUsingLocalData={isUsingLocalData || isOfflineSession}
        pendingCount={offlineSync.pendingCount}
        conflictCount={offlineSync.conflictCount}
        blockedCount={offlineSync.blockedCount}
        mutations={offlineSync.mutations}
        onRetryMutation={(id) => void offlineSync.retryMutation(id)}
        syncError={offlineSync.syncError}
      />
      <Topbar
        onOpenMenu={() => setIsMenuOpen(true)}
        onOpenFilters={() => setAreFiltersOpen(true)}
        menuTriggerRef={menuTrigger}
        filterTriggerRef={filterTrigger}
        menuOpen={isMenuOpen}
        filtersOpen={areFiltersOpen}
        userName={user?.name || user?.email || 'Usuário'}
        logoutError={logoutError}
        isLoggingOut={isLoggingOut}
        onLogout={() => void handleLogout()}
      />
      <div className="app-layout">
        <Sidebar
          activePage={page}
          isOpen={isMenuOpen}
          onNavigate={setPage}
          onClose={closeMenu}
          closeButtonRef={menuCloseButton}
        >
          <Filters {...filterProps} />
        </Sidebar>
        <main className="main-content">
          {page === 'overview' && <Overview
            data={data}
            category={regime}
            cargo={censusFilters.cargo}
            from={periodFrom}
            to={periodTo}
            onCategoryChange={(value) => {
              setRegime(value);
              if (value !== 'ACTIVE') censusFilters.setCargo('');
            }}
            onCargoChange={(value) => {
              censusFilters.setCargo(value);
              if (value) setRegime('ACTIVE');
            }}
            onPeriodChange={(from, to) => {
              setPeriodFrom(from);
              setPeriodTo(to);
            }}
          />}
          {page === 'cadastro' && <Cadastro data={data} records={censusFilters.records} />}
          {page === 'segurados' && <Segurados
            data={data}
            userId={user?.sub ?? ''}
            canWrite={user?.roles.some((role) => role === 'ADMIN' || role === 'OPERATOR') ?? false}
            isOnline={offlineSync.isOnline && !isOfflineSession}
          />}
          {page === 'beneficios' && <Beneficios data={data} />}
          {page === 'contribuicoes' && <Contribuicoes data={data} />}
          {page === 'relatorios' && <ReportBuilder
            data={data}
            userId={user?.sub ?? ''}
            isAdmin={user?.roles.includes('ADMIN') ?? false}
            dashboardFilters={data.filters}
          />}
        </main>
      </div>
      {areFiltersOpen && (
        <div className="filter-dialog-backdrop" onMouseDown={handleFilterBackdropMouseDown}>
          <section
            id="mobile-filter-dialog"
            className="filter-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="filter-dialog-title"
            onKeyDown={trapFilterDialogFocus}
          >
            <div className="filter-dialog__header">
              <div>
                <span className="filter-dialog__eyebrow">Personalize a visualização</span>
                <h2 id="filter-dialog-title">Filtros</h2>
              </div>
              <button
                ref={filterCloseButton}
                className="icon-button filter-dialog__close"
                type="button"
                aria-label="Fechar filtros"
                onClick={closeFilters}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m18 6-12 12M6 6l12 12" />
                </svg>
              </button>
            </div>
            <Filters {...filterProps} showClear={false} />
            <div className="filter-dialog__footer">
              <button className="button button--quiet" type="button" onClick={censusFilters.clear}>
                Limpar filtros
              </button>
              <button className="button button--primary" type="button" onClick={closeFilters}>
                Aplicar filtros
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PwaControls />
      <AppContent />
    </AuthProvider>
  );
}
