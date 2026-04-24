// RestoPilot — À réceptionner (liste des livraisons + détail de réception)
const { useState: useRX, useMemo: useMRX } = React;

const RX_DELIVERIES = [
  {
    id: 'CMD-2614', sup: 'halles', date: 'today', eta: '10:30', driver: 'Karim B. · Fourgon F-8',
    lines: 18, ht: 579.96, ttc: 612.40, status: 'arriving', progress: 95,
  },
  {
    id: 'CMD-2613', sup: 'maree', date: 'today', eta: '11:45', driver: 'Véronique M.',
    lines: 6, ht: 269.15, ttc: 284.00, status: 'in-transit', progress: 60,
  },
  {
    id: 'CMD-2615', sup: 'boucher', date: 'today', eta: '14:00', driver: 'Thomas D.',
    lines: 8, ht: 798.86, ttc: 842.60, status: 'scheduled',
  },
  {
    id: 'CMD-2616', sup: 'terroir', date: 'tomorrow', eta: '08:30', driver: 'Terroir Express',
    lines: 24, ht: 472.08, ttc: 498.20, status: 'scheduled',
  },
  {
    id: 'CMD-2617', sup: 'epicerie', date: 'tomorrow', eta: '11:00', driver: 'Pierre L.',
    lines: 14, ht: 324.80, ttc: 342.65, status: 'scheduled',
  },
  {
    id: 'CMD-2618', sup: 'vin', date: 'thursday', eta: '09:00', driver: 'DHL Premium',
    lines: 12, ht: 2033.33, ttc: 2440.00, status: 'scheduled',
  },
];

const RX_LINES_BASE = [
  { id: 1, name: 'Saint-Jacques Erquy IGP', meta: 'Noix · Cal. 20/30', cmd: 3.0, unit: 'kg', price: 48.50, received: null, status: null, note: '', photo: false },
  { id: 2, name: 'Bar de ligne sauvage',    meta: 'Entier · 1.2 kg', cmd: 4.0, unit: 'kg', price: 38.00, received: null, status: null, note: '', photo: false },
  { id: 3, name: 'Beurre AOP Charentes-Poitou', meta: 'Doux · Plaque 1 kg', cmd: 2.0, unit: 'kg', price: 12.80, received: null, status: null, note: '', photo: false },
  { id: 4, name: 'Truffe noire melanosporum', meta: '1ère qualité', cmd: 0.1, unit: 'kg', price: 890.00, received: null, status: null, note: '', photo: false },
  { id: 5, name: 'Topinambours bio',        meta: 'Cal. 40+ · Bretagne', cmd: 8.0, unit: 'kg', price: 4.20, received: null, status: null, note: '', photo: false },
  { id: 6, name: 'Crème épaisse 35%',       meta: 'Bidon 3L · Isigny', cmd: 3.0, unit: 'L', price: 5.60, received: null, status: null, note: '', photo: false },
  { id: 7, name: 'Huile olive Castelas',    meta: 'AOP · Bidon 5L', cmd: 2.0, unit: 'L', price: 28.00, received: null, status: null, note: '', photo: false },
  { id: 8, name: 'Échalotes roses',         meta: 'Cal. 30/50 · Bretagne', cmd: 2.0, unit: 'kg', price: 6.40, received: null, status: null, note: '', photo: false },
];

