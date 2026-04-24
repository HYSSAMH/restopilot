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
import { Button, IconButton } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Modal";

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
        .not("produit_id", "is", null);

      if (error || !data) { setLoadingCatalogue(false); return; }

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

    const byFourn = new Map<string, { fournisseur: FournisseurOption; items: typeof snapshot[string][]; subtotal: number }>();
    Object.values(snapshot).forEach((entry) => {
      const fid = entry.fournisseur.id;
      if (!byFourn.has(fid)) byFourn.set(fid, { fournisseur: entry.fournisseur, items: [], subtotal: 0 });
      const g = byFourn.get(fid)!;
      g.items.push(entry);
      g.subtotal += entry.fournisseur.prix * entry.qty;
    });

    for (const [fournisseurId, { items, subtotal }] of byFourn) {
      try {
        const { data: commande, error: errCmd } = await supabase
          .from("commandes")
          .insert({
            fournisseur_id: fournisseurId,
            restaurateur_id: user.id,
            restaurateur_nom: restaurateurNom,
            montant_total: Math.round(subtotal * 100) / 100,
            statut: "recue",
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

    const { data: freshBuyer } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    const fournisseurIds = Array.from(byFourn.keys());
    const { data: sellerProfiles } = await supabase
      .from("profiles")
      .select("id, role, nom_commercial, nom_etablissement, raison_sociale, siret, adresse_ligne1, adresse_ligne2, code_postal, ville, telephone, email_contact, logo_url, iban, bic, horaires_livraison, jours_livraison")
      .in("id", fournisseurIds)
      .eq("role", "fournisseur");

    const sellersMap: Record<string, NonNullable<typeof sellerProfiles>[number]> = {};
    (sellerProfiles ?? []).forEach((s) => { sellersMap[s.id] = s; });

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
        <div className="min-h-[calc(100vh-14rem)] flex flex-col items-center justify-center text-center">
          <div
            className="flex h-[72px] w-[72px] items-center justify-center rounded-[18px] text-white mb-6 shadow-[0_8px_24px_rgba(16,185,129,0.35)]"
            style={{ background: "linear-gradient(135deg, #10B981 0%, #06B6D4 100%)" }}
          >
            <Icon name="check" size={32} strokeWidth={2.5} />
          </div>
          <h1 className="page-title">Commande validée</h1>
          <p className="page-sub mt-1">
            Dispatchée vers {suppliers.length} fournisseur{suppliers.length > 1 ? "s" : ""} · La facture PDF a été téléchargée.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <div className="rounded-[10px] border border-[var(--border)] bg-white px-5 py-4 min-w-[160px]">
              <p className="label-upper">Total commande</p>
              <p className="mono tabular mt-1 text-[22px] font-[650] tracking-[-0.02em]">
                {total.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
              </p>
            </div>
            <div className="rounded-[10px] border border-[var(--success-soft)] bg-[var(--success-soft)] px-5 py-4 min-w-[160px]">
              <p className="label-upper text-[var(--success)]">Économies</p>
              <p className="mono tabular mt-1 text-[22px] font-[650] tracking-[-0.02em] text-[var(--success)]">
                −{economies.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €
              </p>
            </div>
            <div className="rounded-[10px] border border-[var(--border)] bg-white px-5 py-4 min-w-[200px] text-left">
              <p className="label-upper">Fournisseurs</p>
              <div className="mt-2 flex flex-col gap-[3px]">
                {suppliers.map((s) => (
                  <p key={s} className="text-[12px] font-[550] text-[var(--text)]">{s}</p>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button variant="secondary" iconLeft="download" onClick={handleRedownload}>
              Re-télécharger la facture
            </Button>
            <Button variant="primary" iconLeft="plus" onClick={() => setValidated(false)}>
              Nouvelle commande
            </Button>
            <Link href="/dashboard/restaurateur">
              <Button variant="ghost" iconLeft="home">Retour au dashboard</Button>
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="restaurateur">
      <Banniere cartMap={cartMap} />

      <div className="relative -mx-6 flex max-w-none gap-0 md:-mx-7">
        {/* Catalogue */}
        <div className="min-w-0 flex-1 px-6 md:px-7 pb-32 lg:pb-6">
          <header className="mb-5">
            <h1 className="page-title">Catalogue fournisseurs</h1>
            <p className="page-sub">
              Comparez les prix et choisissez le meilleur fournisseur pour chaque produit.
            </p>
          </header>

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

        {/* Panier sticky (desktop) */}
        <aside className="hidden w-[380px] shrink-0 border-l border-[var(--border)] lg:block bg-white">
          <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
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

      {/* Bouton panier flottant (mobile) */}
      {cartCount > 0 ? (
        <div className="fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 lg:hidden">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="flex items-center gap-3 rounded-full bg-[var(--accent)] px-5 py-3 text-[13px] font-[600] text-white shadow-[0_8px_24px_rgba(99,102,241,0.35)]"
          >
            <Icon name="shopping-cart" size={16} />
            <span>{cartCount} article{cartCount > 1 ? "s" : ""}</span>
            <span className="rounded-full bg-white/20 px-2 py-[1px] text-[11px] mono tabular">
              Voir
            </span>
          </button>
        </div>
      ) : null}

      {/* Panier mobile en drawer */}
      <Drawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        width={420}
        title="Mon panier"
      >
        <Panier
          cartMap={cartMap}
          onRemove={(id) => { handleRemove(id); if (Object.keys(cartMap).length <= 1) setCartOpen(false); }}
          onQtyChange={handleQtyChange}
          onValidate={() => { handleValidate(); setCartOpen(false); }}
          generatingPdf={generatingPdf}
        />
      </Drawer>
    </DashboardLayout>
  );
}
