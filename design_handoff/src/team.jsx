// RestoPilot — Équipe (annuaire + permissions + activité)
const { useState: useTE, useMemo: useMTE } = React;

const TE_ROLES_DEFAULT = [
  { id: 'owner', name: 'Propriétaire', color: '#6366F1', permissions: ['admin'] },
  { id: 'chef', name: 'Chef de cuisine', color: '#EF4444', permissions: ['orders', 'fiches', 'inventory', 'receive', 'reports'] },
  { id: 'sous-chef', name: 'Second / Sous-chef', color: '#F97316', permissions: ['orders', 'fiches', 'receive'] },
  { id: 'salle', name: 'Responsable salle', color: '#10B981', permissions: ['dashboard', 'reports'] },
  { id: 'serveur', name: 'Serveur', color: '#0EA5E9', permissions: ['dashboard'] },
  { id: 'plongeur', name: 'Plongeur', color: '#8B5CF6', permissions: ['receive'] },
];

const TE_MEMBERS = [
  {
    id: 1, firstName: 'Julien', lastName: 'Mercier', role: 'owner',
    email: 'julien@maisonlumiere.fr', tel: '06 12 45 78 90',
    hiredAt: '2021-03-15', status: 'active', lastActive: 'maintenant',
    initials: 'JM', accent: '#6366F1',
  },
  {
    id: 2, firstName: 'Marc', lastName: 'Bernadet', role: 'chef',
    email: 'm.bernadet@maisonlumiere.fr', tel: '06 33 18 22 41',
    hiredAt: '2021-05-02', status: 'active', lastActive: 'il y a 12 min',
    initials: 'MB', accent: '#EF4444',
  },
  {
    id: 3, firstName: 'Sarah', lastName: 'Petit', role: 'sous-chef',
    email: 's.petit@maisonlumiere.fr', tel: '06 84 22 10 54',
    hiredAt: '2022-09-12', status: 'active', lastActive: 'il y a 1 h',
    initials: 'SP', accent: '#F97316',
  },
  {
    id: 4, firstName: 'Camille', lastName: 'Rousseau', role: 'salle',
    email: 'c.rousseau@maisonlumiere.fr', tel: '06 17 55 28 33',
    hiredAt: '2022-02-01', status: 'active', lastActive: 'il y a 3 h',
    initials: 'CR', accent: '#10B981',
  },
  {
    id: 5, firstName: 'Léa', lastName: 'Dubois', role: 'serveur',
    email: 'l.dubois@maisonlumiere.fr', tel: '06 45 77 91 02',
    hiredAt: '2023-06-05', status: 'active', lastActive: 'hier',
    initials: 'LD', accent: '#0EA5E9',
  },
  {
    id: 6, firstName: 'Thomas', lastName: 'Nguyen', role: 'serveur',
    email: 't.nguyen@maisonlumiere.fr', tel: '06 91 28 44 73',
    hiredAt: '2024-01-15', status: 'active', lastActive: 'il y a 2 j',
    initials: 'TN', accent: '#0EA5E9',
  },
  {
    id: 7, firstName: 'Ibrahim', lastName: 'Sy', role: 'plongeur',
    email: 'i.sy@maisonlumiere.fr', tel: '06 54 12 88 01',
    hiredAt: '2023-11-20', status: 'active', lastActive: 'hier',
    initials: 'IS', accent: '#8B5CF6',
  },
  {
    id: 8, firstName: 'Noémie', lastName: 'Laurent', role: 'serveur',
    email: 'n.laurent@maisonlumiere.fr', tel: '06 22 71 84 50',
    hiredAt: '2024-09-01', status: 'pending', lastActive: '—',
    initials: 'NL', accent: '#0EA5E9',
  },
];

const TE_PERMISSIONS = [
  { id: 'admin', label: 'Administration', desc: 'Gestion complète, utilisateurs, facturation' },
  { id: 'orders', label: 'Passer des commandes', desc: 'Catalogue, commandes fournisseurs' },
  { id: 'receive', label: 'Réception livraisons', desc: 'Pointage BL, écarts, signatures' },
  { id: 'fiches', label: 'Fiches techniques', desc: 'Créer et modifier les recettes' },
  { id: 'inventory', label: 'Inventaire', desc: 'Saisies de stock, valorisation' },
  { id: 'reports', label: 'Rapports & analyses', desc: 'Marges, CA, statistiques' },
  { id: 'treso', label: 'Trésorerie & factures', desc: 'Pointage bancaire, paiement' },
  { id: 'dashboard', label: 'Consulter dashboard', desc: 'Lecture seule des KPIs' },
];

