// RestoPilot — Employee CA input (ultra-simplified)
const { useState: useStateE } = React;

function EmployeePage({ onNav }) {
  const [cash, setCash] = useStateE(420);
  const [card, setCard] = useStateE(3280);
  const [tr, setTr] = useStateE(586);
  const total = (cash || 0) + (card || 0) + (tr || 0);

  return (
    <div className="emp-shell page-enter">
      <div className="emp-hero">
        <h1>Service du soir</h1>
        <p>Bonjour Léa · saisie du CA journalier</p>
        <div className="date">lundi 22 avril 2026 · 23:48</div>
      </div>

      <div className="emp-total">
        <div className="label">Total encaissé</div>
        <div className="value">{total.toLocaleString('fr-FR')} €</div>
      </div>

      <div className="emp-input-card">
        <div className="emp-ic-icon cash"><Icon name="euro" /></div>
        <div>
          <div className="emp-ic-label">Espèces</div>
          <div className="emp-ic-sub">Caisse du jour</div>
        </div>
        <input className="emp-ic-input" type="number" value={cash} onChange={e => setCash(parseFloat(e.target.value) || 0)} />
      </div>

      <div className="emp-input-card">
        <div className="emp-ic-icon card"><Icon name="wallet" /></div>
        <div>
          <div className="emp-ic-label">Carte bancaire</div>
          <div className="emp-ic-sub">CB + sans contact</div>
        </div>
        <input className="emp-ic-input" type="number" value={card} onChange={e => setCard(parseFloat(e.target.value) || 0)} />
      </div>

      <div className="emp-input-card">
        <div className="emp-ic-icon tr"><Icon name="tag" /></div>
        <div>
          <div className="emp-ic-label">Tickets restaurant</div>
          <div className="emp-ic-sub">TR papier + dématérialisés</div>
        </div>
        <input className="emp-ic-input" type="number" value={tr} onChange={e => setTr(parseFloat(e.target.value) || 0)} />
      </div>

      <button className="emp-validate">
        <Icon name="check" size={18} />Valider le service
      </button>

      <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: 'var(--text-subtle)' }}>
        <Icon name="info" size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
        Tes chiffres sont transmis instantanément à la direction
      </div>
    </div>
  );
}

