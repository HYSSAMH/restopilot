// RestoPilot — Trésorerie

const { useState: useStateT } = React;

const BANK_TX = [
  { id: 't1', date: '22 avr.', desc: 'VIR RECU Table 14 Ateliers', ref: 'REF-04221', amount: 284.00, type: 'credit', matched: true, matchWith: 'Facture FAC-2026-0412' },
  { id: 't2', date: '22 avr.', desc: 'CB MAREE ATLANTIQUE SA', ref: '40-22142', amount: -284.00, type: 'debit', matched: true, matchWith: 'CMD-2613 · Marée Atl.' },
  { id: 't3', date: '21 avr.', desc: 'PRLV URSSAF IDF', ref: 'SEPA-URSSAF', amount: -3482.60, type: 'debit', matched: false },
  { id: 't4', date: '21 avr.', desc: 'REM CB 21/04 +32 op.', ref: 'RMS-0421', amount: 4286.40, type: 'credit', matched: true, matchWith: 'Z caisse 21/04' },
  { id: 't5', date: '20 avr.', desc: 'VIR BOUCHERIE DUMAS SARL', ref: 'VIR-SORT-842', amount: -842.60, type: 'debit', matched: true, matchWith: 'BOU-2024-1082' },
  { id: 't6', date: '19 avr.', desc: 'PRLV EDF PRO', ref: 'SEPA-EDF', amount: -684.00, type: 'debit', matched: false },
  { id: 't7', date: '19 avr.', desc: 'REM CB 19/04 +28 op.', ref: 'RMS-0419', amount: 3820.00, type: 'credit', matched: true, matchWith: 'Z caisse 19/04' },
];

const CASHFLOW = [
  { d: '1', v: 2.4 }, { d: '3', v: 3.1 }, { d: '5', v: -1.2 }, { d: '7', v: 4.6 }, { d: '9', v: -0.8 },
  { d: '11', v: 3.8 }, { d: '13', v: 2.9 }, { d: '15', v: -3.4 }, { d: '17', v: 4.1 }, { d: '19', v: 3.8 },
  { d: '21', v: -0.7 }, { d: '22', v: 4.3 },
];

