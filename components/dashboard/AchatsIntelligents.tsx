import Link from "next/link";

const commande = {
  fournisseur: "ProFrais Distribution",
  fournisseurInitiale: "P",
  statut: "En attente de validation",
  dateEstimee: "Livraison demain, 7h–10h",
  totalAvant: 487.6,
  totalApres: 389.1,
  economie: 98.5,
  economiePct: 20.2,
  produits: [
    {
      nom: "Filet de bœuf (5 kg)",
      qte: "5 kg",
      prixAvant: 42.5,
      prixApres: 34.0,
      icone: "🥩",
      categorie: "Viande",
    },
    {
      nom: "Tomates cerises (3 barquettes)",
      qte: "3 × 500 g",
      prixAvant: 8.9,
      prixApres: 7.2,
      icone: "🍅",
      categorie: "Légumes",
    },
    {
      nom: "Huile d'olive extra vierge (5 L)",
      qte: "5 L",
      prixAvant: 38.0,
      prixApres: 29.5,
      icone: "🫒",
      categorie: "Épicerie",
    },
    {
      nom: "Farine T55 (25 kg)",
      qte: "25 kg",
      prixAvant: 22.4,
      prixApres: 18.8,
      icone: "🌾",
      categorie: "Épicerie",
    },
    {
      nom: "Saumon atlantique (3 kg)",
      qte: "3 kg",
      prixAvant: 54.0,
      prixApres: 43.5,
      icone: "🐟",
      categorie: "Poisson",
    },
  ],
};

export default function AchatsIntelligents() {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/5 backdrop-blur-sm">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-white/8 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-500">
            <span className="text-lg">🤖</span>
          </div>
          <div>
            <h2 className="font-semibold text-white">Achats Intelligents</h2>
            <p className="text-sm text-white/40">Optimisé par IA · Mis à jour il y a 12 min</p>
          </div>
        </div>

        {/* Savings badge */}
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2">
          <span className="text-lg">💰</span>
          <div>
            <p className="text-xs text-emerald-400/70">Économies estimées</p>
            <p className="text-lg font-bold text-emerald-400">−{commande.economie.toFixed(2)} €</p>
          </div>
          <span className="ml-1 rounded-lg bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300">
            −{commande.economiePct}%
          </span>
        </div>
      </div>

      <div className="p-6">
        {/* Order info */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-sm font-bold text-white">
              {commande.fournisseurInitiale}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{commande.fournisseur}</p>
              <p className="text-xs text-white/40">{commande.dateEstimee}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              {commande.statut}
            </span>
          </div>
        </div>

        {/* Products table */}
        <div className="mb-6 overflow-hidden rounded-xl border border-white/8">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 border-b border-white/8 bg-white/3 px-4 py-3 text-xs font-medium uppercase tracking-wider text-white/30">
            <span className="col-span-5">Produit</span>
            <span className="col-span-2 text-right">Qté</span>
            <span className="col-span-2 text-right">Avant</span>
            <span className="col-span-2 text-right">Après</span>
            <span className="col-span-1 text-right">Éco.</span>
          </div>

          {commande.produits.map((p, i) => {
            const eco = p.prixAvant - p.prixApres;
            return (
              <div
                key={i}
                className="grid grid-cols-12 items-center gap-2 border-b border-white/5 px-4 py-3.5 text-sm last:border-0 hover:bg-white/3 transition-colors"
              >
                <div className="col-span-5 flex items-center gap-2.5">
                  <span className="text-base">{p.icone}</span>
                  <div className="min-w-0">
                    <p className="truncate text-white/80">{p.nom}</p>
                    <p className="text-xs text-white/30">{p.categorie}</p>
                  </div>
                </div>
                <span className="col-span-2 text-right text-white/40">{p.qte}</span>
                <span className="col-span-2 text-right text-white/40 line-through">
                  {p.prixAvant.toFixed(2)} €
                </span>
                <span className="col-span-2 text-right font-medium text-white">
                  {p.prixApres.toFixed(2)} €
                </span>
                <span className="col-span-1 text-right text-xs font-medium text-emerald-400">
                  −{eco.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Total + CTA */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-white/30">Total habituel</p>
              <p className="text-sm text-white/40 line-through">{commande.totalAvant.toFixed(2)} €</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <p className="text-xs text-white/30">Total optimisé</p>
              <p className="text-xl font-bold text-white">{commande.totalApres.toFixed(2)} €</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white">
              Modifier
            </button>
            <Link href="/dashboard/restaurateur/commandes" className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-purple-400 hover:shadow-violet-500/40">
              <span>🛒</span>
              <span>Passer une commande</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
