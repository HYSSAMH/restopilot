// RestoPilot — Mercuriale fournisseur (import PDF/IA)

const { useState: useStateM, useEffect: useEffectM } = React;

const MERCU_PRODUCTS = [
  { name: 'Saint-Jacques fraîches (noix)', cat: 'Poissons', pack: 'Colis 3 kg', unit: 'kg', price: 54.80, prev: 52.60, badge: 'rising', stock: 'ok' },
  { name: 'Sole portion 350-400g', cat: 'Poissons', pack: 'Pièce', unit: 'pc', price: 18.40, prev: 18.40, badge: null, stock: 'ok' },
  { name: 'Huîtres Gillardeau n°2', cat: 'Fruits de mer', pack: 'Bourriche 24', unit: 'bourriche', price: 42.00, prev: 42.00, badge: 'new', stock: 'ok' },
  { name: 'Langoustines vivantes', cat: 'Fruits de mer', pack: 'Plateau 2kg', unit: 'kg', price: 62.00, prev: 68.50, badge: 'drop', stock: 'low' },
  { name: 'Homard breton 500-600g', cat: 'Fruits de mer', pack: 'Pièce', unit: 'pc', price: 36.00, prev: 36.00, badge: null, stock: 'ok' },
  { name: 'Turbot sauvage', cat: 'Poissons', pack: 'Pièce 3-4kg', unit: 'kg', price: 48.00, prev: 46.20, badge: 'rising', stock: 'ok' },
  { name: 'Bar de ligne', cat: 'Poissons', pack: 'Pièce 800g-1kg', unit: 'kg', price: 38.50, prev: 38.50, badge: null, stock: 'out' },
  { name: 'Crevettes sauvages Madagascar', cat: 'Fruits de mer', pack: 'Colis 2kg', unit: 'kg', price: 42.00, prev: 39.80, badge: 'rising', stock: 'ok' },
];

