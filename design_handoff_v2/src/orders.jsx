// RestoPilot — Mes commandes (historique + suivi)
const { useState: useOR, useMemo: useMOR } = React;

/* ============ DATA ============ */
const OR_ORDERS = [
  {
    id: 'CMD-2618', sup: 'vin', date: '2026-04-25', deliveryDate: '2026-04-25',
    lines: 12, items: ['Bourgogne Mercurey 2021', 'Sancerre Domaine Roger', 'Champagne Pierre Gimonnet', '+ 9 autres'],
    ht: 2033.33, ttc: 2440.00, status: 'confirmed',
    author: 'Julien M.', paymentStatus: 'pending',
  },
  {
    id: 'CMD-2617', sup: 'epicerie', date: '2026-04-24', deliveryDate: '2026-04-24',
    lines: 14, items: ['Huile d\'olive Castelas 5L', 'Vinaigre balsamique Modena', 'Sel de Guérande', '+ 11 autres'],
    ht: 324.80, ttc: 342.65, status: 'confirmed',
    author: 'Sarah P.', paymentStatus: 'pending',
  },
  {
    id: 'CMD-2616', sup: 'terroir', date: '2026-04-24', deliveryDate: '2026-04-24',
    lines: 24, items: ['Topinambours bio 8 kg', 'Poireaux primeur', 'Salsifis', '+ 21 autres'],
    ht: 472.08, ttc: 498.20, status: 'confirmed',
    author: 'Julien M.', paymentStatus: 'pending',
  },
  {
    id: 'CMD-2615', sup: 'boucher', date: '2026-04-23', deliveryDate: '2026-04-23',
    lines: 8, items: ['Filet de bœuf Limousin 4 kg', 'Agneau de Pauillac', 'Ris de veau', '+ 5 autres'],
    ht: 798.86, ttc: 842.60, status: 'shipped',
    author: 'Julien M.', paymentStatus: 'pending',
  },
  {
    id: 'CMD-2614', sup: 'halles', date: '2026-04-23', deliveryDate: '2026-04-23',
    lines: 18, items: ['Beurre Charentes-Poitou', 'Crème Isigny 3L', 'Œufs Label Rouge', '+ 15 autres'],
    ht: 579.96, ttc: 612.40, status: 'shipped',
    author: 'Sarah P.', paymentStatus: 'pending',
  },
  {
    id: 'CMD-2613', sup: 'maree', date: '2026-04-23', deliveryDate: '2026-04-23',
    lines: 6, items: ['Saint-Jacques Erquy IGP 3 kg', 'Bar de ligne', 'Sole', '+ 3 autres'],
    ht: 269.15, ttc: 284.00, status: 'shipped',
    author: 'Julien M.', paymentStatus: 'pending',
  },
  {
    id: 'CMD-2612', sup: 'terroir', date: '2026-04-22', deliveryDate: '2026-04-22',
    lines: 20, items: ['Carottes fanes bio', 'Radis primeur', 'Épinards pousses', '+ 17 autres'],
    ht: 387.40, ttc: 408.70, status: 'received',
    author: 'Sarah P.', paymentStatus: 'paid', invoiceId: 'FA-2026-0418',
  },
  {
    id: 'CMD-2611', sup: 'boucher', date: '2026-04-22', deliveryDate: '2026-04-22',
    lines: 7, items: ['Côtes de porc noir Gascogne', 'Jambon Serrano 18 mois', 'Lardons fumés', '+ 4 autres'],
    ht: 524.60, ttc: 553.45, status: 'dispute', dispute: 'Écart 320 g sur le jambon · avoir en cours',
    author: 'Julien M.', paymentStatus: 'pending',
  },
  {
    id: 'CMD-2610', sup: 'halles', date: '2026-04-21', deliveryDate: '2026-04-21',
    lines: 16, items: ['Farine T65 25 kg', 'Sucre semoule', 'Huile tournesol 5L', '+ 13 autres'],
    ht: 412.80, ttc: 435.50, status: 'received',
    author: 'Sarah P.', paymentStatus: 'paid', invoiceId: 'FA-2026-0415',
  },
  {
    id: 'CMD-2609', sup: 'maree', date: '2026-04-20', deliveryDate: '2026-04-20',
    lines: 5, items: ['Homard breton vivant 8 pcs', 'Langoustines royales', 'Crabe tourteau', '+ 2 autres'],
    ht: 892.00, ttc: 941.00, status: 'received',
    author: 'Julien M.', paymentStatus: 'paid', invoiceId: 'FA-2026-0412',
  },
  {
    id: 'CMD-2608', sup: 'vin', date: '2026-04-19', deliveryDate: '2026-04-19',
    lines: 9, items: ['Châteauneuf-du-Pape 2020', 'Pouilly-Fumé 2022', 'Chablis Premier Cru', '+ 6 autres'],
    ht: 1456.80, ttc: 1748.15, status: 'received',
    author: 'Julien M.', paymentStatus: 'pending',
  },
  {
    id: 'CMD-2607', sup: 'epicerie', date: '2026-04-18', deliveryDate: null,
    lines: 11, items: ['Truffe noire 100g', 'Caviar osciètre', 'Safran Iran', '+ 8 autres'],
    ht: 1245.60, ttc: 1314.10, status: 'cancelled', cancelReason: 'Annulée par le fournisseur · rupture stock truffe',
    author: 'Julien M.', paymentStatus: 'none',
  },
  {
    id: 'CMD-2606', sup: 'terroir', date: '2026-04-17', deliveryDate: '2026-04-17',
    lines: 22, items: ['Tomates cœur de bœuf', 'Courgettes fleur', 'Aubergines violettes', '+ 19 autres'],
    ht: 498.40, ttc: 525.85, status: 'received',
    author: 'Sarah P.', paymentStatus: 'paid', invoiceId: 'FA-2026-0408',
  },
  {
    id: 'CMD-2605', sup: 'boucher', date: '2026-04-16', deliveryDate: '2026-04-16',
    lines: 6, items: ['Pigeon fermier × 12', 'Canard de Challans', 'Foie gras cru', '+ 3 autres'],
    ht: 687.20, ttc: 725.00, status: 'received',
    author: 'Julien M.', paymentStatus: 'paid', invoiceId: 'FA-2026-0405',
  },
  {
    id: 'CMD-2604', sup: 'halles', date: '2026-04-15', deliveryDate: '2026-04-15',
    lines: 14, items: ['Riz arborio 5 kg', 'Pâtes Gragnano', 'Couscous moyen', '+ 11 autres'],
    ht: 287.40, ttc: 303.20, status: 'received',
    author: 'Sarah P.', paymentStatus: 'paid', invoiceId: 'FA-2026-0402',
  },
  {
    id: 'CMD-2603', sup: 'maree', date: '2026-04-14', deliveryDate: null,
    lines: 3, items: ['Turbot sauvage entier', 'Saint-Pierre', '+ 1 autre'],
    ht: 348.00, ttc: 367.15, status: 'sent',
    author: 'Julien M.', paymentStatus: 'none',
  },
];

