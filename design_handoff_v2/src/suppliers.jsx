// RestoPilot — Fournisseurs externes (annuaire + détail drawer)
const { useState: useSU, useMemo: useMSU } = React;

const SU_SUPPLIERS = [
  {
    id: 'halles', specialty: 'Grossiste généraliste',
    address: '12 rue des Halles · 69002 Lyon',
    tel: '04 72 33 18 40', email: 'contact@lyonhalles.fr',
    contact: { name: 'Mathilde Roux', role: 'Commerciale grand-est', tel: '06 21 33 45 12', email: 'm.roux@lyonhalles.fr' },
    ordersCount: 47, totalCA: 28450.60, avgCart: 605.33, lastOrder: '2026-04-23',
    ponctualite: 96, disputeRate: 2.1, priceIndex: -3, refs: 412,
    deliveryDays: 'Lun · Mer · Ven', hours: 'Avant 10h',
    minOrder: 150, franco: 400, payment: 'Virement 30j', paymentTrigger: 0.18,
  },
  {
    id: 'maree', specialty: 'Poissons & fruits de mer',
    address: '28 quai du Port · 35400 Saint-Malo',
    tel: '02 99 40 18 25', email: 'commandes@mareeatlantique.fr',
    contact: { name: 'Pierre-Yves Le Goff', role: 'Responsable comptes pro', tel: '06 82 14 29 77', email: 'py.legoff@mareeatlantique.fr' },
    ordersCount: 32, totalCA: 14320.80, avgCart: 447.53, lastOrder: '2026-04-23',
    ponctualite: 92, disputeRate: 4.8, priceIndex: 2, refs: 87,
    deliveryDays: 'Mar · Jeu · Sam', hours: 'Avant 6h',
    minOrder: 80, franco: 250, payment: 'Virement 15j', paymentTrigger: 0.12,
  },
  {
    id: 'terroir', specialty: 'Fruits, légumes & crémerie fermière',
    address: 'Ferme des Quatre Vents · 77120 Coulommiers',
    tel: '01 64 03 12 08', email: 'contact@terroirdirect.fr',
    contact: { name: 'Jean-Marc Dubreuil', role: 'Producteur-gérant', tel: '06 45 22 81 03', email: 'jm@terroirdirect.fr' },
    ordersCount: 64, totalCA: 22180.40, avgCart: 346.57, lastOrder: '2026-04-24',
    ponctualite: 98, disputeRate: 1.2, priceIndex: -1, refs: 156,
    deliveryDays: 'Mar · Jeu', hours: 'Entre 7h et 9h',
    minOrder: 100, franco: 300, payment: 'Virement 45j', paymentTrigger: 0.21,
  },
  {
    id: 'boucher', specialty: 'Viandes, gibier & charcuterie',
    address: '42 avenue du Bois · 33000 Bordeaux',
    tel: '05 56 81 42 19', email: 'pro@boucheriedumas.com',
    contact: { name: 'Franck Dumas', role: 'Gérant', tel: '06 07 18 44 92', email: 'f.dumas@boucheriedumas.com' },
    ordersCount: 38, totalCA: 31240.00, avgCart: 822.10, lastOrder: '2026-04-23',
    ponctualite: 94, disputeRate: 3.4, priceIndex: 5, refs: 94,
    deliveryDays: 'Mer · Sam', hours: 'Avant 11h',
    minOrder: 200, franco: 500, payment: 'Virement 30j', paymentTrigger: 0.22,
  },
  {
    id: 'vin', specialty: 'Vins, champagnes & spiritueux',
    address: '7 rue de Rivoli · 75001 Paris',
    tel: '01 42 60 85 33', email: 'orders@cavedessommeliers.fr',
    contact: { name: 'Élodie Chambert', role: 'Sommelière conseil', tel: '06 91 55 72 08', email: 'e.chambert@cavedessommeliers.fr' },
    ordersCount: 18, totalCA: 42180.00, avgCart: 2343.33, lastOrder: '2026-04-25',
    ponctualite: 100, disputeRate: 0, priceIndex: 0, refs: 284,
    deliveryDays: 'Sur RDV', hours: 'Journée',
    minOrder: 500, franco: 1500, payment: 'Virement 60j', paymentTrigger: 0.30,
  },
  {
    id: 'epicerie', specialty: 'Épicerie fine & produits de luxe',
    address: 'Rungis Pavillon D3 · 94150 Rungis',
    tel: '01 41 80 30 52', email: 'b2b@epiceriefinerungis.com',
    contact: { name: 'Sarah Benchaïb', role: 'Account manager', tel: '06 12 87 44 33', email: 's.benchaib@epiceriefinerungis.com' },
    ordersCount: 24, totalCA: 9840.20, avgCart: 410.00, lastOrder: '2026-04-24',
    ponctualite: 88, disputeRate: 6.2, priceIndex: 8, refs: 520,
    deliveryDays: 'Lun · Jeu', hours: 'Avant 10h',
    minOrder: 120, franco: 350, payment: 'CB immédiat', paymentTrigger: 0.07,
  },
];

