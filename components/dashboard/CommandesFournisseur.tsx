const commandes = [
  {
    id: "CMD-2041",
    client: "Le Bistrot Parisien",
    initiale: "B",
    produits: ["Filet de bœuf 5 kg", "Tomates cerises ×3", "+3 autres"],
    total: 389.10,
    date: "Aujourd'hui, 08:14",
    statut: "à préparer" as const,
    priorite: true,
  },
  {
    id: "CMD-2040",
    client: "L'Atelier Gourmand",
    initiale: "A",
    produits: ["Saumon atlantique 3 kg", "Farine T55 25 kg"],
    total: 212.50,
    date: "Aujourd'hui, 07:52",
    statut: "à préparer" as const,
    priorite: false,
  },
  {
    id: "CMD-2039",
    client: "Brasserie du Marché",
    initiale: "M",
    produits: ["Huile d'olive EV 10 L", "Beurre AOP 5 kg", "+1 autre"],
    total: 357.00,
    date: "Hier, 17:30",
    statut: "à livrer" as const,
    priorite: false,
  },
  {
    id: "CMD-2038",
    client: "Le Petit Comptoir",
    initiale: "C",
    produits: ["Crème fraîche 8 L", "Champignons 4 kg"],
    total: 62.00,
    date: "Hier, 14:15",
    statut: "à livrer" as const,
    priorite: false,
  },
  {
    id: "CMD-2037",
    client: "Restaurant La Serre",
    initiale: "S",
    produits: ["Filet de bœuf 8 kg", "Saumon 5 kg", "+2 autres"],
    total: 490.00,
    date: "16 avr., 11:00",
    statut: "livrée" as const,
    priorite: false,
  },
  {
    id: "CMD-2036",
    client: "Le Bistrot Parisien",
    initiale: "B",
    produits: ["Tomates cerises ×6", "Farine T55 50 kg"],
    total: 986.80,
    date: "15 avr., 09:30",
    statut: "livrée" as const,
    priorite: false,
  },
];

type Statut = "à préparer" | "à livrer" | "livrée";

const statutConfig: Record<Statut, { label: string; dot: string; badge: string }> = {
  "à préparer": {
    label: "À préparer",
    dot: "bg-amber-400",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  },
  "à livrer": {
    label: "À livrer",
    dot: "bg-blue-400",
    badge: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  },
  livrée: {
    label: "Livrée",
    dot: "bg-emerald-400",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  },
};

const avatarColors = [
  "from-violet-600 to-purple-500",
  "from-blue-600 to-cyan-400",
  "from-emerald-600 to-teal-400",
  "from-orange-500 to-amber-400",
  "from-pink-600 to-rose-400",
];

const counts = {
  "à préparer": commandes.filter((c) => c.statut === "à préparer").length,
  "à livrer": commandes.filter((c) => c.statut === "à livrer").length,
  livrée: commandes.filter((c) => c.statut === "livrée").length,
};

export default function CommandesFournisseur() {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/5 backdrop-blur-sm">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-white/8 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-500">
            <span className="text-lg">📦</span>
          </div>
          <div>
            <h2 className="font-semibold text-white">Commandes en cours</h2>
            <p className="text-sm text-white/40">{commandes.length} commandes · mis à jour à l'instant</p>
          </div>
        </div>

        {/* Status counters */}
        <div className="flex items-center gap-2 text-xs">
          {(["à préparer", "à livrer", "livrée"] as Statut[]).map((s) => (
            <span key={s} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${statutConfig[s].badge}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statutConfig[s].dot} ${s !== "livrée" ? "animate-pulse" : ""}`} />
              {counts[s]} {statutConfig[s].label}
            </span>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="divide-y divide-white/5 p-3">
        {commandes.map((cmd, i) => {
          const cfg = statutConfig[cmd.statut];
          const color = avatarColors[i % avatarColors.length];
          return (
            <div key={cmd.id} className="group flex items-center gap-4 rounded-xl px-3 py-3.5 transition-colors hover:bg-white/[0.04]">
              {/* Avatar */}
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${color} text-sm font-bold text-white shadow-md`}>
                {cmd.initiale}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white/85">{cmd.client}</span>
                  {cmd.priorite && (
                    <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                      URGENT
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-white/35">
                  {cmd.produits.join(" · ")}
                </p>
              </div>

              {/* Meta */}
              <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
                <span className="text-sm font-semibold text-white">{cmd.total.toFixed(2)} €</span>
                <span className="text-xs text-white/30">{cmd.date}</span>
              </div>

              {/* Status */}
              <div className="shrink-0">
                <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.badge}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} ${cmd.statut !== "livrée" ? "animate-pulse" : ""}`} />
                  {cfg.label}
                </span>
              </div>

              {/* Action */}
              <button className="hidden shrink-0 rounded-lg border border-white/8 bg-white/5 px-3 py-1.5 text-xs text-white/40 opacity-0 transition-all group-hover:opacity-100 hover:bg-white/10 hover:text-white/70 lg:block">
                {cmd.statut === "à préparer" ? "Préparer →" : cmd.statut === "à livrer" ? "Livrer →" : "Voir"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
