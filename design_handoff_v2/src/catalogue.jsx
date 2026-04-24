// RestoPilot — Catalogue de commande (comparateur multi-fournisseurs)

const { useState: useStateC, useMemo: useMemoC } = React;

function CatalogueToolbar({ view, setView, query, setQuery, chips, onRemoveChip }) {
  return (
    <>
      <div className="catalogue-toolbar">
        <div className="search-box" style={{ width: 280 }}>
          <Icon name="search" size={14} />
          <input placeholder="Rechercher un produit, une référence..." value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div className="seg">
          <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')}>
            <Icon name="layout-grid" />Grille
          </button>
          <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>
            <Icon name="list" />Tableau
          </button>
        </div>
        <button className="btn sm"><Icon name="sliders" />Trier par: Meilleur prix<Icon name="chevron-down" size={12} /></button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted">127 produits · 6 fournisseurs</span>
        </div>
      </div>
      {chips.length > 0 && (
        <div className="flex gap-2 mb-3" style={{ flexWrap: 'wrap' }}>
          {chips.map(c => (
            <span key={c} className="chip">
              {c}
              <button onClick={() => onRemoveChip(c)}><Icon name="x" /></button>
            </span>
          ))}
          <button className="btn sm ghost" style={{ padding: '2px 8px' }}>Tout effacer</button>
        </div>
      )}
    </>
  );
}

