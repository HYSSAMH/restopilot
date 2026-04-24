// RestoPilot — Mon profil (identité, sécurité, préférences, notifications)
const { useState: useMP } = React;

function ProfilePage({ onNav }) {
  const [tab, setTab] = useMP('identity');
  const [name, setName] = useMP('Julien Mercier');
  const [email, setEmail] = useMP('julien@maisonlumiere.fr');
  const [tel, setTel] = useMP('06 12 45 78 90');
  const [role] = useMP('Propriétaire-gérant');
  const [lang, setLang] = useMP('fr');
  const [tz, setTz] = useMP('Europe/Paris');
  const [theme, setTheme] = useMP('light');
  const [twofa, setTwofa] = useMP(true);
  const [notifPrefs, setNotifPrefs] = useMP({
    orderReceived: { email: true, push: true },
    priceChange:   { email: true, push: false },
    dispute:       { email: true, push: true },
    lowStock:      { email: false, push: true },
    dailyDigest:   { email: true, push: false },
    budgetAlert:   { email: true, push: true },
    weeklyReport:  { email: true, push: false },
  });

  const toggleNotif = (key, channel) => {
    setNotifPrefs({
      ...notifPrefs,
      [key]: { ...notifPrefs[key], [channel]: !notifPrefs[key][channel] },
    });
  };

  const tabs = [
    { id: 'identity', label: 'Identité', icon: 'user' },
    { id: 'security', label: 'Sécurité', icon: 'shield' },
    { id: 'prefs',    label: 'Préférences', icon: 'sliders' },
    { id: 'notifs',   label: 'Notifications', icon: 'bell' },
  ];

  return (
    <div className="content page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mon profil</h1>
          <div className="page-sub">Gère ton compte, ta sécurité et tes préférences</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="log-out" />Se déconnecter</button>
        </div>
      </div>

      <div className="pr-layout">
        {/* Left nav */}
        <div className="pr-nav">
          <div className="pr-profile-header">
            <div className="pr-avatar">JM</div>
            <div style={{ fontSize: 14, fontWeight: 650, letterSpacing: '-0.01em' }}>{name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{role}</div>
            <div style={{ fontSize: 11, color: 'var(--text-subtle)', marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, background: 'var(--success)', borderRadius: '50%' }} />
              En ligne · Maison Lumière
            </div>
          </div>

          {tabs.map(t => (
            <button
              key={t.id}
              className={'pr-nav-item' + (tab === t.id ? ' active' : '')}
              onClick={() => setTab(t.id)}
            >
              <Icon name={t.icon} size={14} />
              {t.label}
            </button>
          ))}

          <div style={{ marginTop: 'auto', padding: 10 }}>
            <div style={{ fontSize: 10.5, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 6 }}>
              Compte créé
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              15 mars 2021
            </div>
          </div>
        </div>

        {/* Panel */}
        <div className="pr-panel">
          {tab === 'identity' && (
            <>
              <div className="pr-section-head">
                <div>
                  <h2>Identité</h2>
                  <p>Informations visibles par ton équipe et tes fournisseurs</p>
                </div>
              </div>

              <div className="pr-avatar-block">
                <div className="pr-avatar lg">JM</div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 3 }}>Photo de profil</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>PNG ou JPG, max 2 Mo</div>
                  <div className="flex gap-2">
                    <button className="btn sm"><Icon name="upload" size={12} />Téléverser</button>
                    <button className="btn sm" style={{ color: 'var(--danger)' }}>Supprimer</button>
                  </div>
                </div>
              </div>

              <div className="pr-grid">
                <div className="pr-field">
                  <label>Nom complet</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="pr-field">
                  <label>Rôle dans l'établissement</label>
                  <input value={role} disabled />
                  <div className="pr-hint">Défini par ton administrateur</div>
                </div>
                <div className="pr-field">
                  <label>Email</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} />
                  <div className="pr-hint"><Icon name="check" size={11} style={{ color: 'var(--success)' }} /> Vérifié</div>
                </div>
                <div className="pr-field">
                  <label>Téléphone</label>
                  <input value={tel} onChange={(e) => setTel(e.target.value)} />
                </div>
              </div>

              <div className="pr-save-bar">
                <button className="btn">Annuler</button>
                <button className="btn primary"><Icon name="check" />Enregistrer</button>
              </div>
            </>
          )}

          {tab === 'security' && (
            <>
              <div className="pr-section-head">
                <div><h2>Sécurité</h2><p>Protège ton compte et contrôle tes accès</p></div>
              </div>

              <div className="pr-card-row">
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>Mot de passe</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                    Modifié il y a 2 mois · <span style={{ color: 'var(--success)' }}>Fort</span>
                  </div>
                </div>
                <button className="btn">Modifier</button>
              </div>

              <div className="pr-card-row">
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    Authentification à deux facteurs
                    {twofa && <span style={{ fontSize: 10.5, background: 'var(--success-soft)', color: 'var(--success)', padding: '2px 7px', borderRadius: 10, fontWeight: 650 }}>Activée</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                    Application d'authentification (Google Authenticator)
                  </div>
                </div>
                <button className={'pr-toggle' + (twofa ? ' on' : '')} onClick={() => setTwofa(!twofa)}>
                  <span className="dot" />
                </button>
              </div>

              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Sessions actives</span>
                  <button style={{ border: 0, background: 'transparent', color: 'var(--danger)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                    Déconnecter toutes les sessions
                  </button>
                </div>
                <div className="pr-sessions">
                  <div className="pr-session current">
                    <Icon name="monitor" size={16} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        MacBook Pro · Safari
                        <span style={{ fontSize: 10, background: 'var(--accent-soft)', color: 'var(--accent)', padding: '2px 7px', borderRadius: 10, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cette session</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Paris, France · maintenant</div>
                    </div>
                  </div>
                  <div className="pr-session">
                    <Icon name="smartphone" size={16} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>iPhone 15 · app RestoPilot</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Paris, France · il y a 3 h</div>
                    </div>
                    <button className="icon-btn"><Icon name="log-out" size={13} /></button>
                  </div>
                  <div className="pr-session">
                    <Icon name="monitor" size={16} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>PC bureau · Chrome</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Paris, France · hier</div>
                    </div>
                    <button className="icon-btn"><Icon name="log-out" size={13} /></button>
                  </div>
                </div>
              </div>
            </>
          )}

          {tab === 'prefs' && (
            <>
              <div className="pr-section-head">
                <div><h2>Préférences</h2><p>Personnalise ton expérience</p></div>
              </div>

              <div className="pr-grid">
                <div className="pr-field">
                  <label>Langue</label>
                  <select value={lang} onChange={(e) => setLang(e.target.value)}>
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="it">Italiano</option>
                  </select>
                </div>
                <div className="pr-field">
                  <label>Fuseau horaire</label>
                  <select value={tz} onChange={(e) => setTz(e.target.value)}>
                    <option value="Europe/Paris">Paris (GMT+1)</option>
                    <option value="Europe/London">Londres (GMT)</option>
                    <option value="Europe/Madrid">Madrid (GMT+1)</option>
                  </select>
                </div>
                <div className="pr-field" style={{ gridColumn: '1 / -1' }}>
                  <label>Thème</label>
                  <div className="pr-theme-row">
                    {['light', 'dark', 'auto'].map(t => (
                      <button
                        key={t}
                        className={'pr-theme-opt' + (theme === t ? ' active' : '')}
                        onClick={() => setTheme(t)}
                      >
                        <div className={'pr-theme-preview ' + t}>
                          <div className="bar" />
                          <div className="content-block" />
                        </div>
                        <span>{t === 'light' ? 'Clair' : t === 'dark' ? 'Sombre' : 'Automatique'}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="pr-field">
                  <label>Format monétaire</label>
                  <select defaultValue="eur">
                    <option value="eur">EUR — 1 234,56 €</option>
                    <option value="eur2">EUR — €1,234.56</option>
                  </select>
                </div>
                <div className="pr-field">
                  <label>Premier jour de la semaine</label>
                  <select defaultValue="mon">
                    <option value="mon">Lundi</option>
                    <option value="sun">Dimanche</option>
                  </select>
                </div>
              </div>

              <div className="pr-save-bar">
                <button className="btn">Annuler</button>
                <button className="btn primary"><Icon name="check" />Enregistrer</button>
              </div>
            </>
          )}

          {tab === 'notifs' && (
            <>
              <div className="pr-section-head">
                <div><h2>Notifications</h2><p>Choisis ce que tu veux recevoir et comment</p></div>
              </div>

              <div className="pr-notifs-table">
                <div className="pr-notifs-head">
                  <span>Événement</span>
                  <span style={{ textAlign: 'center' }}>Email</span>
                  <span style={{ textAlign: 'center' }}>Push mobile</span>
                </div>
                {[
                  { k: 'orderReceived', label: 'Commande réceptionnée', desc: 'Quand une livraison est pointée' },
                  { k: 'priceChange', label: 'Changement de prix fournisseur', desc: 'Hausse ou baisse > 5%' },
                  { k: 'dispute', label: 'Litige ou écart détecté', desc: 'Lors d\'une réception' },
                  { k: 'lowStock', label: 'Stock faible', desc: 'Seuil d\'alerte atteint' },
                  { k: 'budgetAlert', label: 'Alerte budget', desc: 'Dépassement de 80% de l\'enveloppe' },
                  { k: 'dailyDigest', label: 'Récapitulatif quotidien', desc: 'Email chaque matin à 8h' },
                  { k: 'weeklyReport', label: 'Rapport hebdomadaire', desc: 'KPIs + marges chaque lundi' },
                ].map(n => (
                  <div key={n.k} className="pr-notifs-row">
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{n.label}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>{n.desc}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <button className={'pr-toggle sm' + (notifPrefs[n.k].email ? ' on' : '')} onClick={() => toggleNotif(n.k, 'email')}>
                        <span className="dot" />
                      </button>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <button className={'pr-toggle sm' + (notifPrefs[n.k].push ? ' on' : '')} onClick={() => toggleNotif(n.k, 'push')}>
                        <span className="dot" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

window.ProfilePage = ProfilePage;