const OR_STATUS_MAP = {
  draft:     { label: 'Brouillon',    cls: 'draft',     icon: 'file-text' },
  sent:      { label: 'Envoyée',      cls: 'sent',      icon: 'send' },
  confirmed: { label: 'Confirmée',    cls: 'confirmed', icon: 'check' },
  preparing: { label: 'En préparation', cls: 'preparing', icon: 'loader' },
  shipped:   { label: 'En livraison', cls: 'shipped',   icon: 'truck', pulse: true },
  delivered: { label: 'Livrée',       cls: 'delivered', icon: 'inbox' },
  received:  { label: 'Réceptionnée', cls: 'received',  icon: 'check-circle' },
  dispute:   { label: 'Litige',       cls: 'dispute',   icon: 'alert-triangle' },
  cancelled: { label: 'Annulée',      cls: 'cancelled', icon: 'x-circle' },
};

const OR_PERIODS = [
  { id: '7d',  label: '7 jours' },
  { id: '30d', label: '30 jours', active: true },
  { id: 'month', label: 'Ce mois-ci' },
  { id: 'quarter', label: 'Trimestre' },
  { id: 'all', label: 'Tout' },
];

/* ============ PAGE ============ */
function OrdersPage({ onNav }) {
  const [query, setQuery] = useOR('');
  const [period, setPeriod] = useOR('30d');
  const [supFilter, setSupFilter] = useOR('all');
  const [statusFilter, setStatusFilter] = useOR('all');
  const [disputesOnly, setDisputesOnly] = useOR(false);
  const [amountMin, setAmountMin] = useOR('');
  const [amountMax, setAmountMax] = useOR('');
  const [sortBy, setSortBy] = useOR('date-desc');
  const [selectedIds, setSelectedIds] = useOR(new Set());
  const [drawerOrder, setDrawerOrder] = useOR(null);

  const filtered = useMOR(() => {
    let list = [...OR_ORDERS];
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(o =>
        o.id.toLowerCase().includes(q) ||
        o.items.some(it => it.toLowerCase().includes(q)) ||
        SUPPLIERS[o.sup].name.toLowerCase().includes(q)
      );
    }
    if (supFilter !== 'all') list = list.filter(o => o.sup === supFilter);
    if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter);
    if (disputesOnly) list = list.filter(o => o.status === 'dispute');
    if (amountMin) list = list.filter(o => o.ht >= parseFloat(amountMin));
    if (amountMax) list = list.filter(o => o.ht <= parseFloat(amountMax));

    if (sortBy === 'date-desc') list.sort((a,b) => b.date.localeCompare(a.date));
    else if (sortBy === 'date-asc') list.sort((a,b) => a.date.localeCompare(b.date));
    else if (sortBy === 'amount-desc') list.sort((a,b) => b.ht - a.ht);
    else if (sortBy === 'amount-asc') list.sort((a,b) => a.ht - b.ht);
    return list;
  }, [query, supFilter, statusFilter, disputesOnly, amountMin, amountMax, sortBy]);

  const supplierOptions = Object.values(SUPPLIERS);
  const statusOptions = Object.entries(OR_STATUS_MAP);

  const filterCount = (supFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0)
    + (disputesOnly ? 1 : 0) + (amountMin ? 1 : 0) + (amountMax ? 1 : 0);

  const resetFilters = () => {
    setSupFilter('all'); setStatusFilter('all'); setDisputesOnly(false);
    setAmountMin(''); setAmountMax('');
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    const today = new Date('2026-04-23');
    const diff = Math.round((today - d) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return 'Hier';
    if (diff < 7) return `Il y a ${diff} j`;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  const StatusPill = ({ status }) => {
    const s = OR_STATUS_MAP[status];
    return (
      <span className={'or-status-pill ' + s.cls}>
        <span className={'dot' + (s.pulse ? ' pulse' : '')} />
        {s.label}
      </span>
    );
  };

  return (
    <>
      <div className="content page-enter">
        <div className="page-header">
          <div>
            <h1 className="page-title">Mes commandes</h1>
            <div className="page-sub">{filtered.length} commande{filtered.length > 1 ? 's' : ''} · tri par {sortBy.includes('date') ? 'date' : 'montant'}</div>
          </div>
          <div className="page-actions">
            <button className="btn"><Icon name="download" />Exporter</button>
            <button className="btn primary" onClick={() => onNav && onNav('order')}>
              <Icon name="plus" />Nouvelle commande
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="or-filters">
          <div className="or-search">
            <Icon name="search" size={14} />
            <input
              placeholder="Rechercher par n° commande, produit, fournisseur…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && <button className="or-clear" onClick={() => setQuery('')}><Icon name="x" size={12} /></button>}
          </div>

          <select className="or-select" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {OR_PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>

          <select className="or-select" value={supFilter} onChange={(e) => setSupFilter(e.target.value)}>
            <option value="all">Tous fournisseurs</option>
            {supplierOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <select className="or-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Tous statuts</option>
            {statusOptions.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>

          <div className="or-amount-range">
            <Icon name="euro" size={12} />
            <input type="number" placeholder="min" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} />
            <span>—</span>
            <input type="number" placeholder="max" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} />
          </div>

          <button
            className={'or-toggle' + (disputesOnly ? ' active' : '')}
            onClick={() => setDisputesOnly(!disputesOnly)}
          >
            <Icon name="alert-triangle" size={12} />
            Litiges
          </button>

          {filterCount > 0 && (
            <button className="or-reset" onClick={resetFilters}>
              <Icon name="x" size={12} />Réinitialiser ({filterCount})
            </button>
          )}
        </div>

        {/* Table */}
        <div className="or-table">
          <div className="or-table-head">
            <span></span>
            <span className="sortable" onClick={() => setSortBy(sortBy === 'date-desc' ? 'date-asc' : 'date-desc')}>
              Date
              <Icon name={sortBy === 'date-desc' ? 'chevron-down' : sortBy === 'date-asc' ? 'chevron-up' : 'chevrons-up-down'} size={11} />
            </span>
            <span>Commande</span>
            <span>Fournisseur</span>
            <span>Produits</span>
            <span style={{ textAlign: 'right' }} className="sortable" onClick={() => setSortBy(sortBy === 'amount-desc' ? 'amount-asc' : 'amount-desc')}>
              Montant HT
              <Icon name={sortBy === 'amount-desc' ? 'chevron-down' : sortBy === 'amount-asc' ? 'chevron-up' : 'chevrons-up-down'} size={11} />
            </span>
            <span>Statut</span>
            <span></span>
          </div>
          {filtered.length === 0 && (
            <div className="or-empty">
              <Icon name="package" size={28} />
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 10 }}>Aucune commande</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Essaie de modifier les filtres ou la période.</div>
            </div>
          )}
          {filtered.map(o => {
            const sup = SUPPLIERS[o.sup];
            const initials = sup.short.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
            const selected = selectedIds.has(o.id);
            return (
              <div
                key={o.id}
                className={'or-row' + (drawerOrder?.id === o.id ? ' active' : '')}
                onClick={() => setDrawerOrder(o)}
              >
                <label className="or-check" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => {
                      const next = new Set(selectedIds);
                      e.target.checked ? next.add(o.id) : next.delete(o.id);
                      setSelectedIds(next);
                    }}
                  />
                </label>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{formatDate(o.date)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {new Date(o.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 600 }}>{o.id}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {o.lines} lignes · {o.author}
                  </div>
                </div>
                <div className="or-sup-cell">
                  <div className="or-sup-badge" style={{ background: sup.color }}>{initials}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{sup.short}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sup.delivery}</div>
                  </div>
                </div>
                <div className="or-items-cell">
                  <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.5 }}>
                    {o.items.slice(0, 2).join(' · ')}
                  </div>
                  {o.items.length > 2 && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {o.items[o.items.length - 1]}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 650, letterSpacing: '-0.01em' }}>
                    {o.ht.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {o.ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} TTC
                  </div>
                </div>
                <div>
                  <StatusPill status={o.status} />
                  {o.paymentStatus === 'paid' && (
                    <div style={{ fontSize: 10.5, color: 'var(--success)', fontWeight: 600, marginTop: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Icon name="check" size={10} />Payée
                    </div>
                  )}
                </div>
                <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setDrawerOrder(o); }}>
                  <Icon name="chevron-right" size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Drawer */}
      {drawerOrder && <OrderDrawer order={drawerOrder} onClose={() => setDrawerOrder(null)} onNav={onNav} />}
    </>
  );
}

