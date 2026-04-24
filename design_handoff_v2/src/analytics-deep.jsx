// RestoPilot — Historique achats + Analyse des prix + Budget
const { useState: useStateAD, useMemo: useMemoAD } = React;

/* ================================================================
   HISTORIQUE DES ACHATS
   ================================================================ */
const PH_MONTHLY = [
  { m: 'Nov', v: 18240 }, { m: 'Déc', v: 22180 }, { m: 'Jan', v: 16420 },
  { m: 'Fév', v: 17890 }, { m: 'Mar', v: 19620 }, { m: 'Avr', v: 14820 },
];
const PH_ORDERS = [
  { date: '22 avr', id: 'CMD-2614', sup: 'halles', items: 18, ht: 579.96, ttc: 612.40, status: 'delivered' },
  { date: '22 avr', id: 'CMD-2613', sup: 'maree',   items: 6,  ht: 269.15, ttc: 284.00, status: 'shipping' },
  { date: '21 avr', id: 'CMD-2612', sup: 'terroir', items: 24, ht: 472.08, ttc: 498.20, status: 'delivered' },
  { date: '21 avr', id: 'CMD-2611', sup: 'boucher', items: 8,  ht: 798.86, ttc: 842.60, status: 'delivered' },
  { date: '20 avr', id: 'CMD-2610', sup: 'vin',     items: 12, ht: 2033.33, ttc: 1240.00, status: 'delivered' },
  { date: '19 avr', id: 'CMD-2609', sup: 'epicerie',items: 14, ht: 324.80, ttc: 342.65, status: 'delivered' },
  { date: '18 avr', id: 'CMD-2608', sup: 'halles',  items: 22, ht: 712.40, ttc: 751.58, status: 'delivered' },
  { date: '18 avr', id: 'CMD-2607', sup: 'maree',   items: 4,  ht: 186.00, ttc: 196.23, status: 'delivered' },
  { date: '16 avr', id: 'CMD-2606', sup: 'terroir', items: 16, ht: 284.00, ttc: 299.72, status: 'delivered' },
  { date: '15 avr', id: 'CMD-2605', sup: 'boucher', items: 6,  ht: 412.00, ttc: 434.67, status: 'delivered' },
  { date: '14 avr', id: 'CMD-2604', sup: 'halles',  items: 19, ht: 589.20, ttc: 621.61, status: 'delivered' },
  { date: '12 avr', id: 'CMD-2603', sup: 'epicerie',items: 9,  ht: 218.40, ttc: 230.41, status: 'delivered' },
];