const TE_ACTIVITY = [
  { who: 'Sarah P.', what: 'a envoyé la commande ', target: 'CMD-2617 (Épicerie Fine Rungis)', when: 'il y a 2 h' },
  { who: 'Marc B.',  what: 'a validé la fiche technique ', target: 'Saint-Jacques rôties', when: 'il y a 4 h' },
  { who: 'Julien M.', what: 'a modifié les permissions de ', target: 'Ibrahim Sy', when: 'hier · 14:22' },
  { who: 'Sarah P.', what: 'a réceptionné ', target: 'CMD-2612 — 20 lignes OK', when: 'hier · 09:15' },
  { who: 'Marc B.',  what: 'a ouvert un litige sur ', target: 'CMD-2611 (Boucherie Dumas)', when: 'avant-hier' },
  { who: 'Julien M.', what: 'a invité ', target: 'Noémie Laurent (serveur)', when: 'il y a 4 j' },
];

function TeamPage({ onNav }) {
  const [roles, setRoles] = useTE(TE_ROLES_DEFAULT);
  const [activeTab, setActiveTab] = useTE('people');
  const [showCreateRole, setShowCreateRole] = useTE(false);
  const [newRoleName, setNewRoleName] = useTE('');
  const [newRolePerms, setNewRolePerms] = useTE([]);

  const getRole = (id) => roles.find(r => r.id === id) || { name: '—', color: '#94A3B8', permissions: [] };

  const createRole = () => {
    if (!newRoleName.trim()) return;
    setRoles([...roles, {
      id: 'custom-' + Date.now(),
      name: newRoleName.trim(),
      color: '#94A3B8',
      permissions: newRolePerms,
      custom: true,
    }]);
    setNewRoleName('');
    setNewRolePerms([]);
    setShowCreateRole(false);
  };

  const togglePerm = (p) => {
    setNewRolePerms(newRolePerms.includes(p) ? newRolePerms.filter(x => x !== p) : [...newRolePerms, p]);
  };

  const activeMembers = TE_MEMBERS.filter(m => m.status === 'active').length;
  const pendingMembers = TE_MEMBERS.filter(m => m.status === 'pending').length;

  return (
    <div className="content page-enter">
      <div className="page-header">
        <div>
          <h1 className="page-title">Équipe</h1>
          <div className="page-sub">
            {activeMembers} membres actifs · {pendingMembers} invitation{pendingMembers > 1 ? 's' : ''} en attente · {roles.length} rôles
          </div>
        </div>
        <div className="page-actions">
          <button className="btn" onClick={() => setShowCreateRole(true)}>
            <Icon name="plus" />Créer un poste
          </button>
          <button className="btn primary">
            <Icon name="user-plus" />Inviter un membre
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="te-tabs">
        <button className={'te-tab' + (activeTab === 'people' ? ' active' : '')} onClick={() => setActiveTab('people')}>
          Membres <span className="count">{TE_MEMBERS.length}</span>
        </button>
        <button className={'te-tab' + (activeTab === 'roles' ? ' active' : '')} onClick={() => setActiveTab('roles')}>
          Rôles & permissions <span className="count">{roles.length}</span>
        </button>
        <button className={'te-tab' + (activeTab === 'activity' ? ' active' : '')} onClick={() => setActiveTab('activity')}>
          Activité
        </button>
      </div>

      {activeTab === 'people' && (
        <div className="te-grid">
          {TE_MEMBERS.map(m => {
            const r = getRole(m.role);
            return (
              <div key={m.id} className={'te-card' + (m.status === 'pending' ? ' pending' : '')}>
                <div className="te-card-top">
                  <div className="te-avatar" style={{ background: m.accent }}>{m.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 650, letterSpacing: '-0.01em' }}>
                      {m.firstName} {m.lastName}
                    </div>
                    <div className="te-role-badge" style={{ background: r.color + '22', color: r.color }}>
                      {r.name}
                    </div>
                  </div>
                  {m.status === 'pending' && (
                    <span style={{ fontSize: 10.5, background: '#FEF3C7', color: '#A16207', padding: '3px 8px', borderRadius: 10, fontWeight: 600 }}>
                      En attente
                    </span>
                  )}
                </div>

                <div className="te-info">
                  <div className="te-info-row">
                    <Icon name="mail" size={11} />
                    <span>{m.email}</span>
                  </div>
                  <div className="te-info-row">
                    <Icon name="phone" size={11} />
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{m.tel}</span>
                  </div>
                  <div className="te-info-row">
                    <Icon name="clock" size={11} />
                    <span>
                      {m.status === 'pending' ? 'Invitation envoyée il y a 2 j' : 'Actif · ' + m.lastActive}
                    </span>
                  </div>
                </div>

                <div className="te-card-foot">
                  <div style={{ fontSize: 10.5, color: 'var(--text-subtle)' }}>
                    Depuis {new Date(m.hiredAt).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                  </div>
                  <button className="icon-btn" style={{ width: 26, height: 26 }}><Icon name="more-horizontal" size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'roles' && (
        <div>
          <div className="te-roles-grid">
            {roles.map(r => (
              <div key={r.id} className="te-role-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, background: r.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                  }}>
                    <Icon name="shield" size={15} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 650 }}>{r.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      {TE_MEMBERS.filter(m => m.role === r.id).length} membre{TE_MEMBERS.filter(m => m.role === r.id).length > 1 ? 's' : ''}
                    </div>
                  </div>
                  {r.custom && <span style={{ fontSize: 9.5, background: 'var(--accent-soft)', color: 'var(--accent)', padding: '2px 6px', borderRadius: 10, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Custom</span>}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {r.permissions.includes('admin') ? (
                    <span className="te-perm-chip admin">Tous les droits</span>
                  ) : r.permissions.length > 0 ? (
                    r.permissions.map(p => {
                      const def = TE_PERMISSIONS.find(x => x.id === p);
                      return def && <span key={p} className="te-perm-chip">{def.label}</span>;
                    })
                  ) : (
                    <span style={{ fontSize: 11.5, color: 'var(--text-subtle)', fontStyle: 'italic' }}>Aucune permission</span>
                  )}
                </div>
              </div>
            ))}

            <button className="te-role-card new" onClick={() => setShowCreateRole(true)}>
              <Icon name="plus" size={20} />
              <span>Nouveau poste</span>
            </button>
          </div>
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="te-activity">
          {TE_ACTIVITY.map((a, i) => (
            <div key={i} className="te-activity-row">
              <div className="te-avatar sm" style={{ background: '#94A3B8' }}>
                {a.who.split(' ').map(w => w[0]).join('').slice(0, 2)}
              </div>
              <div style={{ flex: 1, fontSize: 13, lineHeight: 1.55 }}>
                <span style={{ fontWeight: 600 }}>{a.who}</span>
                <span style={{ color: 'var(--text-muted)' }}>{a.what}</span>
                <span style={{ fontWeight: 600 }}>{a.target}</span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-subtle)', whiteSpace: 'nowrap' }}>{a.when}</div>
            </div>
          ))}
        </div>
      )}

      {/* Create role modal */}
      {showCreateRole && (
        <>
          <div className="or-drawer-backdrop" onClick={() => setShowCreateRole(false)} />
          <div className="te-modal">
            <div className="te-modal-head">
              <div>
                <div style={{ fontSize: 17, fontWeight: 650 }}>Créer un poste personnalisé</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Définis un rôle sur-mesure avec ses propres permissions
                </div>
              </div>
              <button className="back-btn" onClick={() => setShowCreateRole(false)}><Icon name="x" size={16} /></button>
            </div>
            <div className="te-modal-body">
              <div className="te-field">
                <label>Nom du poste</label>
                <input
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="ex : Pâtissier, Commis, Hôte d'accueil…"
                  autoFocus
                />
              </div>

              <div style={{ marginTop: 18 }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 8 }}>Permissions</label>
                <div className="te-perms-list">
                  {TE_PERMISSIONS.map(p => (
                    <label key={p.id} className={'te-perm-item' + (newRolePerms.includes(p.id) ? ' checked' : '')}>
                      <input type="checkbox" checked={newRolePerms.includes(p.id)} onChange={() => togglePerm(p.id)} />
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{p.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="te-modal-foot">
              <button className="btn" onClick={() => setShowCreateRole(false)}>Annuler</button>
              <button className="btn primary" onClick={createRole} disabled={!newRoleName.trim()}>
                <Icon name="check" />Créer le poste
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

window.TeamPage = TeamPage;
