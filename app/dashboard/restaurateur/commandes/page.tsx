"use client";

import { Suspense, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import Banniere from "@/components/commande/Banniere";
import Catalogue from "@/components/commande/Catalogue";
import Panier from "@/components/commande/Panier";
import { type CartMap, type Produit, type FournisseurOption } from "@/components/commande/data";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth/use-profile";
import type { DbTarifJoined } from "@/lib/supabase/types";
import { Icon } from "@/components/ui/Icon";

// Convertit les tarifs Supabase vers le format Produit[] existant.
// `liveNames` contient le nom_commercial courant de chaque fournisseur
// (source de vérité : profiles). Prioritaire sur fournisseurs.nom.
function tarifsToProduitsFormat(
  tarifs: DbTarifJoined[],
  liveNames: Record<string, { nom: string; initiale: string }> = {},
): Produit[] {
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
        photos: p.photos ?? [],
        fournisseurs: [],
      });
    }
    const live = liveNames[f.id];
    map.get(p.id)!.fournisseurs.push({
      id: f.id,
      nom: live?.nom || f.nom,
      initiale: live?.initiale || f.initiale,
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

export default function CommandesPageWrapper() {
  return (
    <Suspense fallback={null}>
      <CommandesPage />
    </Suspense>
  );
}

function CommandesPage() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get("q") ?? "";
  const { profile } = useProfile();
  const [cartMap, setCartMap] = useState<CartMap>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [validated, setValidated] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [lastCartMap, setLastCartMap] = useState<CartMap>({});
  const [produitsReels, setProduitsReels] = useState<Produit[]>([]);
  const [loadingCatalogue, setLoadingCatalogue] = useState(true);

  // Charger le catalogue depuis Supabase (tarifs + overrides profils)
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("tarifs")
        .select(`
          prix, unite, badge, badge_expires_at, ancien_prix,
          fournisseurs!inner ( id, nom, initiale, avatar, minimum, delai, note ),
          produits!inner ( id, nom, categorie, icone, description, photos )
        `)
        .eq("actif", true)
        .is("archived_at", null)
        .not("fournisseur_id", "is", null)
        .not("produit_id",     "is", null);

      if (error || !data) { setLoadingCatalogue(false); return; }

      // Récupère le nom_commercial COURANT des fournisseurs (source de vérité)
      const typed = data as unknown as DbTarifJoined[];
      const fournIds = Array.from(new Set(typed.map(t => t.fournisseurs.id)));
      const liveNames: Record<string, { nom: string; initiale: string }> = {};
      if (fournIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, nom_commercial, nom_etablissement")
          .in("id", fournIds)
          .eq("role", "fournisseur");
        (profs ?? []).forEach(p => {
          const nom = (p.nom_commercial?.trim()) || (p.nom_etablissement?.trim()) || "";
          if (nom) liveNames[p.id] = { nom, initiale: nom.charAt(0).toUpperCase() };
        });
      }

      setProduitsReels(tarifsToProduitsFormat(typed, liveNames));
      setLoadingCatalogue(false);
    })();
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

    // ── 3. Fetch frais du profil restaurateur (émetteur) ─────
    //     On ne se fie PAS au state du hook useProfile() qui peut
    //     être null si le hook n'a pas encore fini de charger.
    console.group("[Facture PDF] Génération");
    console.log("User ID connecté :", user.id);

    const { data: freshBuyer, error: errBuyer } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    console.log("Profil restaurateur (fresh fetch) :", freshBuyer);
    if (errBuyer) console.error("Erreur fetch buyer :", errBuyer);
    if (!freshBuyer) {
      console.warn("⚠ Aucun profil restaurateur trouvé en base. Rendez-vous sur /profile pour remplir les infos (SIRET, adresse, logo…).");
    } else {
      const filled = Object.entries(freshBuyer)
        .filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && v.length === 0))
        .map(([k]) => k);
      console.log(`Champs remplis (${filled.length}) :`, filled.join(", "));
    }

    // ── 4. Fetch des profils fournisseurs ────────────────────
    const fournisseurIds = Array.from(byFourn.keys());
    console.log("Fournisseur IDs à fetcher :", fournisseurIds);

    const { data: sellerProfiles, error: errSellers } = await supabase
      .from("profiles")
      .select("id, role, nom_commercial, nom_etablissement, raison_sociale, siret, adresse_ligne1, adresse_ligne2, code_postal, ville, telephone, email_contact, logo_url, iban, bic, horaires_livraison, jours_livraison")
      .in("id", fournisseurIds)
      .eq("role", "fournisseur");

    console.log("Profils fournisseurs reçus :", sellerProfiles);
    if (errSellers) console.error("Erreur fetch sellers :", errSellers);
    if (!sellerProfiles || sellerProfiles.length === 0) {
      console.warn(
        "⚠ Aucun profil fournisseur récupéré. Causes possibles :\n" +
        "  1) RLS : exécutez supabase/migration_invoice_access.sql dans Supabase SQL Editor\n" +
        "  2) Les fournisseurs n'ont pas de profil rempli (pas de row dans profiles)\n" +
        `  3) Les IDs demandés ne correspondent à aucun profil role='fournisseur' : ${fournisseurIds.join(", ")}`
      );
    } else if (sellerProfiles.length < fournisseurIds.length) {
      const missing = fournisseurIds.filter(id => !sellerProfiles.find(s => s.id === id));
      console.warn("⚠ Profils fournisseurs manquants pour les IDs :", missing);
    }

    const sellersMap: Record<string, NonNullable<typeof sellerProfiles>[number]> = {};
    (sellerProfiles ?? []).forEach((s) => { sellersMap[s.id] = s; });
    console.log("Map sellers passée au PDF :", sellersMap);
    console.groupEnd();

    // ── 5. Générer le PDF ─────────────────────────────────────
    try {
      const { generateFacturePDF } = await import("@/lib/pdf");
      await generateFacturePDF(snapshot, {
        buyer: freshBuyer ?? profile,
        sellers: sellersMap,
      });
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
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: freshBuyer } = await supabase
        .from("profiles").select("*").eq("id", user.id).maybeSingle();

      const fournisseurIds = Array.from(
        new Set(Object.values(lastCartMap).map((e) => e.fournisseur.id)),
      );
      const { data: sellerProfiles } = await supabase
        .from("profiles")
        .select("id, role, nom_commercial, nom_etablissement, raison_sociale, siret, adresse_ligne1, adresse_ligne2, code_postal, ville, telephone, email_contact, logo_url, iban, bic, horaires_livraison, jours_livraison")
        .in("id", fournisseurIds)
        .eq("role", "fournisseur");
      const sellersMap: Record<string, NonNullable<typeof sellerProfiles>[number]> = {};
      (sellerProfiles ?? []).forEach((s) => { sellersMap[s.id] = s; });

      console.group("[Facture PDF] Re-download");
      console.log("Buyer :",   freshBuyer);
      console.log("Sellers :", sellersMap);
      console.groupEnd();

      const { generateFacturePDF } = await import("@/lib/pdf");
      await generateFacturePDF(lastCartMap, {
        buyer: freshBuyer ?? profile,
        sellers: sellersMap,
      });
    } catch (e) {
      console.error("PDF error:", e);
    }
  }, [lastCartMap, profile]);

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
      <DashboardLayout role="restaurateur">
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
            <h1 className="text-3xl font-bold text-[#1A1A2E]">Commande validée !</h1>
            <p className="mt-2 text-gray-500">
              Dispatché vers {suppliers.length} fournisseur{suppliers.length > 1 ? "s" : ""} · La facture PDF a été téléchargée.
            </p>
          </div>

          {/* Summary cards */}
          <div className="flex flex-wrap justify-center gap-3 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 text-center">
              <p className="text-xs text-gray-500">Total commande</p>
              <p className="mt-1 text-xl font-bold text-[#1A1A2E]">
                {total.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-4 text-center">
              <p className="text-xs text-emerald-400/70">Économies réalisées</p>
              <p className="mt-1 text-xl font-bold text-emerald-400">
                −{economies.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 text-center">
              <p className="text-xs text-gray-500">Fournisseurs</p>
              <div className="mt-1 flex flex-col gap-0.5">
                {suppliers.map((s) => (
                  <p key={s} className="text-xs font-medium text-gray-700">{s}</p>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap justify-center gap-3 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
            <button
              onClick={handleRedownload}
              className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-500/20 px-5 py-3 text-sm font-medium text-indigo-600 transition-all hover:bg-indigo-500 hover:text-[#1A1A2E]"
            >
              <span>⬇</span> Re-télécharger la facture
            </button>
            <button
              onClick={() => setValidated(false)}
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3 text-sm font-semibold text-[#1A1A2E] shadow-lg shadow-indigo-500/20 hover:from-indigo-600 hover:to-violet-600"
            >
              Nouvelle commande
            </button>
            <Link
              href="/dashboard/restaurateur"
              className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-600 hover:bg-white/10 hover:text-[#1A1A2E]"
            >
              Retour au dashboard
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="restaurateur">
      <Banniere cartMap={cartMap} />

      <div className="relative mx-auto flex max-w-[1600px] gap-0">
        {/* ── Catalogue (left, scrollable) ───────────────────────────── */}
        <div className="min-w-0 flex-1 px-6 pb-32 pt-6 lg:pb-6">
          {/* Breadcrumb */}
          <div className="mb-5 flex items-center gap-2 text-sm text-gray-400">
            <Link href="/dashboard/restaurateur" className="hover:text-gray-600 transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-gray-600">Passer une commande</span>
          </div>

          <div className="mb-5">
            <h1 className="text-xl font-bold text-[#1A1A2E]">Catalogue fournisseurs</h1>
            <p className="mt-0.5 text-sm text-gray-500">
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
            initialSearch={initialSearch}
          />
        </div>

        {/* ── Panier (right, sticky desktop) ─────────────────────────── */}
        <aside className="hidden w-96 shrink-0 border-l border-gray-200 lg:block">
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
            className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-3.5 text-sm font-semibold text-[#1A1A2E] shadow-2xl shadow-violet-500/40"
          >
            <Icon name="shopping-cart" size={16} />
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
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-gray-200 bg-[#F8F9FA]">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <span className="font-semibold text-[#1A1A2E]">Mon panier</span>
              <button
                onClick={() => setCartOpen(false)}
                className="text-gray-500 hover:text-[#1A1A2E]"
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
    </DashboardLayout>
  );
}
