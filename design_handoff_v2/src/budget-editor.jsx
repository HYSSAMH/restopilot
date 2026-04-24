// RestoPilot — Budget Editor Modal
const { useState: useBE, useMemo: useMBE } = React;

const BE_DEFAULT = [
  { id: 'food',   name: 'Matière première',    icon: 'chef-hat', color: '#6366F1', monthly: 18000, pctCA: 28, seasonal: 'stable' },
  { id: 'drink',  name: 'Boissons & vins',     icon: 'wine',     color: '#8B5CF6', monthly: 6000,  pctCA: 9,  seasonal: 'summer+' },
  { id: 'staff',  name: 'Masse salariale',     icon: 'users',    color: '#EF4444', monthly: 22000, pctCA: 34, seasonal: 'stable' },
  { id: 'rent',   name: 'Loyer & charges',     icon: 'home',     color: '#10B981', monthly: 4800,  pctCA: 7,  seasonal: 'fixed' },
  { id: 'energy', name: 'Énergie',             icon: 'zap',      color: '#F59E0B', monthly: 1400,  pctCA: 2,  seasonal: 'winter+' },
  { id: 'market', name: 'Marketing & com',     icon: 'megaphone',color: '#0EA5E9', monthly: 1200,  pctCA: 2,  seasonal: 'stable' },
  { id: 'maint',  name: 'Maintenance',         icon: 'wrench',   color: '#64748B', monthly: 800,   pctCA: 1,  seasonal: 'stable' },
];

const BE_PRESETS = {
  'ai': [18200, 5800, 21800, 4800, 1400, 1100, 900],
  '2025': [17200, 5400, 20800, 4600, 1280, 1000, 720],
  'previous': [17800, 5600, 21500, 4800, 1320, 1100, 780],
  'zero':  [0, 0, 0, 0, 0, 0, 0],
};

const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jui','Jul','Aoû','Sep','Oct','Nov','Déc'];
const CA_FORECAST = [58000, 54000, 63000, 66000, 71000, 74000, 68000, 42000, 68000, 70000, 65000, 82000];

