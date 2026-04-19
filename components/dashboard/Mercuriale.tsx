const produits = [
  { nom: "Filet de bœuf",     categorie: "Viande",   icone: "🥩", unite: "kg",    prix: 34.00, evolution: +2.4,  stock: 48,  rupture: false },
  { nom: "Saumon atlantique", categorie: "Poisson",  icone: "🐟", unite: "kg",    prix: 43.50, evolution: -1.8,  stock: 22,  rupture: false },
  { nom: "Tomates cerises",   categorie: "Légumes",  icone: "🍅", unite: "barq.", prix:  7.20, evolution:  0.0,  stock: 120, rupture: false },
  { nom: "Huile d'olive EV",  categorie: "Épicerie", icone: "🫒", unite: "L",     prix: 29.50, evolution: +5.1,  stock: 35,  rupture: false },
  { nom: "Farine T55",        categorie: "Épicerie", icone: "🌾", unite: "kg",    prix: 18.80, evolution: -0.5,  stock: 200, rupture: false },
  { nom: "Beurre AOP",        categorie: "Laitier",  icone: "🧈", unite: "kg",    prix: 12.40, evolution: +1.2,  stock: 60,  rupture: false },
  { nom: "Champignons de Paris",categorie:"Légumes", icone: "🍄", unite: "kg",    prix:  5.90, evolution: -3.2,  stock:  8,  rupture: true  },
  { nom: "Crème fraîche",     categorie: "Laitier",  icone: "🥛", unite: "L",     prix:  4.80, evolution:  0.0,  stock: 45,  rupture: false },
];

function EvolutionBadge({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs text-white/25">—</span>;
  const positive = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${positive ? "text-red-400" : "text-emerald-400"}`}>
      {positive ? "▲" : "▼"} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

function StockBar({ stock, rupture }: { stock: number; rupture: boolean }) {
  const pct = Math.min(100, (stock / 200) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${rupture ? "bg-red-500" : pct < 20 ? "bg-amber-400" : "bg-emerald-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs ${rupture ? "text-red-400" : pct < 20 ? "text-amber-400" : "text-white/40"}`}>
        {rupture ? "Rupture" : `${stock} u.`}
      </span>
    </div>
  );
}

export default function Mercuriale() {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/5 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/8 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-500">
            <span className="text-lg">📋</span>
          </div>
          <div>
            <h2 className="font-semibold text-white">Ma mercuriale de la semaine</h2>
            <p className="text-sm text-white/40">Semaine du 14 au 20 avril 2026 · {produits.length} références</p>
          </div>
        </div>
        <button className="hidden rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/50 transition-all hover:bg-white/10 hover:text-white sm:block">
          + Ajouter un produit
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/8 bg-white/[0.02]">
              <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-white/30">Produit</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-white/30">Prix unitaire</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-white/30">Évolution</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-white/30 hidden md:table-cell">Stock</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-white/30 hidden lg:table-cell">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {produits.map((p) => (
              <tr key={p.nom} className="group transition-colors hover:bg-white/[0.03]">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{p.icone}</span>
                    <div>
                      <p className="text-sm font-medium text-white/85">{p.nom}</p>
                      <p className="text-xs text-white/30">{p.categorie} · /{p.unite}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <span className="text-sm font-semibold text-white">{p.prix.toFixed(2)} €</span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <EvolutionBadge value={p.evolution} />
                </td>
                <td className="hidden px-4 py-3.5 text-right md:table-cell">
                  <StockBar stock={p.stock} rupture={p.rupture} />
                </td>
                <td className="hidden px-4 py-3.5 text-right lg:table-cell">
                  <button className="rounded-lg border border-white/8 bg-white/5 px-2.5 py-1 text-xs text-white/40 opacity-0 transition-all group-hover:opacity-100 hover:bg-white/10 hover:text-white/70">
                    Modifier
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
