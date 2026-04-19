import { createClient } from "@/lib/supabase/client";
import { generateAvoirPDF, type AvoirData, type AvoirLine } from "@/lib/avoir-pdf";

interface Ligne {
  nom_snapshot:   string;
  unite:          string;
  prix_snapshot:  number;
  quantite:       number;
  quantite_recue: number | null;
  qualite:        "conforme" | "non_conforme" | null;
  motif_anomalie: string | null;
}

interface Commande {
  id:              string;
  restaurateur_id: string | null;
  fournisseur_id:  string;
  created_at:      string;
  lignes_commande: Ligne[];
}

interface PartyRow {
  nom_commercial:   string | null;
  nom_etablissement:string | null;
  raison_sociale:   string | null;
  siret:            string | null;
  adresse_ligne1:   string | null;
  code_postal:      string | null;
  ville:            string | null;
}

/**
 * Régénère le PDF d'avoir pour une commande donnée (utilise les anomalies
 * stockées dans lignes_commande). Fonctionne pour tout utilisateur ayant
 * accès à la commande (RLS se charge du contrôle).
 */
export async function regenerateAvoirPDF(commandeId: string): Promise<void> {
  const supabase = createClient();

  const { data } = await supabase
    .from("commandes")
    .select(`
      id, restaurateur_id, fournisseur_id, created_at,
      lignes_commande ( nom_snapshot, unite, prix_snapshot, quantite, quantite_recue, qualite, motif_anomalie )
    `)
    .eq("id", commandeId)
    .maybeSingle();

  if (!data) throw new Error("Commande introuvable");
  const cmd = data as unknown as Commande;

  const [{ data: buyer }, { data: seller }] = await Promise.all([
    cmd.restaurateur_id
      ? supabase.from("profiles").select("nom_commercial,nom_etablissement,raison_sociale,siret,adresse_ligne1,code_postal,ville").eq("id", cmd.restaurateur_id).maybeSingle()
      : Promise.resolve({ data: null } as const),
    supabase.from("profiles").select("nom_commercial,nom_etablissement,raison_sociale,siret,adresse_ligne1,code_postal,ville").eq("id", cmd.fournisseur_id).maybeSingle(),
  ]);

  const buyerProfile  = buyer  as PartyRow | null;
  const sellerProfile = seller as PartyRow | null;

  // Lignes en anomalie : qté reçue < qté commandée OU qualité non conforme
  const lignes: AvoirLine[] = cmd.lignes_commande
    .filter(l =>
      (l.qualite === "non_conforme") ||
      (l.quantite_recue !== null && Number(l.quantite_recue) < Number(l.quantite))
    )
    .map(l => ({
      nom:           l.nom_snapshot,
      unite:         l.unite,
      prix_unitaire: Number(l.prix_snapshot),
      qte_commandee: Number(l.quantite),
      qte_recue:     l.qualite === "non_conforme" ? 0 : Number(l.quantite_recue ?? 0),
      motif:         l.qualite === "non_conforme"
                       ? (l.motif_anomalie ?? "Non conforme")
                       : "Manquant",
    }));

  if (lignes.length === 0) throw new Error("Aucune anomalie détectée sur cette commande.");

  const ref = `AV-${new Date(cmd.created_at).toISOString().slice(0, 10).replace(/-/g, "")}-${cmd.id.slice(0, 4).toUpperCase()}`;
  const data_: AvoirData = {
    reference:   ref,
    commandeRef: cmd.id.slice(0, 8).toUpperCase(),
    date:        new Date().toLocaleDateString("fr-FR"),
    lignes,
    buyer: buyerProfile ? {
      nom:      buyerProfile.nom_commercial || buyerProfile.nom_etablissement || "Restaurateur",
      raison:   buyerProfile.raison_sociale,
      siret:    buyerProfile.siret,
      adresse:  buyerProfile.adresse_ligne1,
      cp_ville: [buyerProfile.code_postal, buyerProfile.ville].filter(Boolean).join(" ") || null,
    } : { nom: "Restaurateur" },
    seller: sellerProfile ? {
      nom:      sellerProfile.nom_commercial || sellerProfile.nom_etablissement || "Distributeur",
      raison:   sellerProfile.raison_sociale,
      siret:    sellerProfile.siret,
      adresse:  sellerProfile.adresse_ligne1,
      cp_ville: [sellerProfile.code_postal, sellerProfile.ville].filter(Boolean).join(" ") || null,
    } : null,
  };

  await generateAvoirPDF(data_);
}
