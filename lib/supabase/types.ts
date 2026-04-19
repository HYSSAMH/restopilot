export type StatutCommande =
  | "recue"
  | "en_preparation"
  | "en_livraison"
  | "livree"
  | "receptionnee"
  | "receptionnee_avec_anomalies"
  | "annulee";

export interface DbFournisseur {
  id: string;
  nom: string;
  initiale: string;
  avatar: string;
  minimum: number;
  delai: string;
  note: number;
}

export interface DbTarifJoined {
  prix: number;
  unite: string;
  badge: "nouveaute" | "prix_baisse" | "promotion" | null;
  badge_expires_at: string | null;
  ancien_prix: number | null;
  fournisseurs: DbFournisseur;
  produits: {
    id: string;
    nom: string;
    categorie: string;
    icone: string;
    description: string | null;
    photos: string[] | null;
  };
}

export interface DbCommande {
  id: string;
  restaurateur_nom: string;
  fournisseur_id: string;
  statut: StatutCommande;
  montant_total: number;
  created_at: string;
  updated_at: string;
  avoir_montant?: number | null;
  avoir_statut?: "en_attente" | "accepte" | "conteste" | "annule" | null;
  avoir_motif_contestation?: string | null;
  fournisseurs: Pick<DbFournisseur, "nom" | "initiale" | "avatar">;
  lignes_commande: {
    id: string;
    nom_snapshot: string;
    prix_snapshot: number;
    unite: string;
    quantite: number;
  }[];
}
