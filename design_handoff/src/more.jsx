// RestoPilot — Menu builder, Onboarding, Settings
const { useState: useS3 } = React;

/* ============= MENU BUILDER ============= */
function MenuBuilderPage({ onNav }) {
  const library = [
    { id: 1, cat: 'E', name: 'Tartare de thon rouge', desc: 'Gingembre, mangue verte, huile de sésame', price: 24, cost: 8.90 },
    { id: 2, cat: 'E', name: 'Saint-Jacques rôties', desc: 'Topinambour, noisettes torréfiées', price: 38, cost: 9.72 },
    { id: 3, cat: 'E', name: 'Velouté de châtaigne', desc: 'Foie gras poêlé, jus de truffe', price: 22, cost: 6.40 },
    { id: 4, cat: 'P', name: 'Filet de bœuf Rossini', desc: 'Foie gras, sauce Périgueux', price: 56, cost: 18.40 },
    { id: 5, cat: 'P', name: 'Bar de ligne en croûte de sel', desc: 'Fenouil confit, beurre blanc', price: 48, cost: 14.20 },
    { id: 6, cat: 'P', name: 'Risotto aux truffes', desc: 'Parmesan affiné 30 mois', price: 42, cost: 12.80 },
    { id: 7, cat: 'D', name: 'Soufflé Grand Marnier', desc: 'Crème anglaise vanille Bourbon', price: 16, cost: 3.20 },
    { id: 8, cat: 'D', name: 'Tarte tatin', desc: 'Pomme Chanteclerc, glace fleur de sel', price: 14, cost: 2.80 },
  ];
  const [selected, setSelected] = useS3([1, 2, 4, 5, 7, 8]);
  const toggle = (id) => setSelected(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
  const chosen = library.filter(d => selected.includes(d.id));
  const byCat = (c) => chosen.filter(d => d.cat === c);
  const totalCost = chosen.reduce((s, d) => s + d.cost, 0);
  const totalPrice = chosen.reduce((s, d) => s + d.price, 0);
  const avgMargin = chosen.length ? (1 - totalCost / totalPrice) * 100 : 0;

  return (
    <div className="content page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Composer la carte</h1>
          <div className="page-sub">Carte de printemps 2026 · en vigueur dès le 1er mai</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="eye" />Aperçu imprimable</button>
          <button className="btn"><Icon name="download" />Exporter PDF</button>
          <button className="btn primary"><Icon name="check" />Publier la carte</button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-label"><Icon name="book-open" />Plats dans la carte</div><div className="kpi-value">{chosen.length}</div><div className="kpi-foot"><span>{byCat('E').length} entrées · {byCat('P').length} plats · {byCat('D').length} desserts</span></div></div>
        <div className="kpi"><div className="kpi-label"><Icon name="euro" />Ticket moyen cible</div><div className="kpi-value">{chosen.length ? (totalPrice / chosen.length).toFixed(0) : 0}<span className="unit">€</span></div><div className="kpi-foot"><span>menu complet {(byCat('E')[0]?.price + byCat('P')[0]?.price + byCat('D')[0]?.price) || 0} €</span></div></div>
        <div className="kpi"><div className="kpi-label"><Icon name="trending-up" />Marge moyenne</div><div className="kpi-value" style={{color:'var(--success)'}}>{avgMargin.toFixed(1)}<span className="unit">%</span></div><div className="kpi-foot"><span>objectif 70%</span></div></div>
        <div className="kpi"><div className="kpi-label"><Icon name="alert-triangle" />Plats sous-margés</div><div className="kpi-value">{chosen.filter(d => (1 - d.cost/d.price) * 100 < 65).length}</div><div className="kpi-foot"><span>à revoir</span></div></div>
      </div>

      <div className="menu-grid-2">
        <div className="menu-library">
          <div className="menu-lib-head">
            <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>Bibliothèque de plats</div>
            <div className="search-box"><Icon name="search" size={14}/><input placeholder="Rechercher..."/></div>
          </div>
          <div className="menu-lib-body">
            {library.map(d => {
              const sel = selected.includes(d.id);
              const marg = ((1 - d.cost / d.price) * 100).toFixed(0);
              return (
                <div className="menu-dish" key={d.id}>
                  <div className="menu-dish-thumb">{d.cat === 'E' ? 'ENT' : d.cat === 'P' ? 'PLA' : 'DES'}</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:550}}>{d.name}</div>
                    <div className="text-xs text-muted mono" style={{marginTop:2}}>{d.price} € · marge {marg}%</div>
                  </div>
                  <button className={`btn sm ${sel ? '' : 'primary'}`} onClick={() => toggle(d.id)} style={{padding:'4px 8px'}}>
                    {sel ? <><Icon name="check" size={12}/>Retirer</> : <><Icon name="plus" size={12}/>Ajouter</>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="menu-canvas">
          <div style={{textAlign:'center',marginBottom:28}}>
            <div style={{fontFamily:"'Playfair Display', Georgia, serif",fontSize:30,fontWeight:650,letterSpacing:'-0.02em'}}>Maison Lumière</div>
            <div className="text-xs text-muted mono" style={{marginTop:4,letterSpacing:'0.12em',textTransform:'uppercase'}}>Carte de printemps · 2026</div>
          </div>

          {[['E','Entrées'],['P','Plats'],['D','Desserts']].map(([c,title]) => (
            byCat(c).length > 0 && (
              <div key={c}>
                <div className="menu-section-title">
                  <span>{title}</span>
                  <span className="text-xs text-muted mono" style={{fontFamily:'var(--font-mono)'}}>{byCat(c).length} plats</span>
                </div>
                {byCat(c).map(d => (
                  <div className="menu-dish-row" key={d.id}>
                    <div>
                      <div className="name">{d.name}</div>
                      <div className="desc">{d.desc}</div>
                    </div>
                    <div className="price">{d.price} €</div>
                    <div className="rm" onClick={() => toggle(d.id)}><Icon name="x" size={14}/></div>
                  </div>
                ))}
              </div>
            )
          ))}

          {chosen.length === 0 && (
            <div style={{textAlign:'center',padding:'80px 0',color:'var(--text-subtle)'}}>
              <Icon name="book-open" size={32}/>
              <div style={{marginTop:10,fontSize:13}}>Ajoute des plats depuis la bibliothèque</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============= ONBOARDING ============= */
function OnboardingPage() {
  const [step, setStep] = useS3(0);
  const [role, setRole] = useS3('resto');
  const [name, setName] = useS3('');
  const steps = ['Rôle', 'Établissement', 'Équipe', 'Fini'];

  const roles = [
    { id: 'resto', label: 'Restaurateur', desc: 'Je gère un ou plusieurs établissements', icon: 'utensils', color: '#F59E0B' },
    { id: 'supplier', label: 'Distributeur', desc: 'Je fournis des restaurants professionnels', icon: 'truck', color: '#6366F1' },
    { id: 'employee', label: 'Employé', desc: 'Je saisis le CA journalier pour mon resto', icon: 'user', color: '#EF4444' },
  ];

  return (
    <div className="ob-shell page-enter">
      <div style={{textAlign:'center',marginBottom:28}}>
        <div style={{display:'inline-flex',alignItems:'center',gap:8,fontSize:15,fontWeight:650,letterSpacing:'-0.01em'}}>
          <div style={{width:26,height:26,borderRadius:7,background:'var(--accent)',color:'white',display:'grid',placeItems:'center',fontSize:12,fontWeight:700}}>R</div>
          RestoPilot
        </div>
      </div>

      <div className="ob-progress">
        {steps.map((_, i) => (
          <div className={`step ${i < step ? 'done' : i === step ? 'active' : ''}`} key={i}/>
        ))}
      </div>

      <div className="ob-card">
        {step === 0 && (<>
          <h1 className="ob-h1">Bienvenue ! 👋</h1>
          <p className="ob-sub">Pour commencer, dis-nous qui tu es.</p>
          {roles.map(r => (
            <div className={`ob-role ${role === r.id ? 'selected' : ''}`} key={r.id} onClick={() => setRole(r.id)}>
              <div className="ob-role-icon" style={{background: r.color}}><Icon name={r.icon} /></div>
              <div>
                <div style={{fontWeight:600,fontSize:14}}>{r.label}</div>
                <div className="text-xs text-muted" style={{marginTop:2}}>{r.desc}</div>
              </div>
              <div>
                {role === r.id && <div style={{width:18,height:18,borderRadius:'50%',background:'var(--accent)',display:'grid',placeItems:'center',color:'white'}}><Icon name="check" size={11}/></div>}
              </div>
            </div>
          ))}
        </>)}

        {step === 1 && (<>
          <h1 className="ob-h1">Ton établissement</h1>
          <p className="ob-sub">Ces infos seront reprises sur tes documents et factures.</p>
          <div className="ob-field"><label>Nom du restaurant</label><input placeholder="Maison Lumière" value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="ob-field"><label>Type de cuisine</label>
            <select><option>Bistronomie</option><option>Gastronomique</option><option>Traditionnel français</option><option>Pizzeria</option><option>Autre</option></select>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div className="ob-field"><label>Nombre de couverts / jour</label><input type="number" placeholder="80" /></div>
            <div className="ob-field"><label>Ticket moyen</label><input placeholder="48 €" /></div>
          </div>
          <div className="ob-field"><label>Adresse</label><input placeholder="23 rue Saint-Honoré, 75001 Paris" /></div>
          <div className="ob-field"><label>SIRET</label><input placeholder="48293847500024" /></div>
        </>)}

        {step === 2 && (<>
          <h1 className="ob-h1">Invite ton équipe</h1>
          <p className="ob-sub">Ils recevront un email pour créer leur accès (facultatif, tu peux le faire plus tard).</p>
          {['Sous-chef', 'Responsable salle', 'Comptable'].map((r, i) => (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 40px',gap:8,marginBottom:10}} key={i}>
              <input className="rec-qty-input" style={{textAlign:'left',fontFamily:'Inter',fontSize:13,padding:'9px 11px',width:'auto'}} placeholder="Prénom Nom" />
              <input className="rec-qty-input" style={{textAlign:'left',fontFamily:'Inter',fontSize:13,padding:'9px 11px',width:'auto'}} placeholder="email@resto.fr" />
              <div className="tva-chip" style={{justifyContent:'center',fontSize:11}}>{r.slice(0,3).toUpperCase()}</div>
            </div>
          ))}
          <button className="btn sm" style={{marginTop:4}}><Icon name="plus" size={12}/>Ajouter un membre</button>
          <div style={{marginTop:24,padding:14,background:'var(--accent-soft)',borderRadius:10,display:'flex',gap:10,alignItems:'start'}}>
            <Icon name="info" size={16} style={{color:'var(--accent)',flexShrink:0,marginTop:1}}/>
            <div className="text-sm" style={{color:'var(--accent)'}}>Chaque collaborateur aura son propre accès avec les permissions adaptées à son rôle.</div>
          </div>
        </>)}

        {step === 3 && (<>
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <div style={{width:68,height:68,borderRadius:'50%',background:'linear-gradient(135deg,#10B981,#059669)',margin:'0 auto 16px',display:'grid',placeItems:'center',color:'white',boxShadow:'0 8px 24px rgba(16,185,129,0.3)'}}>
              <Icon name="check" size={30}/>
            </div>
            <h1 className="ob-h1" style={{marginBottom:10}}>Tout est prêt, {name || 'Antoine'} !</h1>
            <p className="ob-sub" style={{maxWidth:400,margin:'0 auto 24px'}}>Ton espace {name || 'Maison Lumière'} est configuré. Prochaine étape : connecter ton premier fournisseur pour passer commande en 2 clics.</p>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              <button className="btn">Découvrir plus tard</button>
              <button className="btn primary"><Icon name="truck" />Connecter un fournisseur</button>
            </div>
          </div>
        </>)}

        {step < 3 && (
          <div className="ob-actions">
            {step > 0 ? <button className="btn" onClick={() => setStep(step - 1)}><Icon name="chevron-left" size={14}/>Retour</button> : <span/>}
            <button className="btn primary" onClick={() => setStep(step + 1)}>Continuer<Icon name="chevron-right" size={14}/></button>
          </div>
        )}
      </div>

      <div style={{textAlign:'center',marginTop:20,fontSize:12,color:'var(--text-subtle)'}}>
        Étape {step + 1} / {steps.length} · {steps[step]}
      </div>
    </div>
  );
}

/* ============= SETTINGS ============= */
function SettingsPage({ onNav }) {
  const [toggles, setToggles] = useS3({ auto: true, notif: true, alertes: true, sync: false, export: true });
  const flip = (k) => setToggles({ ...toggles, [k]: !toggles[k] });

  return (
    <div className="content page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Paramètres</h1>
          <div className="page-sub">Maison Lumière · Paris 1er</div>
        </div>
        <div className="page-actions">
          <button className="btn primary"><Icon name="check" />Enregistrer</button>
        </div>
      </div>

      <div className="settings-grid">
        <nav className="settings-nav">
          <a className="active"><Icon name="building" />Établissement</a>
          <a><Icon name="scale" />TVA & fiscalité</a>
          <a><Icon name="file-text" />Impressions</a>
          <a><Icon name="users" />Utilisateurs & rôles</a>
          <a><Icon name="credit-card" />Facturation</a>
          <a><Icon name="zap" />Intégrations</a>
          <a><Icon name="shield" />Sécurité</a>
          <a><Icon name="bell" />Notifications</a>
        </nav>

        <div>
          <div className="settings-section">
            <h3>Identité de l'établissement</h3>
            <p className="sub">Ces infos apparaissent sur tes documents et factures clients.</p>
            <div className="settings-row">
              <div>
                <div className="lbl">Raison sociale</div>
                <div className="desc">Nom commercial affiché sur les tickets</div>
              </div>
              <input className="rec-qty-input" style={{textAlign:'left',width:'100%',fontFamily:'Inter',fontSize:13,padding:'8px 10px'}} defaultValue="Maison Lumière SAS" />
            </div>
            <div className="settings-row">
              <div>
                <div className="lbl">SIRET</div>
                <div className="desc">Numéro d'immatriculation</div>
              </div>
              <input className="rec-qty-input" style={{textAlign:'left',width:'100%',fontFamily:'JetBrains Mono',fontSize:12.5,padding:'8px 10px'}} defaultValue="48293 84750 00024" />
            </div>
            <div className="settings-row">
              <div>
                <div className="lbl">Code APE / NAF</div>
                <div className="desc">5610A · Restauration traditionnelle</div>
              </div>
              <input className="rec-qty-input" style={{textAlign:'left',width:'100%',fontFamily:'JetBrains Mono',fontSize:12.5,padding:'8px 10px'}} defaultValue="5610A" />
            </div>
          </div>

          <div className="settings-section">
            <h3>TVA & fiscalité</h3>
            <p className="sub">Taux appliqués automatiquement par catégorie de vente.</p>
            <div className="settings-row">
              <div>
                <div className="lbl">Taux de TVA actifs</div>
                <div className="desc">France · applicable selon catégorie</div>
              </div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'flex-end'}}>
                <span className="tva-chip">5,5%</span>
                <span className="tva-chip">10%</span>
                <span className="tva-chip">20%</span>
              </div>
            </div>
            <div className="settings-row">
              <div>
                <div className="lbl">Affichage prix</div>
                <div className="desc">Sur fiches techniques et cartes</div>
              </div>
              <div className="seg" style={{justifySelf:'end'}}>
                <button className="active">TTC</button>
                <button>HT</button>
              </div>
            </div>
            <div className="settings-row">
              <div>
                <div className="lbl">Clôture fiscale</div>
                <div className="desc">Exercice comptable</div>
              </div>
              <select style={{padding:'8px 10px',border:'1px solid var(--border)',borderRadius:8,fontSize:13,background:'white'}}><option>31 décembre</option><option>30 juin</option></select>
            </div>
          </div>

          <div className="settings-section">
            <h3>Automatismes</h3>
            <p className="sub">Laisse RestoPilot faire le travail pour toi.</p>
            <div className="settings-row">
              <div>
                <div className="lbl">Import automatique des mercuriales</div>
                <div className="desc">Détection IA + rapprochement tarif à chaque réception de fournisseur</div>
              </div>
              <div className={`switch ${toggles.auto ? 'on' : ''}`} onClick={() => flip('auto')}/>
            </div>
            <div className="settings-row">
              <div>
                <div className="lbl">Alertes marge basse</div>
                <div className="desc">Notification dès qu'un plat descend sous 65% de marge</div>
              </div>
              <div className={`switch ${toggles.alertes ? 'on' : ''}`} onClick={() => flip('alertes')}/>
            </div>
            <div className="settings-row">
              <div>
                <div className="lbl">Synchro caisse Sumup / Tiller</div>
                <div className="desc">Remontée automatique du CA toutes les 15min</div>
              </div>
              <div className={`switch ${toggles.sync ? 'on' : ''}`} onClick={() => flip('sync')}/>
            </div>
            <div className="settings-row">
              <div>
                <div className="lbl">Export comptable mensuel</div>
                <div className="desc">Envoi automatique à ton expert-comptable au 5 du mois</div>
              </div>
              <div className={`switch ${toggles.export ? 'on' : ''}`} onClick={() => flip('export')}/>
            </div>
          </div>

          <div className="settings-section">
            <h3>Zone de danger</h3>
            <p className="sub">Actions irréversibles.</p>
            <div className="settings-row">
              <div>
                <div className="lbl" style={{color:'var(--danger)'}}>Supprimer l'établissement</div>
                <div className="desc">Toutes les données seront effacées après 30 jours.</div>
              </div>
              <button className="btn" style={{color:'var(--danger)',borderColor:'var(--danger-soft)',justifySelf:'end'}}>Supprimer</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.MenuBuilderPage = MenuBuilderPage;
window.OnboardingPage = OnboardingPage;
window.SettingsPage = SettingsPage;