function SuppliersPage({ onNav }) {
  const [query, setQuery] = useSU('');
  const [sortBy, setSortBy] = useSU('ca-desc');
  const [activeId, setActiveId] = useSU(null);

  const sorted = useMSU(() => {
    let list = [...SU_SUPPLIERS];
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(s =>
        SUPPLIERS[s.id].name.toLowerCase().includes(q) ||
        s.specialty.toLowerCase().includes(q)
      );
    }
    const by = {
      'ca-desc':   (a, b) => b.totalCA - a.totalCA,
      'orders-desc':(a, b) => b.ordersCount - a.ordersCount,
      'ponctualite-desc':(a, b) => b.ponctualite - a.ponctualite,
      'recent': (a, b) => b.lastOrder.localeCompare(a.lastOrder),
    };
    return list.sort(by[sortBy]);
  }, [query, sortBy]);

  const active = activeId ? SU_SUPPLIERS.find(s => s.id === activeId) : null;

  const totalCA = SU_SUPPLIERS.reduce((s, v) => s + v.totalCA, 0);
  const totalOrders = SU_SUPPLIERS.reduce((s, v) => s + v.ordersCount, 0);
  const avgPonctualite = (SU_SUPPLIERS.reduce((s, v) => s + v.ponctualite, 0) / SU_SUPPLIERS.length).toFixed(0);

  const formatDate = (iso) => {
    const d = new Date(iso);
    const today = new Date('2026-04-24');
    const diff = Math.round((today - d) / (1000 * 60 * 60 * 24));
    if (diff <= 0) return "À venir";
    if (diff === 1) return 'Hier';
    if (diff < 7) return `Il y a ${diff} j`;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  return (
    <>
      <div className="content page-enter">
        <div className="page-header">
          <div>
            <h1 className="page-title">Fournisseurs externes</h1>
            <div className="page-sub">{SU_SUPPLIERS.length} partenaires actifs · CA total achats 148 K€ cette année</div>
          </div>
          <div className="page-actions">
            <button className="btn"><Icon name="download" />Exporter</button>
            <button className="btn primary"><Icon name="plus" />Ajouter un fournisseur</button>
          </div>
        </div>

        {/* Top filter row */}
        <div className="or-filters">
          <div className="or-search">
            <Icon name="search" size={14} />
            <input placeholder="Rechercher fournisseur, spécialité, produit…" value={query} onChange={(e) => setQuery(e.target.value)} />
            {query && <button className="or-clear" onClick={() => setQuery('')}><Icon name="x" size={12} /></button>}
          </div>
          <select className="or-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="ca-desc">Tri : CA total ↓</option>
            <option value="orders-desc">Nb commandes ↓</option>
            <option value="ponctualite-desc">Ponctualité ↓</option>
            <option value="recent">Dernière commande</option>
          </select>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 18, padding: '0 8px', fontSize: 11.5 }}>
            <div>
              <div style={{ color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 9.5 }}>Commandes</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 650, fontSize: 13 }}>{totalOrders}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 9.5 }}>Ponctualité</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 650, fontSize: 13, color: 'var(--success)' }}>{avgPonctualite}%</div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="su-table">
          <div className="su-head">
            <span>Fournisseur</span>
            <span style={{ textAlign: 'center' }}>Commandes</span>
            <span style={{ textAlign: 'right' }}>CA total</span>
            <span style={{ textAlign: 'right' }}>Panier moyen</span>
            <span>Ponctualité</span>
            <span>Dernière cmd</span>
            <span style={{ textAlign: 'right' }}>Contact</span>
            <span></span>
          </div>
          {sorted.map(s => {
            const sup = SUPPLIERS[s.id];
            const initials = sup.short.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
            return (
              <div key={s.id} className={'su-row' + (activeId === s.id ? ' active' : '')} onClick={() => setActiveId(s.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="or-sup-badge" style={{ background: sup.color, width: 36, height: 36, fontSize: 13 }}>{initials}</div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{sup.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>{s.specialty}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13 }}>{s.ordersCount}</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 650, fontSize: 13.5, letterSpacing: '-0.01em' }}>
                    {s.totalCA.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                    {((s.totalCA / totalCA) * 100).toFixed(1)}% du total
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--text-muted)' }}>
                  {s.avgCart.toFixed(0)} €
                </div>
                <div className="su-ponctualite">
                  <div className="bar">
                    <div className={'fill ' + (s.ponctualite >= 95 ? 'good' : s.ponctualite >= 88 ? 'ok' : 'low')} style={{ width: s.ponctualite + '%' }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 600 }}>{s.ponctualite}%</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDate(s.lastOrder)}</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12.5, fontWeight: 550 }}>{s.contact.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.contact.role}</div>
                </div>
                <button className="icon-btn" onClick={(e) => { e.stopPropagation(); setActiveId(s.id); }}>
                  <Icon name="chevron-right" size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {active && <SupplierDrawer supplier={active} onClose={() => setActiveId(null)} onNav={onNav} />}
    </>
  );
}

