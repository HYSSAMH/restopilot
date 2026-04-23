// RestoPilot — Fiche technique (calcul coût de revient)

const { useState: useStateF, useMemo: useMemoF } = React;

function FichePage({ onNav, tweaks }) {
  const f = FICHE;
  const [expanded, setExpanded] = useStateF({ s1: true });
  const [tvaRate, setTvaRate] = useStateF(10);
  const [marginTarget, setMarginTarget] = useStateF(70);

  // Calculations
  const ingredientsCost = useMemoF(() => {
    return f.ingredients.reduce((s, i) => s + i.qty * i.cost, 0);
  }, []);
  const subRecipesCost = useMemoF(() => {
    return f.subRecipes.reduce((s, sr) => s + sr.qty * sr.cost, 0);
  }, []);
  const totalCost = ingredientsCost + subRecipesCost;

  // Prix de vente calculator
  const coefTarget = 100 / (100 - marginTarget); // coef multiplicateur
  const pvHT = totalCost * coefTarget;
  const pvTTC = pvHT * (1 + tvaRate / 100);
  const marginActual = ((pvHT - totalCost) / pvHT) * 100;
  const coutMatierePct = (totalCost / pvHT) * 100;

  return (
    <div className="content page-enter">
      <div className="page-header">
        <button className="btn ghost" style={{ padding: '4px 8px' }} onClick={() => onNav('fiches')}>
          <Icon name="arrow-left" size={14} />
        </button>
        <div style={{ flex: 1 }}>
          <div className="breadcrumb" style={{ marginBottom: 4 }}>
            <span>Fiches techniques</span>
            <Icon name="chevron-right" size={12} />
            <span className="current">Saint-Jacques rôties</span>
          </div>
          <h1 className="page-title">{f.name}</h1>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="eye" />Aperçu</button>
          <button className="btn"><Icon name="copy" />Dupliquer</button>
          <button className="btn"><Icon name="download" />PDF</button>
          <button className="btn primary"><Icon name="save" />Enregistrer</button>
        </div>
      </div>

      <div className="fiche-layout">
        <div className="fiche-main">

          {/* Head card */}
          <div className="fiche-head">
            <div className="fiche-thumb">photo<br/>plat</div>
            <div>
              <div className="fiche-title-row">
                <span className="badge accent"><Icon name="star" />Signature</span>
                <span className="badge neutral">{f.category}</span>
                <span className="badge success"><span className="dot" />Publiée à la carte</span>
              </div>
              <div className="fiche-meta">
                <div><Icon name="users" />{f.portions} portion · {f.weight} g</div>
                <div><Icon name="chef-hat" />{f.service}</div>
                <div><Icon name="clock" />Prép. 25 min · Cuisson 4 min</div>
                <div><Icon name="alert-triangle" />{f.allergens.join(' · ')}</div>
              </div>
              <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Noix snackées côté plancha, brunoise et purée de topinambour, sauce vinaigrette chaude aux agrumes et éclats de noisette torréfiée.
              </div>
            </div>
          </div>

          {/* Ingredients */}
          <div className="card">
            <div className="card-header">
              <Icon name="leaf" size={15} style={{ color: 'var(--success)' }} />
              <div className="card-title">Ingrédients & sous-recettes</div>
              <span className="text-xs text-muted">{f.ingredients.length + f.subRecipes.length} éléments</span>
              <button className="btn sm ml-auto"><Icon name="plus" />Ajouter</button>
            </div>
            <div>
              <div className="ingredient-row-head">
                <span></span>
                <span>Ingrédient</span>
                <span style={{ textAlign: 'right' }}>Qté</span>
                <span style={{ textAlign: 'center' }}>Unité</span>
                <span style={{ textAlign: 'right' }}>Coût unitaire</span>
                <span style={{ textAlign: 'right' }}>Total</span>
                <span></span>
              </div>

              {f.ingredients.map(i => {
                const sup = SUPPLIERS[i.supplier];
                const total = i.qty * i.cost;
                return (
                  <div key={i.id} className="ingredient-row">
                    <div className="ing-drag"><Icon name="grip-vertical" /></div>
                    <div>
                      <div className="ing-name">{i.name}</div>
                      {sup && (
                        <div className="ing-supplier flex items-center gap-1">
                          <span className="sup-dot" style={{ background: sup.color, width: 6, height: 6, borderRadius: '50%' }} />
                          {sup.short}
                        </div>
                      )}
                    </div>
                    <div className="ing-qty">{i.qty.toFixed(3).replace(/\.?0+$/, '')}</div>
                    <div className="ing-unit">{i.unit}</div>
                    <div className="ing-unit-cost">{i.cost.toFixed(2)} €<span style={{ color: 'var(--text-subtle)', fontSize: 10 }}>/{i.unit}</span></div>
                    <div className="ing-total">{total.toFixed(2)} €</div>
                    <div><button className="icon-btn"><Icon name="more-horizontal" size={13} /></button></div>
                  </div>
                );
              })}

              {/* Sub-recipes */}
              {f.subRecipes.map(sr => {
                const isOpen = expanded[sr.id];
                const total = sr.qty * sr.cost;
                return (
                  <React.Fragment key={sr.id}>
                    <div className="ingredient-row" style={{ background: 'var(--accent-soft)' }}>
                      <div className="ing-drag"><Icon name="grip-vertical" /></div>
                      <div>
                        <div className="ing-name">
                          {sr.name}
                          <span className="sub-recipe-mark">SOUS-RECETTE</span>
                          <button
                            className="icon-btn"
                            style={{ marginLeft: 6, width: 20, height: 20 }}
                            onClick={() => setExpanded(e => ({ ...e, [sr.id]: !isOpen }))}
                          >
                            <Icon name={isOpen ? 'chevron-down' : 'chevron-right'} size={12} />
                          </button>
                        </div>
                        <div className="ing-supplier">{sr.items.length} composants · calcul auto</div>
                      </div>
                      <div className="ing-qty">{sr.qty.toFixed(3).replace(/\.?0+$/, '')}</div>
                      <div className="ing-unit">{sr.unit}</div>
                      <div className="ing-unit-cost">{sr.cost.toFixed(2)} €<span style={{ color: 'var(--text-subtle)', fontSize: 10 }}>/{sr.unit}</span></div>
                      <div className="ing-total">{total.toFixed(2)} €</div>
                      <div><button className="icon-btn"><Icon name="more-horizontal" size={13} /></button></div>
                    </div>
                    {isOpen && (
                      <div className="sub-recipe">
                        {sr.items.map((it, i) => (
                          <div key={i} className="ingredient-row">
                            <div></div>
                            <div className="ing-name" style={{ fontWeight: 400 }}>↳ {it.name}</div>
                            <div className="ing-qty">{it.qty.toFixed(3).replace(/\.?0+$/, '')}</div>
                            <div className="ing-unit">{it.unit}</div>
                            <div className="ing-unit-cost">{it.cost.toFixed(2)} €</div>
                            <div className="ing-total">{(it.qty * it.cost).toFixed(2)} €</div>
                            <div></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}

              {/* Total row */}
              <div className="ingredient-row" style={{ background: 'var(--bg-subtle)', fontWeight: 600 }}>
                <div></div>
                <div>Coût matière total</div>
                <div></div>
                <div></div>
                <div className="ing-unit-cost text-muted" style={{ fontWeight: 400 }}>pour 1 portion</div>
                <div className="ing-total" style={{ fontSize: 14, color: 'var(--accent)' }}>{totalCost.toFixed(2)} €</div>
                <div></div>
              </div>
            </div>
          </div>

          {/* Cost summary */}
          <div className="fiche-costs">
            <div className="cost-block">
              <div className="cost-label">Coût matière</div>
              <div className="cost-value">{totalCost.toFixed(2)} €</div>
              <div className="cost-sub">par portion · HT</div>
            </div>
            <div className="cost-block">
              <div className="cost-label">Prix de vente HT</div>
              <div className="cost-value" style={{ color: 'var(--accent)' }}>{pvHT.toFixed(2)} €</div>
              <div className="cost-sub">coef. {coefTarget.toFixed(2)}× · {marginTarget}% marge</div>
            </div>
            <div className="cost-block">
              <div className="cost-label">Prix de vente TTC</div>
              <div className="cost-value">{pvTTC.toFixed(2)} €</div>
              <div className="cost-sub">TVA {tvaRate}%</div>
            </div>
          </div>

          {/* Margin gauge */}
          <div className="card">
            <div className="card-header">
              <Icon name="activity" size={15} style={{ color: 'var(--accent)' }} />
              <div className="card-title">Positionnement de la marge</div>
              <span className="badge success ml-auto"><Icon name="check" />Au-dessus de l'objectif</span>
            </div>
            <div className="card-body">
              <div className="margin-gauge" style={{ marginTop: 28 }}>
                <div className="margin-marker" data-label={`${marginActual.toFixed(1)}%`} style={{ left: `${marginActual}%` }} />
              </div>
              <div className="margin-ticks">
                <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
              </div>
              <div className="grid-3 mt-4" style={{ gap: 20 }}>
                <div>
                  <div className="text-xs text-muted">Coût matière %</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>{coutMatierePct.toFixed(1)}%</div>
                  <div className="text-xs text-muted">objectif &lt; 30%</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Marge brute</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 600, color: 'var(--success)' }}>{marginActual.toFixed(1)}%</div>
                  <div className="text-xs text-muted">objectif ≥ {marginTarget}%</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Marge en €</div>
                  <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>{(pvHT - totalCost).toFixed(2)} €</div>
                  <div className="text-xs text-muted">par portion</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Side: calculator */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 80 }}>
          <div className="card">
            <div className="card-header">
              <Icon name="calculator" size={15} style={{ color: 'var(--accent)' }} />
              <div className="card-title">Calculateur prix de vente</div>
            </div>
            <div className="card-body">
              <div className="pv-calc">
                <div>
                  <div className="flex items-center mb-2">
                    <label className="text-xs text-muted font-medium">Marge visée</label>
                    <span className="ml-auto mono" style={{ fontWeight: 600 }}>{marginTarget}%</span>
                  </div>
                  <input
                    type="range"
                    className="pv-slider"
                    min="40" max="85" step="1"
                    value={marginTarget}
                    onChange={e => setMarginTarget(parseInt(e.target.value))}
                  />
                  <div className="flex text-xs text-subtle mt-1">
                    <span>40%</span><span className="ml-auto">85%</span>
                  </div>
                </div>

                <div className="divider" />

                <div className="pv-row">
                  <label>Coût matière</label>
                  <div className="pv-output">{totalCost.toFixed(2)} €</div>
                </div>
                <div className="pv-row">
                  <label>Coef. multiplicateur</label>
                  <div className="pv-output">×{coefTarget.toFixed(2)}</div>
                </div>
                <div className="pv-row highlight">
                  <label style={{ fontWeight: 600, color: 'var(--text)' }}>Prix vente HT</label>
                  <div className="pv-output">{pvHT.toFixed(2)} €</div>
                </div>

                <div className="divider" />

                <div className="pv-row">
                  <label>TVA</label>
                  <div className="seg" style={{ justifySelf: 'end' }}>
                    {[5.5, 10, 20].map(r => (
                      <button key={r} className={tvaRate === r ? 'active' : ''} onClick={() => setTvaRate(r)}>{r}%</button>
                    ))}
                  </div>
                </div>
                <div className="pv-row">
                  <label style={{ fontWeight: 600, color: 'var(--text)' }}>Prix vente TTC</label>
                  <div className="pv-output" style={{ fontWeight: 600, fontSize: 14 }}>{pvTTC.toFixed(2)} €</div>
                </div>
                <div className="pv-row">
                  <label>Prix pratiqué carte</label>
                  <input type="text" defaultValue="38.00 €" />
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <Icon name="repeat" size={15} style={{ color: 'var(--warning)' }} />
              <div className="card-title">Évolution du coût</div>
            </div>
            <div className="card-body" style={{ padding: '14px 16px' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="badge danger"><Icon name="trending-up" />+6.8% sur 30j</span>
              </div>
              <div className="text-xs text-muted" style={{ lineHeight: 1.5 }}>
                Le coût matière a augmenté de <strong style={{color:'var(--text)'}}>0.84 €</strong> sur 30 jours, principalement dû au prix des Saint-Jacques (+12% saisonnier).
              </div>
              <div className="mt-3 flex gap-2">
                <button className="btn sm"><Icon name="sparkles" />Suggérer substitutions</button>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <Icon name="book-open" size={15} />
              <div className="card-title">Procédé</div>
              <button className="btn sm ghost ml-auto"><Icon name="pencil" size={12} /></button>
            </div>
            <div className="card-body" style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <ol style={{ paddingLeft: 18, margin: 0 }}>
                <li>Tailler les topinambours en brunoise, réserver parures pour la purée.</li>
                <li>Rôtir les Saint-Jacques plancha bien chaude, 1 min par face.</li>
                <li>Monter le beurre noisette, déglacer au Xérès.</li>
                <li>Dresser · finition fleur de sel et noisettes concassées.</li>
              </ol>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

window.FichePage = FichePage;
