import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { classifierProduit, dominantCategorie } from "@/lib/categories";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/recategorize-all
 *
 * Reclassifie toutes les lignes_commande du restaurateur connecté avec
 * la classification automatique (lib/categories.ts), puis recalcule la
 * categorie_dominante de chaque commande. Idempotent : peut être
 * relancé après chaque mise à jour de la taxonomie.
 *
 * Réponse : { ok, lignes_updated, commandes_updated, errors? }
 */
export async function POST(_req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supa = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
    );
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return Response.json({ error: "Non authentifié." }, { status: 401 });

    // 1) Récupère toutes les commandes + lignes du restaurateur
    const { data: commandes, error: errC } = await supa
      .from("commandes")
      .select(`
        id,
        lignes_commande ( id, nom_snapshot, prix_snapshot, quantite, categorie )
      `)
      .eq("restaurateur_id", user.id);
    if (errC) {
      return Response.json({ error: "Lecture commandes : " + errC.message }, { status: 500 });
    }

    type Cmd = {
      id: string;
      lignes_commande: {
        id: string;
        nom_snapshot: string;
        prix_snapshot: number;
        quantite: number;
        categorie: string | null;
      }[];
    };
    const allCmds = (commandes ?? []) as Cmd[];

    let lignesUpdated = 0;
    let commandesUpdated = 0;
    const errors: string[] = [];

    for (const cmd of allCmds) {
      const lignes = cmd.lignes_commande ?? [];

      // Classifie chaque ligne et collecte les updates si la catégorie change
      const ligneUpdates: { id: string; categorie: string }[] = [];
      const lignesAvecCat: { categorie: string; quantite: number; prix_unitaire: number; total: number }[] = [];
      for (const l of lignes) {
        const newCat = classifierProduit(l.nom_snapshot);
        if (l.categorie !== newCat) {
          ligneUpdates.push({ id: l.id, categorie: newCat });
        }
        lignesAvecCat.push({
          categorie: newCat,
          quantite: Number(l.quantite),
          prix_unitaire: Number(l.prix_snapshot),
          total: Number(l.quantite) * Number(l.prix_snapshot),
        });
      }

      // Update des lignes en batch (un par un parce que update bulk
      // par id n'est pas trivial avec supabase-js — on utilise upsert).
      for (const u of ligneUpdates) {
        const { error } = await supa
          .from("lignes_commande")
          .update({ categorie: u.categorie })
          .eq("id", u.id);
        if (error) {
          errors.push(`ligne ${u.id}: ${error.message}`);
        } else {
          lignesUpdated++;
        }
      }

      // Calcul de la catégorie dominante de la commande
      const dom = dominantCategorie(lignesAvecCat);
      if (dom) {
        const { error } = await supa
          .from("commandes")
          .update({ categorie_dominante: dom })
          .eq("id", cmd.id);
        if (error) {
          errors.push(`commande ${cmd.id}: ${error.message}`);
        } else {
          commandesUpdated++;
        }
      }
    }

    return Response.json({
      ok: true,
      lignes_updated: lignesUpdated,
      commandes_updated: commandesUpdated,
      total_commandes: allCmds.length,
      total_lignes: allCmds.reduce((s, c) => s + (c.lignes_commande?.length ?? 0), 0),
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
    });
  } catch (e) {
    return Response.json(
      { error: "Erreur serveur : " + (e instanceof Error ? e.message : String(e)) },
      { status: 500 },
    );
  }
}
