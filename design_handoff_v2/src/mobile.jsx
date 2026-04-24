// RestoPilot — Vue mobile (dashboard restaurateur + drawer nav)

const { useState: useStateMo } = React;

const MOBILE_NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: 'home' },
  { id: 'order', label: 'Commander', icon: 'shopping-cart' },
  { id: 'receive', label: 'À réceptionner', icon: 'inbox', count: 3 },
  { id: 'orders', label: 'Mes commandes', icon: 'package' },
  { id: 'invoices', label: 'Factures', icon: 'file-text', count: 7 },
  { id: 'fiches', label: 'Fiches techniques', icon: 'chef-hat' },
  { id: 'treso', label: 'Trésorerie', icon: 'wallet' },
  { id: 'team', label: 'Équipe', icon: 'users' },
  { id: 'profile', label: 'Mon profil', icon: 'user' },
];

function MobileStatusBar() {
  return (
    <div className="status-bar">
      <span>9:41</span>
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
        <svg width="17" height="11" viewBox="0 0 17 11" fill="none"><rect x="0.5" y="3.5" width="2" height="4" rx="0.5" fill="#0F172A"/><rect x="4.5" y="2.5" width="2" height="6" rx="0.5" fill="#0F172A"/><rect x="8.5" y="1.5" width="2" height="8" rx="0.5" fill="#0F172A"/><rect x="12.5" y="0.5" width="2" height="10" rx="0.5" fill="#0F172A"/></svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none"><path d="M7.5 2.5C9.8 2.5 12 3.3 13.7 4.7L14.8 3.3C12.8 1.6 10.2 0.5 7.5 0.5C4.8 0.5 2.2 1.6 0.2 3.3L1.3 4.7C3 3.3 5.2 2.5 7.5 2.5Z" fill="#0F172A"/><circle cx="7.5" cy="9" r="1.5" fill="#0F172A"/></svg>
        <svg width="24" height="11" viewBox="0 0 24 11" fill="none"><rect x="0.5" y="0.5" width="21" height="10" rx="2.5" stroke="#0F172A" fill="none"/><rect x="2" y="2" width="17" height="7" rx="1" fill="#0F172A"/><rect x="22" y="4" width="1.5" height="3" rx="0.5" fill="#0F172A"/></svg>
      </span>
    </div>
  );
}