function BudgetEditorModal({ onClose, onSave }) {
  const [cats, setCats] = useBE(BE_DEFAULT.map(c => ({ ...c })));
  const [expanded, setExpanded] = useBE(null);
  const [monthView, setMonthView] = useBE('avr');
  // per-cat monthly overrides: {catId: {monthIdx: value}}
  const [overrides, setOverrides] = useBE({});

  const totalMonthly = cats.reduce((a, c) => a + c.monthly, 0);
  const caAvril = CA_FORECAST[3];
  const caAnnual = CA_FORECAST.reduce((a, b) => a + b, 0);
  const totalAnnual = cats.reduce((a, c) => {
    const override = overrides[c.id] || {};
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += (override[i] !== undefined) ? override[i] : c.monthly;
    }
    return a + sum;
  }, 0);

  const marginMonthly = caAvril - totalMonthly;
  const marginPct = (marginMonthly / caAvril) * 100;
  const marginAnnual = caAnnual - totalAnnual;

  const foodPct = (cats.find(c => c.id === 'food').monthly / caAvril) * 100;
  const staffPct = (cats.find(c => c.id === 'staff').monthly / caAvril) * 100;
  const totalPct = (totalMonthly / caAvril) * 100;

  // alerts
  const alerts = [];
  if (foodPct > 32) alerts.push({ kind: 'warn', text: `Coût matière à ${foodPct.toFixed(1)}% du CA — au-dessus de la cible 28-30%.` });
  if (staffPct > 38) alerts.push({ kind: 'warn', text: `Masse salariale à ${staffPct.toFixed(1)}% du CA — secteur restauration ~35%.` });
  if (totalPct > 92) alerts.push({ kind: 'warn', text: `Budget total à ${totalPct.toFixed(1)}% du CA — marge très tendue.` });
  if (totalPct < 75) alerts.push({ kind: 'good', text: `Budget maîtrisé — marge brute prévisionnelle >${(100-totalPct).toFixed(0)}%.` });

  const applyPreset = (key) => {
    const preset = BE_PRESETS[key];
    setCats(cats.map((c, i) => ({ ...c, monthly: preset[i] })));
    setOverrides({});
  };

  const updateCat = (id, value) => {
    const v = Math.max(0, Math.round(value));
    setCats(cats.map(c => c.id === id ? { ...c, monthly: v } : c));
  };

  const updateOverride = (catId, monthIdx, value) => {
    const v = value === '' ? undefined : Math.max(0, Math.round(parseFloat(value) || 0));
    setOverrides(o => {
      const catOv = { ...(o[catId] || {}) };
      if (v === undefined) delete catOv[monthIdx];
      else catOv[monthIdx] = v;
      return { ...o, [catId]: catOv };
    });
  };

  // Donut segments
  const donutSegments = cats.map(c => ({
    color: c.color, name: c.name, value: c.monthly,
    pct: totalMonthly > 0 ? (c.monthly / totalMonthly) * 100 : 0,
  }));
  let cum = 0;
  const donutCircles = donutSegments.map((s) => {
    const dash = (s.pct / 100) * 2 * Math.PI * 42;
    const offset = -cum;
    cum += dash;
    return { ...s, dash, offset };
  });

  return (
    <div className="be-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="be-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="be-header">
          <div>
            <div className="be-title">Ajuster les budgets</div>
            <div className="be-sub">
              Maison Lumière · budget 2026 · CA prévisionnel annuel {(caAnnual/1000).toFixed(0)}k €
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="be-month-nav">
              {['Avr','Mai','Jui','Jul','Aoû','Sep','Oct','Nov','Déc'].map(m => (
                <button key={m} className={m === 'Avr' && monthView === 'avr' ? 'active' : ''} onClick={() => setMonthView(m.toLowerCase().slice(0,3))}>{m}</button>
              ))}
            </div>
            <button className="icon-btn" onClick={onClose}><Icon name="x" size={16} /></button>
          </div>
        </div>

        {/* Main */}
        <div className="be-main">
          {/* Presets */}
          <div className="be-presets">
            <div className="be-preset-label">
              <Icon name="sparkles" size={14} />
              Point de départ
            </div>
            <button className="be-preset-btn ai" onClick={() => applyPreset('ai')}>
              <Icon name="sparkles" size={12} />Suggestion IA
            </button>
            <button className="be-preset-btn" onClick={() => applyPreset('previous')}>
              <Icon name="repeat" size={12} />Copier mars 2026
            </button>
            <button className="be-preset-btn" onClick={() => applyPreset('2025')}>
              <Icon name="clock" size={12} />Basé sur avril 2025
            </button>
            <div className="ml-auto" style={{ fontSize: 11.5, color: 'var(--accent-hover)', fontWeight: 550 }}>
              <Icon name="info" size={12} style={{ verticalAlign: -1, marginRight: 3 }} />
              Benchmark secteur : 68-78% du CA en charges totales
            </div>
          </div>

          {/* Category list header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '36px 180px 90px 1fr 130px 110px 30px',
            gap: 14, padding: '0 16px 8px',
            fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            <span></span>
            <span>Catégorie</span>
            <span>% du CA</span>
            <span>Ajuster (slider)</span>
            <span style={{ textAlign: 'right' }}>Budget mensuel</span>
            <span style={{ textAlign: 'center' }}>Variation M-1</span>
            <span></span>
          </div>

          {cats.map((c, idx) => {
            const pct = caAvril > 0 ? (c.monthly / caAvril) * 100 : 0;
            const prev = BE_DEFAULT[idx].monthly;
            const delta = prev > 0 ? ((c.monthly - prev) / prev) * 100 : 0;
            const max = c.id === 'staff' ? 32000 : c.id === 'food' ? 28000 : c.id === 'drink' ? 10000 : c.id === 'rent' ? 8000 : 3000;
            const isExp = expanded === c.id;
            const pctState = pct > 35 ? 'over' : pct > 30 ? 'warn' : '';
            const sliderBg = `linear-gradient(${c.color}, ${c.color}) 0 / ${(c.monthly / max) * 100}% 100% no-repeat, var(--bg-subtle)`;

            return (
              <div key={c.id} className={'be-cat-row' + (isExp ? ' expanded' : '')}>
                <div className="be-cat-head" onClick={() => setExpanded(isExp ? null : c.id)}>
                  <div className="be-cat-icon" style={{ background: c.color }}>
                    <Icon name={c.icon} size={17} />
                  </div>
                  <div>
                    <div className="be-cat-name">{c.name}</div>
                    <div className="be-cat-meta">
                      {c.seasonal === 'summer+' && '↑ été'}
                      {c.seasonal === 'winter+' && '↑ hiver'}
                      {c.seasonal === 'fixed' && 'Poste fixe'}
                      {c.seasonal === 'stable' && 'Stable sur l\'année'}
                    </div>
                  </div>
                  <span className={'be-cat-pct-pill ' + pctState}>
                    {pct.toFixed(1)}%
                  </span>
                  <input
                    type="range"
                    className="be-cat-slider"
                    min="0" max={max} step="100"
                    value={c.monthly}
                    onChange={(e) => updateCat(c.id, parseFloat(e.target.value))}
                    onClick={(e) => e.stopPropagation()}
                    style={{ background: sliderBg }}
                  />
                  <div className="be-cat-input" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="number"
                      value={c.monthly}
                      onChange={(e) => updateCat(c.id, parseFloat(e.target.value) || 0)}
                    />
                    <span className="suffix">€</span>
                  </div>
                  <span style={{ textAlign: 'center', fontSize: 11.5, fontFamily: 'var(--font-mono)', fontWeight: 600,
                    color: Math.abs(delta) < 1 ? 'var(--text-muted)' : delta > 0 ? 'var(--danger)' : 'var(--success)' }}>
                    {Math.abs(delta) < 0.1 ? '—' : (delta > 0 ? '+' : '') + delta.toFixed(1) + '%'}
                  </span>
                  <button className="be-cat-expand">
                    <Icon name="chevron-right" size={14} />
                  </button>
                </div>
                {isExp && (
                  <div className="be-cat-body">
                    {MONTHS.map((m, i) => {
                      const ov = overrides[c.id]?.[i];
                      const val = ov !== undefined ? ov : c.monthly;
                      return (
                        <div key={i} className={'be-month-input' + (ov !== undefined ? ' override' : '')}>
                          <div className="label">{m}</div>
                          <input
                            type="number"
                            value={val}
                            onChange={(e) => updateOverride(c.id, i, e.target.value)}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ marginTop: 16, padding: '12px 14px', background: 'white', border: '1px dashed var(--border-strong)', borderRadius: 10, fontSize: 12.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="plus" size={14} />
            Ajouter une catégorie personnalisée (événementiel, sous-traitance, formation…)
          </div>
        </div>

        {/* Summary side panel */}
        <div className="be-summary">
          <div className="be-sum-title">Aperçu mensuel — avril 2026</div>

          <div className="be-sum-hero">
            <div className="label">Total budgété / mois</div>
            <div className="value">{totalMonthly.toLocaleString('fr-FR')} €</div>
            <div className="sub">{totalPct.toFixed(1)}% du CA prévisionnel ({caAvril.toLocaleString('fr-FR')} €)</div>
            <div style={{ height: 5, background: 'rgba(255,255,255,0.15)', borderRadius: 3, marginTop: 10, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: Math.min(totalPct, 100) + '%', background: totalPct > 90 ? '#F59E0B' : 'white', transition: 'width 0.3s' }} />
            </div>
          </div>

          {/* Donut */}
          <div className="be-donut-wrap">
            <svg width="160" height="160" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="42" fill="none" stroke="var(--bg-subtle)" strokeWidth="16" />
              {donutCircles.map((s, i) => (
                <circle
                  key={i} cx="60" cy="60" r="42" fill="none"
                  stroke={s.color} strokeWidth="16"
                  strokeDasharray={`${s.dash} ${2 * Math.PI * 42}`}
                  strokeDashoffset={s.offset}
                  transform="rotate(-90 60 60)"
                  style={{ transition: 'stroke-dasharray 0.3s, stroke-dashoffset 0.3s' }}
                />
              ))}
              <text x="60" y="58" textAnchor="middle" fontSize="9" fill="var(--text-muted)" fontFamily="var(--font-mono)">RÉPARTITION</text>
              <text x="60" y="72" textAnchor="middle" fontSize="14" fontWeight="650" fill="var(--text)" fontFamily="var(--font-mono)" letterSpacing="-0.02em">
                {(totalMonthly/1000).toFixed(1)}k €
              </text>
            </svg>
          </div>

          <div className="be-legend">
            {cats.map(c => (
              <div key={c.id} className="be-legend-row">
                <span className="be-legend-dot" style={{ background: c.color }} />
                <span>{c.name}</span>
                <span className="be-legend-val">{((c.monthly/totalMonthly)*100 || 0).toFixed(1)}%</span>
              </div>
            ))}
          </div>

          <div className="be-metric-grid">
            <div className={'be-metric ' + (marginPct < 5 ? 'bad' : marginPct < 15 ? 'warn' : 'good')}>
              <div className="label">Marge brute proj.</div>
              <div className="value">{marginPct.toFixed(1)}%</div>
            </div>
            <div className={'be-metric ' + (marginMonthly < 0 ? 'bad' : 'good')}>
              <div className="label">Résultat / mois</div>
              <div className="value">{marginMonthly >= 0 ? '+' : ''}{(marginMonthly/1000).toFixed(1)}k €</div>
            </div>
            <div className="be-metric">
              <div className="label">Coût matière</div>
              <div className="value" style={{ color: foodPct > 32 ? 'var(--danger)' : foodPct > 30 ? 'var(--warning)' : 'var(--success)' }}>
                {foodPct.toFixed(1)}%
              </div>
            </div>
            <div className="be-metric">
              <div className="label">Annuel projeté</div>
              <div className="value">{(totalAnnual/1000).toFixed(0)}k €</div>
            </div>
          </div>

          {alerts.map((a, i) => (
            <div key={i} className={'be-alert ' + a.kind}>
              <Icon name={a.kind === 'warn' ? 'alert-triangle' : 'check-circle'} size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>{a.text}</div>
            </div>
          ))}

          {alerts.length === 0 && (
            <div className="be-alert good">
              <Icon name="check-circle" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <div>Budget équilibré · tous les ratios sont dans les normes du secteur.</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="be-footer">
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            <Icon name="save" size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
            Modifications enregistrées automatiquement toutes les 30s
          </div>
          <div className="ml-auto flex gap-2">
            <button className="btn" onClick={onClose}>Annuler</button>
            <button className="btn"><Icon name="download" />Exporter en Excel</button>
            <button className="btn primary" onClick={() => { onSave && onSave(cats); onClose(); }}>
              <Icon name="check" />Valider le budget
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.BudgetEditorModal = BudgetEditorModal;
