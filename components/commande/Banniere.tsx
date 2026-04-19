import type { CartMap } from "./data";

interface BanniereProps {
  cartMap: CartMap;
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Banniere({ cartMap }: BanniereProps) {
  const entries = Object.values(cartMap);

  // Économies = pour chaque item, (prix le plus cher du produit - prix choisi) × qty
  const economies = entries.reduce((acc, { produit, fournisseur, qty }) => {
    const maxPrix = Math.max(...produit.fournisseurs.map((f) => f.prix));
    return acc + (maxPrix - fournisseur.prix) * qty;
  }, 0);

  // Fournisseurs distincts dans le panier
  const fournisseursIds = new Set(entries.map((e) => e.fournisseur.id));
  const nbFournisseurs = fournisseursIds.size;

  // Minimums : grouper les totaux par fournisseur
  const totalParFourn: Record<string, number> = {};
  entries.forEach(({ fournisseur, qty }) => {
    totalParFourn[fournisseur.id] = (totalParFourn[fournisseur.id] ?? 0) + fournisseur.prix * qty;
  });
  const minimumsAtteints = Object.entries(totalParFourn).filter(
    ([id, total]) => {
      const entry = entries.find((e) => e.fournisseur.id === id);
      return entry && total >= entry.fournisseur.minimum;
    }
  ).length;
  const minimumsTotal = fournisseursIds.size;

  const allMinimumsOk = minimumsAtteints === minimumsTotal && minimumsTotal > 0;

  if (entries.length === 0) return null;

  return (
    <div className="sticky top-16 z-40 border-b border-white/8 bg-[#0d0d1a]/95 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-wrap items-center gap-3 py-3">
          {/* Label */}
          <span className="text-xs font-medium uppercase tracking-wider text-white/30">
            Récapitulatif commande
          </span>

          <div className="flex flex-1 flex-wrap items-center gap-2">
            {/* Économies */}
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5">
              <span className="text-sm">💰</span>
              <span className="text-xs text-white/50">Économies</span>
              <span className="text-sm font-bold text-emerald-400">
                −{fmt(economies)} €
              </span>
            </div>

            {/* Fournisseurs */}
            <div className="flex items-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/10 px-3 py-1.5">
              <span className="text-sm">🚚</span>
              <span className="text-xs text-white/50">Fournisseurs</span>
              <span className="text-sm font-bold text-violet-300">{nbFournisseurs}</span>
            </div>

            {/* Minimums */}
            <div
              className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 ${
                allMinimumsOk
                  ? "border-emerald-500/25 bg-emerald-500/10"
                  : minimumsAtteints > 0
                  ? "border-amber-500/25 bg-amber-500/10"
                  : "border-red-500/25 bg-red-500/10"
              }`}
            >
              <span className="text-sm">{allMinimumsOk ? "✅" : "⚠️"}</span>
              <span className="text-xs text-white/50">Minimums</span>
              <span
                className={`text-sm font-bold ${
                  allMinimumsOk ? "text-emerald-400" : minimumsAtteints > 0 ? "text-amber-300" : "text-red-400"
                }`}
              >
                {minimumsAtteints}/{minimumsTotal} atteints
              </span>
            </div>

            {/* Produits */}
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5">
              <span className="text-xs text-white/50">Produits</span>
              <span className="text-sm font-bold text-white">{entries.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
