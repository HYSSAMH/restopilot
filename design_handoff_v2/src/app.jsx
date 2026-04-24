// RestoPilot — Main app entry

const { useState: useStateA, useEffect: useEffectA } = React;

const DEFAULT_TWEAKS = /*EDITMODE-BEGIN*/{
  "density": "comfortable",
  "accentColor": "#6366F1",
  "catalogueView": "grid",
  "showSparklines": true,
  "showSupplierColors": true
}/*EDITMODE-END*/;

function App() {
  const [page, setPage] = useStateA('dashboard');
  const tweaks = useTweaks(DEFAULT_TWEAKS);
  const [showTweaks, setShowTweaks] = useStateA(false);

  useEffectA(() => {
    document.documentElement.setAttribute('data-density', tweaks.density === 'compact' ? 'compact' : 'comfortable');
    document.documentElement.style.setProperty('--accent', tweaks.accentColor);
    document.documentElement.style.setProperty('--accent-hover', tweaks.accentColor);
  }, [tweaks.density, tweaks.accentColor]);

  useEffectA(() => {
    const handler = (e) => {
      if (e.data?.type === '__activate_edit_mode') setShowTweaks(true);
      if (e.data?.type === '__deactivate_edit_mode') setShowTweaks(false);
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  const crumbs = {
    dashboard: ['Maison Lumière', 'Dashboard'],
    order: ['Maison Lumière', 'Passer une commande', 'Catalogue'],
    fiches: ['Maison Lumière', 'Menu', 'Fiches techniques', 'Saint-Jacques rôties'],
    mercuriale: ['Maison Lumière', 'Menu', 'Mercuriale'],
    treso: ['Maison Lumière', 'Gestion', 'Trésorerie'],
    history: ['Maison Lumière', 'Gestion', 'Historique des achats'],
    prices: ['Maison Lumière', 'Gestion', 'Analyse des prix'],
    budget: ['Maison Lumière', 'Gestion', 'Budget'],
    receive: ['Maison Lumière', 'Principal', 'À réceptionner'],
    orders: ['Maison Lumière', 'Principal', 'Mes commandes'],
    suppliers: ['Maison Lumière', 'Menu', 'Fournisseurs externes'],
    team: ['Maison Lumière', 'Gestion', 'Équipe'],
    profile: ['Maison Lumière', 'Compte', 'Mon profil'],
    mobile: ['Maison Lumière', 'Aperçu mobile'],
  };

  let Page = null;
  if (page === 'dashboard') Page = <DashboardPage onNav={setPage} tweaks={tweaks} />;
  else if (page === 'order') Page = <CataloguePage onNav={setPage} tweaks={tweaks} />;
  else if (page === 'fiches') Page = <FichePage onNav={setPage} tweaks={tweaks} />;
  else if (page === 'mercuriale') Page = <MercurialePage onNav={setPage} />;
  else if (page === 'treso') Page = <TresoPage onNav={setPage} />;
  else if (page === 'mobile') Page = <MobilePage />;
  else if (page === 'employee') Page = <EmployeePage onNav={setPage} />;
  else if (page === 'supplier') Page = <SupplierPage onNav={setPage} />;
  else if (page === 'admin') Page = <AdminPage onNav={setPage} />;
  else if (page === 'margin') Page = <MargePage onNav={setPage} />;
  else if (page === 'reception') Page = <ReceptionPage onNav={setPage} />;
  else if (page === 'receive') Page = <ReceivePage onNav={setPage} />;
  else if (page === 'orders') Page = <OrdersPage onNav={setPage} />;
  else if (page === 'suppliers') Page = <SuppliersPage onNav={setPage} />;
  else if (page === 'team') Page = <TeamPage onNav={setPage} />;
  else if (page === 'profile') Page = <ProfilePage onNav={setPage} />;
  else if (page === 'planning') Page = <PlanningPage onNav={setPage} />;
  else if (page === 'inventory') Page = <InventoryPage onNav={setPage} />;
  else if (page === 'analytics') Page = <AnalyticsPage onNav={setPage} />;
  else if (page === 'menu-builder') Page = <MenuBuilderPage onNav={setPage} />;
  else if (page === 'onboarding') Page = <OnboardingPage />;
  else if (page === 'settings') Page = <SettingsPage onNav={setPage} />;
  else if (page === 'invoices') Page = <InvoicesPage onNav={setPage} />;
  else if (page === 'history') Page = <PurchaseHistoryPage onNav={setPage} />;
  else if (page === 'prices') Page = <PriceAnalysisPage onNav={setPage} />;
  else if (page === 'budget') Page = <BudgetPage onNav={setPage} />;
  else Page = <PlaceholderPage pageId={page} onNav={setPage} />;

  return (
    <div className="app" data-screen-label={page} style={(page==='employee' || page==='onboarding') ? {gridTemplateColumns:'1fr'} : {}}>
      {page!=='employee' && page!=='onboarding' && <Sidebar current={page} onNav={setPage} />}
      <div className="main">
        {page!=='employee' && page!=='onboarding' && <Topbar crumbs={crumbs[page] || ['Maison Lumière', NAV.find(n => n.id === page)?.label || page]} />}
        {Page}
      </div>

      {showTweaks && (
        <TweaksPanel title="Tweaks" onClose={() => setShowTweaks(false)}>
          <TweakSection title="Apparence">
            <TweakRadio
              label="Densité"
              value={tweaks.density}
              onChange={v => tweaks.set('density', v)}
              options={[
                { value: 'comfortable', label: 'Aérée' },
                { value: 'compact', label: 'Compacte' },
              ]}
            />
            <TweakColor label="Couleur d'accent" value={tweaks.accentColor} onChange={v => tweaks.set('accentColor', v)} />
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              {['#6366F1', '#8B5CF6', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#0F172A'].map(c => (
                <button key={c} onClick={() => tweaks.set('accentColor', c)} style={{
                  width: 22, height: 22, borderRadius: 6, background: c,
                  border: tweaks.accentColor === c ? '2px solid var(--text)' : '1px solid var(--border)',
                  cursor: 'pointer',
                }} />
              ))}
            </div>
          </TweakSection>

          <TweakSection title="Catalogue">
            <TweakRadio
              label="Vue par défaut"
              value={tweaks.catalogueView}
              onChange={v => tweaks.set('catalogueView', v)}
              options={[
                { value: 'grid', label: 'Grille' },
                { value: 'table', label: 'Tableau' },
              ]}
            />
            <TweakToggle label="Couleurs fournisseurs" value={tweaks.showSupplierColors} onChange={v => tweaks.set('showSupplierColors', v)} />
          </TweakSection>

          <TweakSection title="Dashboard">
            <TweakToggle label="Sparklines KPI" value={tweaks.showSparklines} onChange={v => tweaks.set('showSparklines', v)} />
          </TweakSection>

          <TweakSection title="Navigation">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <button className="btn sm" onClick={() => setPage('dashboard')}>Dashboard</button>
              <button className="btn sm" onClick={() => setPage('order')}>Catalogue</button>
              <button className="btn sm" onClick={() => setPage('fiches')}>Fiche tech.</button>
              <button className="btn sm" onClick={() => setPage('mercuriale')}>Mercuriale</button>
              <button className="btn sm" onClick={() => setPage('treso')}>Trésorerie</button>
              <button className="btn sm" onClick={() => setPage('mobile')}>Vue mobile</button>
              <button className="btn sm" onClick={() => setPage('employee')}>Employé CA</button>
              <button className="btn sm" onClick={() => setPage('supplier')}>Distributeur</button>
              <button className="btn sm" onClick={() => setPage('admin')}>Admin</button>
              <button className="btn sm" onClick={() => setPage('margin')}>Rapport marge</button>
              <button className="btn sm" onClick={() => setPage('reception')}>Réception</button>
              <button className="btn sm" onClick={() => setPage('planning')}>Planning</button>
              <button className="btn sm" onClick={() => setPage('inventory')}>Inventaire</button>
              <button className="btn sm" onClick={() => setPage('analytics')}>Analytics</button>
              <button className="btn sm" onClick={() => setPage('menu-builder')}>Composer carte</button>
              <button className="btn sm" onClick={() => setPage('onboarding')}>Onboarding</button>
              <button className="btn sm" onClick={() => setPage('settings')}>Paramètres</button>
              <button className="btn sm" onClick={() => setPage('invoices')}>Factures</button>
            </div>
          </TweakSection>
        </TweaksPanel>
      )}
    </div>
  );
}

function PlaceholderPage({ pageId, onNav }) {
  const item = NAV.find(n => n.id === pageId);
  return (
    <div className="content page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">{item?.label || pageId}</h1>
          <div className="page-sub">Cette page n'est pas encore designée dans ce prototype.</div>
        </div>
      </div>
      <div className="card">
        <div className="card-body" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ display: 'inline-grid', placeItems: 'center', width: 48, height: 48, borderRadius: 12, background: 'var(--accent-soft)', color: 'var(--accent)', marginBottom: 12 }}>
            <Icon name={item?.icon || 'info'} size={20} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>À designer</div>
          <div className="text-sm text-muted" style={{ maxWidth: 420, margin: '0 auto 16px' }}>
            Ce prototype couvre 6 écrans : Dashboard, Catalogue, Fiche technique, Mercuriale, Trésorerie et la vue mobile.
          </div>
          <div className="flex gap-2" style={{ justifyContent: 'center' }}>
            <button className="btn" onClick={() => onNav('dashboard')}><Icon name="home" />Retour au Dashboard</button>
            <button className="btn primary" onClick={() => onNav('order')}><Icon name="shopping-cart" />Voir le catalogue</button>
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
