// RestoPilot — Reception, Planning, Inventory, Analytics
const { useState: useS2, useMemo: useM2 } = React;

/* ============= RECEPTION ============= */
function ReceptionPage({ onNav }) {
  const [items, setItems] = useS2([
    { id: 1, name: 'Saint-Jacques Erquy IGP', cmd: 3.0, unit: 'kg', price: 48.50, received: 3.0, status: 'ok', photo: false, note: '' },
    { id: 2, name: 'Bar de ligne sauvage', cmd: 4.0, unit: 'kg', price: 38.00, received: 3.8, status: 'warn', photo: true, note: 'Manque 200g' },
    { id: 3, name: 'Beurre AOP Charentes-Poitou', cmd: 2.0, unit: 'kg', price: 12.80, received: 2.0, status: 'ok', photo: false },
    { id: 4, name: 'Truffe noire melanosporum', cmd: 0.1, unit: 'kg', price: 890.00, received: 0.08, status: 'warn', photo: true, note: 'Poids pesé réception' },
    { id: 5, name: 'Topinambours bio', cmd: 8.0, unit: 'kg', price: 4.20, received: 0, status: 'ko', photo: true, note: 'Qualité refusée — moisi' },
    { id: 6, name: 'Crème épaisse 35%', cmd: 3.0, unit: 'L', price: 5.60, received: 3.0, status: 'ok', photo: false },
    { id: 7, name: 'Huile olive Castelas AOP', cmd: 2.0, unit: 'L', price: 28.00, received: 2.0, status: 'ok', photo: false },
  ]);
  const ok = items.filter(i => i.status === 'ok').length;
  const warn = items.filter(i => i.status === 'warn').length;
  const ko = items.filter(i => i.status === 'ko').length;
  const avoir = items.reduce((s, i) => {
    if (i.status === 'ko') return s + i.cmd * i.price;
    if (i.status === 'warn') return s + (i.cmd - i.received) * i.price;
    return s;
  }, 0);

  const cycle = (id) => {
    setItems(items.map(i => i.id === id ? { ...i, status: i.status === 'ok' ? 'warn' : i.status === 'warn' ? 'ko' : 'ok' } : i));
  };

  return (
    <div className="content page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Réception livraison</h1>
          <div className="page-sub">Grossiste Lyon Halles · bon BL-24891 · 22 avril 2026 · 07:42</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="camera" />Photo globale</button>
          <button className="btn primary"><Icon name="check" />Valider la réception</button>
        </div>
      </div>

      <div className="rec-bon-head">
        <div>
          <div className="text-xs text-muted">Fournisseur</div>
          <div style={{fontWeight:600,fontSize:14,marginTop:2}}>Grossiste Lyon Halles</div>
          <div className="text-xs text-muted" style={{marginTop:2}}>Chauffeur · Karim B. · camion 38-AL-902</div>
        </div>
        <div>
          <div className="text-xs text-muted">Montant bon</div>
          <div className="mono" style={{fontWeight:700,fontSize:18,marginTop:2}}>612,40 €</div>
        </div>
        <div>
          <div className="text-xs text-muted">Avoir à demander</div>
          <div className="mono" style={{fontWeight:700,fontSize:18,marginTop:2,color:'var(--danger)'}}>{avoir.toFixed(2)} €</div>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'flex-end'}}>
          <span className="badge success"><span className="dot"/>{ok} OK</span>
          <span className="badge warning"><span className="dot"/>{warn} écart</span>
          <span className="badge danger"><span className="dot"/>{ko} refusé</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Articles livrés</div><span className="text-xs text-muted ml-auto">Clique sur l'état pour changer · OK → Écart → Refusé</span></div>
        <div className="mercu-row mercu-row-head" style={{gridTemplateColumns:'36px 1fr 100px 100px 100px 140px'}}>
          <span/><span>Article</span><span style={{textAlign:'right'}}>Commandé</span><span style={{textAlign:'right'}}>Reçu</span><span style={{textAlign:'right'}}>P.U.</span><span>Note / Photo</span>
        </div>
        {items.map(it => (
          <div className={`rec-line ${it.status}`} key={it.id}>
            <div className={`rec-chk ${it.status}`} onClick={() => cycle(it.id)}>
              {it.status === 'ok' && <Icon name="check" size={12}/>}
              {it.status === 'warn' && <Icon name="alert-triangle" size={12}/>}
              {it.status === 'ko' && <Icon name="x" size={12}/>}
            </div>
            <div>
              <div style={{fontWeight:550}}>{it.name}</div>
              {it.note && <div className="text-xs" style={{color: it.status==='ko'?'var(--danger)':'var(--warning)', marginTop:2}}>{it.note}</div>}
            </div>
            <div className="mono" style={{textAlign:'right',fontSize:12.5}}>{it.cmd} {it.unit}</div>
            <div style={{textAlign:'right'}}>
              <input className="rec-qty-input" defaultValue={it.received} /> <span className="text-xs text-muted">{it.unit}</span>
            </div>
            <div className="mono" style={{textAlign:'right',fontSize:12.5}}>{it.price.toFixed(2)} €</div>
            <div style={{display:'flex',gap:6,alignItems:'center'}}>
              <div className={`rec-photo ${it.photo?'has':''}`}><Icon name="camera" size={12}/></div>
              <button className="btn sm ghost" style={{padding:'4px 8px',fontSize:11}}>+ Note</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============= PLANNING ============= */
function PlanningPage({ onNav }) {
  const days = [
    { d: 'Lun', n: '22' }, { d: 'Mar', n: '23' }, { d: 'Mer', n: '24' },
    { d: 'Jeu', n: '25' }, { d: 'Ven', n: '26' }, { d: 'Sam', n: '27' }, { d: 'Dim', n: '28' },
  ];
  const team = [
    { name: 'Antoine C.', role: 'Chef', color: '#F59E0B', shifts: ['journee:08-23', 'soir:17-23', 'journee:08-23', 'journee:08-23', 'journee:08-23', 'soir:17-23', 'off'] },
    { name: 'Marie L.', role: 'Sous-chef', color: '#EF4444', shifts: ['midi:10-15', 'journee:10-23', 'off', 'midi:10-15', 'journee:10-23', 'journee:10-23', 'journee:10-23'] },
    { name: 'Léa M.', role: 'Salle', color: '#8B5CF6', shifts: ['soir:18-00', 'soir:18-00', 'soir:18-00', 'off', 'soir:18-00', 'soir:18-00', 'conge:Congé'] },
    { name: 'Théo R.', role: 'Plonge', color: '#0EA5E9', shifts: ['midi:11-15', 'midi:11-15', 'soir:18-23', 'soir:18-23', 'midi:11-15', 'soir:18-23', 'off'] },
    { name: 'Sofia G.', role: 'Salle', color: '#10B981', shifts: ['off', 'midi:11-15', 'midi:11-15', 'soir:18-00', 'journee:10-23', 'journee:10-23', 'midi:11-15'] },
    { name: 'Karim Z.', role: 'Commis', color: '#EC4899', shifts: ['soir:16-23', 'soir:16-23', 'midi:09-15', 'soir:16-23', 'soir:16-23', 'midi:09-15', 'off'] },
  ];
  const totalHours = 248;
  const plannedHours = 232;

  return (
    <div className="content page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Planning équipe</h1>
          <div className="page-sub">Semaine 17 · 22 – 28 avril 2026 · 6 collaborateurs</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="chevron-left" size={14}/></button>
          <button className="btn">Cette semaine</button>
          <button className="btn"><Icon name="chevron-right" size={14}/></button>
          <button className="btn"><Icon name="copy" />Dupliquer semaine</button>
          <button className="btn primary"><Icon name="plus" />Nouveau shift</button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-label"><Icon name="clock" />Heures plannifiées</div><div className="kpi-value">{plannedHours}<span className="unit">h</span></div><div className="kpi-foot"><span>sur {totalHours}h contrat</span></div></div>
        <div className="kpi"><div className="kpi-label"><Icon name="euro" />Masse salariale</div><div className="kpi-value">4 820<span className="unit">€</span></div><div className="kpi-foot"><span>{((4820/18600)*100).toFixed(1)}% du CA prévu</span></div></div>
        <div className="kpi"><div className="kpi-label"><Icon name="alert-triangle" />Conflits</div><div className="kpi-value" style={{color:'var(--warning)'}}>1</div><div className="kpi-foot"><span>Léa · demande de congé</span></div></div>
        <div className="kpi"><div className="kpi-label"><Icon name="check" />Pointages ce jour</div><div className="kpi-value">4 / 6</div><div className="kpi-foot"><span>2 arrivées à venir</span></div></div>
      </div>

      <div className="plan-grid">
        <div className="plan-cell plan-head">Collaborateur</div>
        {days.map(d => (
          <div className="plan-cell plan-head" key={d.n}>
            {d.d}<div className="date">{d.n} avr.</div>
          </div>
        ))}
        {team.map((m, mi) => (
          <React.Fragment key={mi}>
            <div className="plan-cell plan-emp">
              <div className="av" style={{background: m.color}}>{m.name.split(' ').map(n => n[0]).slice(0,2).join('')}</div>
              <div>
                <div style={{fontSize:12.5}}>{m.name}</div>
                <div className="text-xs text-muted">{m.role}</div>
              </div>
            </div>
            {m.shifts.map((s, si) => {
              const [type, label] = s.split(':');
              return (
                <div className="plan-cell" key={si}>
                  <div className={`plan-shift ${type}`}>
                    <span style={{fontWeight:650,fontSize:10.5,textTransform:'uppercase',letterSpacing:'0.04em',opacity:0.7}}>
                      {type === 'off' ? '—' : type === 'conge' ? 'Congé' : type === 'midi' ? 'Midi' : type === 'soir' ? 'Soir' : 'Journée'}
                    </span>
                    {type !== 'off' && type !== 'conge' && <span className="time">{label}</span>}
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ============= INVENTORY ============= */
function InventoryPage({ onNav }) {
  const items = [
    { cat: 'MER', catColor: '#0EA5E9', name: 'Saint-Jacques Erquy (surgelé)', theo: 4.2, reel: 3.9, unit: 'kg', price: 48.50 },
    { cat: 'MER', catColor: '#0EA5E9', name: 'Bar de ligne', theo: 2.8, reel: 2.8, unit: 'kg', price: 38.00 },
    { cat: 'VIA', catColor: '#EF4444', name: 'Filet de bœuf Simmental', theo: 3.5, reel: 3.2, unit: 'kg', price: 62.00 },
    { cat: 'VIA', catColor: '#EF4444', name: 'Foie gras cru IGP', theo: 1.2, reel: 1.4, unit: 'kg', price: 54.00 },
    { cat: 'LAI', catColor: '#F59E0B', name: 'Beurre AOP Charentes', theo: 6.0, reel: 5.8, unit: 'kg', price: 12.80 },
    { cat: 'LAI', catColor: '#F59E0B', name: 'Crème épaisse 35%', theo: 8.0, reel: 7.5, unit: 'L', price: 5.60 },
    { cat: 'LEG', catColor: '#10B981', name: 'Topinambours bio', theo: 12, reel: 9.5, unit: 'kg', price: 4.20 },
    { cat: 'CAV', catColor: '#8B5CF6', name: 'Sancerre blanc 2022', theo: 24, reel: 22, unit: 'btl', price: 14.00 },
    { cat: 'CAV', catColor: '#8B5CF6', name: 'Chablis 1er cru 2021', theo: 12, reel: 12, unit: 'btl', price: 28.00 },
    { cat: 'EPI', catColor: '#6366F1', name: 'Huile olive Castelas', theo: 4.0, reel: 3.8, unit: 'L', price: 28.00 },
  ];
  const totalTheo = items.reduce((s, i) => s + i.theo * i.price, 0);
  const totalReel = items.reduce((s, i) => s + i.reel * i.price, 0);
  const ecart = totalReel - totalTheo;
  const compteES = items.filter(i => i.reel > 0).length;

  return (
    <div className="content page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventaire mensuel</h1>
          <div className="page-sub">Clôture avril 2026 · 48 références · Stock au 30/04 à 23h</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="download" />Exporter</button>
          <button className="btn"><Icon name="upload" />Importer CSV</button>
          <button className="btn primary"><Icon name="check" />Clôturer l'inventaire</button>
        </div>
      </div>

      <div className="inv-head-stat">
        <div className="mercu-stat"><div className="mercu-stat-label">Stock théorique</div><div className="mercu-stat-value">{totalTheo.toFixed(0)} €</div><div className="text-xs text-muted">selon logiciel</div></div>
        <div className="mercu-stat"><div className="mercu-stat-label">Stock réel compté</div><div className="mercu-stat-value">{totalReel.toFixed(0)} €</div><div className="text-xs text-muted">{compteES}/{items.length} comptés</div></div>
        <div className="mercu-stat"><div className="mercu-stat-label">Écart valorisé</div><div className="mercu-stat-value" style={{color: ecart >= 0 ? 'var(--success)' : 'var(--danger)'}}>{ecart >= 0 ? '+' : ''}{ecart.toFixed(0)} €</div><div className="text-xs text-muted">{(ecart/totalTheo*100).toFixed(1)}% démarque</div></div>
        <div className="mercu-stat"><div className="mercu-stat-label">Rotation moyenne</div><div className="mercu-stat-value">14j</div><div className="text-xs text-muted">sur produits frais</div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Détail par référence</div>
          <div className="seg ml-auto">
            <button className="active">Toutes</button>
            <button>Mer</button><button>Viande</button><button>Lait</button>
            <button>Légumes</button><button>Cave</button><button>Épicerie</button>
          </div>
        </div>
        <div className="mercu-row mercu-row-head" style={{gridTemplateColumns:'24px 1fr 100px 120px 100px 100px 140px 80px'}}>
          <span/><span>Référence</span><span style={{textAlign:'right'}}>Théo.</span><span style={{textAlign:'right'}}>Réel compté</span><span style={{textAlign:'right'}}>P.U.</span><span style={{textAlign:'right'}}>Valo.</span><span style={{textAlign:'right'}}>Écart</span><span/>
        </div>
        {items.map((it, i) => {
          const diff = it.reel - it.theo;
          const val = it.reel * it.price;
          const pct = (diff / it.theo) * 100;
          return (
            <div className="inv-row" key={i}>
              <div className="inv-cat-icon" style={{background: it.catColor}}>{it.cat}</div>
              <div style={{fontWeight:550}}>{it.name}</div>
              <div className="mono" style={{textAlign:'right',fontSize:12.5}}>{it.theo} {it.unit}</div>
              <div style={{textAlign:'right'}}>
                <input className="inv-count-input" defaultValue={it.reel} /> <span className="text-xs text-muted">{it.unit}</span>
              </div>
              <div className="mono" style={{textAlign:'right',fontSize:12.5}}>{it.price.toFixed(2)} €</div>
              <div className="mono" style={{textAlign:'right',fontSize:12.5,fontWeight:600}}>{val.toFixed(0)} €</div>
              <div style={{textAlign:'right'}}>
                <span className={`inv-ecart ${diff>=0?'pos':'neg'}`}>
                  {diff >= 0 ? '+' : ''}{diff.toFixed(1)} {it.unit} ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)
                </span>
              </div>
              <div style={{textAlign:'right'}}>
                <button className="icon-btn"><Icon name="more-horizontal" size={14}/></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============= ANALYTICS ============= */
function AnalyticsPage({ onNav }) {
  const sites = [
    { name: 'Maison Lumière (Paris 1)', ca: 148200, ratio: 100, pct: '+8,2%', up: true },
    { name: 'Maison Lumière (Lyon 2)', ca: 112400, ratio: 76, pct: '+4,1%', up: true },
    { name: 'Bistrot Lumière (Paris 11)', ca: 92800, ratio: 62, pct: '-2,4%', up: false },
    { name: 'Cave Lumière (Paris 6)', ca: 48600, ratio: 33, pct: '+12,8%', up: true },
  ];
  const totalCa = sites.reduce((s, x) => s + x.ca, 0);

  // sparkline data
  const trend = [62, 58, 64, 70, 66, 72, 74, 78, 82, 76, 80, 85, 82, 88, 92, 88, 94, 96, 92, 98, 102, 108, 104, 112, 118, 114, 120, 124, 128, 132];
  const max = Math.max(...trend);
  const min = Math.min(...trend);
  const points = trend.map((v, i) => `${(i / (trend.length - 1)) * 100},${100 - ((v - min) / (max - min)) * 100}`).join(' ');

  const foodCost = [
    { m: 'Jan', pct: 28.4 }, { m: 'Fév', pct: 29.2 }, { m: 'Mar', pct: 28.8 },
    { m: 'Avr', pct: 27.9 }, { m: 'Mai', pct: 28.1 }, { m: 'Jun', pct: 28.6 },
    { m: 'Jul', pct: 29.8 }, { m: 'Aoû', pct: 30.2 }, { m: 'Sep', pct: 29.1 },
    { m: 'Oct', pct: 28.2 }, { m: 'Nov', pct: 27.8 }, { m: 'Déc', pct: 28.5 },
  ];
  const fcMax = Math.max(...foodCost.map(f => f.pct));
  const fcMin = Math.min(...foodCost.map(f => f.pct));

  return (
    <div className="content page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics multi-sites</h1>
          <div className="page-sub">4 établissements · avril 2026 · comparaison mensuelle</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="calendar-days" />avril 2026<Icon name="chevron-down" size={12}/></button>
          <div className="seg"><button>Jour</button><button>Semaine</button><button className="active">Mois</button><button>Année</button></div>
          <button className="btn"><Icon name="download" />Exporter</button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-label"><Icon name="euro" />CA consolidé</div><div className="kpi-value">{(totalCa/1000).toFixed(0)}<span className="unit">k€</span></div><div className="kpi-foot"><span className="kpi-delta up"><Icon name="arrow-up" size={11}/>6,2%</span><span>vs mars</span></div></div>
        <div className="kpi"><div className="kpi-label"><Icon name="trending-down" />Food cost moyen</div><div className="kpi-value">28,2<span className="unit">%</span></div><div className="kpi-foot"><span className="kpi-delta down"><Icon name="arrow-down" size={11}/>0,6pt</span><span>vs mars</span></div></div>
        <div className="kpi"><div className="kpi-label"><Icon name="users" />Couverts</div><div className="kpi-value">8 420</div><div className="kpi-foot"><span className="kpi-delta up"><Icon name="arrow-up" size={11}/>4,1%</span><span>vs mars</span></div></div>
        <div className="kpi"><div className="kpi-label"><Icon name="receipt" />Ticket moyen</div><div className="kpi-value">47,80<span className="unit">€</span></div><div className="kpi-foot"><span className="kpi-delta up"><Icon name="arrow-up" size={11}/>2,0%</span><span>vs mars</span></div></div>
      </div>

      <div className="analytics-grid">
        <div className="card">
          <div className="card-header">
            <div className="card-title">CA consolidé · 30 derniers jours</div>
            <span className="badge success ml-auto"><Icon name="trending-up" size={11}/>+6,2%</span>
          </div>
          <div style={{padding:'14px 16px'}}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{width:'100%',height:200}}>
              <defs>
                <linearGradient id="anaGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#6366F1" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="#6366F1" stopOpacity="0"/>
                </linearGradient>
              </defs>
              <polyline fill="url(#anaGrad)" stroke="none" points={`0,100 ${points} 100,100`}/>
              <polyline fill="none" stroke="#6366F1" strokeWidth="1.2" vectorEffect="non-scaling-stroke" points={points}/>
            </svg>
            <div className="flex items-center justify-between mt-2 text-xs text-muted">
              <span>1 avr.</span><span>15 avr.</span><span>30 avr.</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Top plats · avril</div></div>
          <div>
            {[
              { n: 'Saint-Jacques rôties', c: 178, amt: 6764 },
              { n: 'Filet bœuf Rossini', c: 124, amt: 6944 },
              { n: 'Bar en croûte de sel', c: 98, amt: 4704 },
              { n: 'Menu signature', c: 42, amt: 6090 },
              { n: 'Risotto truffes', c: 86, amt: 3612 },
            ].map((p, i) => (
              <div key={i} style={{padding:'11px 16px',borderBottom:i<4?'1px solid var(--border)':'none',display:'flex',alignItems:'center',gap:10}}>
                <span style={{fontFamily:'var(--font-mono)',color:'var(--text-subtle)',fontSize:11,fontWeight:600,width:18}}>{(i+1).toString().padStart(2,'0')}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:550}}>{p.n}</div>
                  <div className="text-xs text-muted">{p.c} couverts</div>
                </div>
                <span className="mono" style={{fontWeight:600,fontSize:12.5}}>{p.amt.toLocaleString('fr-FR')} €</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{marginBottom:16}}>
        <div className="card-header"><div className="card-title">Comparateur établissements · CA avril</div><span className="text-xs text-muted ml-auto">Trié par CA décroissant</span></div>
        {sites.map((s, i) => (
          <div className="site-bar" key={i}>
            <div style={{fontWeight:550,fontSize:13}}>{s.name}</div>
            <div className="bar-wrap"><div className="bar" style={{width: s.ratio + '%'}}/></div>
            <div className="mono" style={{textAlign:'right',fontWeight:600}}>{s.ca.toLocaleString('fr-FR')} €</div>
            <div style={{textAlign:'right'}}>
              <span className={`kpi-delta ${s.up?'up':'down'}`}>
                <Icon name={s.up?'arrow-up':'arrow-down'} size={11}/>{s.pct}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Food cost · 12 derniers mois</div><span className="badge warning ml-auto">Pic en août · 30,2%</span></div>
        <div style={{padding:'18px 20px'}}>
          <svg viewBox="0 0 400 140" style={{width:'100%',height:160}}>
            <line x1="0" y1="40" x2="400" y2="40" stroke="#E8E8EC" strokeDasharray="2,3" strokeWidth="1"/>
            <line x1="0" y1="80" x2="400" y2="80" stroke="#E8E8EC" strokeDasharray="2,3" strokeWidth="1"/>
            <text x="5" y="38" fontSize="9" fill="#94A3B8" fontFamily="JetBrains Mono">30%</text>
            <text x="5" y="78" fontSize="9" fill="#94A3B8" fontFamily="JetBrains Mono">28%</text>
            {foodCost.map((f, i) => {
              const x = 30 + (i * (370 / (foodCost.length - 1)));
              const y = 20 + ((fcMax - f.pct) / (fcMax - fcMin)) * 100;
              return (
                <g key={i}>
                  {i > 0 && (() => {
                    const prev = foodCost[i-1];
                    const px = 30 + ((i-1) * (370 / (foodCost.length - 1)));
                    const py = 20 + ((fcMax - prev.pct) / (fcMax - fcMin)) * 100;
                    return <line x1={px} y1={py} x2={x} y2={y} stroke="#6366F1" strokeWidth="2"/>;
                  })()}
                  <circle cx={x} cy={y} r="3" fill="white" stroke="#6366F1" strokeWidth="2"/>
                  <text x={x} y="135" fontSize="10" fill="#64748B" textAnchor="middle" fontFamily="Inter">{f.m}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}

window.ReceptionPage = ReceptionPage;
window.PlanningPage = PlanningPage;
window.InventoryPage = InventoryPage;
window.AnalyticsPage = AnalyticsPage;
