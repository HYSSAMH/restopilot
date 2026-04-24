// RestoPilot — Invoices (factures fournisseurs reçues + avoirs + import IA)
const { useState: useSInv } = React;

function InvoicesPage({ onNav }) {
  const invoices = [
    {
      id: 'FAC-2026-0428',
      type: 'facture',
      supplier: 'Grossiste Lyon Halles',
      supColor: '#6366F1',
      supInitials: 'GL',
      date: '22 avr. 2026',
      due: '22 mai 2026',
      amount: 612.40,
      amountHT: 579.96,
      tva: 32.44,
      status: 'pending',
      matched: 'ok',
      lines: [
        { d: 'Saint-Jacques Erquy IGP', q: 3, u: 'kg', p: 48.50, total: 145.50 },
        { d: 'Bar de ligne sauvage', q: 4, u: 'kg', p: 38.00, total: 152.00 },
        { d: 'Beurre AOP Charentes-Poitou', q: 2, u: 'kg', p: 12.80, total: 25.60 },
        { d: 'Truffe noire melanosporum', q: 0.1, u: 'kg', p: 890.00, total: 89.00 },
        { d: 'Topinambours bio', q: 8, u: 'kg', p: 4.20, total: 33.60 },
        { d: 'Crème épaisse 35%', q: 3, u: 'L', p: 5.60, total: 16.80 },
        { d: 'Huile olive Castelas AOP', q: 2, u: 'L', p: 28.00, total: 56.00 },
      ],
    },
    {
      id: 'FAC-2026-0427', type: 'facture', supplier: 'Marée Atlantique',
      supColor: '#0EA5E9', supInitials: 'MA',
      date: '21 avr. 2026', due: '21 mai 2026',
      amount: 348.20, amountHT: 329.71, tva: 18.49,
      status: 'paid', matched: 'warn',
    },
    {
      id: 'AV-2026-0114', type: 'avoir', supplier: 'Grossiste Lyon Halles',
      supColor: '#6366F1', supInitials: 'GL',
      date: '20 avr. 2026', due: '—',
      amount: -33.60, amountHT: -31.83, tva: -1.77,
      status: 'received', matched: 'ok',
      reason: 'Refus topinambours — qualité',
    },
    {
      id: 'FAC-2026-0426', type: 'facture', supplier: 'Boucherie Dumas',
      supColor: '#10B981', supInitials: 'BD',
      date: '19 avr. 2026', due: '19 mai 2026',
      amount: 1248.00, amountHT: 1181.00, tva: 67.00,
      status: 'overdue', matched: 'ok',
    },
    {
      id: 'FAC-2026-0425', type: 'facture', supplier: 'Cave des Vignerons',
      supColor: '#8B5CF6', supInitials: 'CV',
      date: '18 avr. 2026', due: '18 mai 2026',
      amount: 2840.00, amountHT: 2366.67, tva: 473.33,
      status: 'pending', matched: 'ok',
    },
    {
      id: 'FAC-2026-0424', type: 'facture', supplier: 'Épicerie fine Provence',
      supColor: '#F59E0B', supInitials: 'EP',
      date: '17 avr. 2026', due: '17 mai 2026',
      amount: 418.70, amountHT: 396.31, tva: 22.39,
      status: 'paid', matched: 'ko',
    },
    {
      id: 'AV-2026-0113', type: 'avoir', supplier: 'Marée Atlantique',
      supColor: '#0EA5E9', supInitials: 'MA',
      date: '14 avr. 2026', due: '—',
      amount: -58.00, amountHT: -54.92, tva: -3.08,
      status: 'received', matched: 'ok',
      reason: 'Écart pesée bar de ligne',
    },
    {
      id: 'FAC-2026-0423', type: 'facture', supplier: 'Fromagerie Laurent',
      supColor: '#EF4444', supInitials: 'FL',
      date: '12 avr. 2026', due: '12 mai 2026',
      amount: 482.40, amountHT: 456.61, tva: 25.79,
      status: 'pending', matched: 'ok',
    },
  ];

  const [selected, setSelected] = useSInv(invoices[0]);
  const [filter, setFilter] = useSInv('all');
  const [uploadState, setUploadState] = useSInv('idle'); // idle | uploading | processing | done
  const [dragActive, setDragActive] = useSInv(false);

  const filtered = invoices.filter(i => {
    if (filter === 'all') return true;
    if (filter === 'factures') return i.type === 'facture';
    if (filter === 'avoirs') return i.type === 'avoir';
    if (filter === 'pending') return i.status === 'pending';
    if (filter === 'overdue') return i.status === 'overdue';
    return true;
  });

  const stats = {
    total: invoices.filter(i => i.type === 'facture').reduce((s, i) => s + i.amount, 0),
    avoirs: invoices.filter(i => i.type === 'avoir').reduce((s, i) => s + Math.abs(i.amount), 0),
    pending: invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.amount, 0),
    overdue: invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0),
    count: invoices.length,
  };

  const startImport = () => {
    setUploadState('uploading');
    setTimeout(() => setUploadState('processing'), 900);
    setTimeout(() => setUploadState('done'), 3600);
  };

  const statusBadge = (s) => {
    if (s === 'pending') return <span className="badge warning"><span className="dot"/>À payer</span>;
    if (s === 'paid') return <span className="badge success"><span className="dot"/>Payée</span>;
    if (s === 'overdue') return <span className="badge danger"><span className="dot"/>En retard</span>;
    if (s === 'received') return <span className="badge info"><span className="dot"/>Reçu</span>;
    return null;
  };

  return (
    <div className="content page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Factures & avoirs fournisseurs</h1>
          <div className="page-sub">Maison Lumière · avril 2026 · {invoices.length} documents ce mois</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="download" />Export FEC</button>
          <button className="btn"><Icon name="file-text" />Rapprochement mercuriale</button>
          <button className="btn primary" onClick={startImport}><Icon name="upload" />Importer une facture</button>
        </div>
      </div>

      {/* Import zone */}
      {uploadState === 'idle' && (
        <div className="inv-import-zone"
          onDragOver={e => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={e => { e.preventDefault(); setDragActive(false); startImport(); }}
          className={`inv-import-zone ${dragActive ? 'drag' : ''}`}
          onClick={startImport}
        >
          <div className="inv-import-icon"><Icon name="upload" /></div>
          <div style={{fontSize:15,fontWeight:600,marginBottom:4}}>Glisse tes factures ici</div>
          <div className="text-sm text-muted">PDF, JPG, PNG · 20 Mo max · L'IA détecte fournisseur, lignes, TVA et rapproche avec la mercuriale</div>
          <div className="inv-import-sources">
            <div className="inv-import-src"><Icon name="file-text" />PDF / Image</div>
            <div className="inv-import-src"><Icon name="inbox" />Email dédié</div>
            <div className="inv-import-src"><Icon name="link" />Webdora / Chorus</div>
            <div className="inv-import-src"><Icon name="camera" />Scan mobile</div>
          </div>
        </div>
      )}

      {uploadState !== 'idle' && uploadState !== 'done' && (
        <div style={{marginBottom:16,padding:18,background:'var(--accent-soft)',border:'1px solid var(--accent-border)',borderRadius:12}}>
          <div style={{fontSize:13,fontWeight:600,color:'var(--accent)',marginBottom:10,display:'flex',alignItems:'center',gap:8}}>
            <Icon name="zap" size={14} />Import IA en cours
          </div>
          <div className="inv-upload-row">
            <div className="inv-upload-ic pdf"><Icon name="file-pdf" /></div>
            <div>
              <div style={{fontSize:13,fontWeight:550}}>facture-lyon-halles-042926.pdf</div>
              <div className="inv-upload-progress"><div style={{width: uploadState === 'uploading' ? '45%' : '100%'}}/></div>
            </div>
            <div className="inv-upload-status ing">
              {uploadState === 'uploading' && <><Icon name="loader" size={12}/>Téléversement...</>}
              {uploadState === 'processing' && <><Icon name="zap" size={12}/>Analyse OCR + rapprochement...</>}
            </div>
            <div className="text-xs text-muted mono">482 Ko</div>
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:10}}>
            <div className={`ai-step ${uploadState !== 'uploading' ? 'done' : 'active'}`}><Icon name="check" size={10}/>OCR texte</div>
            <div className={`ai-step ${uploadState === 'processing' ? 'active' : uploadState === 'done' ? 'done' : ''}`}><Icon name="check" size={10}/>Détection fournisseur</div>
            <div className={`ai-step ${uploadState === 'processing' ? 'active' : ''}`}><Icon name="check" size={10}/>Extraction lignes</div>
            <div className={`ai-step ${uploadState === 'processing' ? 'active' : ''}`}><Icon name="check" size={10}/>Rapprochement mercuriale</div>
          </div>
        </div>
      )}

      {uploadState === 'done' && (
        <div style={{marginBottom:16,padding:14,background:'var(--success-soft)',border:'1px solid #A7F3D0',borderRadius:10,display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:32,height:32,borderRadius:'50%',background:'var(--success)',display:'grid',placeItems:'center',color:'white'}}><Icon name="check" size={16}/></div>
          <div style={{flex:1}}>
            <div style={{fontSize:13.5,fontWeight:600,color:'var(--success)'}}>Facture importée avec succès · FAC-2026-0429</div>
            <div className="text-xs" style={{color:'#047857'}}>7 lignes extraites · rapprochement 100% · écart tarif détecté sur 1 article</div>
          </div>
          <button className="btn sm" onClick={() => setUploadState('idle')}>Importer une autre</button>
          <button className="btn sm primary">Voir la facture</button>
        </div>
      )}

      {/* Stats */}
      <div className="inv-stats">
        <div className="inv-stat">
          <div className="label"><Icon name="file-text" />Total factures</div>
          <div className="value">{stats.total.toFixed(0)} €</div>
          <div className="sub">avril · {invoices.filter(i=>i.type==='facture').length} factures</div>
        </div>
        <div className="inv-stat success">
          <div className="label"><Icon name="trending-down" />Avoirs reçus</div>
          <div className="value">−{stats.avoirs.toFixed(2)} €</div>
          <div className="sub">{invoices.filter(i=>i.type==='avoir').length} avoirs · suite refus</div>
        </div>
        <div className="inv-stat warn">
          <div className="label"><Icon name="clock" />À payer</div>
          <div className="value">{stats.pending.toFixed(0)} €</div>
          <div className="sub">{invoices.filter(i=>i.status==='pending').length} factures en attente</div>
        </div>
        <div className="inv-stat danger">
          <div className="label"><Icon name="alert-triangle" />En retard</div>
          <div className="value">{stats.overdue.toFixed(0)} €</div>
          <div className="sub">{invoices.filter(i=>i.status==='overdue').length} facture · action requise</div>
        </div>
        <div className="inv-stat">
          <div className="label"><Icon name="zap" />Rapprochement auto</div>
          <div className="value" style={{color:'var(--success)'}}>94%</div>
          <div className="sub">1 écart tarif détecté</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center'}}>
        <div className="seg">
          <button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>Tout ({invoices.length})</button>
          <button className={filter==='factures'?'active':''} onClick={()=>setFilter('factures')}>Factures ({invoices.filter(i=>i.type==='facture').length})</button>
          <button className={filter==='avoirs'?'active':''} onClick={()=>setFilter('avoirs')}>Avoirs ({invoices.filter(i=>i.type==='avoir').length})</button>
          <button className={filter==='pending'?'active':''} onClick={()=>setFilter('pending')}>À payer</button>
          <button className={filter==='overdue'?'active':''} onClick={()=>setFilter('overdue')}>En retard</button>
        </div>
        <div className="search-box ml-auto" style={{width:240}}><Icon name="search" size={14}/><input placeholder="Rechercher fournisseur, n°..."/></div>
        <button className="btn sm"><Icon name="filter" />Filtres</button>
      </div>

      {/* Split view */}
      <div className="inv-list-grid">
        <div className="inv-list">
          <div className="inv-list-head">
            <div style={{fontSize:12,color:'var(--text-muted)',fontWeight:550,display:'flex',justifyContent:'space-between'}}>
              <span>{filtered.length} documents</span>
              <span className="mono">avril 2026</span>
            </div>
          </div>
          <div className="inv-list-body">
            {filtered.map(inv => (
              <div key={inv.id} className={`inv-row ${inv.type==='avoir'?'avoir':''} ${selected?.id===inv.id?'active':''}`} onClick={() => setSelected(inv)}>
                <div className="top">
                  <div className="sup" style={{background: inv.supColor}}>{inv.supInitials}</div>
                  <span className="num">{inv.id}</span>
                  {inv.type === 'avoir' && <span className="badge danger" style={{padding:'1px 6px',fontSize:10}}>AVOIR</span>}
                  <span className="amount">{inv.amount.toFixed(2)} €</span>
                </div>
                <div className="name">{inv.supplier}</div>
                <div className="meta">
                  <span className="mono">{inv.date}</span>
                  <span>·</span>
                  {statusBadge(inv.status)}
                  {inv.matched === 'warn' && <span className="badge warning" style={{padding:'1px 5px',fontSize:10}}>Écart</span>}
                  {inv.matched === 'ko' && <span className="badge danger" style={{padding:'1px 5px',fontSize:10}}>Non rapproché</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail */}
        {selected && (
          <div className="inv-detail">
            <div className="inv-detail-head">
              <div className="sup" style={{width:40,height:40,borderRadius:10,background:selected.supColor,color:'white',display:'grid',placeItems:'center',fontSize:13,fontWeight:700,flexShrink:0}}>{selected.supInitials}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <span className="mono text-xs" style={{color:'var(--text-subtle)',fontWeight:600}}>{selected.id}</span>
                  {selected.type === 'avoir' && <span className="badge danger">AVOIR</span>}
                  {statusBadge(selected.status)}
                </div>
                <div style={{fontSize:17,fontWeight:650,letterSpacing:'-0.01em'}}>{selected.supplier}</div>
                <div className="text-sm text-muted" style={{marginTop:2}}>Émise le {selected.date} · échéance {selected.due}</div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div className="mono" style={{fontSize:22,fontWeight:700,color: selected.type==='avoir'?'var(--danger)':'var(--text)'}}>{selected.amount.toFixed(2)} €</div>
                <div className="text-xs text-muted mono">dont {selected.tva.toFixed(2)} € TVA</div>
              </div>
              <div style={{display:'flex',gap:6,flexShrink:0}}>
                <button className="icon-btn"><Icon name="download" size={14}/></button>
                <button className="icon-btn"><Icon name="more-horizontal" size={14}/></button>
              </div>
            </div>

            <div className="inv-detail-body">
              {/* Paper preview */}
              <div className="inv-preview">
                <div className="inv-paper">
                  <div className="paper-head">
                    <div>
                      <h2>{selected.supplier}</h2>
                      <div className="paper-meta">
                        {selected.type === 'avoir' ? 'Avoir n° ' : 'Facture n° '}{selected.id}<br/>
                        Date : {selected.date}<br/>
                        {selected.due !== '—' && <>Échéance : {selected.due}</>}
                      </div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div className="paper-meta" style={{textAlign:'right'}}>
                        <strong>Maison Lumière SAS</strong><br/>
                        23 rue Saint-Honoré<br/>
                        75001 Paris<br/>
                        SIRET 48293847500024
                      </div>
                    </div>
                  </div>
                  {selected.reason && (
                    <div style={{padding:'8px 12px',background:'#FEF3C7',borderRadius:4,marginBottom:10,fontSize:11,color:'#92400E'}}>
                      <strong>Motif de l'avoir :</strong> {selected.reason}
                    </div>
                  )}
                  {selected.lines && (
                    <table>
                      <thead>
                        <tr><th>Désignation</th><th className="num">Qté</th><th className="num">P.U. HT</th><th className="num">Total HT</th></tr>
                      </thead>
                      <tbody>
                        {selected.lines.map((l, i) => (
                          <tr key={i}>
                            <td>{l.d}</td>
                            <td className="num">{l.q} {l.u}</td>
                            <td className="num">{l.p.toFixed(2)} €</td>
                            <td className="num">{l.total.toFixed(2)} €</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div className="paper-totals">
                    <div className="lbl">Total HT</div>
                    <div className="val">{selected.amountHT.toFixed(2)} €</div>
                    <div className="lbl">TVA (5,5% + 20%)</div>
                    <div className="val">{selected.tva.toFixed(2)} €</div>
                    <div className="lbl grand"><span>Total TTC</span></div>
                    <div className="val grand">{selected.amount.toFixed(2)} €</div>
                  </div>
                </div>
              </div>

              {/* Info panel */}
              <div className="inv-info">
                <div className="section">
                  <h4>Informations</h4>
                  <div className="field"><span className="k">Fournisseur</span><span className="v">{selected.supplier}</span></div>
                  <div className="field"><span className="k">Date</span><span className="v mono" style={{fontSize:12.5}}>{selected.date}</span></div>
                  <div className="field"><span className="k">Échéance</span><span className="v mono" style={{fontSize:12.5}}>{selected.due}</span></div>
                  <div className="field"><span className="k">Mode paiement</span><span className="v">Virement 30j</span></div>
                  <div className="field"><span className="k">Compte comptable</span><span className="v mono" style={{fontSize:12.5}}>401000 · Achats</span></div>
                </div>

                {selected.lines && (
                  <div className="section">
                    <h4>Rapprochement mercuriale</h4>
                    <div className="reconcile-box">
                      <div className="reconcile-head">
                        <Icon name="zap" size={12}/>
                        Auto-match 6/7 lignes
                        <span className="ml-auto mono" style={{fontSize:11,fontWeight:500}}>94% confiance</span>
                      </div>
                      <div className="reconcile-line">
                        <div>Saint-Jacques Erquy IGP</div>
                        <div className="mono text-xs" style={{textAlign:'right'}}>48,50 €</div>
                        <div className="mono text-xs text-muted" style={{textAlign:'right'}}>tarif 48,50</div>
                        <div className="delta">=</div>
                        <div className="match ok"><Icon name="check"/></div>
                      </div>
                      <div className="reconcile-line">
                        <div>Bar de ligne sauvage</div>
                        <div className="mono text-xs" style={{textAlign:'right'}}>38,00 €</div>
                        <div className="mono text-xs text-muted" style={{textAlign:'right'}}>tarif 36,00</div>
                        <div className="delta up">+5,6%</div>
                        <div className="match warn"><Icon name="alert-triangle"/></div>
                      </div>
                      <div className="reconcile-line">
                        <div>Beurre AOP Charentes</div>
                        <div className="mono text-xs" style={{textAlign:'right'}}>12,80 €</div>
                        <div className="mono text-xs text-muted" style={{textAlign:'right'}}>tarif 12,80</div>
                        <div className="delta">=</div>
                        <div className="match ok"><Icon name="check"/></div>
                      </div>
                      <div className="reconcile-line">
                        <div>Truffe melanosporum</div>
                        <div className="mono text-xs" style={{textAlign:'right'}}>890,00 €</div>
                        <div className="mono text-xs text-muted" style={{textAlign:'right'}}>tarif 890</div>
                        <div className="delta">=</div>
                        <div className="match ok"><Icon name="check"/></div>
                      </div>
                      <div className="reconcile-line">
                        <div>Topinambours bio</div>
                        <div className="mono text-xs" style={{textAlign:'right'}}>4,20 €</div>
                        <div className="mono text-xs text-muted" style={{textAlign:'right'}}>refusé</div>
                        <div className="delta"><span style={{color:'var(--danger)',fontSize:11}}>avoir</span></div>
                        <div className="match ok"><Icon name="check"/></div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="section">
                  <h4>Actions</h4>
                  <div style={{display:'grid',gap:6}}>
                    {selected.status === 'pending' && <button className="btn primary" style={{justifyContent:'center'}}><Icon name="check" />Marquer comme payée</button>}
                    {selected.status === 'overdue' && <button className="btn primary" style={{justifyContent:'center',background:'var(--danger)',borderColor:'var(--danger)'}}><Icon name="euro" />Payer maintenant</button>}
                    <button className="btn" style={{justifyContent:'center'}}><Icon name="file-text" />Demander un avoir</button>
                    <button className="btn" style={{justifyContent:'center'}}><Icon name="eye" />Voir la commande liée</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

window.InvoicesPage = InvoicesPage;
