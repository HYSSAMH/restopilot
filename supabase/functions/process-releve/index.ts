// ============================================================
// RestoPilot — Edge Function : traitement asynchrone d'un
// relevé bancaire PDF. Déploiement :
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//   supabase functions deploy process-releve
//
// Invocation (fire-and-forget depuis la route Next.js) :
//   POST https://<project>.supabase.co/functions/v1/process-releve
//   Authorization: Bearer <SERVICE_ROLE_KEY>
//   Body: { "job_id": "uuid" }
//
// La fonction :
//   1. lit le job depuis import_jobs
//   2. télécharge le PDF depuis storage.releves
//   3. appelle Anthropic Claude en parallèle page par page
//   4. met à jour le job (status=done + result, ou status=error)
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

// @ts-ignore — EdgeRuntime est injecté par Supabase au runtime Deno
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

const MODEL_ID = "claude-sonnet-4-5";
const MAX_TOKENS_PER_PAGE = 2000;

// ── Prompt court ────────────────────────────────────────────────────

function pagePrompt(page: number, total: number): string {
  return `Extrais les lignes du tableau bancaire de la page ${page}/${total}. JSON uniquement, aucun texte. Format: [{"date":"JJ/MM/AAAA","libelle":"...","debit":0,"credit":0}]. Les montants sont toujours positifs (utilise debit OU credit). Ignore entêtes, pieds de page, totaux intermédiaires, numéros de page. Si la page ne contient pas de tableau bancaire (page de garde, conditions, etc.), retourne [].`;
}

// ── Types ───────────────────────────────────────────────────────────

type Categorie =
  | "remise_cb" | "commission_cb" | "prelevement" | "salaire" | "virement"
  | "paiement_cb" | "charges_sociales" | "prevoyance" | "cheque"
  | "frais_bancaires" | "autre";

interface ParsedLigne {
  date:            string | null;
  libelle:         string;
  montant_debit:   number;
  montant_credit:  number;
  solde_courant:   number | null;
  categorie:       Categorie;
}

// ── Helpers ─────────────────────────────────────────────────────────

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

function parseDateFr(s: string | null | undefined): string | null {
  if (!s) return null;
  const str = String(s).trim();
  const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const yyyy = y.length === 2 ? (Number(y) > 50 ? "19" + y : "20" + y) : y;
    return `${yyyy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const m2 = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m2 ? m2[0] : null;
}

function categorize(libelle: string): Categorie {
  const s = libelle.toUpperCase();
  if (/REMCB|REMISE\s*CB|REM\.\s*CB/.test(s))     return "remise_cb";
  if (/COMCB|COMMISSION\s*CB/.test(s))              return "commission_cb";
  if (/URSSAF/.test(s))                              return "charges_sociales";
  if (/KLESIA|AG2R|MALAKOFF|MUTUEL/.test(s))        return "prevoyance";
  if (/PRLV|PRELEVEMENT|PRELV/.test(s))              return "prelevement";
  if (/\bVIR\b.*(SAL|PAYE|PAYROLL|SALAIRE)/.test(s)) return "salaire";
  if (/\bVIR\b|VIREMENT/.test(s))                    return "virement";
  if (/PAIEMENT\s*CB|ACHAT\s*CB|\bCB\s*\*/.test(s)) return "paiement_cb";
  if (/CHEQUE|\bCHQ\b/.test(s))                      return "cheque";
  if (/FRAIS|COTIS\s*CARTE|AGIOS/.test(s))          return "frais_bancaires";
  return "autre";
}

function parsePageResponse(text: string): ParsedLigne[] {
  if (!text) return [];
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const raw = JSON.parse(match[0]);
    if (!Array.isArray(raw)) return [];
    return (raw as Record<string, unknown>[])
      .filter((l) => typeof l === "object" && l !== null)
      .map((l) => {
        const libelle = String(l.libelle ?? "").trim().replace(/\s+/g, " ");
        const debit   = num(l.debit  ?? l.montant_debit)  ?? 0;
        const credit  = num(l.credit ?? l.montant_credit) ?? 0;
        return {
          date:            parseDateFr(l.date as string | null),
          libelle,
          montant_debit:  debit,
          montant_credit: credit,
          solde_courant:  null,
          categorie:      categorize(libelle),
        } as ParsedLigne;
      })
      .filter((l) => l.libelle.length > 0 && (l.montant_debit > 0 || l.montant_credit > 0));
  } catch (e) {
    console.error("parse page JSON:", e);
    return [];
  }
}

function detectPageCount(pdfBytes: Uint8Array): number {
  try {
    // Décode comme binary latin-1 (pas UTF-8 pour éviter de corrompre les bytes)
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < pdfBytes.length; i += chunk) {
      binary += String.fromCharCode(...pdfBytes.subarray(i, i + chunk));
    }
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

// ── Appel Anthropic via fetch direct ────────────────────────────────

async function extractPage(
  pdfBase64: string,
  page: number,
  total: number,
  apiKey: string,
): Promise<{ page: number; lignes: ParsedLigne[]; ms: number; error?: string }> {
  const t0 = Date.now();
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":     "application/json",
        "x-api-key":        apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta":    "pdfs-2024-09-25",
      },
      body: JSON.stringify({
        model: MODEL_ID,
        max_tokens: MAX_TOKENS_PER_PAGE,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
            { type: "text", text: pagePrompt(page, total) },
          ],
        }],
      }),
    });
    const ms = Date.now() - t0;

    if (!res.ok) {
      const txt = await res.text();
      console.error(`[process-releve] page ${page}/${total} ❌ ${res.status} (${ms}ms) : ${txt.slice(0, 300)}`);
      return { page, lignes: [], ms, error: `HTTP ${res.status}: ${txt.slice(0, 200)}` };
    }

    const data = await res.json() as { content?: { type: string; text?: string }[] };
    const text = data.content?.[0]?.type === "text" ? (data.content[0].text ?? "") : "";
    const trimmed = text.trim();
    if (trimmed === "[]" || trimmed.length === 0) {
      console.log(`[process-releve] page ${page}/${total} — vide (${ms}ms)`);
      return { page, lignes: [], ms };
    }
    const lignes = parsePageResponse(text);
    console.log(`[process-releve] page ${page}/${total} — ${ms}ms → ${lignes.length} lignes`);
    return { page, lignes, ms };
  } catch (e) {
    const ms = Date.now() - t0;
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[process-releve] page ${page}/${total} ❌ ${ms}ms ${msg}`);
    return { page, lignes: [], ms, error: msg };
  }
}

