import type { SupabaseClient } from "@supabase/supabase-js";

export type ProduitSourceKind = "mercuriale" | "historique" | "import";

/** Un produit consolidé depuis l'une des 3 sources d'approvisionnement. */
export interface ProduitSource {
  id:                 string;         // `tarif:<id>` OU `histo:<ligne_id>`
  source:             ProduitSourceKind;
  tarif_id:           string | null;
  produit_id:         string | null;
  produit_nom:        string;
  produit_categorie:  string;
  fournisseur_id:     string | null;
  fournisseur_nom:    string | null;
  unite:              string;
  prix_ht:            number;
  tva_taux:           number;
  prix_precedent:     number | null;
  prix_precedent_maj: string | null;
  updated_at:         string;
}

/**
 * Charge l'ensemble des produits accessibles à un restaurateur,
 * consolidé depuis les 3 sources :
 *   1. Mercuriale fournisseurs (table `tarifs` actifs)
 *   2. Historique d'achats (lignes_commande sur commandes non annulées)
 *   3. Factures importées (lignes_commande avec commande.source='import')
 *
 * Déduplication par (nom, fournisseur_id) : les tarifs l'emportent
 * sur les entrées issues de l'historique.
 *
 * Utilisé par `/menu/mercuriale` ET par la recherche d'ingrédients
 * des fiches techniques `/menu/[plat_id]` pour garantir la cohérence.
 */
export async function loadProduitSources(
  supa: SupabaseClient,
  restaurateurId: string,
  options: { debug?: boolean } = {},
): Promise<ProduitSource[]> {
  const log = options.debug ? console.log.bind(console) : () => {};

  // 1. Mercuriale fournisseurs
  const tarifsRes = await supa
    .from("tarifs")
    .select("*, produits(nom, categorie), fournisseurs(id, nom)")
    .eq("actif", true);

  if (tarifsRes.error) console.error("[mercuriale-sources] tarifs:", tarifsRes.error);
  log(`[mercuriale-sources] tarifs actifs → ${tarifsRes.data?.length ?? 0}`);

  type TarifRaw = {
    id: string; prix: number | null; unite: string; produit_id: string;
    tva_taux?: number | null;
    prix_precedent?: number | null;
    prix_precedent_maj?: string | null;
    updated_at?: string;
    produits: { nom: string; categorie: string } | null;
    fournisseurs: { id: string; nom: string } | null;
  };
  const fromTarifs: ProduitSource[] = ((tarifsRes.data ?? []) as unknown as TarifRaw[]).map(t => ({
    id:                 `tarif:${t.id}`,
    source:             "mercuriale",
    tarif_id:           t.id,
    produit_id:         t.produit_id,
    produit_nom:        t.produits?.nom ?? "—",
    produit_categorie:  t.produits?.categorie ?? "autre",
    fournisseur_id:     t.fournisseurs?.id ?? null,
    fournisseur_nom:    t.fournisseurs?.nom ?? null,
    unite:              t.unite ?? "pièce",
    prix_ht:            Number(t.prix ?? 0),
    tva_taux:           Number(t.tva_taux ?? 20),
    prix_precedent:     t.prix_precedent != null ? Number(t.prix_precedent) : null,
    prix_precedent_maj: t.prix_precedent_maj ?? null,
    updated_at:         t.updated_at ?? new Date(0).toISOString(),
  }));

  // 2. Historique + factures importées
  const cmdRes = await supa
    .from("commandes")
    .select(`
      id, fournisseur_id, fournisseur_externe_id, source, created_at,
      fournisseurs(nom),
      fournisseurs_externes(nom),
      lignes_commande(id, nom_snapshot, prix_snapshot, unite)
    `)
    .eq("restaurateur_id", restaurateurId)
    .neq("statut", "annulee")
    .order("created_at", { ascending: false })
    .limit(500);

  if (cmdRes.error) console.error("[mercuriale-sources] commandes:", cmdRes.error);

  type CmdRaw = {
    id: string;
    fournisseur_id: string | null;
    fournisseur_externe_id: string | null;
    source: string | null;
    created_at: string;
    fournisseurs: { nom: string } | null;
    fournisseurs_externes: { nom: string } | null;
    lignes_commande: { id: string; nom_snapshot: string; prix_snapshot: number; unite: string }[] | null;
  };
  const dedupHisto = new Map<string, ProduitSource>();
  let totalLignes = 0;
  ((cmdRes.data ?? []) as unknown as CmdRaw[]).forEach(c => {
    const isImport = c.source === "import";
    const fournNom = c.fournisseurs?.nom ?? c.fournisseurs_externes?.nom ?? null;
    const fournId  = c.fournisseur_id ?? c.fournisseur_externe_id ?? null;
    (c.lignes_commande ?? []).forEach(l => {
      totalLignes += 1;
      const nom = (l.nom_snapshot ?? "").trim();
      if (!nom) return;
      const key = `${nom.toLowerCase()}|${fournId ?? "none"}`;
      if (dedupHisto.has(key)) return;  // 1re occurrence = la plus récente (commandes ordered desc)
      dedupHisto.set(key, {
        id:                 `histo:${l.id}`,
        source:             isImport ? "import" : "historique",
        tarif_id:           null,
        produit_id:         null,
        produit_nom:        nom,
        produit_categorie:  "autre",
        fournisseur_id:     fournId,
        fournisseur_nom:    fournNom,
        unite:              l.unite ?? "pièce",
        prix_ht:            Number(l.prix_snapshot ?? 0),
        tva_taux:           20,
        prix_precedent:     null,
        prix_precedent_maj: null,
        updated_at:         c.created_at,
      });
    });
  });
  log(`[mercuriale-sources] lignes_commande → ${totalLignes} lignes, ${dedupHisto.size} uniques`);

  // 3. Fusion avec priorité aux tarifs
  const merged = new Map<string, ProduitSource>();
  fromTarifs.forEach(r => {
    const k = `${r.produit_nom.toLowerCase()}|${r.fournisseur_id ?? "none"}`;
    merged.set(k, r);
  });
  dedupHisto.forEach((r, k) => {
    if (!merged.has(k)) merged.set(k, r);
  });
  const out = Array.from(merged.values());
  log(`[mercuriale-sources] fusion → ${out.length} produits`);

  return out;
}
