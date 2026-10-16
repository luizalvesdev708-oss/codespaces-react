import type { PageKey } from '../@types/censo';
import type { ReactNode } from 'react';
import type { RefObject } from 'react';
const pages: { key: PageKey; label: string; icon: ReactNode }[] = [
  { key: 'overview', label: 'Visão geral', icon: <><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="5" rx="1" /><rect x="13" y="10" width="8" height="11" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /></> },
  { key: 'cadastro', label: 'Base do censo', icon: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" /></> },
  { key: 'segurados', label: 'Segurados', icon: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></> },
  { key: 'beneficios', label: 'Benefícios', icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></> },
  { key: 'contribuicoes', label: 'Contribuições', icon: <><path d="M3 3v18h18" /><path d="m19 9-5 5-4-4-5 5" /><path d="M15 9h4v4" /></> },
  { key: 'relatorios', label: 'Relatórios', icon: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /><path d="M8 7h8M8 11h8" /></> },
];
interface SidebarProps { activePage: PageKey; isOpen: boolean; onNavigate: (page: PageKey) => void; onClose: () => void; closeButtonRef: RefObject<HTMLButtonElement>; children: ReactNode }
export default function Sidebar({ activePage, isOpen, onNavigate, onClose, closeButtonRef, children }: SidebarProps) {
  return <>
    <button className={`sidebar-backdrop${isOpen ? ' is-visible' : ''}`} type="button" aria-label="Fechar menu" tabIndex={isOpen ? 0 : -1} onClick={onClose} />
    <aside id="main-sidebar" className={`sidebar bg-rpps-sidebar${isOpen ? ' is-open' : ''}`} aria-label="Navegação e filtros" aria-hidden={!isOpen ? undefined : false}>
    <div className="sidebar__mobile-header"><span>Menu</span><button ref={closeButtonRef} className="icon-button sidebar__close" type="button" onClick={onClose} aria-label="Fechar menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12" /></svg></button></div>
    <nav className="side-nav" aria-label="Navegação do painel"><p className="sidebar__eyebrow">Navegação</p>{pages.map(({ key, label, icon }) => <button className={`sidebar__item${activePage === key ? ' is-active' : ''}`} key={key} onClick={() => { onNavigate(key); onClose(); }} type="button" aria-current={activePage === key ? 'page' : undefined}><span className="sidebar__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icon}</svg></span><span>{label}</span></button>)}</nav>
    <div className="sidebar__filters">{children}</div>
  </aside>
  </>;
}