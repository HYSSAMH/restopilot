"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

// ── Constants ──────────────────────────────────────────────────────────────

export const DEMO_FOURNISSEUR_ID = "f1000000-0000-0000-0000-000000000001";
const BADGE_7_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const CAT_ICONE: Record<string, string> = {
  legumes: "🥬", fruits: "🍎", boucherie: "🥩", poissonnerie: "🐟", epicerie: "🫙",
  herbes: "🌿", pommes_de_terre: "🥔", salades: "🥗", cremerie: "🧀",
};
const getCatIcone = (cat: string) => CAT_ICONE[cat] ?? "📦";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ImportProgress {
  page: number;
  totalPages: number;
}

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
}

export type ImportStatus =
  | "idle"
  | "running"
  | "preview"
  | "applying"
  | "done"
  | "error";

export interface PreviewItem {
  nom: string;
  categorie: string;
  prix: number;
  unite: string;
  ancien_prix: number | null;
  is_promo: boolean;
  status: "nouveau" | "updated" | "unchanged";
  oldPrix?: number;
  tarif_id?: string;
  produit_id?: string;
}

export interface ImportState {
  status: ImportStatus;
  progress: ImportProgress | null;
  filename: string | null;
  previewItems: PreviewItem[];
  result: ImportResult | null;
  error: string | null;
}

interface ExtractedProduct {
  nom: string;
  categorie: string;
  prix: number | null;
  unite: string;
  ancien_prix?: number | null;
  is_promo?: boolean;
}

type CurrentRow = {
  id: string;
  prix: number;
  produits: { id: string; nom: string; categorie: string };
};

interface ImportContextValue {
  state: ImportState;
  startImport: (file: File) => void;
  confirmImport: (editedItems: PreviewItem[]) => Promise<void>;
  cancelImport: () => void;
  dismiss: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function detectPdfPageCount(base64: string): number {
  try {
    const binary = atob(base64);
    let max = 0;
    const re = /\/Count\s+(\d+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(binary)) !== null) {
      const n = parseInt(m[1], 10);
      if (n > max && n < 9999) max = n;
    }
    return max > 0 ? max : 1;
  } catch {
    return 1;
  }
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function buildPreviewItems(
  extracted: ExtractedProduct[],
  currentRows: CurrentRow[],
): PreviewItem[] {
  return extracted
    .filter((p) => p.prix !== null && p.prix > 0)
    .map((product) => {
      const norm = product.nom.toLowerCase().replace(/\s+/g, " ").trim();
      const row = currentRows.find(
        (r) => r.produits.nom.toLowerCase().replace(/\s+/g, " ").trim() === norm,
      );

      const base = {
        nom: product.nom,
        categorie: product.categorie,
        prix: product.prix as number,
        unite: product.unite,
        ancien_prix: product.ancien_prix ?? null,
        is_promo: product.is_promo ?? false,
      };

      if (!row) {
        return { ...base, status: "nouveau" as const };
      }

      const priceChanged = product.prix !== row.prix;
      const status =
        priceChanged || product.is_promo
          ? ("updated" as const)
          : ("unchanged" as const);

      return {
        ...base,
        status,
        oldPrix: row.prix,
        tarif_id: row.id,
        produit_id: row.produits.id,
      };
    });
}

// ── Context ────────────────────────────────────────────────────────────────

const ImportContext = createContext<ImportContextValue | null>(null);

export function useImport() {
  const ctx = useContext(ImportContext);
  if (!ctx) throw new Error("useImport must be used inside ImportProvider");
  return ctx;
}

// ── Provider ───────────────────────────────────────────────────────────────

export function ImportProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ImportState>({
    status: "idle",
    progress: null,
    filename: null,
    previewItems: [],
    result: null,
    error: null,
  });

  const startImport = useCallback(async (file: File) => {
    setState({
      status: "running",
      progress: null,
      filename: file.name,
      previewItems: [],
      result: null,
      error: null,
    });

    try {
      const base64 = await readFileAsBase64(file);
      const isPdf = file.type === "application/pdf";
      const pageCount = isPdf ? detectPdfPageCount(base64) : 1;
      const mediaType = file.type === "image/jpg" ? "image/jpeg" : file.type;

      // Utilisateur connecté (= fournisseur_id pour un rôle fournisseur)
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée — reconnectez-vous pour importer.");
      const fournisseurId = user.id;

      // Fetch current mercuriale for comparison
      const { data: tarifData } = await supabase
        .from("tarifs")
        .select("id, prix, produits ( id, nom, categorie )")
        .eq("fournisseur_id", fournisseurId);

      const currentRows: CurrentRow[] = (tarifData as CurrentRow[] | null) ?? [];

      // Call API → SSE stream
      const res = await fetch("/api/mercuriale-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64: base64, pageCount, mediaType }),
      });

      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? "Erreur serveur");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let extracted: ExtractedProduct[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const data = JSON.parse(part.slice(6)) as {
            type: string;
            page?: number;
            totalPages?: number;
            produits?: ExtractedProduct[];
            error?: string;
          };

          if (data.type === "progress" && data.page && data.totalPages) {
            setState((s) => ({
              ...s,
              progress: { page: data.page!, totalPages: data.totalPages! },
            }));
          }
          if (data.type === "error") throw new Error(data.error ?? "Erreur inconnue");
          if (data.type === "done" && data.produits) extracted = data.produits;
        }
      }