// ── Traitement principal d'un job ───────────────────────────────────

async function processJob(jobId: string): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const apiKey      = Deno.env.get("ANTHROPIC_API_KEY");

  const supa = createClient(supabaseUrl, serviceKey);

  // 1. Charge le job
  const { data: job, error: errFetch } = await supa
    .from("import_jobs")
    .select("id, restaurateur_id, pdf_path, status")
    .eq("id", jobId)
    .maybeSingle();

  if (errFetch || !job) {
    console.error("[process-releve] job introuvable :", jobId, errFetch);
    return;
  }

  // 2. Marque processing
  await supa.from("import_jobs")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", jobId);

  try {
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY manquante dans les secrets Supabase");
    if (!job.pdf_path) throw new Error("pdf_path manquant sur le job");

    // 3. Télécharge le PDF
    const dl = await supa.storage.from("releves").download(job.pdf_path);
    if (dl.error || !dl.data) throw new Error("Téléchargement PDF échoué : " + (dl.error?.message ?? "data vide"));
    const pdfBytes = new Uint8Array(await dl.data.arrayBuffer());
    const pdfBase64 = encodeBase64(pdfBytes);
    const pageCount = Math.min(Math.max(1, detectPageCount(pdfBytes)), 30);
    console.log(`[process-releve] job=${jobId} — ${pageCount} pages, ${(pdfBytes.length / 1024).toFixed(0)} KB`);

    // 4. Extraction parallèle
    const t0 = Date.now();
    const results = await Promise.all(
      Array.from({ length: pageCount }, (_, i) => extractPage(pdfBase64, i + 1, pageCount, apiKey)),
    );
    const totalMs = Date.now() - t0;

    // 5. Agrège
    const allLignes = results.sort((a, b) => a.page - b.page).flatMap(r => r.lignes);
    const seen = new Set<string>();
    const deduped = allLignes.filter(l => {
      const k = `${l.date ?? ""}|${l.libelle}|${l.montant_debit}|${l.montant_credit}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const dates = deduped.map(l => l.date).filter((d): d is string => !!d).sort();
    const errors = results.filter(r => r.error).length;

    const result = {
      periode_debut: dates[0]      ?? null,
      periode_fin:   dates.at(-1)  ?? null,
      solde_debut:   null,
      solde_fin:     null,
      lignes:        deduped,
      diagnostic: {
        pages: pageCount,
        failed_pages: errors,
        duration_ms: totalMs,
        per_page_ms: results.map(r => ({ page: r.page, ms: r.ms, lines: r.lignes.length })),
      },
    };

    console.log(`[process-releve] ✅ job=${jobId} — ${totalMs}ms, ${deduped.length} lignes (${errors} erreurs)`);

    if (deduped.length === 0) {
      await supa.from("import_jobs").update({
        status: "error",
        error_message: errors > 0
          ? `Aucune ligne extraite (${errors} pages en erreur).`
          : "Aucune ligne bancaire détectée dans le PDF.",
        result,
        page_count: pageCount,
        finished_at: new Date().toISOString(),
      }).eq("id", jobId);
      return;
    }

    // 6. Sauvegarde succès
    await supa.from("import_jobs").update({
      status: "done",
      result,
      page_count: pageCount,
      finished_at: new Date().toISOString(),
    }).eq("id", jobId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[process-releve] ❌ job=" + jobId, msg);
    await supa.from("import_jobs").update({
      status: "error",
      error_message: msg,
      finished_at: new Date().toISOString(),
    }).eq("id", jobId);
  }
}

// ── Handler HTTP ────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }
  let jobId: string;
  try {
    const body = await req.json();
    jobId = String(body?.job_id ?? "");
    if (!jobId) throw new Error("job_id manquant");
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Body invalide : " + (e instanceof Error ? e.message : String(e)) }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Lance le traitement en arrière-plan : la réponse HTTP revient
  // immédiatement au caller ; la promesse continue à tourner sur Supabase.
  EdgeRuntime.waitUntil(processJob(jobId));

  return new Response(JSON.stringify({ ok: true, job_id: jobId }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
});