function PurchaseHistoryPage({ onNav }) {
  const [sup, setSup] = useStateAD('all');
  const [range, setRange] = useStateAD('30j');
  const maxM = Math.max(...PH_MONTHLY.map(d => d.v));
  const filtered = sup === 'all' ? PH_ORDERS : PH_ORDERS.filter(o => o.sup === sup);
  const totalHT = filtered.reduce((a,b) => a + b.ht, 0);
  const totalTTC = filtered.reduce((a,b) => a + b.ttc, 0);
  const avgOrder = totalTTC / (filtered.length || 1);

  // supplier breakdown
  const supBreakdown = Object.keys(SUPPLIERS).map(id => {
    const orders = PH_ORDERS.filter(o => o.sup === id);
    const total = orders.reduce((a,b) => a + b.ttc, 0);
    return { id, name: SUPPLIERS[id].short, color: SUPPLIERS[id].color, count: orders.length, total };
  }).filter(s => s.count > 0).sort((a,b) => b.total - a.total);
  const supMax = supBreakdown[0]?.total || 1;

  return (
    <div className="content page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Historique des achats</h1>
          <div className="page-sub">Toutes les commandes passées · 12 derniers mois</div>
        </div>
        <div className="page-actions">
          <div className="seg">
            <button className={range==='7j'?'active':''} onClick={()=>setRange('7j')}>7 jours</button>
            <button className={range==='30j'?'active':''} onClick={()=>setRange('30j')}>30 jours</button>
            <button className={range==='12m'?'active':''} onClick={()=>setRange('12m')}>12 mois</button>
            <button className={range==='ytd'?'active':''} onClick={()=>setRange('ytd')}>YTD</button>
          </div>
          <button className="btn"><Icon name="download" />Exporter CSV</button>
        </div>
      </div>

      {/* Top row: chart + 2 KPIs */}
      <div className="ph-head-grid">
        <div className="ph-chart-card">
          <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Volume d'achats mensuel</div>
            <span className="badge" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
              −24% vs mois dernier
            </span>
            <div className="ml-auto flex gap-1" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
              <span className="dot" style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent)', display: 'inline-block' }} /> HT
            </div>
          </div>
          <svg viewBox="0 0 600 140" style={{ width: '100%', height: 140 }}>
            {[0, 0.25, 0.5, 0.75, 1].map((p,i) => (
              <line key={i} x1="0" x2="600" y1={20 + p*100} y2={20 + p*100}
                    stroke="var(--border)" strokeDasharray={p===0||p===1?'':'2,3'} strokeWidth="1" />
            ))}
            {PH_MONTHLY.map((d,i) => {
              const x = 30 + i * 100;
              const h = (d.v / maxM) * 100;
              const y = 120 - h;
              return (
                <g key={i}>
                  <rect x={x-22} y={y} width="44" height={h} rx="3"
                        fill={i === PH_MONTHLY.length-1 ? 'var(--accent)' : 'var(--accent-soft)'} />
                  <text x={x} y="135" textAnchor="middle" fontSize="10" fill="var(--text-muted)" fontFamily="var(--font-mono)">{d.m}</text>
                  <text x={x} y={y-4} textAnchor="middle" fontSize="10.5" fill="var(--text)" fontWeight="600" fontFamily="var(--font-mono)">
                    {(d.v/1000).toFixed(1)}k
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="ph-chart-card">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 550, marginBottom: 6 }}>Total achats HT · 30j</div>
          <div style={{ fontSize: 26, fontWeight: 650, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>
            {totalHT.toLocaleString('fr-FR', {maximumFractionDigits: 0})} €
          </div>
          <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 4, fontWeight: 550 }}>
            <Icon name="trending-down" size={12} style={{ verticalAlign: -1, marginRight: 3 }} />
            −18.2% vs période précédente
          </div>
          <div style={{ height: 1, background: 'var(--border)', margin: '14px 0 10px' }} />
          <div className="flex justify-between" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            <span>Panier moyen</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', fontWeight: 600 }}>
              {avgOrder.toFixed(0)} €
            </span>
          </div>
          <div className="flex justify-between" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            <span>Commandes</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', fontWeight: 600 }}>{filtered.length}</span>
          </div>
          <div className="flex justify-between" style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
            <span>Jours avec commande</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text)', fontWeight: 600 }}>18 / 30</span>
          </div>
        </div>
        <div className="ph-chart-card">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 550, marginBottom: 10 }}>Répartition fournisseurs</div>
          {supBreakdown.slice(0, 5).map(s => (
            <div key={s.id} style={{ marginBottom: 9 }}>
              <div className="flex justify-between" style={{ fontSize: 11.5, marginBottom: 3 }}>
                <span style={{ color: 'var(--text)', fontWeight: 550 }}>{s.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {s.total.toFixed(0)} €
                </span>
              </div>
              <div style={{ height: 6, background: 'var(--bg-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${(s.total/supMax)*100}%`,
                  background: s.color, borderRadius: 3, transition: 'width 0.4s',
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="card-body" style={{ padding: '12px 14px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className={'chip' + (sup==='all'?' active':'')} onClick={()=>setSup('all')}>
            Tous les fournisseurs <span style={{ color: 'var(--text-subtle)', marginLeft: 4 }}>· {PH_ORDERS.length}</span>
          </button>
          {Object.keys(SUPPLIERS).map(id => {
            const count = PH_ORDERS.filter(o => o.sup === id).length;
            if (count === 0) return null;
            return (
              <button key={id} className={'chip' + (sup===id?' active':'')} onClick={()=>setSup(id)}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: SUPPLIERS[id].color, display: 'inline-block', marginRight: 6 }} />
                {SUPPLIERS[id].short} <span style={{ color: 'var(--text-subtle)', marginLeft: 4 }}>· {count}</span>
              </button>
            );
          })}
          <div className="ml-auto flex gap-2">
            <button className="btn sm"><Icon name="filter" size={13} />Plus de filtres</button>
          </div>
        </div>
      </div>

      {/* Timeline table */}
      <div className="card">
        <div className="card-header" style={{ paddingBottom: 10 }}>
          <div>
            <div className="card-title">Toutes les commandes</div>
            <div className="card-sub">{filtered.length} commande{filtered.length>1?'s':''} · triées par date décroissante</div>
          </div>
          <div className="ml-auto">
            <button className="btn sm"><Icon name="arrow-down-up" size={13} />Trier</button>
          </div>
        </div>
        <div className="ph-timeline" style={{ background: 'var(--bg-subtle)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <span>Date</span><span>Fournisseur / N°</span><span>Lignes</span><span>HT</span><span>TTC</span><span>Statut</span><span></span>
        </div>
        {filtered.map((o,i) => (
          <div key={i} className="ph-timeline">
            <span className="ph-date">{o.date}</span>
            <div>
              <div className="ph-sup-chip" style={{ background: SUPPLIERS[o.sup].color + '18', color: SUPPLIERS[o.sup].color }}>
                <span className="dot" style={{ background: SUPPLIERS[o.sup].color }} />
                {SUPPLIERS[o.sup].short}
              </div>
              <span style={{ marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-subtle)' }}>{o.id}</span>
            </div>
            <span style={{ color: 'var(--text-muted)' }}>{o.items} lignes</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{o.ht.toFixed(2)} €</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{o.ttc.toFixed(2)} €</span>
            <span>
              {o.status === 'delivered' && <span className="badge" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>Livrée</span>}
              {o.status === 'shipping' && <span className="badge" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>En livraison</span>}
              {o.status === 'pending' && <span className="badge" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>En attente</span>}
            </span>
            <button className="icon-btn" style={{ width: 28, height: 28 }}><Icon name="chevron-right" size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   ANALYSE DES PRIX
   ================================================================ */
const PRICE_ITEMS = [
  { name: 'Saint-Jacques fraîches', unit: 'kg', cat: 'Poissons',
    m1: 52.40, m6: 48.90, now: 54.80, y1: 46.20,
    suppliers: [
      { id: 'maree',    p: 54.80, variation: 5.6, best: true },
      { id: 'halles',   p: 58.20, variation: 2.1 },
      { id: 'epicerie', p: 62.00, variation: -1.2 },
    ],
    spark: [48, 50, 49, 51, 52, 53, 54, 55, 54, 53, 54, 55],
  },
  { name: 'Filet de bœuf Limousin', unit: 'kg', cat: 'Viandes',
    m1: 47.60, m6: 45.80, now: 48.90, y1: 43.20,
    suppliers: [
      { id: 'boucher', p: 48.90, variation: 2.7, best: true },
      { id: 'terroir', p: 51.20, variation: 4.1 },
      { id: 'halles',  p: 52.40, variation: 1.5 },
    ],
    spark: [44, 45, 46, 46, 47, 47, 48, 48, 49, 49, 48, 49],
  },
  { name: 'Beurre AOP Charentes', unit: 'kg', cat: 'Crémerie',
    m1: 11.80, m6: 11.40, now: 12.60, y1: 10.80,
    suppliers: [
      { id: 'halles',   p: 12.60, variation: 6.8, best: true },
      { id: 'terroir',  p: 13.20, variation: 3.9 },
      { id: 'epicerie', p: 14.10, variation: 8.5, alert: true },
    ],
    spark: [10, 10.5, 11, 11.2, 11.4, 11.6, 11.8, 12, 12.2, 12.4, 12.5, 12.6],
  },
  { name: 'Asperges blanches bio', unit: 'kg', cat: 'Légumes',
    m1: 8.20, m6: 12.40, now: 7.40, y1: 9.60,
    suppliers: [
      { id: 'terroir', p: 7.40, variation: -9.8, best: true, promo: true },
      { id: 'halles',  p: 8.20, variation: -6.2 },
    ],
    spark: [12, 11.5, 11, 10, 9.5, 9, 8.5, 8.2, 8, 7.8, 7.5, 7.4],
  },
  { name: 'Homard breton vivant', unit: 'pièce', cat: 'Poissons',
    m1: 34.00, m6: 32.50, now: 36.00, y1: 30.00,
    suppliers: [
      { id: 'maree',  p: 36.00, variation: 5.9, best: true },
      { id: 'halles', p: 39.50, variation: 4.2 },
    ],
    spark: [30, 31, 32, 33, 33, 34, 34, 35, 35, 36, 36, 36],
  },
  { name: 'Huile d\'olive Taggiasca', unit: 'L', cat: 'Épicerie',
    m1: 17.80, m6: 16.40, now: 18.40, y1: 15.20,
    suppliers: [
      { id: 'epicerie', p: 18.40, variation: 3.4, best: true },
      { id: 'halles',   p: 19.80, variation: 2.1 },
    ],
    spark: [15, 15.5, 16, 16.4, 16.8, 17, 17.4, 17.8, 18, 18.2, 18.4, 18.4],
  },
  { name: 'Œufs bio fermiers (180)', unit: 'plateau', cat: 'Crémerie',
    m1: 31.50, m6: 30.00, now: 32.00, y1: 28.50,
    suppliers: [
      { id: 'terroir', p: 32.00, variation: 1.6, best: true },
      { id: 'halles',  p: 34.50, variation: 3.0 },
    ],
    spark: [28, 29, 29, 30, 30, 31, 31, 31, 31.5, 32, 32, 32],
  },
  { name: 'Truffe noire Périgord', unit: '100g', cat: 'Légumes',
    m1: 92.00, m6: 105.00, now: 98.00, y1: 85.00,
    suppliers: [
      { id: 'terroir',  p: 98.00, variation: 6.5, best: true },
      { id: 'epicerie', p: 112.00, variation: -1.8, alert: true },
    ],
    spark: [85, 90, 95, 100, 105, 104, 100, 98, 96, 98, 98, 98],
  },
];

function Sparkline({ data, color, height = 40, stroke = 1.8 }) {
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const w = 160;
  const h = height;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 8) - 4;
    return `${x},${y}`;
  }).join(' ');
  const area = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height, display: 'block' }} preserveAspectRatio="none">
      <polygon points={area} fill={color} opacity="0.12" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(w * (data.length-1) / (data.length-1))} cy={h - ((data[data.length-1] - min) / range) * (h - 8) - 4} r="2.5" fill={color} />
    </svg>
  );
}

function PriceAnalysisPage({ onNav }) {
  const [selected, setSelected] = useStateAD(PRICE_ITEMS[0]);
  const [cat, setCat] = useStateAD('all');
  const filtered = cat === 'all' ? PRICE_ITEMS : PRICE_ITEMS.filter(p => p.cat === cat);

  const rising = PRICE_ITEMS.filter(p => p.now > p.m1).length;
  const falling = PRICE_ITEMS.filter(p => p.now < p.m1).length;
  const avgInflation = (PRICE_ITEMS.reduce((a,p) => a + ((p.now - p.y1)/p.y1)*100, 0) / PRICE_ITEMS.length);

  return (
    <div className="content page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analyse des prix</h1>
          <div className="page-sub">Suivi des variations · {PRICE_ITEMS.length} produits surveillés · màj il y a 12 min</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="bell" />Alertes prix (3)</button>
          <button className="btn primary"><Icon name="download" />Rapport mensuel</button>
        </div>
      </div>

      {/* Top price KPI row */}
      <div className="price-trend-grid">
        <div className="price-card">
          <div className="title">
            <Icon name="trending-up" size={14} style={{ color: 'var(--danger)' }} />
            Produits en hausse (30j)
          </div>
          <div className="flex items-end gap-3">
            <div style={{ fontSize: 32, fontWeight: 650, fontFamily: 'var(--font-mono)', color: 'var(--danger)', letterSpacing: '-0.02em' }}>{rising}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingBottom: 8 }}>sur {PRICE_ITEMS.length} produits</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Inflation moyenne sur 12 mois :
            <b style={{ color: 'var(--danger)', fontFamily: 'var(--font-mono)', marginLeft: 4 }}>+{avgInflation.toFixed(1)}%</b>
          </div>
        </div>
        <div className="price-card">
          <div className="title">
            <Icon name="trending-down" size={14} style={{ color: 'var(--success)' }} />
            Produits en baisse (30j)
          </div>
          <div className="flex items-end gap-3">
            <div style={{ fontSize: 32, fontWeight: 650, fontFamily: 'var(--font-mono)', color: 'var(--success)', letterSpacing: '-0.02em' }}>{falling}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', paddingBottom: 8 }}>dont asperges et truffe</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Économies estimées ce mois :
            <b style={{ color: 'var(--success)', fontFamily: 'var(--font-mono)', marginLeft: 4 }}>+284 €</b>
          </div>
        </div>
      </div>

      {/* Selected product detail */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <div className="card-title">{selected.name}</div>
            <div className="card-sub">{selected.cat} · prix au {selected.unit} · historique 12 mois</div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 550 }}>Prix actuel</div>
              <div style={{ fontSize: 22, fontWeight: 650, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>
                {selected.now.toFixed(2)} €
              </div>
            </div>
            <span className={'price-delta-pill ' + (selected.now > selected.m1 ? 'up' : 'down')}>
              <Icon name={selected.now > selected.m1 ? 'trending-up' : 'trending-down'} size={11} />
              {(((selected.now - selected.m1)/selected.m1)*100).toFixed(1)}% vs 30j
            </span>
          </div>
        </div>
        <div className="card-body" style={{ padding: '14px 20px 18px', display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20, alignItems: 'center' }}>
          <div>
            <svg viewBox="0 0 600 180" style={{ width: '100%', height: 180 }}>
              {[0, 0.25, 0.5, 0.75, 1].map((p,i) => (
                <line key={i} x1="40" x2="580" y1={20 + p*130} y2={20 + p*130}
                      stroke="var(--border)" strokeDasharray={p===0||p===1?'':'2,3'} />
              ))}
              {(() => {
                const min = Math.min(...selected.spark) * 0.95;
                const max = Math.max(...selected.spark) * 1.05;
                const range = max - min;
                const pts = selected.spark.map((v,i) => {
                  const x = 40 + (i / (selected.spark.length-1)) * 540;
                  const y = 20 + 130 - ((v - min) / range) * 130;
                  return `${x},${y}`;
                }).join(' ');
                const area = `40,150 ${pts} 580,150`;
                return (
                  <>
                    <polygon points={area} fill="var(--accent)" opacity="0.1" />
                    <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    {selected.spark.map((v,i) => {
                      const x = 40 + (i / (selected.spark.length-1)) * 540;
                      const y = 20 + 130 - ((v - min) / range) * 130;
                      return <circle key={i} cx={x} cy={y} r={i === selected.spark.length-1 ? 4 : 2.5}
                                     fill={i === selected.spark.length-1 ? 'var(--accent)' : 'white'}
                                     stroke="var(--accent)" strokeWidth="1.5" />;
                    })}
                    <text x="40" y="14" fontSize="10" fill="var(--text-muted)" fontFamily="var(--font-mono)">{max.toFixed(1)} €</text>
                    <text x="40" y="168" fontSize="10" fill="var(--text-muted)" fontFamily="var(--font-mono)">{min.toFixed(1)} €</text>
                  </>
                );
              })()}
              {['M-11','M-9','M-7','M-5','M-3','M-1','Auj.'].map((l, i) => (
                <text key={i} x={40 + (i/6)*540} y="170" fontSize="9.5" fill="var(--text-subtle)" textAnchor="middle" fontFamily="var(--font-mono)">{l}</text>
              ))}
            </svg>
          </div>
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                ['Il y a 1 an', selected.y1, ((selected.now - selected.y1)/selected.y1*100)],
                ['Il y a 6 mois', selected.m6, ((selected.now - selected.m6)/selected.m6*100)],
                ['Il y a 1 mois', selected.m1, ((selected.now - selected.m1)/selected.m1*100)],
                ['Meilleur fourn.', selected.suppliers.find(s=>s.best).p, 0, selected.suppliers.find(s=>s.best).id],
              ].map(([label, val, pct, supId], i) => (
                <div key={i} style={{ background: 'var(--bg-subtle)', padding: '10px 12px', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 550 }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 650, fontFamily: 'var(--font-mono)', marginTop: 2, letterSpacing: '-0.01em' }}>
                    {val.toFixed(2)} €
                  </div>
                  {i < 3 && (
                    <div style={{ fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)', color: pct > 0 ? 'var(--danger)' : pct < 0 ? 'var(--success)' : 'var(--text-muted)', marginTop: 2 }}>
                      {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                    </div>
                  )}
                  {i === 3 && supId && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: SUPPLIERS[supId].color, marginTop: 2 }}>
                      {SUPPLIERS[supId].short}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Products comparison */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Comparateur multi-produits</div>
            <div className="card-sub">Cliquez sur un produit pour afficher son détail ci-dessus</div>
          </div>
          <div className="ml-auto flex gap-1">
            {['all','Poissons','Viandes','Légumes','Crémerie','Épicerie'].map(c => (
              <button key={c} className={'chip sm' + (cat===c?' active':'')} onClick={()=>setCat(c)}>
                {c === 'all' ? 'Tous' : c}
              </button>
            ))}
          </div>
        </div>
        <div className="price-row-compare" style={{ background: 'var(--bg-subtle)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <span>Produit</span>
          <span style={{ textAlign: 'right' }}>Prix actuel</span>
          <span style={{ textAlign: 'right' }}>vs 30j</span>
          <span style={{ textAlign: 'right' }}>vs 1 an</span>
          <span>12 mois</span>
          <span></span>
        </div>
        {filtered.map((p,i) => {
          const d30 = ((p.now - p.m1)/p.m1)*100;
          const d1y = ((p.now - p.y1)/p.y1)*100;
          const isSelected = selected.name === p.name;
          return (
            <div key={i} className="price-row-compare" style={{ background: isSelected ? 'var(--accent-soft)' : undefined, cursor: 'pointer' }} onClick={()=>setSelected(p)}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>
                  {p.cat} · {p.suppliers.length} fourn.
                </div>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 650, textAlign: 'right' }}>{p.now.toFixed(2)} €</span>
              <span style={{ textAlign: 'right' }}>
                <span className={'price-delta-pill ' + (d30 > 0.5 ? 'up' : d30 < -0.5 ? 'down' : 'flat')}>
                  {d30 > 0 ? '+' : ''}{d30.toFixed(1)}%
                </span>
              </span>
              <span style={{ textAlign: 'right' }}>
                <span className={'price-delta-pill ' + (d1y > 0.5 ? 'up' : d1y < -0.5 ? 'down' : 'flat')}>
                  {d1y > 0 ? '+' : ''}{d1y.toFixed(1)}%
                </span>
              </span>
              <span style={{ width: 130 }}>
                <Sparkline data={p.spark} color={d30 > 0 ? 'var(--danger)' : 'var(--success)'} height={30} />
              </span>
              <button className="icon-btn" style={{ width: 26, height: 26 }} onClick={(e)=>{e.stopPropagation(); setSelected(p);}}>
                <Icon name="chevron-right" size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================================================================
   BUDGET
   ================================================================ */
const BUDGET_CATEGORIES = [
  { id: 'food',   name: 'Matière première',    budget: 18000, spent: 14820, icon: 'chef-hat',       color: '#6366F1' },
  { id: 'drink',  name: 'Boissons & vins',     budget: 6000,  spent: 5840,  icon: 'wine',            color: '#8B5CF6' },
  { id: 'staff',  name: 'Masse salariale',     budget: 22000, spent: 22340, icon: 'users',           color: '#EF4444' },
  { id: 'rent',   name: 'Loyer & charges',     budget: 4800,  spent: 4800,  icon: 'home',            color: '#10B981' },
  { id: 'energy', name: 'Énergie',             budget: 1400,  spent: 1120,  icon: 'zap',             color: '#F59E0B' },
  { id: 'market', name: 'Marketing & com',     budget: 1200,  spent: 680,   icon: 'megaphone',       color: '#0EA5E9' },
  { id: 'maint',  name: 'Maintenance',         budget: 800,   spent: 340,   icon: 'wrench',          color: '#64748B' },
];

const BUDGET_YEAR = [
  { m: 'Jan', b: 54200, s: 51820 },
  { m: 'Fév', b: 54200, s: 49680 },
  { m: 'Mar', b: 54200, s: 53400 },
  { m: 'Avr', b: 54200, s: 49940 },  // current
  { m: 'Mai', b: 54200 },
  { m: 'Jui', b: 54200 },
  { m: 'Jul', b: 54200 },
  { m: 'Aoû', b: 42000 },  // closed in august
  { m: 'Sep', b: 54200 },
  { m: 'Oct', b: 54200 },
  { m: 'Nov', b: 54200 },
  { m: 'Déc', b: 58000 },
];

function BudgetPage({ onNav }) {
  const [showEditor, setShowEditor] = useStateAD(false);
  const totalBudget = BUDGET_CATEGORIES.reduce((a,b) => a + b.budget, 0);
  const totalSpent = BUDGET_CATEGORIES.reduce((a,b) => a + b.spent, 0);
  const pct = (totalSpent / totalBudget) * 100;
  const remaining = totalBudget - totalSpent;
  const daysLeft = 8;

  return (
    <div className="content page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Budget</h1>
          <div className="page-sub">Avril 2026 · {daysLeft} jours restants dans le mois</div>
        </div>
        <div className="page-actions">
          <div className="seg">
            <button>Mois</button>
            <button className="active">Avril 2026</button>
            <button><Icon name="chevron-right" size={13} /></button>
          </div>
          <button className="btn" onClick={() => setShowEditor(true)}><Icon name="settings" />Ajuster les budgets</button>
          <button className="btn primary"><Icon name="download" />Rapport</button>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="budget-grid">
        <div className="ph-chart-card" style={{ background: 'var(--text)', color: 'white', border: 'none', position: 'relative', overflow: 'hidden' }}>
          <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 550 }}>Consommé ce mois</div>
          <div style={{ fontSize: 30, fontWeight: 650, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em', marginTop: 4 }}>
            {totalSpent.toLocaleString('fr-FR')} €
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
            sur {totalBudget.toLocaleString('fr-FR')} € budgétés · <b>{pct.toFixed(1)}%</b>
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 5, background: 'rgba(255,255,255,0.15)' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct > 95 ? '#F59E0B' : 'white', transition: 'width 0.5s' }} />
          </div>
        </div>
        <div className="ph-chart-card">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 550 }}>Reste à dépenser</div>
          <div style={{ fontSize: 30, fontWeight: 650, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em', marginTop: 4, color: remaining >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {remaining >= 0 ? '+' : ''}{remaining.toLocaleString('fr-FR')} €
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {daysLeft} jours restants · ~{Math.round(Math.abs(remaining)/daysLeft)} €/jour
          </div>
        </div>
        <div className="ph-chart-card">
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 550 }}>Rythme de dépense</div>
          <div style={{ fontSize: 30, fontWeight: 650, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em', marginTop: 4 }}>
            <Icon name="trending-up" size={20} style={{ verticalAlign: -3, color: 'var(--warning)', marginRight: 4 }} />
            +2.8%
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Au-dessus de la moyenne · attention</div>
        </div>
        <div className="ph-chart-card" style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 550 }}>Catégories en dépassement</div>
            <div style={{ fontSize: 30, fontWeight: 650, fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em', marginTop: 4, color: 'var(--danger)' }}>
              1 <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/ {BUDGET_CATEGORIES.length}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Masse salariale : +340 €
            </div>
          </div>
          <div style={{ width: 56, height: 56, borderRadius: '50%',
            background: `conic-gradient(var(--danger) 0 14deg, var(--bg-subtle) 14deg 360deg)`,
            display: 'grid', placeItems: 'center',
          }}>
            <div style={{ width: 44, height: 44, background: 'white', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: 'var(--danger)' }}>
              14%
            </div>
          </div>
        </div>
      </div>

      {/* Year month strip */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Exécution du budget annuel</div>
            <div className="card-sub">2026 · objectif global 620 000 € · réalisé 204 840 €</div>
          </div>
          <div className="ml-auto flex gap-3" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--success-soft)', border: '1px solid var(--success)', marginRight: 4, verticalAlign: -1 }} />Sous budget</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--accent)', marginRight: 4, verticalAlign: -1 }} />Mois en cours</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--danger-soft)', border: '1px solid var(--danger)', marginRight: 4, verticalAlign: -1 }} />Dépassement</span>
          </div>
        </div>
        <div className="card-body" style={{ padding: '6px 20px 20px' }}>
          <div className="budget-month-grid">
            {BUDGET_YEAR.map((m, i) => {
              const hasSpent = m.s !== undefined;
              const p = hasSpent ? (m.s / m.b) * 100 : null;
              const isCurrent = i === 3;
              const over = p !== null && p > 100;
              const under = p !== null && p < 95;
              return (
                <div key={i} className={'budget-month ' + (isCurrent ? 'current' : over ? 'over' : under ? 'under' : '')}>
                  <div style={{ fontWeight: 600 }}>{m.m}</div>
                  <div style={{ fontSize: 9.5, opacity: 0.75, marginTop: 1 }}>
                    {hasSpent ? `${(m.s/1000).toFixed(1)}k` : `${(m.b/1000).toFixed(0)}k`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Catégories budgétaires</div>
            <div className="card-sub">Répartition avril 2026 · objectif vs consommé</div>
          </div>
        </div>
        <div className="budget-cat-row" style={{ background: 'var(--bg-subtle)', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <span>Catégorie</span>
          <span style={{ textAlign: 'right' }}>Budget</span>
          <span style={{ textAlign: 'right' }}>Consommé</span>
          <span>Progression</span>
          <span style={{ textAlign: 'right' }}>Reste</span>
          <span></span>
        </div>
        {BUDGET_CATEGORIES.map(c => {
          const p = (c.spent / c.budget) * 100;
          const rest = c.budget - c.spent;
          const expectedP = (22 / 30) * 100; // 22 days into 30
          const state = p > 100 ? 'over' : p > expectedP + 5 ? 'warn' : 'ok';
          return (
            <div key={c.id} className="budget-cat-row">
              <div className="flex items-center gap-2">
                <div className="budget-icon" style={{ background: c.color }}>
                  <Icon name={c.icon} size={16} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{p.toFixed(1)}% consommé</div>
                </div>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', color: 'var(--text-muted)' }}>
                {c.budget.toLocaleString('fr-FR')} €
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 600 }}>
                {c.spent.toLocaleString('fr-FR')} €
              </span>
              <div className="budget-bar-wrap">
                <div className={'budget-bar ' + state} style={{ width: Math.min(p, 100) + '%' }} />
                <div className="budget-marker" style={{ left: expectedP + '%' }} title="Attendu à cette date" />
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 600, color: rest < 0 ? 'var(--danger)' : rest < c.budget * 0.1 ? 'var(--warning)' : 'var(--success)' }}>
                {rest >= 0 ? '' : '−'}{Math.abs(rest).toLocaleString('fr-FR')} €
              </span>
              <button className="icon-btn" style={{ width: 28, height: 28 }}><Icon name="chevron-right" size={14} /></button>
            </div>
          );
        })}
      </div>

      {showEditor && <BudgetEditorModal onClose={() => setShowEditor(false)} />}
    </div>
  );
}

window.PurchaseHistoryPage = PurchaseHistoryPage;
window.PriceAnalysisPage = PriceAnalysisPage;
window.BudgetPage = BudgetPage;