function ProductCard({ p, onAdd }) {
  const sorted = [...p.prices].sort((a, b) => a.price - b.price);
  const best = sorted[0];
  const badgeLabels = {
    'best-price': { label: 'Meilleur prix', cls: 'success', icon: 'trending-down' },
    'new':        { label: 'Nouveau', cls: 'accent', icon: 'sparkles' },
    'promo':      { label: 'Promo', cls: 'warning', icon: 'tag' },
    'season':     { label: 'De saison', cls: 'info', icon: 'leaf' },
  };
  const b = p.badge && badgeLabels[p.badge];
  return (
    <div className="prod-card">
      <div className="prod-thumb">
        <div className="prod-badges">
          {b && <span className={'badge solid ' + b.cls}><Icon name={b.icon} />{b.label}</span>}
          {p.prev && <span className="badge danger"><Icon name="trending-down" />-{Math.round((1 - best.price/p.prev) * 100)}%</span>}
        </div>
        <div className="ph-label">photo produit</div>
      </div>
      <div className="prod-info">
        <div className="prod-name">{p.name}</div>
        <div className="prod-meta">{p.meta}</div>
      </div>
      <div className="supplier-rows">
        {sorted.map((pr, i) => {
          const sup = SUPPLIERS[pr.supplier];
          return (
            <div key={i} className={'supplier-row' + (i === 0 ? ' best' : '')}>
              <div className="sup-name">
                <span className="sup-dot" style={{ background: sup.color }} />
                {sup.short}
                {i === 0 && <Icon name="check" size={12} style={{ color: 'var(--success)' }} />}
              </div>
              <div className="sup-price">
                {pr.price.toFixed(2)}€<span className="unit">/{p.unit}</span>
              </div>
              <button className="sup-add" title="Ajouter" onClick={() => onAdd(p, pr)}>
                <Icon name="plus" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CatalogueTable({ products, onAdd, query }) {
  const filtered = query ? products.filter(p => p.name.toLowerCase().includes(query.toLowerCase())) : products;
  return (
    <div className="cat-table">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 40 }}></th>
            <th>Produit</th>
            <th>Catégorie</th>
            <th className="num">Lyon Halles</th>
            <th className="num">Marée Atl.</th>
            <th className="num">Terroir</th>
            <th className="num">Dumas</th>
            <th className="num">Rungis</th>
            <th style={{ width: 40 }}></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(p => {
            const bySup = {};
            p.prices.forEach(pr => { bySup[pr.supplier] = pr.price; });
            const values = Object.values(bySup);
            const minP = Math.min(...values), maxP = Math.max(...values);
            const cell = (key) => {
              const v = bySup[key];
              if (v === undefined) return <td className="num text-subtle">—</td>;
              const cls = v === minP ? 'best' : (v === maxP && values.length > 1 ? 'worst' : '');
              return (
                <td className="num">
                  <div className={'price-cell ' + cls}>
                    <div className="price-main">{v.toFixed(2)} €</div>
                    <div className="price-sub">/ {p.unit}</div>
                  </div>
                </td>
              );
            };
            const best = p.prices.find(pr => pr.price === minP);
            return (
              <tr key={p.id}>
                <td><div className="prod-thumb" style={{ width: 32, height: 32, border: '1px solid var(--border)', borderRadius: 6, padding: 0 }}><div/></div></td>
                <td>
                  <div style={{ fontWeight: 550 }}>{p.name}</div>
                  <div className="text-xs text-muted">{p.meta}</div>
                </td>
                <td>
                  <span className="badge neutral">
                    {CATEGORIES.find(c => c.id === p.category)?.name || p.category}
                  </span>
                </td>
                {cell('halles')}
                {cell('maree')}
                {cell('terroir')}
                {cell('boucher')}
                {cell('epicerie')}
                <td>
                  <button className="sup-add" style={{ background: 'var(--success)', color: 'white' }} onClick={() => onAdd(p, best)}>
                    <Icon name="plus" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CartPanel({ cart, setCart }) {
  // Group by supplier
  const groups = useMemoC(() => {
    const g = {};
    cart.forEach(item => {
      if (!g[item.supplier]) g[item.supplier] = [];
      g[item.supplier].push(item);
    });
    return g;
  }, [cart]);

  const total = cart.reduce((s, it) => s + it.price * it.qty, 0);
  const saving = cart.reduce((s, it) => s + (it.maxPrice ? (it.maxPrice - it.price) * it.qty : 0), 0);

  const updateQty = (id, delta) => {
    setCart(c => c.map(it => it.key === id ? { ...it, qty: Math.max(1, it.qty + delta) } : it));
  };
  const remove = (id) => setCart(c => c.filter(it => it.key !== id));

  return (
    <div className="cart-panel">
      <div className="cart-head">
        <Icon name="shopping-cart" size={15} style={{ color: 'var(--accent)' }} />
        <h3>Panier</h3>
        <span className="badge accent">{cart.length} articles</span>
        <button className="icon-btn ml-auto"><Icon name="more-horizontal" size={14} /></button>
      </div>
      <div className="cart-groups">
        {Object.keys(groups).length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13 }}>
            <Icon name="shopping-cart" size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
            <div>Votre panier est vide</div>
          </div>
        ) : Object.entries(groups).map(([supId, items]) => {
          const sup = SUPPLIERS[supId];
          const subTotal = items.reduce((s, it) => s + it.price * it.qty, 0);
          return (
            <div key={supId} className="cart-group">
              <div className="cart-group-head">
                <span className="sup-dot" style={{ background: sup.color }} />
                {sup.name}
                <span className="text-xs text-muted" style={{ fontWeight: 400 }}>· {sup.delivery}</span>
                <span className="price">{subTotal.toFixed(2)} €</span>
              </div>
              {items.map(it => (
                <div key={it.key} className="cart-item">
                  <div>
                    <div className="cart-item-name">{it.name}</div>
                    <div className="cart-item-qty">{it.price.toFixed(2)} € / {it.unit}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <div className="qty-ctrl">
                      <button onClick={() => updateQty(it.key, -1)}><Icon name="minus" /></button>
                      <input value={it.qty} readOnly />
                      <button onClick={() => updateQty(it.key, 1)}><Icon name="plus" /></button>
                    </div>
                    <div className="cart-item-price">{(it.price * it.qty).toFixed(2)} €</div>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div className="cart-foot">
        <div className="cart-line"><span>Sous-total HT</span><span className="mono tabular">{total.toFixed(2)} €</span></div>
        <div className="cart-line"><span>Livraison estimée</span><span className="mono tabular text-muted">incluse</span></div>
        <div className="cart-line total"><span>Total HT</span><span className="mono">{total.toFixed(2)} €</span></div>
        {saving > 0 && (
          <div className="cart-saving">
            <Icon name="piggy-bank" />
            Économies réalisées : {saving.toFixed(2)} €
          </div>
        )}
        <button className="btn primary" style={{ width: '100%', justifyContent: 'center', marginTop: 12, padding: '9px 12px' }}>
          Valider le panier<Icon name="arrow-right" />
        </button>
      </div>
    </div>
  );
}

function CataloguePage({ onNav, tweaks }) {
  const [view, setView] = useStateC(tweaks.catalogueView || 'grid');
  const [query, setQuery] = useStateC('');
  const [cat, setCat] = useStateC('all');
  const [cart, setCart] = useStateC([
    { key: 'init1', name: 'Saint-Jacques fraîches', supplier: 'maree', price: 54.80, maxPrice: 62.00, qty: 3, unit: 'kg' },
    { key: 'init2', name: 'Beurre AOP Charentes', supplier: 'halles', price: 12.60, maxPrice: 14.10, qty: 10, unit: 'kg' },
    { key: 'init3', name: 'Asperges blanches', supplier: 'terroir', price: 7.40, maxPrice: 8.20, qty: 5, unit: 'botte' },
    { key: 'init4', name: 'Filet de bœuf Limousin', supplier: 'boucher', price: 48.90, maxPrice: 52.40, qty: 4, unit: 'kg' },
  ]);

  const filtered = useMemoC(() => {
    let list = PRODUCTS;
    if (cat !== 'all') list = list.filter(p => p.category === cat);
    if (query) list = list.filter(p => p.name.toLowerCase().includes(query.toLowerCase()) || p.meta.toLowerCase().includes(query.toLowerCase()));
    return list;
  }, [cat, query]);

  const addToCart = (p, price) => {
    const key = `${p.id}-${price.supplier}-${Date.now()}`;
    const max = Math.max(...p.prices.map(x => x.price));
    setCart(c => [...c, {
      key, name: p.name, supplier: price.supplier, price: price.price, maxPrice: max, qty: 1, unit: p.unit
    }]);
  };

  const [chips, setChips] = useStateC(['Bio', 'France', 'En stock']);

  return (
    <div className="content page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Catalogue de commande</h1>
          <div className="page-sub">Comparez en temps réel les prix de vos 6 fournisseurs et optimisez vos achats.</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="upload" />Import liste</button>
          <button className="btn"><Icon name="repeat" />Recommander l'habituel</button>
        </div>
      </div>

      <div className="catalogue-layout">
        {/* Filters */}
        <aside className="filters">
          <div className="filter-group">
            <div className="filter-label">Catégories</div>
            {CATEGORIES.map(c => (
              <label key={c.id} className="filter-opt" style={{ cursor: 'pointer' }}>
                <input type="radio" name="cat" checked={cat === c.id} onChange={() => setCat(c.id)} />
                <span style={{ fontWeight: cat === c.id ? 550 : 400 }}>{c.name}</span>
                <span className="count">{c.count}</span>
              </label>
            ))}
          </div>
          <div className="filter-group">
            <div className="filter-label">Fournisseurs <button className="btn sm ghost" style={{padding:'0 4px'}}>Tous</button></div>
            {Object.values(SUPPLIERS).slice(0,5).map(s => (
              <label key={s.id} className="filter-opt">
                <input type="checkbox" defaultChecked />
                <span className="sup-dot" style={{ background: s.color, width: 8, height: 8, borderRadius: '50%' }} />
                <span>{s.short}</span>
                <span className="count">★ {s.rating}</span>
              </label>
            ))}
          </div>
          <div className="filter-group">
            <div className="filter-label">Labels & qualité</div>
            {['Bio', 'Label Rouge', 'AOP / AOC', 'Origine France', 'Local (<100km)', 'De saison'].map(l => (
              <label key={l} className="filter-opt">
                <input type="checkbox" defaultChecked={['Bio', 'Origine France'].includes(l)} />
                <span>{l}</span>
              </label>
            ))}
          </div>
          <div className="filter-group">
            <div className="filter-label">Disponibilité</div>
            <label className="filter-opt"><input type="checkbox" defaultChecked /><span>En stock uniquement</span></label>
            <label className="filter-opt"><input type="checkbox" /><span>Livrable demain</span></label>
          </div>
        </aside>

        {/* Main */}
        <main className="catalogue-main">
          <CatalogueToolbar
            view={view} setView={setView}
            query={query} setQuery={setQuery}
            chips={chips}
            onRemoveChip={c => setChips(cs => cs.filter(x => x !== c))}
          />

          {view === 'grid' ? (
            <div className="prod-grid">
              {filtered.map(p => <ProductCard key={p.id} p={p} onAdd={addToCart} />)}
            </div>
          ) : (
            <CatalogueTable products={filtered} onAdd={addToCart} query={query} />
          )}
        </main>

        {/* Cart */}
        <CartPanel cart={cart} setCart={setCart} />
      </div>
    </div>
  );
}

window.CataloguePage = CataloguePage;
