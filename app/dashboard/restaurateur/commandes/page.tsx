"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/dashboard/Navbar";
import Banniere from "@/components/commande/Banniere";
import Catalogue from "@/components/commande/Catalogue";
import Panier from "@/components/commande/Panier";
import { type CartMap, type Produit, type FournisseurOption } from "@/components/commande/data";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth/use-profile";
import type { DbTarifJoined } from "@/lib/supabase/types";

// Convertit les tarifs Supabase vers le format Produit[] existant
function tarifsToProduitsFormat(tarifs: DbTarifJoined[]): Produit[] {
  const map = new Map<string, Produit>();
  tarifs.forEach((t) => {
    const p = t.produits;
    const f = t.fournisseurs;
    if (!map.has(p.id)) {
      map.set(p.id, {
        id: p.id,
        nom: p.nom,
        categorie: p.categorie as Produit["categorie"],
        icone: p.icone,
        description: p.description ?? "",
        fournisseurs: [],
      });
    }
    map.get(p.id)!.fournisseurs.push({
      id: f.id,
      nom: f.nom,
      initiale: f.initiale,
      avatar: f.avatar,
      prix: t.prix,
      unite: t.unite,
      minimum: f.minimum,
      delai: f.delai,
      note: f.note,
      badge: t.badge ?? null,
      badge_expires_at: t.badge_expires_at ?? null,
      ancien_prix: t.ancien_prix ?? null,
    } as FournisseurOption);
  });
  return Array.from(map.values());
}

