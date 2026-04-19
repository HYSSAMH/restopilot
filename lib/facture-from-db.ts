import type { CartMap, Produit, FournisseurOption } from "@/components/commande/data";
import { generateFacturePDF, type PartyInfo } from "@/lib/pdf";
import { createClient } from "@/lib/supabase/client";

interface DbLigne {
  id:              string;
  nom_snapshot:    string;
  prix_snapshot:   number;
  unite:           string;
  quantite:        number;
  produit_id:      string | null;
}

interface DbCommandeForPdf {
  id:              string;
  fournisseur_id:  string;
  restaurateur_id: string | null;
  lignes_commande: DbLigne[];
  fournisseurs?:   { nom: string; initiale: string; avatar: string; minimum: number } | null;
}

/**
 * Reconstitue un CartMap à partir d'une commande stockée en base
 * puis réutilise generateFacturePDF pour refaire le bon de commande.
 */
export async function regenerateFacturePDF(commandeId: string): Promise<void> {
  const supabase = createClient();

  const { data } = await supabase
    .from("commandes")
    .select(`
      id, fournisseur_id, restaurateur_id,
      fournisseurs ( nom, initiale, avatar, minimum ),
      lignes_commande ( id, nom_snapshot, prix_snapshot, unite, quantite, produit_id )
    `)
    .eq("id", commandeId)
    .maybeSingle();

  if (!data) throw new Error("Commande introuvable");
  const cmd = data as unknown as DbCommandeForPdf;

  // Reconstitue un "fournisseur" minimal — seules les données d'affichage importent
  const fournisseur: FournisseurOption = {
    id:       cmd.fournisseur_id,
    nom:      cmd.fournisseurs?.nom ?? "Fournisseur",
    initiale: cmd.fournisseurs?.initiale ?? "F",
    avatar:   cmd.fournisseurs?.avatar ?? "from-indigo-500 to-violet-500",
    prix:     0,
    unite:    "",
    minimum:  Number(cmd.fournisseurs?.minimum ?? 0),
    delai:    "J+1",
    note:     0,
  };

  const cartMap: CartMap = {};
  cmd.lignes_commande.forEach((l, i) => {
    const produit: Produit = {
      id:          l.produit_id ?? `virtual-${i}`,
      nom:         l.nom_snapshot,
      categorie:   "epicerie",
      icone:       "📦",
      description: "",
      fournisseurs: [{ ...fournisseur, prix: Number(l.prix_snapshot), unite: l.unite }],
    };
    cartMap[produit.id] = {
      produit,
      fournisseur: { ...fournisseur, prix: Number(l.prix_snapshot), unite: l.unite },
      qty: l.quantite,
    };
  });

  // Fetch buyer + seller profiles
  const [{ data: buyerP }, { data: sellerP }] = await Promise.all([
    cmd.restaurateur_id
      ? supabase.from("profiles").select("*").eq("id", cmd.restaurateur_id).maybeSingle()
      : Promise.resolve({ data: null } as const),
    supabase.from("profiles").select("*").eq("id", cmd.fournisseur_id).maybeSingle(),
  ]);

  const sellers: Record<string, PartyInfo> = {};
  if (sellerP) sellers[cmd.fournisseur_id] = sellerP as PartyInfo;

  await generateFacturePDF(cartMap, {
    buyer:   (buyerP as PartyInfo | null) ?? undefined,
    sellers,
  });
}