function ReceivePage({ onNav }) {
  const [view, setView] = useRX('list'); // list | detail
  const [activeDelivery, setActiveDelivery] = useRX(null);
  const [filter, setFilter] = useRX('all');

  const grouped = {
    today: RX_DELIVERIES.filter(d => d.date === 'today'),
    tomorrow: RX_DELIVERIES.filter(d => d.date === 'tomorrow'),
    thursday: RX_DELIVERIES.filter(d => d.date === 'thursday'),
  };

  const stats = {
    today: grouped.today.length,
    week: RX_DELIVERIES.length,
    inTransit: RX_DELIVERIES.filter(d => d.status === 'in-transit' || d.status === 'arriving').length,
    discrepancies: 2,
  };

  const supShort = (id) => SUPPLIERS[id];

  if (view === 'detail' && activeDelivery) {
    return <ReceiveDetail delivery={activeDelivery} onBack={() => { setView('list'); setActiveDelivery(null); }} />;
  }

  const StatusPill = ({ status }) => {
    const map = {
      scheduled: { label: 'Planifiée', cls: 'scheduled' },
      'in-transit': { label: 'En livraison', cls: 'in-transit', pulse: true },
      arriving: { label: 'Livreur sur place', cls: 'arriving', pulse: true },
      received: { label: 'Réceptionnée', cls: 'received' },
      discrepancy: { label: 'Écart détecté', cls: 'discrepancy' },
    };
    const s = map[status] || map.scheduled;
    return (
      <span className={'rx-status-pill ' + s.cls}>
        <span className={'dot' + (s.pulse ? ' pulse' : '')} />
        {s.label}
      </span>
    );
  };

  const renderCard = (d) => {
    const sup = supShort(d.sup);
    const initials = sup.short.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    return (
      <div key={d.id} className={'rx-delivery-card status-' + d.status} onClick={() => { setActiveDelivery(d); setView('detail'); }}>
        <div className="rx-sup-badge" style={{ background: sup.color }}>{initials}</div>
        <div>
          <div className="rx-sup-name">{sup.name}</div>
          <div className="rx-sup-meta">
            <span style={{ fontFamily: 'var(--font-mono)' }}>{d.id}</span>
            <span>·</span>
            <span>{d.driver}</span>
          </div>
        </div>
        <div className="rx-eta">
          <div className="time">
            <Icon name="clock" size={13} style={{ verticalAlign: -1, marginRight: 4, color: 'var(--text-muted)' }} />
            {d.eta}
          </div>
          <div className="driver">{d.date === 'today' ? 'aujourd\'hui' : d.date === 'tomorrow' ? 'demain' : 'jeudi'}</div>
        </div>
        <div className="rx-lines-count">
          <span className="big">{d.lines} lignes</span>
          <span className="sub">{d.ttc.toFixed(2)} € TTC</span>
        </div>
        <StatusPill status={d.status} />
        <button className="btn primary sm" onClick={(e) => { e.stopPropagation(); setActiveDelivery(d); setView('detail'); }}>
          <Icon name="check" size={13} />
          {d.status === 'arriving' ? 'Réceptionner' : 'Ouvrir'}
        </button>
      </div>
    );
  };

  return (
    <div className="content page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">À réceptionner</h1>
          <div className="page-sub">6 livraisons programmées cette semaine · {stats.inTransit} en cours de transit</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="camera" />Scanner BL</button>
          <button className="btn"><Icon name="plus" />Réception libre</button>
        </div>
      </div>

      {/* Stats */}
      <div className="rx-stats">
        <div className="rx-stat">
          <div className="rx-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <Icon name="calendar-days" size={16} />
          </div>
          <div className="label">Aujourd'hui</div>
          <div className="value">{stats.today}</div>
          <div className="sub">1 arrivée imminente · 1 en route</div>
        </div>
        <div className="rx-stat">
          <div className="rx-icon" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
            <Icon name="truck" size={16} />
          </div>
          <div className="label">Cette semaine</div>
          <div className="value">{stats.week}</div>
          <div className="sub">Total HT · 4 478 €</div>
        </div>
        <div className="rx-stat">
          <div className="rx-icon" style={{ background: '#FEF3C7', color: '#A16207' }}>
            <Icon name="loader" size={16} />
          </div>
          <div className="label">En transit</div>
          <div className="value">{stats.inTransit}</div>
          <div className="sub">Suivi temps réel activé</div>
        </div>
        <div className="rx-stat">
          <div className="rx-icon" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
            <Icon name="alert-triangle" size={16} />
          </div>
          <div className="label">Écarts ce mois</div>
          <div className="value">{stats.discrepancies}</div>
          <div className="sub">126 € de réclamations</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2" style={{ marginBottom: 12 }}>
        <button className={'chip' + (filter==='all' ? ' active' : '')} onClick={() => setFilter('all')}>Toutes · {RX_DELIVERIES.length}</button>
        <button className={'chip' + (filter==='today' ? ' active' : '')} onClick={() => setFilter('today')}>Aujourd'hui · {stats.today}</button>
        <button className={'chip' + (filter==='tomorrow' ? ' active' : '')} onClick={() => setFilter('tomorrow')}>Demain · {grouped.tomorrow.length}</button>
        <button className={'chip' + (filter==='transit' ? ' active' : '')} onClick={() => setFilter('transit')}>En transit · {stats.inTransit}</button>
      </div>

      {/* Today */}
      {(filter === 'all' || filter === 'today' || filter === 'transit') && grouped.today.length > 0 && (
        <>
          <div className="rx-day-header today">
            <Icon name="calendar-days" size={13} />
            Aujourd'hui · mardi 23 avril
            <span className="count">{grouped.today.length}</span>
          </div>
          {grouped.today.filter(d => filter !== 'transit' || d.status === 'in-transit' || d.status === 'arriving').map(renderCard)}
        </>
      )}

      {(filter === 'all' || filter === 'tomorrow') && grouped.tomorrow.length > 0 && (
        <>
          <div className="rx-day-header">
            Demain · mercredi 24 avril
            <span className="count">{grouped.tomorrow.length}</span>
          </div>
          {grouped.tomorrow.map(renderCard)}
        </>
      )}

      {(filter === 'all') && grouped.thursday.length > 0 && (
        <>
          <div className="rx-day-header">
            Jeudi 25 avril
            <span className="count">{grouped.thursday.length}</span>
          </div>
          {grouped.thursday.map(renderCard)}
        </>
      )}
    </div>
  );
}