function TresoPage({ onNav }) {
  const [tx, setTx] = useStateT(BANK_TX);
  const matched = tx.filter(t => t.matched).length;
  const total = tx.length;
  const maxCf = Math.max(...CASHFLOW.map(c => Math.abs(c.v)));

  const toggle = (id) => setTx(list => list.map(t => t.id === id ? { ...t, matched: !t.matched } : t));

  return (
    <div className="content page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Trésorerie</h1>
          <div className="page-sub">Compte Crédit Agricole ···5847 · Synchronisé il y a 3 min</div>
        </div>
        <div className="page-actions">
          <span className="connect-pill"><span className="pulse" />Banque connectée</span>
          <button className="btn"><Icon name="upload" />Import relevé</button>
          <button className="btn primary"><Icon name="check" />Valider pointage</button>
        </div>
      </div>

      {/* Top cards */}
      <div className="treso-top">
        <div className="treso-card accent">
          <div className="tc-label" style={{ color: 'rgba(255,255,255,0.7)' }}>
            <Icon name="wallet" />Solde bancaire
          </div>
          <div className="tc-value">28 642,<span style={{ fontSize: 18 }}>40 €</span></div>
          <div className="tc-sub">au 22 avril 09:14 · +4 286 € sur 7j</div>
        </div>
        <div className="treso-card">
          <div className="tc-label"><Icon name="arrow-down" />Encaissé ce mois</div>
          <div className="tc-value" style={{ color: 'var(--success)' }}>+68 420 €</div>
          <div className="tc-sub">CB · espèces · TR · virements</div>
        </div>
        <div className="treso-card">
          <div className="tc-label"><Icon name="arrow-up" />Décaissé ce mois</div>
          <div className="tc-value" style={{ color: 'var(--danger)' }}>−42 180 €</div>
          <div className="tc-sub">fournisseurs · salaires · charges</div>
        </div>
      </div>

      <div className="treso-layout">
        {/* Reconciliation */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Pointage factures / relevé</div>
              <div className="card-sub">{matched}/{total} opérations rapprochées automatiquement par l'IA</div>
            </div>
            <div className="ml-auto flex gap-2">
              <div className="seg">
                <button className="active">Toutes</button>
                <button>À pointer</button>
                <button>Rapprochées</button>
              </div>
            </div>
          </div>
          <div className="mercu-row mercu-row-head" style={{ gridTemplateColumns: '24px 1fr 110px 110px 120px' }}>
            <span></span><span>Opération</span><span>Date</span><span style={{ textAlign:'right' }}>Montant</span><span>Statut</span>
          </div>
          {tx.map(t => (
            <div key={t.id} className={'reconcile-row' + (t.matched ? ' matched' : '')} onClick={() => toggle(t.id)}>
              <div className={'rec-check' + (t.matched ? ' checked' : '')}>
                {t.matched && <Icon name="check" />}
              </div>
              <div>
                <div className="rec-desc">{t.desc}</div>
                <div className="rec-meta">
                  {t.ref}
                  {t.matched && <> · <span style={{ color: 'var(--success)' }}>↔ {t.matchWith}</span></>}
                </div>
              </div>
              <div className="text-sm text-muted mono">{t.date}</div>
              <div style={{ textAlign: 'right' }}>
                <div className="mono" style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: t.amount > 0 ? 'var(--success)' : 'var(--text)' }}>
                  {t.amount > 0 ? '+' : ''}{t.amount.toFixed(2).replace('.', ',')} €
                </div>
              </div>
              <div>
                {t.matched
                  ? <span className="badge success"><Icon name="check" />Pointée</span>
                  : <span className="badge warning"><Icon name="alert-circle" />À pointer</span>
                }
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Cash flow */}
          <div className="card">
            <div className="card-header">
              <Icon name="activity" size={15} style={{ color: 'var(--accent)' }} />
              <div className="card-title">Flux de trésorerie · avril</div>
              <span className="badge success ml-auto">+26 240 €</span>
            </div>
            <div className="card-body">
              <div className="cashflow-bars">
                {CASHFLOW.map((c, i) => (
                  <div
                    key={i}
                    className={'cf-bar ' + (c.v > 0 ? 'pos' : 'neg')}
                    style={{ height: `${(Math.abs(c.v) / maxCf) * 100}%`, alignSelf: c.v > 0 ? 'flex-end' : 'flex-start' }}
                    title={`${c.d} avr : ${c.v > 0 ? '+' : ''}${c.v}k €`}
                  />
                ))}
              </div>
              <div className="flex mt-2 text-xs text-subtle mono" style={{ justifyContent: 'space-between' }}>
                <span>1</span><span>7</span><span>14</span><span>21</span>
              </div>
            </div>
          </div>

          {/* Masse salariale */}
          <div className="card">
            <div className="card-header">
              <Icon name="users" size={15} />
              <div className="card-title">Masse salariale</div>
              <span className="badge neutral ml-auto">avril 2026</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <div className="text-xs text-muted">Salaires bruts</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 650 }}>18 420 €</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Charges patronales</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 650 }}>7 982 €</div>
                </div>
                <div>
                  <div className="text-xs text-muted">% du CA</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 650, color: 'var(--accent)' }}>38,6%</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Collab. actifs</div>
                  <div className="mono" style={{ fontSize: 18, fontWeight: 650 }}>12</div>
                </div>
              </div>
              <div className="divider mt-3 mb-3" />
              <div className="flex items-center gap-2 text-xs text-muted">
                <Icon name="calendar-days" size={13} />
                <span>Prochain prélèvement URSSAF · <strong style={{color:'var(--text)'}}>5 mai</strong> · 3 482,60 €</span>
              </div>
            </div>
          </div>

          {/* Upcoming */}
          <div className="card">
            <div className="card-header">
              <Icon name="clock" size={15} style={{ color: 'var(--warning)' }} />
              <div className="card-title">À venir · 7 jours</div>
            </div>
            <div>
              {[
                { date: '25 avr.', desc: 'Fournisseur Cave Sommeliers', amount: -1240, urgent: true },
                { date: '28 avr.', desc: 'Loyer local 7e', amount: -4800, urgent: false },
                { date: '30 avr.', desc: 'Salaires équipe', amount: -18420, urgent: false },
              ].map((u, i) => (
                <div key={i} className="flex items-center gap-3" style={{ padding: '10px 16px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                  <div className="mono text-xs text-muted" style={{ width: 56 }}>{u.date}</div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{u.desc}</div>
                  <div className="mono" style={{ fontWeight: 600, color: 'var(--danger)' }}>{u.amount.toLocaleString('fr-FR')} €</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.TresoPage = TresoPage;
