"use client";

import { useMemo } from "react";
import type { CartMap, Produit, FournisseurOption } from "./data";

interface PanierProps {
  cartMap: CartMap;
  onRemove: (produitId: string) => void;
  onQtyChange: (produitId: string, delta: number) => void;
  onValidate: () => void;
  generatingPdf?: boolean;
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Panier({ cartMap, onRemove, onQtyChange, onValidate, generatingPdf = false }: PanierProps) {
  const entries = Object.values(cartMap);

  const { grouped, economies, grandTotal, minimumsStatus } = useMemo(() => {
    const groups: Record<string, {
      fournisseur: FournisseurOption;
      items: { produit: Produit; fournisseur: FournisseurOption; qty: number }[];
      subtotal: number;
    }> = {};

    let eco = 0;
    let total = 0;

    Object.values(cartMap).forEach((entry) => {
      const { produit, fournisseur, qty } = entry;
      const id = fournisseur.id;
      if (!groups[id]) groups[id] = { fournisseur, items: [], subtotal: 0 };
      groups[id].items.push(entry);
      groups[id].subtotal += fournisseur.prix * qty;
      total += fournisseur.prix * qty;
      const maxPrix = Math.max(...produit.fournisseurs.map((f) => f.prix));
      eco += (maxPrix - fournisseur.prix) * qty;
    });

    const miniStatus = Object.values(groups).map(({ fournisseur, subtotal }) => ({
      nom: fournisseur.nom,
      minimum: fournisseur.minimum,
      subtotal,
      ok: subtotal >= fournisseur.minimum,
      avatar: fournisseur.avatar,
      initiale: fournisseur.initiale,
    }));

    return { grouped: Object.values(groups), economies: eco, grandTotal: total, minimumsStatus: miniStatus };
  }, [cartMap]);

  const allMinimumsOk = minimumsStatus.every((m) => m.ok);
  const hasItems = entries.length > 0;
  const canValidate = hasItems; // minimums are warnings, not hard blockers

  if (entries.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl">
          🛒
        </div>
        <p className="text-sm font-medium text-gray-500">Votre panier est vide</p>
        <p className="text-xs text-gray-400">
          Ajoutez des produits depuis le catalogue
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🛒</span>
            <span className="font-semibold text-[#1A1A2E]">Mon panier</span>
          </div>
          <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-600">
            {entries.length} produit{entries.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Grouped by fournisseur */}
        <div className="divide-y divide-gray-100 px-4 py-3">
          {grouped.map(({ fournisseur, items, subtotal }) => {
            const minInfo = minimumsStatus.find((m) => m.nom === fournisseur.nom)!;
            const pct = Math.min(100, (subtotal / fournisseur.minimum) * 100);

            return (
              <div key={fournisseur.id} className="py-4 first:pt-0">
                {/* Fournisseur header */}
                <div className="mb-3 flex items-center gap-2">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${fournisseur.avatar} text-xs font-bold text-[#1A1A2E]`}>
                    {fournisseur.initiale}
                  </div>
                  <span className="text-sm font-medium text-gray-700">{fournisseur.nom}</span>
                </div>

                {/* Items */}
                <div className="mb-3 flex flex-col gap-1.5">
                  {items.map(({ produit, qty }) => (
                    <div key={produit.id} className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
                      <span className="text-base">{produit.icone}</span>
                      <span className="flex-1 truncate text-xs text-white/65">{produit.nom}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => qty <= 1 ? onRemove(produit.id) : onQtyChange(produit.id, -1)}
                          className="flex h-5 w-5 items-center justify-center rounded text-gray-500 hover:bg-white/10 hover:text-[#1A1A2E] text-xs"
                        >
                          {qty <= 1 ? "×" : "−"}
                        </button>
                        <span className="w-5 text-center text-xs font-semibold text-[#1A1A2E]">{qty}</span>
                        <button
                          onClick={() => onQtyChange(produit.id, +1)}
                          className="flex h-5 w-5 items-center justify-center rounded text-gray-500 hover:bg-white/10 hover:text-[#1A1A2E] text-xs"
                        >
                          +
                        </button>
                      </div>
                      <span className="w-14 text-right text-xs font-medium text-[#1A1A2E]">
                        {fmt(fournisseur.prix * qty)} €
                      </span>
                    </div>
                  ))}
                </div>

                {/* Subtotal + minimum progress */}
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-gray-500">
                      Sous-total · min. {fmt(fournisseur.minimum)} €
                    </span>
                    <span className={`font-semibold ${minInfo.ok ? "text-emerald-400" : "text-amber-300"}`}>
                      {fmt(subtotal)} €
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        minInfo.ok ? "bg-emerald-500" : "bg-amber-400"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {!minInfo.ok && (
                    <p className="mt-1.5 text-xs text-amber-400/80">
                      Encore {fmt(fournisseur.minimum - subtotal)} € pour atteindre le minimum
                    </p>
                  )}
                  {minInfo.ok && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-400/80">
                      <span>✓</span> Minimum de commande atteint
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Économies */}
        {economies > 0 && (
          <div className="mx-4 mb-3 flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-base">💰</span>
              <span className="text-sm text-gray-600">Économies réalisées</span>
            </div>
            <span className="text-base font-bold text-emerald-400">−{fmt(economies)} €</span>
          </div>
        )}
      </div>

      {/* Footer sticky */}
      <div className="border-t border-gray-200 p-4">
        {/* Grand total */}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm text-gray-500">Total commande</span>
          <span className="text-xl font-bold text-[#1A1A2E]">{fmt(grandTotal)} €</span>
        </div>

        {/* Minimums warning — non-bloquant */}
        {hasItems && !allMinimumsOk && (
          <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-400/80">
            ⚠️ {minimumsStatus.filter((m) => !m.ok).length} fournisseur
            {minimumsStatus.filter((m) => !m.ok).length > 1 ? "s n'atteignent" : " n'atteint"} pas son minimum — vous pouvez quand même valider.
          </div>
        )}

        <button
          onClick={onValidate}
          disabled={!canValidate || generatingPdf}
          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all ${
            canValidate && !generatingPdf
              ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-[#1A1A2E] shadow-lg shadow-indigo-500/20 hover:from-indigo-600 hover:to-violet-600 hover:shadow-xl"
              : "cursor-not-allowed bg-gray-100 text-gray-400"
          }`}
        >
          {generatingPdf ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Génération de la facture…
            </>
          ) : hasItems ? (
            <>
              <span>⬇</span>
              <span>Valider & télécharger — {fmt(grandTotal)} €</span>
            </>
          ) : (
            "Panier vide"
          )}
        </button>
      </div>
    </div>
  );
}