function SupplierDrawer({ supplier, onClose, onNav }) {
  const sup = SUPPLIERS[supplier.id];
  const initials = sup.short.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  // monthly CA mini chart
  const monthly = [1820, 2140, 1980, 2460, 2180, 2620, 2890, 2180, 2340, 2780, 2960, 2640];
  const maxM = Math.max(...monthly);

  // last orders
  const lastOrders = [
    { id: 'CMD-2614', date: '2026-04-23', ht: 579.96, status: 'shipped' },
    { id: 'CMD-2601', date: '2026-04-16', ht: 612.40, status: 'received' },
    { id: 'CMD-2589', date: '2026-04-09', ht: 498.20, status: 'received' },
    { id: 'CMD-2574', date: '2026-04-02', ht: 672.15, status: 'received' },
  ];

  return (
    <>
      <div className="or-drawer-backdrop" onClick={onClose} />
      <div className="or-drawer" style={{ width: 560 }}>
        <div className="or-drawer-head" style={{ alignItems: 'flex-start', padding: '18px' }}>
          <button className="back-btn" onClick={onClose}><Icon name="x" size={16} /></button>
          <div className="or-sup-badge" style={{ background: sup.color, width: 44, height: 44, fontSize: 15, borderRadius: 10 }}>{initials}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 650, letterSpacing: '-0.01em' }}>{sup.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{supplier.specialty} · partenaire depuis 2022</div>
          </div>
          <button className="btn primary sm" onClick={() => onNav && onNav('order')}>
            <Icon name="shopping-cart" size={13} />Commander
          </button>
        </div>

        <div className="or-drawer-body">
          {/* Key numbers */}
          <div className="su-kpi-row">
            <div className="su-kpi">
              <div className="lbl">Commandes</div>
              <div className="val">{supplier.ordersCount}</div>
              <div className="sub">sur 12 mois</div>
            </div>
            <div className="su-kpi">
              <div className="lbl">CA total</div>
              <div className="val">{(supplier.totalCA / 1000).toFixed(1)}<span style={{ fontSize: 15, color: 'var(--text-muted)' }}>k€</span></div>
              <div className="sub">HT</div>
            </div>
            <div className="su-kpi">
              <div className="lbl">Panier moyen</div>
              <div className="val">{supplier.avgCart.toFixed(0)}<span style={{ fontSize: 15, color: 'var(--text-muted)' }}>€</span></div>
              <div className="sub">par commande</div>
            </div>
          </div>

          {/* CA chart */}
          <div style={{ marginTop: 18 }}>
            <div className="or-section-title">Évolution CA · 12 derniers mois</div>
            <div className="su-chart">
              {monthly.map((v, i) => (
                <div key={i} className="su-bar-wrap">
                  <div className="su-bar" style={{ height: (v / maxM * 100) + '%', background: sup.color }} title={v + ' €'} />
                </div>
              ))}
            </div>
            <div className="su-chart-labels">
              <span>mai</span><span>juin</span><span>juil.</span><span>août</span>
              <span>sept.</span><span>oct.</span><span>nov.</span><span>déc.</span>
              <span>janv.</span><span>févr.</span><span>mars</span><span>avr.</span>
            </div>
          </div>

          {/* Contact */}
          <div style={{ marginTop: 22 }}>
            <div className="or-section-title">Coordonnées</div>
            <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <div className="su-info-lbl"><Icon name="map-pin" size={11} />Adresse</div>
                  <div className="su-info-val">{supplier.address}</div>
                </div>
                <div>
                  <div className="su-info-lbl"><Icon name="phone" size={11} />Téléphone</div>
                  <div className="su-info-val" style={{ fontFamily: 'var(--font-mono)' }}>{supplier.tel}</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div className="su-info-lbl"><Icon name="mail" size={11} />Email commandes</div>
                  <div className="su-info-val">{supplier.email}</div>
                </div>
              </div>

              {/* Commercial attitré */}
              <div style={{ padding: '12px 14px', background: 'var(--bg-subtle)', borderRadius: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', background: sup.color, opacity: 0.9,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 650, fontSize: 14, fontFamily: 'var(--font-mono)',
                }}>
                  {supplier.contact.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{supplier.contact.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{supplier.contact.role}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 3, display: 'flex', gap: 10 }}>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{supplier.contact.tel}</span>
                    <span>·</span>
                    <span>{supplier.contact.email}</span>
                  </div>
                </div>
                <button className="icon-btn" title="Appeler"><Icon name="phone" size={13} /></button>
                <button className="icon-btn" title="Email"><Icon name="mail" size={13} /></button>
              </div>
            </div>
          </div>

          {/* Derniers achats */}
          <div style={{ marginTop: 22 }}>
            <div className="or-section-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Dernières commandes</span>
              <button style={{ border: 0, background: 'transparent', color: 'var(--accent)', fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'none', letterSpacing: 0 }} onClick={() => onNav && onNav('orders')}>
                Voir tout →
              </button>
            </div>
            <div className="or-lines-preview">
              {lastOrders.map(o => (
                <div key={o.id} className="or-line-row" style={{ cursor: 'pointer' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 600 }}>{o.id}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {new Date(o.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={'or-status-pill ' + o.status}>{OR_STATUS_MAP[o.status].label}</span>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13, minWidth: 70, textAlign: 'right' }}>
                      {o.ht.toFixed(2)} €
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

window.SuppliersPage = SuppliersPage;