export default function CommandesPage() {
  const { profile } = useProfile();
  const [cartMap, setCartMap] = useState<CartMap>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [validated, setValidated] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [lastCartMap, setLastCartMap] = useState<CartMap>({});
  const [produitsReels, setProduitsReels] = useState<Produit[]>([]);
  const [loadingCatalogue, setLoadingCatalogue] = useState(true);

  // Charger le catalogue depuis Supabase
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("tarifs")
      .select(`
        prix, unite, badge, badge_expires_at, ancien_prix,
        fournisseurs!inner ( id, nom, initiale, avatar, minimum, delai, note ),
        produits!inner ( id, nom, categorie, icone, description )
      `)
      .eq("actif", true)
      .is("archived_at", null)
      .not("fournisseur_id", "is", null)
      .not("produit_id",     "is", null)
      .then(({ data, error }) => {
        if (!error && data) {
          setProduitsReels(tarifsToProduitsFormat(data as unknown as DbTarifJoined[]));
        }
        setLoadingCatalogue(false);
      });
  }, []);

  const handleAdd = useCallback((produit: Produit, fournisseur: FournisseurOption) => {
    setCartMap((prev) => ({
      ...prev,
      [produit.id]: {
        produit,
        fournisseur,
        qty: prev[produit.id]?.fournisseur.id === fournisseur.id
          ? (prev[produit.id]?.qty ?? 0) + 1
          : 1,
      },
    }));
  }, []);

  const handleRemove = useCallback((produitId: string) => {
    setCartMap((prev) => {
      const next = { ...prev };
      delete next[produitId];
      return next;
    });
  }, []);

  const handleQtyChange = useCallback((produitId: string, delta: number) => {
    setCartMap((prev) => {
      const entry = prev[produitId];
      if (!entry) return prev;
      const newQty = entry.qty + delta;
      if (newQty <= 0) {
        const next = { ...prev };
        delete next[produitId];
        return next;
      }
      return { ...prev, [produitId]: { ...entry, qty: newQty } };
    });
  }, []);

  const handleAutoFill = useCallback(() => {
    const source = produitsReels;
    const autoCart: CartMap = {};
    source.forEach((produit) => {
      const cheapest = produit.fournisseurs.reduce((best, f) =>
        f.prix < best.prix ? f : best
      );
      autoCart[produit.id] = { produit, fournisseur: cheapest, qty: 1 };
    });
    setCartMap(autoCart);
  }, [produitsReels]);

  const handleValidate = useCallback(async () => {
    setGeneratingPdf(true);
    const snapshot = { ...cartMap };
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setGeneratingPdf(false); return; }
    const restaurateurNom = profile?.nom_etablissement ?? "Mon restaurant";

    // ── 1. Grouper par fournisseur ────────────────────────────
    const byFourn = new Map<string, { fournisseur: FournisseurOption; items: typeof snapshot[string][]; subtotal: number }>();
    Object.values(snapshot).forEach((entry) => {
      const fid = entry.fournisseur.id;
      if (!byFourn.has(fid)) byFourn.set(fid, { fournisseur: entry.fournisseur, items: [], subtotal: 0 });
      const g = byFourn.get(fid)!;
      g.items.push(entry);
      g.subtotal += entry.fournisseur.prix * entry.qty;
    });

    // ── 2. Insérer une commande par fournisseur ───────────────
    for (const [fournisseurId, { items, subtotal }] of byFourn) {
      try {
        const { data: commande, error: errCmd } = await supabase
          .from("commandes")
          .insert({
            fournisseur_id:  fournisseurId,
            restaurateur_id: user.id,
            restaurateur_nom: restaurateurNom,
            montant_total:   Math.round(subtotal * 100) / 100,
            statut:          "recue",
          })
          .select("id")
          .single();

        if (errCmd || !commande) { console.error("Erreur commande:", errCmd); continue; }

        await supabase.from("lignes_commande").insert(
          items.map(({ produit, fournisseur: f, qty }) => ({
            commande_id: commande.id,
            produit_id: produit.id,
            nom_snapshot: produit.nom,
            prix_snapshot: f.prix,
            unite: f.unite,
            quantite: qty,
          }))
        );
      } catch (e) {
        console.error("Erreur insertion commande:", e);
      }
    }

    // ── 3. Générer le PDF ─────────────────────────────────────
    try {
      const { generateFacturePDF } = await import("@/lib/pdf");
      await generateFacturePDF(snapshot);
    } catch (e) {
      console.error("PDF error:", e);
    }

    setLastCartMap(snapshot);
    setCartMap({});
    setValidated(true);
    setGeneratingPdf(false);
  }, [cartMap, profile]);

  const handleRedownload = useCallback(async () => {
    try {
      const { generateFacturePDF } = await import("@/lib/pdf");
      await generateFacturePDF(lastCartMap);
    } catch (e) {
      console.error("PDF error:", e);
    }
  }, [lastCartMap]);

  const cartCount = Object.values(cartMap).reduce((s, e) => s + e.qty, 0);

  if (validated) {
    const suppliers = [...new Set(Object.values(lastCartMap).map((e) => e.fournisseur.nom))];
    const total = Object.values(lastCartMap).reduce(
      (s, e) => s + e.fournisseur.prix * e.qty, 0
    );
    const economies = Object.values(lastCartMap).reduce((s, { produit, fournisseur, qty }) => {
      const maxPrix = Math.max(...produit.fournisseurs.map((f) => f.prix));
      return s + (maxPrix - fournisseur.prix) * qty;
    }, 0);

    return (
      <div className="min-h-screen bg-[#0d0d1a]">
        <Navbar role="restaurateur" />
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-emerald-700/15 blur-3xl" />
        </div>
        <div className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-8 px-4 text-center">
          {/* Icon */}
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-400 text-5xl shadow-2xl shadow-emerald-500/30 animate-fade-in-up">
            ✓
          </div>

          {/* Title */}
          <div className="animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            <h1 className="text-3xl font-bold text-white">Commande validée !</h1>
            <p className="mt-2 text-white/50">
              Dispatché vers {suppliers.length} fournisseur{suppliers.length > 1 ? "s" : ""} · La facture PDF a été téléchargée.
            </p>
          </div>

          {/* Summary cards */}
          <div className="flex flex-wrap justify-center gap-3 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-center">
              <p className="text-xs text-white/40">Total commande</p>
              <p className="mt-1 text-xl font-bold text-white">
                {total.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-4 text-center">
              <p className="text-xs text-emerald-400/70">Économies réalisées</p>
              <p className="mt-1 text-xl font-bold text-emerald-400">
                −{economies.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-center">
              <p className="text-xs text-white/40">Fournisseurs</p>
              <div className="mt-1 flex flex-col gap-0.5">
                {suppliers.map((s) => (
                  <p key={s} className="text-xs font-medium text-white/70">{s}</p>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap justify-center gap-3 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
            <button
              onClick={handleRedownload}
              className="flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-600/20 px-5 py-3 text-sm font-medium text-violet-300 transition-all hover:bg-violet-600 hover:text-white"
            >
              <span>⬇</span> Re-télécharger la facture
            </button>
            <button
              onClick={() => setValidated(false)}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:from-violet-500 hover:to-purple-400"
            >
              Nouvelle commande
            </button>
            <Link
              href="/dashboard/restaurateur"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white"
            >
              Retour au dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d1a]">
      <Navbar role="restaurateur" />
      <Banniere cartMap={cartMap} />

      <div className="relative mx-auto flex max-w-[1600px] gap-0">
        {/* ── Catalogue (left, scrollable) ───────────────────────────── */}
        <div className="min-w-0 flex-1 px-6 pb-32 pt-6 lg:pb-6">
          {/* Breadcrumb */}
          <div className="mb-5 flex items-center gap-2 text-sm text-white/30">
            <Link href="/dashboard/restaurateur" className="hover:text-white/60 transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-white/60">Passer une commande</span>
          </div>

          <div className="mb-5">
            <h1 className="text-xl font-bold text-white">Catalogue fournisseurs</h1>
            <p className="mt-0.5 text-sm text-white/40">
              Comparez les prix et choisissez le meilleur fournisseur pour chaque produit.
            </p>
          </div>

          <Catalogue
            cartMap={cartMap}
            onAdd={handleAdd}
            onRemove={handleRemove}
            onQtyChange={handleQtyChange}
            onAutoFill={handleAutoFill}
            produitsReels={produitsReels}
            loading={loadingCatalogue}
          />
        </div>

        {/* ── Panier (right, sticky desktop) ─────────────────────────── */}
        <aside className="hidden w-96 shrink-0 border-l border-white/8 lg:block">
          <div className="sticky top-[calc(4rem+var(--banniere-h,0px))] h-[calc(100vh-4rem)] overflow-y-auto">
            <Panier
              cartMap={cartMap}
              onRemove={handleRemove}
              onQtyChange={handleQtyChange}
              onValidate={handleValidate}
              generatingPdf={generatingPdf}
            />
          </div>
        </aside>
      </div>

      {/* ── Floating cart button (mobile) ─────────────────────────────── */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 lg:hidden">
          <button
            onClick={() => setCartOpen(true)}
            className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-500 px-5 py-3.5 text-sm font-semibold text-white shadow-2xl shadow-violet-500/40"
          >
            <span>🛒</span>
            <span>{cartCount} article{cartCount > 1 ? "s" : ""} dans le panier</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
              Voir →
            </span>
          </button>
        </div>
      )}

      {/* ── Mobile cart drawer ─────────────────────────────────────────── */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setCartOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#0d0d1a]">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <span className="font-semibold text-white">Mon panier</span>
              <button
                onClick={() => setCartOpen(false)}
                className="text-white/40 hover:text-white"
              >
                ✕
              </button>
            </div>
            <Panier
              cartMap={cartMap}
              onRemove={(id) => { handleRemove(id); if (Object.keys(cartMap).length <= 1) setCartOpen(false); }}
              onQtyChange={handleQtyChange}
              onValidate={() => { handleValidate(); setCartOpen(false); }}
              generatingPdf={generatingPdf}
            />
          </div>
        </div>
      )}
    </div>
  );
}