/* =========================================================
   DÉTAIL DE RÉCEPTION (après clic sur une livraison)
   ========================================================= */
function ReceiveDetail({ delivery, onBack }) {
  const [lines, setLines] = useRX(RX_LINES_BASE.slice(0, delivery.lines > 8 ? 8 : delivery.lines).map(l => ({ ...l, received: l.cmd })));
  const [signed, setSigned] = useRX(false);
  const [temp, setTemp] = useRX('');

  const sup = SUPPLIERS[delivery.sup];
  const initials = sup.short.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  const updateLine = (id, patch) => setLines(lines.map(l => l.id === id ? { ...l, ...patch } : l));

  const done = lines.filter(l => l.status !== null).length;
  const progress = (done / lines.length) * 100;
  const okCount = lines.filter(l => l.status === 'ok').length;
  const koCount = lines.filter(l => l.status === 'discrepancy' || l.status === 'missing').length;

  // avoir calculation
  const avoirAmount = lines.reduce((s, l) => {
    if (l.status === 'missing') return s + l.cmd * l.price;
    if (l.status === 'discrepancy') return s + Math.max(0, l.cmd - (l.received || 0)) * l.price;
    return s;
  }, 0);

  const handleQtyAdjust = (id, delta) => {
    const line = lines.find(l => l.id === id);
    const newQty = Math.max(0, (line.received || line.cmd) + delta);
    updateLine(id, { received: parseFloat(newQty.toFixed(2)) });
  };

  return (
    <div className="content page-enter">
      {/* Header */}
      <div className="rx-detail-head">
        <button className="back-btn" onClick={onBack}><Icon name="arrow-left" size={16} /></button>
        <div>
          <div className="flex items-center gap-2" style={{ marginBottom: 3 }}>
            <div className="rx-sup-badge" style={{ background: sup.color, width: 32, height: 32, fontSize: 12 }}>{initials}</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 650 }}>{sup.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{delivery.id}</span> · livraison prévue {delivery.eta} · {delivery.driver}
              </div>
            </div>
          </div>
          <div className="rx-progress-bar" style={{ maxWidth: 420, marginTop: 10 }}>
            <div className="fill" style={{ width: progress + '%' }} />
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
            {done}/{lines.length} lignes pointées · {progress.toFixed(0)}% complété
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn"><Icon name="file-text" />Voir bon de livraison</button>
          <button className="btn" onClick={() => {
            const allOk = lines.map(l => ({ ...l, received: l.cmd, status: 'ok' }));
            setLines(allOk);
          }}>
            <Icon name="check" />Tout valider OK
          </button>
        </div>
      </div>

      <div className="rx-detail">
        <div className="rx-detail-main">
          <div className="rx-line-table">
            <div className="rx-line-head">
              <span></span>
              <span>Produit</span>
              <span>Commandé</span>
              <span>Reçu</span>
              <span style={{ textAlign: 'center' }}>Statut</span>
              <span></span>
            </div>
            {lines.map(line => {
              const diff = (line.received || 0) - line.cmd;
              const diffPct = line.cmd > 0 ? (diff / line.cmd) * 100 : 0;
              const statusClass = line.status === 'ok' ? 'ok' : line.status === 'discrepancy' ? 'discrepancy' : line.status === 'missing' ? 'missing' : '';

              return (
                <div key={line.id} className={'rx-line ' + statusClass}>
                  <button
                    className={'rx-line-check ' + (line.status === 'ok' ? 'checked' : line.status === 'discrepancy' ? 'discrepancy' : line.status === 'missing' ? 'missing' : '')}
                    onClick={() => updateLine(line.id, { status: line.status === 'ok' ? null : 'ok', received: line.status === 'ok' ? line.received : line.cmd })}
                  >
                    {line.status === 'ok' && <Icon name="check" size={13} />}
                    {line.status === 'discrepancy' && <Icon name="alert-triangle" size={12} />}
                    {line.status === 'missing' && <Icon name="x" size={13} />}
                  </button>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{line.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                      {line.meta} · {line.price.toFixed(2)} €/{line.unit}
                    </div>
                    {line.note && (
                      <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Icon name="alert-circle" size={11} />{line.note}
                      </div>
                    )}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13 }}>
                    {line.cmd} <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{line.unit}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="rx-qty-input">
                      <button onClick={() => handleQtyAdjust(line.id, -0.1)}><Icon name="minus" size={12} /></button>
                      <input
                        type="number"
                        step="0.1"
                        value={line.received ?? ''}
                        onChange={(e) => updateLine(line.id, { received: parseFloat(e.target.value) || 0 })}
                      />
                      <button onClick={() => handleQtyAdjust(line.id, 0.1)}><Icon name="plus" size={12} /></button>
                    </div>
                    {Math.abs(diff) > 0.01 && (
                      <span className={'rx-delta-badge ' + (diff > 0 ? 'over' : diff < -line.cmd * 0.5 ? 'miss' : 'under')}>
                        {diff > 0 ? '+' : ''}{diffPct.toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <div className="rx-line-action-group" style={{ justifyContent: 'center' }}>
                    <button
                      className={'rx-line-action' + (line.status === 'ok' ? ' active ok' : '')}
                      onClick={() => updateLine(line.id, { status: 'ok', received: line.cmd, note: '' })}
                      title="Conforme"
                    ><Icon name="check" size={13} /></button>
                    <button
                      className={'rx-line-action' + (line.status === 'discrepancy' ? ' active ko' : '')}
                      onClick={() => updateLine(line.id, { status: 'discrepancy', note: line.note || 'Écart signalé' })}
                      title="Écart poids/qualité"
                    ><Icon name="alert-triangle" size={13} /></button>
                    <button
                      className={'rx-line-action' + (line.status === 'missing' ? ' active missing' : '')}
                      onClick={() => updateLine(line.id, { status: 'missing', received: 0, note: 'Produit manquant' })}
                      title="Manquant"
                    ><Icon name="x" size={13} /></button>
                  </div>
                  <button className="icon-btn" style={{ width: 28, height: 28 }}>
                    <Icon name={line.photo ? 'camera' : 'camera'} size={13} style={{ color: line.photo ? 'var(--accent)' : 'var(--text-subtle)' }} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Note zone */}
          <div style={{ marginTop: 12, padding: '14px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="pencil" size={12} />Notes de réception
            </div>
            <textarea
              placeholder="Commentaire général (ex: retard 20 min, qualité produit, température du camion…)"
              style={{
                width: '100%', minHeight: 60, border: '1px solid var(--border)',
                borderRadius: 7, padding: 10, fontSize: 13, fontFamily: 'inherit',
                resize: 'vertical', outline: 'none', background: 'var(--bg-subtle)',
              }}
            />
          </div>
        </div>

        {/* Right panel */}
        <div>
          <div className="rx-panel">
            <div className="rx-panel-title">Récapitulatif</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
              <div style={{ background: 'var(--success-soft)', padding: '10px 12px', borderRadius: 8 }}>
                <div style={{ fontSize: 10.5, color: 'var(--success)', fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Conformes</div>
                <div style={{ fontSize: 22, fontWeight: 650, fontFamily: 'var(--font-mono)', color: 'var(--success)', letterSpacing: '-0.02em', marginTop: 2 }}>{okCount}</div>
              </div>
              <div style={{ background: 'var(--danger-soft)', padding: '10px 12px', borderRadius: 8 }}>
                <div style={{ fontSize: 10.5, color: 'var(--danger)', fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Écarts</div>
                <div style={{ fontSize: 22, fontWeight: 650, fontFamily: 'var(--font-mono)', color: 'var(--danger)', letterSpacing: '-0.02em', marginTop: 2 }}>{koCount}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, padding: '10px 0', borderTop: '1px solid var(--border)', fontSize: 12.5 }}>
              <span style={{ color: 'var(--text-muted)' }}>Total BL (HT)</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{delivery.ht.toFixed(2)} €</span>
            </div>
            {avoirAmount > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, padding: '10px 0', borderTop: '1px solid var(--border)', fontSize: 12.5 }}>
                <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Avoir à générer</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 650, color: 'var(--danger)' }}>−{avoirAmount.toFixed(2)} €</span>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, padding: '12px 0 6px', borderTop: '2px solid var(--text)', fontSize: 13 }}>
              <span style={{ fontWeight: 650 }}>Net à régler</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16 }}>{(delivery.ht - avoirAmount).toFixed(2)} €</span>
            </div>

            {/* Temp control */}
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 18, marginBottom: 4 }}>Chaîne du froid</div>
            <div className="rx-temp-input">
              <Icon name="zap" size={14} style={{ color: temp ? (parseFloat(temp) > 6 ? 'var(--danger)' : 'var(--success)') : 'var(--text-subtle)' }} />
              <input
                type="number" step="0.1" placeholder="0.0"
                value={temp}
                onChange={(e) => setTemp(e.target.value)}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-mono)' }}>°C</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              Relevé camion frigo · norme HACCP &lt; 4°C
            </div>

            {/* Photos */}
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 18, marginBottom: 4 }}>Photos BL & écarts</div>
            <div className="rx-photo-grid">
              <div className="rx-photo-cell has-photo">
                <Icon name="camera" size={14} />
              </div>
              <div className="rx-photo-cell has-photo">
                <Icon name="camera" size={14} />
              </div>
              <div className="rx-photo-cell">
                <Icon name="plus" size={14} />
              </div>
            </div>

            {/* Signature */}
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 18, marginBottom: 6 }}>Signature livreur</div>
            <div className={'rx-sig-box' + (signed ? ' signed' : '')} onClick={() => setSigned(!signed)}>
              {signed ? (
                <>
                  <Icon name="check-circle" size={20} />
                  <div style={{ fontSize: 11.5, fontWeight: 600 }}>Signé · Karim B.</div>
                  <div style={{ fontSize: 10, opacity: 0.7 }}>23 avr. 10:42</div>
                </>
              ) : (
                <>
                  <Icon name="pencil" size={18} />
                  <div style={{ fontSize: 12, fontWeight: 550 }}>Toucher pour signer</div>
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            {avoirAmount > 0 && (
              <button className="btn" style={{ background: 'var(--danger-soft)', color: 'var(--danger)', borderColor: '#FECACA', justifyContent: 'center' }}>
                <Icon name="file-text" />Générer avoir automatique · {avoirAmount.toFixed(2)} €
              </button>
            )}
            <button className="btn primary" style={{ justifyContent: 'center', padding: '10px 16px' }} onClick={onBack}>
              <Icon name="check-circle" />Valider la réception
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ReceivePage = ReceivePage;