/* ============ DRAWER ============ */
function OrderDrawer({ order, onClose, onNav }) {
  const sup = SUPPLIERS[order.sup];
  const initials = sup.short.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const status = OR_STATUS_MAP[order.status];

  // Timeline
  const now = order.status;
  const steps = ['sent', 'confirmed', 'shipped', 'received'];
  const currentIdx = status.cls === 'cancelled' ? -1 : steps.indexOf(now === 'dispute' ? 'received' : now);

  const formatFull = (iso) => iso ? new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  // Fake detailed lines (preview)
  const lines = order.items.slice(0, Math.min(5, order.lines)).map((name, i) => ({
    name,
    qty: [3, 4, 2, 8, 1][i % 5],
    unit: ['kg', 'kg', 'L', 'bt', 'pce'][i % 5],
    price: [48.50, 38.00, 12.80, 4.20, 28.00][i % 5],
  }));

  return (
    <>
      <div className="or-drawer-backdrop" onClick={onClose} />
      <div className="or-drawer">
        <div className="or-drawer-head">
          <button className="back-btn" onClick={onClose}><Icon name="x" size={16} /></button>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>{order.id}</div>
            <div style={{ fontSize: 17, fontWeight: 650, letterSpacing: '-0.01em' }}>{sup.name}</div>
          </div>
          <span className={'or-status-pill ' + status.cls}>
            <span className={'dot' + (status.pulse ? ' pulse' : '')} />
            {status.label}
          </span>
        </div>

        {/* Status banner */}
        {order.status === 'dispute' && (
          <div className="or-banner danger">
            <Icon name="alert-triangle" size={14} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 12.5 }}>Litige en cours</div>
              <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 1 }}>{order.dispute}</div>
            </div>
          </div>
        )}
        {order.status === 'cancelled' && (
          <div className="or-banner muted">
            <Icon name="x-circle" size={14} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 12.5 }}>Commande annulée</div>
              <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 1 }}>{order.cancelReason}</div>
            </div>
          </div>
        )}

        <div className="or-drawer-body">
          {/* Meta */}
          <div className="or-meta-grid">
            <div className="or-meta">
              <div className="lbl">Date commande</div>
              <div className="val">{formatFull(order.date)}</div>
            </div>
            <div className="or-meta">
              <div className="lbl">Livraison prévue</div>
              <div className="val">{formatFull(order.deliveryDate)}</div>
            </div>
            <div className="or-meta">
              <div className="lbl">Passée par</div>
              <div className="val">{order.author}</div>
            </div>
            <div className="or-meta">
              <div className="lbl">Paiement</div>
              <div className="val">
                {order.paymentStatus === 'paid' && <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ Payée</span>}
                {order.paymentStatus === 'pending' && <span style={{ color: 'var(--text-muted)' }}>En attente</span>}
                {order.paymentStatus === 'none' && <span style={{ color: 'var(--text-muted)' }}>—</span>}
              </div>
            </div>
          </div>

          {/* Lines preview */}
          <div style={{ marginTop: 18 }}>
            <div className="or-section-title">Lignes de commande · {order.lines}</div>
            <div className="or-lines-preview">
              {lines.map((l, i) => (
                <div key={i} className="or-line-row">
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 550 }}>{l.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                      {l.qty} {l.unit} × {l.price.toFixed(2)} €
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600 }}>
                    {(l.qty * l.price).toFixed(2)} €
                  </div>
                </div>
              ))}
              {order.lines > lines.length && (
                <div className="or-line-more">
                  + {order.lines - lines.length} autres lignes
                </div>
              )}
            </div>
          </div>

          {/* Totals */}
          <div className="or-totals">
            <div className="or-total-row">
              <span>Sous-total HT</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{order.ht.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
            </div>
            <div className="or-total-row">
              <span>TVA</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{(order.ttc - order.ht).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
            </div>
            <div className="or-total-row grand">
              <span>Total TTC</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{order.ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
            </div>
          </div>

          {/* Timeline */}
          {order.status !== 'cancelled' && (
            <div style={{ marginTop: 22 }}>
              <div className="or-section-title">Suivi</div>
              <div className="or-timeline">
                {steps.map((step, i) => {
                  const stepDef = OR_STATUS_MAP[step];
                  const done = i <= currentIdx;
                  const current = i === currentIdx;
                  return (
                    <div key={step} className={'or-timeline-step' + (done ? ' done' : '') + (current ? ' current' : '')}>
                      <div className="or-timeline-dot">
                        {done && <Icon name="check" size={10} />}
                      </div>
                      <div className="or-timeline-label">
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{stepDef.label}</div>
                        {current && (
                          <div style={{ fontSize: 10.5, color: 'var(--accent)', fontWeight: 600, marginTop: 1 }}>
                            En cours
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="or-drawer-actions">
          <button className="btn">
            <Icon name="download" />Bon de commande PDF
          </button>
          {order.invoiceId && (
            <button className="btn" onClick={() => onNav && onNav('invoices')}>
              <Icon name="file-text" />Voir la facture {order.invoiceId}
            </button>
          )}
          {order.status !== 'cancelled' && order.status !== 'dispute' && (
            <button className="btn" style={{ color: 'var(--danger)' }}>
              <Icon name="alert-triangle" />Signaler un litige
            </button>
          )}
        </div>
      </div>
    </>
  );
}

window.OrdersPage = OrdersPage;