      // Build preview items (compare extracted vs current DB state)
      const previewItems = buildPreviewItems(extracted, currentRows);

      if (previewItems.length === 0) {
        setState((s) => ({
          ...s,
          status: "error",
          progress: null,
          error: "Aucun produit exploitable détecté dans le fichier.",
        }));
        return;
      }

      setState((s) => ({
        ...s,
        status: "preview",
        progress: null,
        previewItems,
      }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      console.error("ImportContext startImport error:", e);
      setState((s) => ({ ...s, status: "error", progress: null, error: msg }));
    }
  }, []);

  const confirmImport = useCallback(async (editedItems: PreviewItem[]) => {
    setState((s) => ({ ...s, status: "applying" }));

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée — reconnectez-vous.");
      const fournisseurId = user.id;

      let added = 0;
      let updated = 0;
      const failures: string[] = [];
      const expiresAt = new Date(Date.now() + BADGE_7_DAYS_MS).toISOString();

      for (const item of editedItems) {
        if (item.status === "unchanged") continue;

        if (item.status === "nouveau") {
          const { data: prod, error: errProd } = await supabase
            .from("produits")
            .insert({
              nom: item.nom,
              categorie: item.categorie,
              icone: getCatIcone(item.categorie),
              actif: true,
            })
            .select("id")
            .single();
          if (errProd || !prod) {
            failures.push(`${item.nom} (produit) : ${errProd?.message ?? "échec insert"}`);
            continue;
          }

          const { error: errTarif } = await supabase.from("tarifs").insert({
            produit_id: prod.id,
            fournisseur_id: fournisseurId,
            prix: item.prix,
            unite: item.unite,
            actif: true,
            badge: item.is_promo ? "promotion" : "nouveaute",
            badge_expires_at: expiresAt,
            ancien_prix: item.is_promo ? item.ancien_prix : null,
          });
          if (errTarif) {
            // Rollback orphan produit so it doesn't linger without a fournisseur link
            await supabase.from("produits").delete().eq("id", prod.id);
            failures.push(`${item.nom} (tarif) : ${errTarif.message}`);
            continue;
          }
          added++;
        } else {
          // updated
          if (item.produit_id) {
            await supabase
              .from("produits")
              .update({
                nom: item.nom,
                categorie: item.categorie,
                icone: getCatIcone(item.categorie),
              })
              .eq("id", item.produit_id);
          }

          const badge = item.is_promo
            ? "promotion"
            : item.oldPrix !== undefined && item.prix < item.oldPrix
            ? "prix_baisse"
            : null;

          const { error: errUpd } = await supabase
            .from("tarifs")
            .update({
              prix: item.prix,
              unite: item.unite,
              badge,
              badge_expires_at: badge ? expiresAt : null,
              ancien_prix: item.is_promo ? item.ancien_prix : null,
            })
            .eq("id", item.tarif_id!);
          if (errUpd) {
            failures.push(`${item.nom} (update) : ${errUpd.message}`);
            continue;
          }
          updated++;
        }
      }

      if (failures.length > 0) {
        console.error("Import failures:", failures);
      }

      // If everything failed, surface as error so the user sees the message
      if (added === 0 && updated === 0 && failures.length > 0) {
        setState((s) => ({
          ...s,
          status: "error",
          previewItems: [],
          error: `Aucun produit importé. Exemple d'erreur : ${failures[0]}`,
        }));
        return;
      }

      setState((s) => ({
        ...s,
        status: "done",
        previewItems: [],
        result: { added, updated, skipped: failures.length },
        error: null,
      }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      console.error("ImportContext confirmImport error:", e);
      setState((s) => ({ ...s, status: "error", progress: null, error: msg }));
    }
  }, []);

  const cancelImport = useCallback(() => {
    setState({
      status: "idle",
      progress: null,
      filename: null,
      previewItems: [],
      result: null,
      error: null,
    });
  }, []);

  const dismiss = useCallback(() => {
    setState({
      status: "idle",
      progress: null,
      filename: null,
      previewItems: [],
      result: null,
      error: null,
    });
  }, []);

  return (
    <ImportContext.Provider
      value={{ state, startImport, confirmImport, cancelImport, dismiss }}
    >
      {children}
    </ImportContext.Provider>
  );
}
