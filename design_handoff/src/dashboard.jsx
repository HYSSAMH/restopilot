// RestoPilot — Dashboard page

const Sparkline = ({ data, color = '#6366F1', w = 70, h = 28 }) => {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * (h - 4) - 2).toFixed(1)}`).join(' ');
  const fillPts = `0,${h} ${pts} ${w},${h}`;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h}>
      <polygon points={fillPts} fill={color} opacity="0.08" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={h - ((data[data.length-1] - min) / range) * (h - 4) - 2} r="2.5" fill={color} />
    </svg>
  );
};

const KpiCard = ({ kpi }) => {
  const color = kpi.dir === 'up' ? 'var(--success)' : kpi.dir === 'down' ? 'var(--danger)' : 'var(--text-muted)';
  const sparkColor = kpi.inverse
    ? (kpi.dir === 'up' ? '#10B981' : '#EF4444')
    : (kpi.dir === 'up' ? '#10B981' : kpi.dir === 'down' ? '#EF4444' : '#94A3B8');
  const fmt = (v) => kpi.key === 'ca'
    ? v.toLocaleString('fr-FR')
    : (kpi.unit === '%' ? v.toFixed(1) : v.toString());
  return (
    <div className="kpi">
      <div className="kpi-label">
        <Icon name={kpi.key === 'ca' ? 'euro' : kpi.key === 'cm' ? 'scale' : kpi.key === 'marge' ? 'trending-up' : 'users'} />
        {kpi.label}
      </div>
      <div className="kpi-value">
        {fmt(kpi.value)}<span className="unit">{kpi.unit}</span>
      </div>
      <div className="kpi-foot">
        {kpi.delta !== 0 && (
          <span className={'kpi-delta ' + (kpi.dir === 'up' ? 'up' : kpi.dir === 'down' ? 'down' : 'flat')}>
            <Icon name={kpi.delta > 0 ? 'arrow-up' : kpi.delta < 0 ? 'arrow-down' : 'arrow-right'} size={11} />
            {Math.abs(kpi.delta).toFixed(1)}%
          </span>
        )}
        <span>{kpi.sub}</span>
      </div>
      <Sparkline data={kpi.spark} color={sparkColor} />
    </div>
  );
};

const BarChart = ({ data }) => {
  const max = Math.max(...data.map(d => d.ca));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 160, padding: '12px 4px 4px' }}>
      {data.map((d, i) => {
        const h = (d.ca / max) * 100;
        const isToday = i === data.length - 1;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 600 }}>
              {(d.ca/1000).toFixed(1)}k
            </div>
            <div style={{ width: '100%', height: 120, display: 'flex', alignItems: 'flex-end', position: 'relative' }}>
              <div style={{
                width: '100%',
                height: `${h}%`,
                background: isToday ? 'linear-gradient(180deg, #6366F1 0%, #818CF8 100%)' : 'linear-gradient(180deg, #E0E7FF 0%, #EEF2FF 100%)',
                borderRadius: '6px 6px 2px 2px',
                transition: 'all 0.4s ease',
                boxShadow: isToday ? '0 2px 6px rgba(99,102,241,0.25)' : 'none',
              }} />
            </div>
            <div style={{ fontSize: 11.5, color: isToday ? 'var(--accent)' : 'var(--text-muted)', fontWeight: isToday ? 600 : 500 }}>{d.day}</div>
          </div>
        );
      })}
    </div>
  );
};

const AlertItem = ({ a }) => {
  const iconMap = { danger: 'alert-circle', warning: 'alert-triangle', info: 'info', success: 'check-circle' };
  return (
    <div className="alert">
      <div className={'alert-icon ' + a.kind}>
        <Icon name={iconMap[a.kind]} size={15} />
      </div>
      <div className="alert-body">
        <div className="alert-title">{a.title}</div>
        <div className="alert-desc">{a.desc}</div>
      </div>
      <div className="alert-time">{a.time}</div>
    </div>
  );
};

const OrderStatus = ({ s }) => {
  const map = {
    delivered: { label: 'Livrée', cls: 'success' },
    shipping:  { label: 'En cours', cls: 'info' },
    pending:   { label: 'En préparation', cls: 'warning' },
  };
  const { label, cls } = map[s];
  return <span className={'badge ' + cls}><span className="dot" />{label}</span>;
};

function DashboardPage({ onNav }) {
  const total = WEEK_SALES.reduce((a,b) => a+b.ca, 0);
  return (
    <div className="content page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Bonjour Antoine 👋</h1>
          <div className="page-sub">Lundi 22 avril · Voici l'état de Maison Lumière ce matin.</div>
        </div>
        <div className="page-actions">
          <button className="btn"><Icon name="calendar-days" />Aujourd'hui<Icon name="chevron-down" size={13} /></button>
          <button className="btn"><Icon name="download" />Exporter</button>
          <button className="btn primary" onClick={() => onNav('order')}><Icon name="plus" />Commander</button>
        </div>
      </div>

      <div className="kpi-grid">
        {KPIS.map(k => <KpiCard key={k.key} kpi={k} />)}
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Chiffre d'affaires — 7 derniers jours</div>
              <div className="card-sub">Total semaine · <span className="mono" style={{fontWeight:600, color:'var(--text)'}}>{total.toLocaleString('fr-FR')} €</span></div>
            </div>
            <div className="ml-auto flex gap-2">
              <div className="seg">
                <button className="active">7j</button>
                <button>30j</button>
                <button>90j</button>
              </div>
            </div>
          </div>
          <div className="chart-wrap">
            <BarChart data={WEEK_SALES} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <Icon name="sparkles" size={15} style={{ color: 'var(--accent)' }} />
            <div className="card-title">Alertes intelligentes</div>
            <button className="btn sm ghost ml-auto">Tout voir</button>
          </div>
          <div className="alert-list">
            {ALERTS.slice(0,4).map((a, i) => <AlertItem key={i} a={a} />)}
          </div>
        </div>
      </div>

      <div className="dashboard-grid mt-4">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Commandes récentes</div>
            <button className="btn sm ghost ml-auto" onClick={() => onNav('orders')}>Voir tout<Icon name="arrow-right" size={12} /></button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Fournisseur</th>
                <th>Date</th>
                <th className="num">Articles</th>
                <th className="num">Montant</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_ORDERS.map(o => {
                const sup = SUPPLIERS[o.supplier];
                return (
                  <tr key={o.id}>
                    <td className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{o.id}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="sup-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: sup.color }} />
                        {sup.name}
                      </div>
                    </td>
                    <td className="text-muted">{o.date}</td>
                    <td className="num text-muted">{o.items}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{o.amount.toFixed(2)} €</td>
                    <td><OrderStatus s={o.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-header">
            <Icon name="zap" size={15} style={{ color: 'var(--warning)' }} />
            <div className="card-title">Raccourcis</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border)' }}>
            {[
              { icon: 'shopping-cart', label: 'Passer commande', desc: '12 produits en rupture', id: 'order' },
              { icon: 'chef-hat', label: 'Nouvelle fiche', desc: 'Calcul de marge', id: 'fiches' },
              { icon: 'file-text', label: 'Saisir facture', desc: '3 à valider', id: 'invoices' },
              { icon: 'upload', label: 'Importer mercuriale', desc: 'PDF · Image · IA', id: 'mercuriale' },
            ].map(s => (
              <button
                key={s.id}
                onClick={() => onNav(s.id)}
                style={{
                  background: 'white',
                  padding: '16px 14px',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  transition: 'background 0.1s',
                }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
                onMouseOut={e => e.currentTarget.style.background = 'white'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: 'var(--accent-soft)', color: 'var(--accent)',
                    display: 'grid', placeItems: 'center',
                  }}>
                    <Icon name={s.icon} size={14} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</div>
                </div>
                <div className="text-xs text-muted" style={{ marginLeft: 36 }}>{s.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

window.DashboardPage = DashboardPage;
