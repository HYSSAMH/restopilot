// RestoPilot — Shell layout: Sidebar + Topbar

const { useState, useEffect, useMemo, useRef } = React;

const NAV = [
  { section: 'Principal' },
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'order', label: 'Passer une commande', icon: 'shopping-cart' },
  { id: 'receive', label: 'À réceptionner', icon: 'inbox', count: 3 },
  { id: 'orders', label: 'Mes commandes', icon: 'package' },
  { id: 'invoices', label: 'Factures', icon: 'file-text', count: 7 },
  { id: 'suppliers', label: 'Fournisseurs externes', icon: 'truck' },
  { section: 'Menu' },
  { id: 'fiches', label: 'Fiches techniques', icon: 'chef-hat' },
  { id: 'margin', label: 'Rapport de marge', icon: 'trending-up' },
  { id: 'analytics', label: 'Analytics multi-sites', icon: 'bar-chart-2' },
  { id: 'reception', label: 'Réception livraison', icon: 'package' },
  { id: 'planning', label: 'Planning équipe', icon: 'calendar-days' },
  { id: 'inventory', label: 'Inventaire', icon: 'clipboard-list' },
  { id: 'menu-builder', label: 'Composer la carte', icon: 'book-open' },
  { id: 'settings', label: 'Paramètres', icon: 'settings' },
  { id: 'onboarding', label: 'Onboarding', icon: 'zap' },
  { section: 'Autres rôles' },
  { id: 'employee', label: 'Interface employé', icon: 'user' },
  { id: 'supplier', label: 'Espace distributeur', icon: 'truck' },
  { id: 'admin', label: 'Admin', icon: 'settings' },
  { id: 'mercuriale', label: 'Mercuriale', icon: 'book-open' },
  { section: 'Gestion' },
  { id: 'history', label: 'Historique achats', icon: 'clock' },
  { id: 'prices', label: 'Analyse des prix', icon: 'activity' },
  { id: 'budget', label: 'Budget', icon: 'piggy-bank' },
  { id: 'treso', label: 'Trésorerie', icon: 'wallet' },
  { section: 'Compte' },
  { id: 'team', label: 'Équipe', icon: 'users' },
  { id: 'profile', label: 'Mon profil', icon: 'user' },
  { section: 'Mobile' },
  { id: 'mobile', label: 'Aperçu mobile', icon: 'command' },
];

function Sidebar({ current, onNav }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">RP</div>
        <div className="brand-name">RestoPilot</div>
        <div className="brand-badge">v3.2</div>
      </div>

      <div className="sidebar-workspace">
        <div className="workspace-pill">
          <div className="workspace-avatar">ML</div>
          <div className="workspace-text">
            <div className="workspace-name">Maison Lumière</div>
            <div className="workspace-role">Restaurateur · Paris 7e</div>
          </div>
          <Icon name="chevron-down" size={14} style={{ color: 'var(--text-subtle)' }} />
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((item, i) => {
          if (item.section) {
            return <div key={'s'+i} className="nav-section">{item.section}</div>;
          }
          const active = current === item.id;
          return (
            <button
              key={item.id}
              className={'nav-item' + (active ? ' active' : '')}
              onClick={() => onNav && onNav(item.id)}
            >
              <Icon name={item.icon} size={16} />
              <span>{item.label}</span>
              {item.count !== undefined && (
                <span className={'nav-count' + (item.id === 'invoices' ? ' dot' : '')}>{item.count}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-avatar">AC</div>
        <div className="user-text">
          <div className="user-name">Antoine Clément</div>
          <div className="user-email">antoine@maison-lumiere.fr</div>
        </div>
        <button className="icon-btn" title="Aide"><Icon name="help-circle" size={15} /></button>
      </div>
    </aside>
  );
}

function Topbar({ crumbs, actions }) {
  return (
    <div className="topbar">
      <div className="breadcrumb">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Icon name="chevron-right" size={14} />}
            <span className={i === crumbs.length - 1 ? 'current' : ''}>{c}</span>
          </React.Fragment>
        ))}
      </div>

      <div className="top-actions">
        <div className="search-box">
          <Icon name="search" size={14} />
          <input placeholder="Rechercher produits, commandes..." />
          <span className="kbd">⌘K</span>
        </div>
        <button className="icon-btn" title="Notifications">
          <Icon name="bell" size={15} />
        </button>
        {actions}
      </div>
    </div>
  );
}

window.Sidebar = Sidebar;
window.Topbar = Topbar;
window.NAV = NAV;