function MercurialePage({ onNav }) {
  const [step, setStep] = useStateM('dropzone'); // dropzone -> processing -> done
  const [progress, setProgress] = useStateM(0);

  useEffectM(() => {
    if (step !== 'processing') return;
    const id = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(id); setStep('done'); return 100; }
        return p + 4;
      });
    }, 80);
    return () => clearInterval(id);
  }, [step]);

  const steps = [
    { id: 'upload', label: 'Fichier reçu', done: progress > 10 },
    { id: 'ocr', label: 'OCR & extraction', done: progress > 35, active: progress > 10 && progress <= 35 },
    { id: 'match', label: 'Rapprochement produits', done: progress > 65, active: progress > 35 && progress <= 65 },
    { id: 'price', label: 'Détection variations prix', done: progress > 90, active: progress > 65 && progress <= 90 },
    { id: 'ready', label: 'Prêt à valider', done: progress >= 100, active: progress > 90 && progress < 100 },
  ];

  return (
    <div className="content page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mercuriale · Marée Atlantique</h1>
          <div className="page-sub">Dernière mise à jour le 19 avril · 127 références · cycle de livraison mardi/jeudi</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="download" />Exporter</button>
          <button className="btn"><Icon name="external-link" />Voir catalogue</button>
          <button className="btn primary"><Icon name="upload" />Importer une mercuriale</button>
        </div>
      </div>

      {/* Import dropzone */}
      <div className={'import-dropzone mb-4' + (step === 'processing' ? ' processing' : '')}>
        {step === 'processing' && <div className="ai-shimmer" />}
        <div>
          <div className="import-head">
            <div className="import-icon">
              <Icon name={step === 'done' ? 'check' : 'sparkles'} />
            </div>
            <div>
              <div className="import-title">
                {step === 'dropzone' && 'Importer un nouveau catalogue — IA'}
                {step === 'processing' && 'Analyse en cours…'}
                {step === 'done' && 'Mercuriale importée avec succès'}
              </div>
              <div className="import-sub">
                {step === 'dropzone' && 'Glissez un PDF, une photo ou un Excel — l\'IA reconnaît produits, conditionnements et prix automatiquement.'}
                {step === 'processing' && 'catalogue-maree-avril-2026.pdf · 8 pages · 127 produits détectés'}
                {step === 'done' && '127 produits mis à jour · 18 hausses de prix détectées · 3 nouveautés'}
              </div>
            </div>
          </div>
          {step !== 'dropzone' && (
            <div className="ai-step-list">
              {steps.map(s => (
                <span key={s.id} className={'ai-step' + (s.done ? ' done' : s.active ? ' active' : '')}>
                  {s.done ? <Icon name="check" /> : s.active ? <Icon name="sparkles" /> : <Icon name="clock" />}
                  {s.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {step === 'dropzone' && (
            <>
              <button className="btn" onClick={() => { setProgress(0); setStep('processing'); }}>
                <Icon name="upload" />Parcourir
              </button>
              <button className="btn primary" onClick={() => { setProgress(0); setStep('processing'); }}>
                <Icon name="sparkles" />Essayer démo
              </button>
            </>
          )}
          {step === 'processing' && (
            <div style={{ minWidth: 160, textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 650, color: 'var(--accent)' }}>{progress}%</div>
              <div style={{ width: 140, height: 4, background: 'var(--border)', borderRadius: 4, marginTop: 6, overflow: 'hidden' }}>
                <div style={{ width: progress + '%', height: '100%', background: 'var(--accent)', transition: 'width 0.2s' }} />
              </div>
            </div>
          )}
          {step === 'done' && (
            <button className="btn primary" onClick={() => setStep('dropzone')}>
              <Icon name="check" />Valider les changements
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mercu-stats">
        <div className="mercu-stat">
          <div className="mercu-stat-label">Produits actifs</div>
          <div className="mercu-stat-value">127</div>
        </div>
        <div className="mercu-stat">
          <div className="mercu-stat-label">Nouveautés 7j</div>
          <div className="mercu-stat-value" style={{ color: 'var(--accent)' }}>+8</div>
        </div>
        <div className="mercu-stat">
          <div className="mercu-stat-label">Hausses de prix</div>
          <div className="mercu-stat-value" style={{ color: 'var(--danger)' }}>18</div>
        </div>
        <div className="mercu-stat">
          <div className="mercu-stat-label">Baisses de prix</div>
          <div className="mercu-stat-value" style={{ color: 'var(--success)' }}>6</div>
        </div>
      </div>

      {/* Product list */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">Tarifs en vigueur</div>
          <span className="badge neutral">Valide jusqu'au 26 avril</span>
          <div className="ml-auto flex gap-2">
            <div className="seg">
              <button className="active">Tous</button>
              <button>Nouveautés</button>
              <button>Hausses</button>
              <button>Baisses</button>
            </div>
            <div className="search-box" style={{ width: 220 }}>
              <Icon name="search" size={14} />
              <input placeholder="Rechercher..." />
            </div>
          </div>
        </div>
        <div>
          <div className="mercu-row mercu-row-head">
            <span></span>
            <span>Produit & conditionnement</span>
            <span>Catégorie</span>
            <span style={{ textAlign: 'right' }}>Prix HT</span>
            <span style={{ textAlign: 'right' }}>Évolution</span>
            <span>Statut</span>
            <span></span>
          </div>
          {MERCU_PRODUCTS.map((p, i) => {
            const diff = p.price - p.prev;
            const diffPct = p.prev ? (diff / p.prev) * 100 : 0;
            return (
              <div key={i} className="mercu-row">
                <div className="mercu-thumb" />
                <div>
                  <div style={{ fontWeight: 550, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {p.name}
                    {p.badge === 'new' && <span className="badge accent"><Icon name="sparkles" />Nouveau</span>}
                    {p.badge === 'drop' && <span className="badge success"><Icon name="trending-down" />Prix en baisse</span>}
                    {p.badge === 'rising' && <span className="badge warning"><Icon name="trending-up" />Hausse</span>}
                  </div>
                  <div className="text-xs text-muted mono" style={{ marginTop: 2 }}>{p.pack}</div>
                </div>
                <div><span className="badge neutral">{p.cat}</span></div>
                <div className="price-evol">
                  <div className="amt">{p.price.toFixed(2)} €<span style={{ color: 'var(--text-subtle)', fontWeight: 400, fontSize: 11 }}>/{p.unit}</span></div>
                </div>
                <div className="price-evol">
                  {diff === 0
                    ? <span className="evol flat">—</span>
                    : <span className={'evol ' + (diff > 0 ? 'up' : 'down')}>
                        <Icon name={diff > 0 ? 'arrow-up' : 'arrow-down'} />
                        {diff > 0 ? '+' : ''}{diffPct.toFixed(1)}%
                      </span>
                  }
                  <span style={{ fontSize: 10.5, color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>
                    précéd. {p.prev.toFixed(2)}
                  </span>
                </div>
                <div>
                  {p.stock === 'ok' && <span className="badge success"><span className="dot" />En stock</span>}
                  {p.stock === 'low' && <span className="badge warning"><span className="dot" />Stock faible</span>}
                  {p.stock === 'out' && <span className="badge danger"><span className="dot" />Rupture</span>}
                </div>
                <div><button className="icon-btn"><Icon name="more-horizontal" size={14} /></button></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

window.MercurialePage = MercurialePage;