function MobileDrawer({ open, onClose, current, onNav }) {
  if (!open) return null;
  return (
    <>
      <div className="m-drawer-backdrop" onClick={onClose} />
      <div className="m-drawer">
        <MobileStatusBar />
        <div style={{ padding: '8px 18px 14px', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="brand-mark" style={{ width: 36, height: 36, fontSize: 14 }}>RP</div>
            <div>
              <div style={{ fontWeight: 650, fontSize: 15 }}>RestoPilot</div>
              <div className="text-xs text-muted">Maison Lumière</div>
            </div>
            <button className="icon-btn ml-auto" onClick={onClose}><Icon name="x" /></button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
          {MOBILE_NAV.map(n => (
            <button key={n.id} className={'m-nav-item' + (current === n.id ? ' active' : '')} onClick={() => { onNav(n.id); onClose(); }} style={{ background: current === n.id ? 'var(--accent-soft)' : 'transparent', border: 'none', width: '100%', textAlign: 'left' }}>
              <Icon name={n.icon} size={18} />
              <span>{n.label}</span>
              {n.count && <span className={'nav-count' + (n.id === 'invoices' ? ' dot' : '')}>{n.count}</span>}
            </button>
          ))}
        </div>
        <div style={{ borderTop: '1px solid var(--border)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="user-avatar">AC</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Antoine Clément</div>
            <div className="text-xs text-muted">Restaurateur</div>
          </div>
          <button className="icon-btn"><Icon name="log-out" size={15} /></button>
        </div>
      </div>
    </>
  );
}

function MobileDashboard() {
  const [drawer, setDrawer] = useStateMo(false);
  const [page, setPage] = useStateMo('dashboard');

  return (
    <div className="mobile-frame">
      <div className="mobile-notch" />
      <div className="mobile-screen">
        <MobileStatusBar />

        <div className="m-topbar">
          <button className="m-hamburger" onClick={() => setDrawer(true)}>
            <Icon name="list" size={18} />
          </button>
          <h2>Dashboard</h2>
          <div className="m-top-actions">
            <button><Icon name="search" size={16} /></button>
            <button>
              <Icon name="bell" size={16} />
              <span className="m-badge-dot" />
            </button>
          </div>
        </div>

        <div className="m-content">
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 20, fontWeight: 650, letterSpacing: '-0.02em' }}>Bonjour Antoine 👋</div>
            <div className="text-xs text-muted">Lundi 22 avril · Maison Lumière</div>
          </div>

          <div className="m-kpi-scroll">
            <div className="m-kpi accent">
              <div className="m-kpi-label">CA du jour</div>
              <div className="m-kpi-value">4 286 €</div>
              <div className="m-kpi-sub">↑ 12,4% vs lun. dernier</div>
            </div>
            <div className="m-kpi">
              <div className="m-kpi-label">Coût matière</div>
              <div className="m-kpi-value">28,4%</div>
              <div className="m-kpi-sub" style={{ color: 'var(--success)' }}>↓ 1,2 pts</div>
            </div>
            <div className="m-kpi">
              <div className="m-kpi-label">Couverts ce soir</div>
              <div className="m-kpi-value">82</div>
              <div className="m-kpi-sub">complet à 19h</div>
            </div>
            <div className="m-kpi">
              <div className="m-kpi-label">Marge brute</div>
              <div className="m-kpi-value">71,6%</div>
              <div className="m-kpi-sub">+1,2 pts</div>
            </div>
          </div>

          <div className="m-card">
            <div className="m-card-head">
              <Icon name="sparkles" size={14} style={{ color: 'var(--accent)' }} />
              <h3>Alertes</h3>
              <span className="badge danger ml-auto" style={{ marginLeft: 'auto' }}>3</span>
            </div>
            {ALERTS.slice(0, 3).map((a, i) => {
              const iconMap = { danger: 'alert-circle', warning: 'alert-triangle', info: 'info', success: 'check-circle' };
              return (
                <div key={i} className="m-alert-item">
                  <div className={'alert-icon ' + a.kind}>
                    <Icon name={iconMap[a.kind]} size={13} />
                  </div>
                  <div className="m-alert-body" style={{ flex: 1 }}>
                    <h4>{a.title}</h4>
                    <p>{a.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="m-card">
            <div className="m-card-head">
              <Icon name="zap" size={14} style={{ color: 'var(--warning)' }} />
              <h3>Actions rapides</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border)' }}>
              {[
                { icon: 'shopping-cart', label: 'Commander' },
                { icon: 'inbox', label: 'Réceptionner' },
                { icon: 'file-text', label: 'Facturer' },
                { icon: 'chef-hat', label: 'Fiche tech.' },
              ].map(a => (
                <button key={a.label} style={{ background: 'white', padding: '14px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: 'none' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
                    <Icon name={a.icon} size={16} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 550 }}>{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="m-tabbar">
          {[
            { id: 'dashboard', icon: 'home', label: 'Accueil' },
            { id: 'order', icon: 'shopping-cart', label: 'Commander' },
            { id: 'orders', icon: 'package', label: 'Cmdes' },
            { id: 'treso', icon: 'wallet', label: 'Tréso' },
            { id: 'profile', icon: 'user', label: 'Profil' },
          ].map(t => (
            <button key={t.id} className={'m-tab' + (page === t.id ? ' active' : '')} onClick={() => setPage(t.id)}>
              <Icon name={t.icon} size={18} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <MobileDrawer open={drawer} onClose={() => setDrawer(false)} current={page} onNav={setPage} />
      </div>
    </div>
  );
}

function MobileCommande() {
  return (
    <div className="mobile-frame">
      <div className="mobile-notch" />
      <div className="mobile-screen">
        <MobileStatusBar />
        <div className="m-topbar">
          <button className="m-hamburger"><Icon name="arrow-left" size={18} /></button>
          <h2>Commander</h2>
          <div className="m-top-actions">
            <button style={{ position: 'relative' }}>
              <Icon name="shopping-cart" size={16} />
              <span style={{ position: 'absolute', top: 2, right: 2, background: 'var(--accent)', color: 'white', fontSize: 9, fontWeight: 700, padding: '0 4px', borderRadius: 10, minWidth: 14, textAlign: 'center' }}>4</span>
            </button>
          </div>
        </div>
        <div className="m-content">
          <div className="search-box" style={{ width: '100%', marginBottom: 12 }}>
            <Icon name="search" size={14} />
            <input placeholder="Rechercher un produit..." />
          </div>

          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -14px 14px', padding: '0 14px' }}>
            {['Tous', 'Poissons', 'Viandes', 'Légumes', 'Crémerie', 'Épicerie'].map((c, i) => (
              <button key={c} className={i === 0 ? 'btn primary sm' : 'btn sm'} style={{ flexShrink: 0 }}>{c}</button>
            ))}
          </div>

          {PRODUCTS.slice(0, 4).map(p => {
            const sorted = [...p.prices].sort((a, b) => a.price - b.price);
            const best = sorted[0];
            const sup = SUPPLIERS[best.supplier];
            return (
              <div key={p.id} className="m-card" style={{ padding: 12, display: 'grid', gridTemplateColumns: '56px 1fr auto', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: 10, background: 'repeating-linear-gradient(-45deg, #F5F5F7 0px, #F5F5F7 4px, #EFEFF2 4px, #EFEFF2 8px)', border: '1px solid var(--border)' }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{p.name}</div>
                  <div className="text-xs text-muted" style={{ marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.meta}</div>
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span className="sup-dot" style={{ background: sup.color, width: 6, height: 6, borderRadius: '50%' }} />
                    <span className="text-xs text-muted">{sup.short}</span>
                    <span className="badge success" style={{ marginLeft: 2, fontSize: 9, padding: '1px 5px' }}>meilleur prix</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="mono" style={{ fontSize: 14, fontWeight: 650 }}>{best.price.toFixed(2)} €</div>
                  <button className="btn primary sm" style={{ marginTop: 4, padding: '3px 8px' }}>
                    <Icon name="plus" size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="m-tabbar">
          {[
            { id: 'dashboard', icon: 'home', label: 'Accueil' },
            { id: 'order', icon: 'shopping-cart', label: 'Commander', active: true },
            { id: 'orders', icon: 'package', label: 'Cmdes' },
            { id: 'treso', icon: 'wallet', label: 'Tréso' },
            { id: 'profile', icon: 'user', label: 'Profil' },
          ].map(t => (
            <button key={t.id} className={'m-tab' + (t.active ? ' active' : '')}>
              <Icon name={t.icon} size={18} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MobilePage() {
  return (
    <div className="content page-enter" style={{ maxWidth: 'none' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Navigation mobile</h1>
          <div className="page-sub">Aperçu de l'app iOS · Dashboard + écran Commander avec sidebar drawer. Cliquez sur l'icône menu pour ouvrir le drawer.</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="external-link" />Ouvrir en plein écran</button>
        </div>
      </div>

      <div className="mobile-showcase">
        <div>
          <MobileDashboard />
          <div className="mobile-caption">Dashboard · drawer hamburger + tab bar</div>
        </div>
        <div>
          <MobileCommande />
          <div className="mobile-caption">Commander · listing compact + chips scroll</div>
        </div>
      </div>
    </div>
  );
}

window.MobilePage = MobilePage;
