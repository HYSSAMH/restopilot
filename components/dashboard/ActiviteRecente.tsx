const activites = [
  {
    icone: "📦",
    couleur: "bg-violet-600/20 text-violet-300",
    titre: "Nouvelle commande reçue",
    detail: "Le Bistrot Parisien · CMD-2041",
    heure: "Il y a 8 min",
    type: "commande",
  },
  {
    icone: "✅",
    couleur: "bg-emerald-600/15 text-emerald-300",
    titre: "Livraison confirmée",
    detail: "Restaurant La Serre · CMD-2037",
    heure: "Il y a 2 h",
    type: "livraison",
  },
  {
    icone: "💶",
    couleur: "bg-blue-600/15 text-blue-300",
    titre: "Paiement reçu",
    detail: "Le Bistrot Parisien · 986,80 €",
    heure: "Il y a 3 h",
    type: "paiement",
  },
  {
    icone: "⚠️",
    couleur: "bg-amber-500/15 text-amber-300",
    titre: "Stock bas détecté",
    detail: "Champignons de Paris · 8 unités restantes",
    heure: "Il y a 5 h",
    type: "alerte",
  },
  {
    icone: "👤",
    couleur: "bg-purple-600/15 text-purple-300",
    titre: "Nouveau client",
    detail: "Brasserie du Soleil a passé sa 1ère commande",
    heure: "Hier, 18:42",
    type: "client",
  },
  {
    icone: "📈",
    couleur: "bg-pink-600/15 text-pink-300",
    titre: "Prix mis à jour",
    detail: "Huile d'olive EV · +5,1% cette semaine",
    heure: "Hier, 09:00",
    type: "prix",
  },
];

export default function ActiviteRecente() {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/5 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/8 p-5">
        <div className="flex items-center gap-2">
          <span className="text-base">⚡</span>
          <h2 className="font-semibold text-white">Activité récente</h2>
        </div>
        <span className="rounded-full bg-violet-600/20 px-2 py-0.5 text-xs text-violet-300">
          {activites.length}
        </span>
      </div>

      <div className="relative p-4">
        {/* Vertical line */}
        <div className="absolute left-[2.15rem] top-4 bottom-4 w-px bg-white/8" />

        <div className="flex flex-col gap-1">
          {activites.map((a, i) => (
            <div key={i} className="group relative flex items-start gap-3 rounded-xl p-2 transition-colors hover:bg-white/[0.04]">
              {/* Icon */}
              <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${a.couleur} border border-white/10 text-sm`}>
                {a.icone}
              </div>

              {/* Content */}
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
                <p className="text-sm font-medium text-white/80">{a.titre}</p>
                <p className="truncate text-xs text-white/35">{a.detail}</p>
              </div>

              {/* Time */}
              <span className="shrink-0 pt-0.5 text-xs text-white/25">{a.heure}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/8 p-4">
        <button className="w-full rounded-xl border border-white/8 py-2 text-sm text-white/40 transition-colors hover:bg-white/5 hover:text-white/60">
          Voir tout l'historique →
        </button>
      </div>
    </div>
  );
}