// SUPPLIER DASHBOARD
function SupplierPage({ onNav }) {
  const orders = [
    { id: 'CMD-A612', client: 'Maison Lumière', qty: 18, amount: 612.40, status: 'new', time: 'il y a 12min' },
    { id: 'CMD-A611', client: 'Bistrot du Marais', qty: 24, amount: 842.00, status: 'prep', time: '1h' },
    { id: 'CMD-A610', client: 'Le Gavroche', qty: 32, amount: 1240.00, status: 'shipping', time: '3h' },
    { id: 'CMD-A609', client: 'Café des Arts', qty: 8, amount: 284.00, status: 'delivered', time: 'hier' },
  ];
  return (
    <div className="content page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard distributeur</h1>
          <div className="page-sub">Grossiste Lyon Halles · 48 clients actifs</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="upload" />Mercuriale</button>
          <button className="btn primary"><Icon name="plus" />Nouveau client</button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label"><Icon name="euro" />CA du jour</div>
          <div className="kpi-value">12 480<span className="unit">€</span></div>
          <div className="kpi-foot"><span className="kpi-delta up"><Icon name="arrow-up" size={11} />8,2%</span><span>vs hier</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-label"><Icon name="shopping-cart" />Commandes</div>
          <div className="kpi-value">23</div>
          <div className="kpi-foot"><span>à traiter aujourd'hui</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-label"><Icon name="users" />Clients actifs</div>
          <div className="kpi-value">48</div>
          <div className="kpi-foot"><span className="kpi-delta up"><Icon name="arrow-up" size={11} />+3</span><span>ce mois</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-label"><Icon name="file-text" />Avoirs en attente</div>
          <div className="kpi-value" style={{color:'var(--warning)'}}>4</div>
          <div className="kpi-foot"><span>540 € à régulariser</span></div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Commandes à traiter</div>
            <span className="badge accent ml-auto">{orders.filter(o=>o.status==='new').length} nouvelle</span>
          </div>
          <table className="table">
            <thead><tr><th>Référence</th><th>Client</th><th className="num">Articles</th><th className="num">Montant</th><th>Statut</th><th>Reçue</th></tr></thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td className="mono" style={{fontWeight:600,fontSize:12.5}}>{o.id}</td>
                  <td>{o.client}</td>
                  <td className="num">{o.qty}</td>
                  <td className="num" style={{fontWeight:600}}>{o.amount.toFixed(2)} €</td>
                  <td>
                    {o.status==='new' && <span className="badge accent"><span className="dot"/>Nouvelle</span>}
                    {o.status==='prep' && <span className="badge warning"><span className="dot"/>En prépa</span>}
                    {o.status==='shipping' && <span className="badge info"><span className="dot"/>En cours</span>}
                    {o.status==='delivered' && <span className="badge success"><span className="dot"/>Livrée</span>}
                  </td>
                  <td className="text-xs text-muted">{o.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-header"><Icon name="trending-up" size={15} style={{color:'var(--success)'}}/><div className="card-title">Top clients · avril</div></div>
          <div>
            {[
              {n:'Maison Lumière', a:8420, v:100},
              {n:'Le Gavroche', a:6240, v:74},
              {n:'Bistrot du Marais', a:4820, v:57},
              {n:'Brasserie Clichy', a:3940, v:47},
              {n:'Café des Arts', a:2180, v:26},
            ].map((c,i)=>(
              <div key={i} style={{padding:'10px 16px', borderBottom: i<4?'1px solid var(--border)':'none'}}>
                <div className="flex items-center gap-2 mb-2">
                  <span style={{fontSize:13,fontWeight:550}}>{c.n}</span>
                  <span className="mono ml-auto" style={{fontWeight:600,fontSize:12.5}}>{c.a.toLocaleString('fr-FR')} €</span>
                </div>
                <div className="marge-bar-wrap"><div className="marge-bar" style={{width:c.v+'%',background:'var(--accent)'}}/></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ADMIN
function AdminPage({ onNav }) {
  const users = [
    { name: 'Antoine Clément', email: 'antoine@maison-lumiere.fr', role: 'Restaurateur', org: 'Maison Lumière', status: 'active', last: 'il y a 2min', color:'#F59E0B' },
    { name: 'Grossiste Lyon Halles', email: 'commandes@lyon-halles.fr', role: 'Distributeur', org: 'Lyon Halles SA', status: 'active', last: '14min', color:'#6366F1' },
    { name: 'Léa Morel', email: 'lea.m@maison-lumiere.fr', role: 'Employé', org: 'Maison Lumière', status: 'active', last: '1h', color:'#EF4444' },
    { name: 'Marée Atlantique', email: 'contact@maree-atl.fr', role: 'Distributeur', org: 'Marée Atl. SARL', status: 'pending', last: '—', color:'#0EA5E9' },
    { name: 'Boucherie Dumas', email: 'dumas@pro.fr', role: 'Distributeur', org: 'SARL Dumas', status: 'active', last: '3h', color:'#10B981' },
    { name: 'Chef Paul Blanc', email: 'paul@gavroche.fr', role: 'Restaurateur', org: 'Le Gavroche', status: 'suspended', last: 'il y a 3j', color:'#8B5CF6' },
  ];
  return (
    <div className="content page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Administration</h1>
          <div className="page-sub">Gestion globale des comptes et arbitrage des litiges</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="download" />Export CSV</button>
          <button className="btn primary"><Icon name="plus" />Inviter utilisateur</button>
        </div>
      </div>

      <div className="admin-stat-grid">
        {[
          {l:'Restaurants', v:248, d:'+12 ce mois', c:'var(--accent)'},
          {l:'Distributeurs', v:62, d:'+3 ce mois', c:'var(--success)'},
          {l:'Employés', v:1420, d:'actifs', c:'var(--text)'},
          {l:'Litiges ouverts', v:7, d:'dont 2 urgents', c:'var(--danger)'},
        ].map(s=>(
          <div className="mercu-stat" key={s.l}>
            <div className="mercu-stat-label">{s.l}</div>
            <div className="mercu-stat-value" style={{color:s.c}}>{s.v}</div>
            <div className="text-xs text-muted" style={{marginTop:2}}>{s.d}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Tous les utilisateurs</div>
          <div className="ml-auto flex gap-2">
            <div className="seg">
              <button className="active">Tous</button>
              <button>Restaurateurs</button>
              <button>Distributeurs</button>
              <button>En attente</button>
            </div>
            <div className="search-box" style={{width:220}}><Icon name="search" size={14}/><input placeholder="Rechercher..."/></div>
          </div>
        </div>
        <div className="mercu-row mercu-row-head" style={{gridTemplateColumns:'40px 1fr 140px 120px 110px 100px 40px'}}>
          <span/><span>Utilisateur</span><span>Rôle</span><span>Organisation</span><span>Dernière activité</span><span>Statut</span><span/>
        </div>
        {users.map((u,i)=>(
          <div className="user-row" key={i}>
            <div className="user-av" style={{background:u.color}}>{u.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</div>
            <div>
              <div style={{fontWeight:550}}>{u.name}</div>
              <div className="text-xs text-muted">{u.email}</div>
            </div>
            <div>
              {u.role==='Restaurateur' && <span className="badge accent">{u.role}</span>}
              {u.role==='Distributeur' && <span className="badge info">{u.role}</span>}
              {u.role==='Employé' && <span className="badge neutral">{u.role}</span>}
            </div>
            <div className="text-sm text-muted">{u.org}</div>
            <div className="text-xs mono text-muted">{u.last}</div>
            <div>
              {u.status==='active' && <span className="badge success"><span className="dot"/>Actif</span>}
              {u.status==='pending' && <span className="badge warning"><span className="dot"/>En attente</span>}
              {u.status==='suspended' && <span className="badge danger"><span className="dot"/>Suspendu</span>}
            </div>
            <div><button className="icon-btn"><Icon name="more-horizontal" size={14}/></button></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// MARGE REPORT
function MargePage({ onNav }) {
  const dishes = [
    { name: 'Saint-Jacques rôties, topinambour', cat:'Entrée', cost:9.72, price:38, margin:74.4, volume:142, ca:5396 },
    { name: 'Bar de ligne en croûte de sel', cat:'Plat', cost:14.20, price:48, margin:70.4, volume:98, ca:4704 },
    { name: 'Filet de bœuf Rossini', cat:'Plat', cost:18.40, price:56, margin:67.1, volume:124, ca:6944 },
    { name: 'Risotto aux truffes', cat:'Plat', cost:12.80, price:42, margin:69.5, volume:86, ca:3612 },
    { name: 'Soufflé Grand Marnier', cat:'Dessert', cost:3.20, price:16, margin:80.0, volume:178, ca:2848 },
    { name: 'Tartare de thon rouge', cat:'Entrée', cost:8.90, price:24, margin:62.9, volume:64, ca:1536 },
    { name: 'Menu signature 6 services', cat:'Menu', cost:28.40, price:145, margin:80.4, volume:42, ca:6090 },
  ];
  const totalCa = dishes.reduce((s,d)=>s+d.ca,0);
  const avgMargin = dishes.reduce((s,d)=>s+d.margin*d.ca,0)/totalCa;

  return (
    <div className="content page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Rapport de marge</h1>
          <div className="page-sub">Analyse par plat · avril 2026 · 30 derniers jours</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="calendar-days" />avril 2026<Icon name="chevron-down" size={12}/></button>
          <button className="btn"><Icon name="download" />Exporter PDF</button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-label"><Icon name="euro"/>CA total</div><div className="kpi-value">{totalCa.toLocaleString('fr-FR')}<span className="unit">€</span></div><div className="kpi-foot"><span>30 jours</span></div></div>
        <div className="kpi"><div className="kpi-label"><Icon name="trending-up"/>Marge moyenne</div><div className="kpi-value" style={{color:'var(--success)'}}>{avgMargin.toFixed(1)}<span className="unit">%</span></div><div className="kpi-foot"><span>objectif 70%</span></div></div>
        <div className="kpi"><div className="kpi-label"><Icon name="star"/>Meilleure marge</div><div className="kpi-value">80,4<span className="unit">%</span></div><div className="kpi-foot"><span>Menu signature</span></div></div>
        <div className="kpi"><div className="kpi-label"><Icon name="alert-triangle"/>Sous objectif</div><div className="kpi-value" style={{color:'var(--warning)'}}>2</div><div className="kpi-foot"><span>plats à revoir</span></div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Détail par plat</div>
          <div className="seg ml-auto">
            <button className="active">Marge %</button>
            <button>CA</button>
            <button>Volume</button>
          </div>
        </div>
        <div className="mercu-row mercu-row-head" style={{gridTemplateColumns:'1fr 90px 90px 90px 140px 70px'}}>
          <span>Plat</span><span style={{textAlign:'right'}}>Coût</span><span style={{textAlign:'right'}}>Prix HT</span><span style={{textAlign:'right'}}>Volume</span><span>Marge %</span><span style={{textAlign:'right'}}>CA</span>
        </div>
        {dishes.map((d,i)=>{
          const color = d.margin>=70?'var(--success)':d.margin>=65?'var(--warning)':'var(--danger)';
          return (
            <div className="marge-row" key={i}>
              <div>
                <div style={{fontWeight:550}}>{d.name}</div>
                <div className="text-xs text-muted">{d.cat}</div>
              </div>
              <div className="mono" style={{textAlign:'right',fontSize:12.5}}>{d.cost.toFixed(2)} €</div>
              <div className="mono" style={{textAlign:'right',fontSize:12.5,fontWeight:600}}>{d.price.toFixed(2)} €</div>
              <div className="mono" style={{textAlign:'right',fontSize:12.5}}>{d.volume}</div>
              <div>
                <div className="flex items-center gap-2">
                  <div className="marge-bar-wrap" style={{flex:1}}>
                    <div className="marge-bar" style={{width:d.margin+'%',background:color}}/>
                  </div>
                  <span className="mono" style={{fontSize:12,fontWeight:600,color,minWidth:40,textAlign:'right'}}>{d.margin.toFixed(1)}%</span>
                </div>
              </div>
              <div className="mono" style={{textAlign:'right',fontSize:12.5,fontWeight:600}}>{d.ca.toLocaleString('fr-FR')} €</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

window.EmployeePage = EmployeePage;
window.SupplierPage = SupplierPage;
window.AdminPage = AdminPage;
window.MargePage = MargePage;
