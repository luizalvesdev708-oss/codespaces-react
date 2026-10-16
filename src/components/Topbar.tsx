import type { RefObject } from 'react';
interface TopbarProps {
  onOpenMenu: () => void;
  onOpenFilters: () => void;
  menuTriggerRef: RefObject<HTMLButtonElement>;
  filterTriggerRef: RefObject<HTMLButtonElement>;
  menuOpen: boolean;
  filtersOpen: boolean;
  userName: string;
  logoutError: string;
  isLoggingOut: boolean;
  onLogout: () => void;
}

export default function Topbar({
  onOpenMenu,
  onOpenFilters,
  menuTriggerRef,
  filterTriggerRef,
  menuOpen,
  filtersOpen,
  userName,
  logoutError,
  isLoggingOut,
  onLogout,
}: TopbarProps) {
  return (
    <header className="topbar bg-rpps-header text-rpps-card">
      <div className="topbar__start">
        <button
          ref={menuTriggerRef}
          className="icon-button topbar__menu-trigger"
          type="button"
          onClick={onOpenMenu}
          aria-label="Abrir menu de navegação"
          aria-controls="main-sidebar"
          aria-expanded={menuOpen}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <a className="brand" href="/">
          <span className="brand__mark" aria-hidden="true">C</span>
          <span>Censo Previdenciário</span>
        </a>
      </div>
      <div className="topbar__actions">
        <button
          ref={filterTriggerRef}
          className="icon-button topbar__filter-trigger"
          type="button"
          onClick={onOpenFilters}
          aria-label="Abrir filtros"
          aria-controls="mobile-filter-dialog"
          aria-expanded={filtersOpen}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 7h16M7 12h10m-7 5h4" />
            <circle cx="8" cy="7" r="2" />
            <circle cx="15" cy="12" r="2" />
            <circle cx="12" cy="17" r="2" />
          </svg>
          <span>Filtros</span>
        </button>
        <div className="topbar__account">
          <span className="topbar__user" title={userName}>{userName}</span>
          <span className="topbar__demo">Dados do sistema</span>
          <button type="button" onClick={onLogout} disabled={isLoggingOut} aria-label="Sair da sessão">
            {isLoggingOut ? 'Saindo…' : 'Sair'}
          </button>
        </div>
      </div>
      {logoutError && <p className="topbar__error" role="alert">{logoutError}</p>}
    </header>
  );
}