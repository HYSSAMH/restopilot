"use client";

import { useState } from "react";
import { type CartMap, type Produit, type FournisseurOption, type Categorie } from "./data";

interface CatalogueProps {
  cartMap: CartMap;
  onAdd: (produit: Produit, fournisseur: FournisseurOption) => void;
  onRemove: (produitId: string) => void;
  onQtyChange: (produitId: string, delta: number) => void;
  onAutoFill: () => void;
  produitsReels: Produit[];
  loading?: boolean;
}

function Stars({ note }: { note: number }) {
  return (
    <span className="flex items-center gap-0.5 text-xs text-amber-400">
      ★ <span className="text-gray-500">{note.toFixed(1)}</span>
    </span>
  );
}

function ProduitCard({
  produit,
  cartMap,
  onAdd,
  onRemove,
  onQtyChange,
}: {
  produit: Produit;
  cartMap: CartMap;
  onAdd: (p: Produit, f: FournisseurOption) => void;
  onRemove: (id: string) => void;
  onQtyChange: (id: string, delta: number) => void;
}) {
  const minPrix = Math.min(...produit.fournisseurs.map((f) => f.prix));
  const selected = cartMap[produit.id];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white transition-all duration-200 hover:border-violet-500/20 hover:bg-white/[0.06]">
      {/* Product header */}
      <div className="flex items-start justify-between border-b border-gray-200 px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{produit.icone}</span>
          <div>
            <p className="font-semibold text-[#1A1A2E]">{produit.nom}</p>
            <p className="text-xs text-white/35">{produit.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {selected && (
            <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs font-medium text-indigo-600">
              Dans le panier
            </span>
          )}
        </div>
      </div>

      {/* Fournisseur rows */}
      <div className="divide-y divide-gray-100 px-2 py-1.5">
        {produit.fournisseurs.map((f) => {
          const isBest = f.prix === minPrix;
          const isSelected = selected?.fournisseur.id === f.id;
          const isAutoSelected = isBest && !selected; // cheapest, not yet in cart
          const qty = isSelected ? selected!.qty : 0;

          return (
            <div
              key={f.id}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
                isSelected
                  ? "bg-indigo-500/10 ring-1 ring-violet-500/30"
                  : isAutoSelected
                  ? "bg-emerald-500/5 ring-1 ring-emerald-500/25"
                  : "hover:bg-white/[0.04]"
              }`}
            >
              {/* Avatar */}
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${f.avatar} text-xs font-bold text-[#1A1A2E] shadow-sm`}
              >
                {f.initiale}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm text-gray-700">{f.nom}</span>
                  {isBest && (
                    <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                      Meilleur prix
                    </span>
                  )}
                  {isAutoSelected && (
                    <span className="shrink-0 rounded-full bg-emerald-600/15 px-1.5 py-0.5 text-[10px] text-emerald-400/70">
                      ✦ Auto-sélectionné
                    </span>
                  )}
                  {f.badge === "nouveaute" && f.badge_expires_at && new Date(f.badge_expires_at) > new Date() && (
                    <span className="shrink-0 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
                      ✦ Nouveauté
                    </span>
                  )}
                  {f.badge === "prix_baisse" && f.badge_expires_at && new Date(f.badge_expires_at) > new Date() && (
                    <span className="shrink-0 rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                      ↓ Prix en baisse
                    </span>
                  )}
                  {f.badge === "promotion" && f.badge_expires_at && new Date(f.badge_expires_at) > new Date() && (
                    <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                      🏷 Promotion
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Stars note={f.note} />
                  <span>·</span>
                  <span>{f.delai}</span>
                  <span>·</span>
                  <span>Min. {f.minimum} €</span>
                </div>
              </div>

              {/* Prix + contrôles */}
              <div className="flex shrink-0 items-center gap-2">
                <div className="text-right">
                  {f.ancien_prix != null && f.badge === "promotion" && f.badge_expires_at && new Date(f.badge_expires_at) > new Date() && (
                    <p className="text-xs text-gray-400 line-through">{f.ancien_prix.toFixed(2)} €</p>
                  )}
                  <p
                    className={`text-sm font-bold ${
                      isBest ? "text-emerald-400" : "text-[#1A1A2E]"
                    }`}
                  >
                    {f.prix.toFixed(2)} €
                  </p>
                  <p className="text-xs text-gray-400">/{f.unite}</p>
                </div>

                {isSelected ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => qty <= 1 ? onRemove(produit.id) : onQtyChange(produit.id, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-gray-100 text-sm text-gray-600 transition-colors hover:bg-white/15 hover:text-[#1A1A2E]"
                    >
                      {qty <= 1 ? "×" : "−"}
                    </button>
                    <span className="w-7 text-center text-sm font-semibold text-[#1A1A2E]">{qty}</span>
                    <button
                      onClick={() => onQtyChange(produit.id, +1)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500 text-sm text-[#1A1A2E] transition-colors hover:bg-violet-500"
                    >
                      +
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onAdd(produit, f)}
                    className={`flex h-7 items-center justify-center rounded-lg text-sm transition-all hover:text-[#1A1A2E] ${
                      isAutoSelected
                        ? "w-auto gap-1 border border-emerald-500/40 bg-emerald-600/20 px-2 text-emerald-300 opacity-100 hover:bg-emerald-600"
                        : "w-7 border border-indigo-200 bg-indigo-500/20 text-indigo-600 opacity-0 group-hover:opacity-100 hover:bg-indigo-500"
                    }`}
                  >
                    {isAutoSelected ? <><span>+</span><span className="text-xs">Ajouter</span></> : "+"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Catalogue({ cartMap, onAdd, onRemove, onQtyChange, onAutoFill, produitsReels, loading = false }: CatalogueProps) {
  const SOURCE = produitsReels;
  const [activeTab, setActiveTab] = useState<Categorie | "tous">("tous");
  const [search, setSearch] = useState("");

  const displayTabs = [
    { id: "tous" as const,          label: "Tous",             icone: "🛒",  count: SOURCE.length },
    { id: "legumes" as const,       label: "Fruits & Légumes", icone: "🥬",  count: SOURCE.filter((p) => p.categorie === "legumes" || p.categorie === "fruits").length },
    { id: "boucherie" as const,     label: "Boucherie",        icone: "🥩",  count: SOURCE.filter((p) => p.categorie === "boucherie").length },
    { id: "poissonnerie" as const,  label: "Poissonnerie",     icone: "🐟",  count: SOURCE.filter((p) => p.categorie === "poissonnerie").length },
    { id: "epicerie" as const,      label: "Épicerie",         icone: "🫙",  count: SOURCE.filter((p) => p.categorie === "epicerie").length },
  ];

  const catalogFiltered = SOURCE.filter((p) => {
    const matchSearch = p.nom.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (activeTab === "tous") return true;
    if (activeTab === "legumes") return p.categorie === "legumes" || p.categorie === "fruits";
    return p.categorie === activeTab;
  });

  if (loading) {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-2xl border border-gray-200 bg-white" />
        ))}
      </div>
    );
  }

  if (SOURCE.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white py-24 text-center">
        <span className="text-5xl">📭</span>
        <p className="text-gray-500 font-medium">Aucun produit disponible pour le moment</p>
        <p className="text-sm text-gray-400">Les fournisseurs n&apos;ont pas encore publié de produits.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Rechercher un produit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-[#1A1A2E] placeholder-gray-400 outline-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {displayTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-indigo-500 text-[#1A1A2E] shadow-lg shadow-indigo-500/20"
                : "border border-gray-200 bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            }`}
          >
            <span>{tab.icone}</span>
            <span>{tab.label}</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs ${
                activeTab === tab.id ? "bg-white/20 text-[#1A1A2E]" : "bg-gray-100 text-gray-400"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Auto-fill bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          {catalogFiltered.length} produit{catalogFiltered.length > 1 ? "s" : ""}
          {search && ` pour "${search}"`}
        </p>
        <button
          onClick={onAutoFill}
          className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-all hover:bg-emerald-500/20 hover:text-emerald-300"
        >
          <span>✦</span>
          <span>Tout ajouter au meilleur prix</span>
        </button>
      </div>

      {/* Product grid */}
      <div className="grid gap-4 xl:grid-cols-2">
        {catalogFiltered.map((produit) => (
          <ProduitCard
            key={produit.id}
            produit={produit}
            cartMap={cartMap}
            onAdd={onAdd}
            onRemove={onRemove}
            onQtyChange={onQtyChange}
          />
        ))}
      </div>

      {catalogFiltered.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-gray-200 py-16 text-center">
          <span className="text-4xl">🔍</span>
          <p className="text-gray-500">Aucun produit trouvé pour &ldquo;{search}&rdquo;</p>
          <button onClick={() => setSearch("")} className="text-sm text-indigo-500 underline-offset-4 hover:underline">
            Effacer la recherche
          </button>
        </div>
      )}
    </div>
  );
}
