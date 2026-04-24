"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface ParsedLigne {
  nom:            string;
  categorie:      string;
  quantite:       number;
  unite:          string;
  prix_unitaire:  number;
  total:          number;
  tva_taux?:      number | null;
}
interface TvaLigneRecap {
  taux:         number;
  base_ht:      number;
  montant_tva:  number;
  ttc:          number | null;
}
interface ParsedFacture {
  fournisseur: {
    nom:       string | null;
    siret:     string | null;
    adresse:   string | null;
    telephone: string | null;
    email:     string | null;
  };
  numero_facture: string | null;
  date:           string | null;
  lignes:         ParsedLigne[];
  tva_recap?:     TvaLigneRecap[];
  montant_ht:     number | null;
  tva:            number | null;
  montant_ttc:    number | null;
}

type Step = "pick" | "parsing" | "review" | "saving";

interface Props {
  onClose:  () => void;
  onSaved:  () => void;
}

function readBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res((r.result as string).split(",")[1]);
    r.onerror = () => rej(new Error("Lecture fichier échouée"));
    r.readAsDataURL(file);
  });
}

/**
 * OCR d'un PDF scanné côté client.
 * Rend chaque page en canvas via pdfjs-dist puis passe à tesseract.js.
 * Cette approche évite tout timeout serverless côté Netlify.
 */
async function ocrPdfClient(file: File, onProgress: (s: string) => void): Promise<string> {
  // Imports dynamiques pour éviter SSR + alléger le bundle initial
  const [{ getDocument, GlobalWorkerOptions }, tesseract] = await Promise.all([
    import("pdfjs-dist"),
    import("tesseract.js"),
  ]);
  // Worker pdfjs servi depuis un CDN (évite la config webpack)
  // Version alignée avec la dépendance dans package.json.
  const pdfjsVersion = "5.6.205";
  GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;

  const worker = await tesseract.createWorker("fra");
  let fullText = "";
  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      onProgress(`OCR page ${p}/${pdf.numPages}…`);
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas non supporté");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      const { data } = await worker.recognize(canvas);
      fullText += "\n" + data.text;
    }
  } finally {
    await worker.terminate();
  }
  return fullText;
}

/**
 * OCR d'une image (JPG/PNG/WebP) directement.
 */
async function ocrImageClient(file: File, onProgress: (s: string) => void): Promise<string> {
  const tesseract = await import("tesseract.js");
  onProgress("OCR de l'image…");
  const worker = await tesseract.createWorker("fra");
  try {
    const { data } = await worker.recognize(file);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#1A1A2E] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";

export default function FactureImportModal({ onClose, onSaved }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("pick");
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [progress, setProgress] = useState<string>("");
  const [facture, setFacture] = useState<ParsedFacture | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileMediaType, setFileMediaType] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const valid = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!valid.includes(file.type)) { setError("Format non supporté (PDF, JPG, PNG, WebP)."); return; }
    if (file.size > 20 * 1024 * 1024) { setError("Fichier trop lourd (max 20 Mo)."); return; }

    setError(null);
    setFilename(file.name);
    setStep("parsing");
    setProgress("Extraction du texte…");

    try {
      const b64 = await readBase64(file);
      const mt = file.type === "image/jpg" ? "image/jpeg" : file.type;
      setFileBase64(b64);
      setFileMediaType(mt);

      let parsed: ParsedFacture | null = null;

      if (mt === "application/pdf") {
        // Étape 1 — tentative serveur (texte natif) via unpdf
        const res = await fetch("/api/facture-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileBase64: b64, mediaType: mt }),
        });
        const j = await res.json().catch(() => ({}));

        if (res.ok && (j as { needsOcr?: boolean }).needsOcr !== true) {
          parsed = (j as { facture: ParsedFacture }).facture;
        } else if (j?.needsOcr === true) {
          // Étape 2 — PDF scanné : OCR client puis parsing serveur
          setProgress("PDF scanné détecté. OCR en cours dans votre navigateur…");
          const rawText = await ocrPdfClient(file, setProgress);
          parsed = await parseRawTextOnServer(rawText);
        } else {
          throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
        }
      } else {
        // Image directe : OCR client sans passer par /api/facture-import
        setProgress("OCR en cours dans votre navigateur…");
        const rawText = await ocrImageClient(file, setProgress);
        parsed = await parseRawTextOnServer(rawText);
      }

      if (!parsed) throw new Error("Aucune facture extraite.");
      setFacture(parsed);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setStep("pick");
    } finally {
      setProgress("");
    }
  }

  async function parseRawTextOnServer(rawText: string): Promise<ParsedFacture> {
    const res = await fetch("/api/facture-parse-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
    return (j as { facture: ParsedFacture }).facture;
  }

  function updateFournisseur<K extends keyof ParsedFacture["fournisseur"]>(key: K, value: ParsedFacture["fournisseur"][K]) {
    setFacture(f => f ? { ...f, fournisseur: { ...f.fournisseur, [key]: value } } : f);
  }
  function updateLigne(idx: number, key: keyof ParsedLigne, value: string | number) {
    setFacture(f => {
      if (!f) return f;
      const lignes = [...f.lignes];
      const cur = { ...lignes[idx] };
      if (key === "quantite" || key === "prix_unitaire" || key === "total") {
        const n = typeof value === "string" ? parseFloat(value) : value;
        cur[key] = isNaN(n) ? 0 : n;
      } else {
        (cur as Record<string, string | number>)[key as string] = value;
      }
      // Auto-calcule total si qte+pu changent
      if (key === "quantite" || key === "prix_unitaire") {
        cur.total = Math.round(cur.quantite * cur.prix_unitaire * 100) / 100;
      }
      lignes[idx] = cur;
      return { ...f, lignes };
    });
  }
  function deleteLigne(idx: number) {
    setFacture(f => f ? { ...f, lignes: f.lignes.filter((_, i) => i !== idx) } : f);
  }

  async function handleSave() {
    if (!facture) return;
    if (!facture.fournisseur.nom) { setError("Nom du fournisseur requis."); return; }
    if (facture.lignes.length === 0) { setError("Au moins une ligne requise."); return; }

    setStep("saving"); setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée");

      // 1. Chercher si ce fournisseur existe déjà (sur profiles inscrits ou
      //    dans fournisseurs_externes du restaurateur)
      let fournisseurId: string | null = null;
      let fournisseurExterneId: string | null = null;

      const nomLower = facture.fournisseur.nom!.toLowerCase().trim();

      // Check profiles fournisseurs avec nom similaire
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nom_commercial, nom_etablissement, siret")
        .eq("role", "fournisseur");
      const match = (profs ?? []).find(p =>
        (p.nom_commercial?.toLowerCase().trim() === nomLower)
        || (p.nom_etablissement?.toLowerCase().trim() === nomLower)
        || (facture.fournisseur.siret && p.siret === facture.fournisseur.siret)
      );
      if (match) {
        fournisseurId = match.id;
      } else {
        // Check fournisseurs_externes déjà créés
        const { data: existants } = await supabase
          .from("fournisseurs_externes")
          .select("id, nom, siret")
          .eq("restaurateur_id", user.id);
        const mExt = (existants ?? []).find(e =>
          e.nom.toLowerCase().trim() === nomLower
          || (facture.fournisseur.siret && e.siret === facture.fournisseur.siret)
        );
        if (mExt) {
          fournisseurExterneId = mExt.id;
          // Mettre à jour au besoin
          await supabase.from("fournisseurs_externes").update({
            email:     facture.fournisseur.email     ?? undefined,
            telephone: facture.fournisseur.telephone ?? undefined,
            adresse:   facture.fournisseur.adresse   ?? undefined,
            siret:     facture.fournisseur.siret     ?? undefined,
          }).eq("id", mExt.id);
        } else {
          // Créer nouveau fournisseur externe
          const { data: newExt, error: errExt } = await supabase
            .from("fournisseurs_externes")
            .insert({
              restaurateur_id: user.id,
              nom:             facture.fournisseur.nom,
              email:           facture.fournisseur.email,
              telephone:       facture.fournisseur.telephone,
              adresse:         facture.fournisseur.adresse,
              siret:           facture.fournisseur.siret,
            })
            .select("id").single();
          if (errExt || !newExt) throw new Error("Création fournisseur externe échouée : " + (errExt?.message ?? ""));
          fournisseurExterneId = newExt.id;
        }
      }

      // 2. Créer la commande
      const montant = facture.montant_ht ?? facture.lignes.reduce((s, l) => s + l.total, 0);
      const createdAt = facture.date ? new Date(facture.date).toISOString() : new Date().toISOString();

      const { data: cmd, error: errCmd } = await supabase.from("commandes").insert({
        restaurateur_id:         user.id,
        fournisseur_id:          fournisseurId,
        fournisseur_externe_id:  fournisseurExterneId,
        restaurateur_nom:        "",
        montant_total:           Math.round(montant * 100) / 100,
        statut:                  "livree",
        source:                  "import",
        numero_facture_externe:  facture.numero_facture,
        created_at:              createdAt,
        tva_recap:               facture.tva_recap ?? [],
      }).select("id").single();
      if (errCmd || !cmd) throw new Error("Création commande échouée : " + (errCmd?.message ?? ""));

      // 2.b Upload du PDF/image original dans le bucket factures-externes
      // pour consultation / téléchargement ultérieur.
      if (fileBase64 && fileMediaType) {
        try {
          const binary = Uint8Array.from(atob(fileBase64), ch => ch.charCodeAt(0));
          const ext = fileMediaType === "application/pdf" ? "pdf"
                    : fileMediaType === "image/png"       ? "png"
                    : fileMediaType === "image/webp"      ? "webp"
                    : "jpg";
          const path = `${user.id}/${cmd.id}.${ext}`;
          const { error: errUp } = await supabase.storage.from("factures-externes")
            .upload(path, binary, { contentType: fileMediaType, upsert: true });
          if (errUp) {
            console.warn("[facture-import] upload storage failed:", errUp);
          } else {
            await supabase.from("commandes").update({ pdf_path: path }).eq("id", cmd.id);
          }
        } catch (upErr) {
          console.warn("[facture-import] upload exception:", upErr);
        }
      }

      // 3. Lignes — on persiste aussi le taux TVA capté ligne par ligne
      const { error: errLignes } = await supabase.from("lignes_commande").insert(
        facture.lignes.map(l => ({
          commande_id:   cmd.id,
          produit_id:    null,
          nom_snapshot:  l.nom,
          prix_snapshot: l.prix_unitaire,
          unite:         l.unite,
          quantite:      l.quantite,
          tva_taux:      l.tva_taux ?? null,
        })),
      );
      if (errLignes) throw new Error("Ajout lignes échoué : " + errLignes.message);

      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setStep("review");
    }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-[#1A1A2E]">Importer une facture</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {step === "pick"    && "Choisissez un PDF ou une photo de votre facture fournisseur."}
              {step === "parsing" && (progress || "Analyse de la facture…")}
              {step === "review"  && "Vérifiez les infos extraites avant enregistrement."}
              {step === "saving"  && "Enregistrement en cours…"}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={step === "parsing" || step === "saving"}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-xl text-gray-400 hover:bg-gray-100 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* ── Étape : pick ──────────────────────── */}
          {step === "pick" && (
            <div>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 py-16 transition-colors hover:border-indigo-400 hover:bg-indigo-50"
              >
                <svg className="h-10 w-10 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4m-8 12h8a2 2 0 002-2v-3" />
                </svg>
                <p className="text-sm font-medium text-[#1A1A2E]">Cliquez pour choisir</p>
                <p className="text-xs text-gray-500">PDF, JPG, PNG · 20 Mo max</p>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={handleFile}
              />
              {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
            </div>
          )}

          {/* ── Étape : parsing ───────────────────── */}
          {step === "parsing" && (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <svg className="h-10 w-10 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <p className="text-sm text-gray-700">{progress || "Analyse en cours…"}</p>
              <p className="text-xs text-gray-500">{filename}</p>
            </div>
          )}

          {/* ── Étape : review ────────────────────── */}
          {step === "review" && facture && (
            <div className="flex flex-col gap-5">
              {/* Fournisseur */}
              <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-[#1A1A2E]">Fournisseur</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">Nom *</span>
                    <input className={inputCls} value={facture.fournisseur.nom ?? ""} onChange={e => updateFournisseur("nom", e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">SIRET</span>
                    <input className={inputCls} value={facture.fournisseur.siret ?? ""} onChange={e => updateFournisseur("siret", e.target.value)} />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-medium text-gray-600">Adresse</span>
                    <input className={inputCls} value={facture.fournisseur.adresse ?? ""} onChange={e => updateFournisseur("adresse", e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">Téléphone</span>
                    <input className={inputCls} value={facture.fournisseur.telephone ?? ""} onChange={e => updateFournisseur("telephone", e.target.value)} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">Email</span>
                    <input className={inputCls} type="email" value={facture.fournisseur.email ?? ""} onChange={e => updateFournisseur("email", e.target.value)} />
                  </label>
                </div>
              </section>

              {/* Entête facture */}
              <section className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <h3 className="mb-3 text-sm font-semibold text-[#1A1A2E]">Facture</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">N° facture</span>
                    <input className={inputCls} value={facture.numero_facture ?? ""} onChange={e => setFacture(f => f ? { ...f, numero_facture: e.target.value } : f)} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">Date</span>
                    <input type="date" className={inputCls} value={facture.date ?? ""} onChange={e => setFacture(f => f ? { ...f, date: e.target.value } : f)} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">Montant TTC</span>
                    <input type="number" step="0.01" className={inputCls} value={facture.montant_ttc ?? ""} onChange={e => setFacture(f => f ? { ...f, montant_ttc: parseFloat(e.target.value) } : f)} />
                  </label>
                </div>
              </section>

              {/* Lignes */}
              <section className="rounded-2xl border border-gray-200 bg-white p-4">
                <h3 className="mb-3 text-sm font-semibold text-[#1A1A2E]">Lignes ({facture.lignes.length})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-500">
                        <th className="py-2 text-left">Produit</th>
                        <th className="py-2 text-right">Qté</th>
                        <th className="py-2 text-left">Unité</th>
                        <th className="py-2 text-right">PU HT (€)</th>
                        <th className="py-2 text-right">TVA %</th>
                        <th className="py-2 text-right">Total HT (€)</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {facture.lignes.map((l, i) => (
                        <tr key={i}>
                          <td className="py-2 pr-2">
                            <input className={inputCls} value={l.nom} onChange={e => updateLigne(i, "nom", e.target.value)} />
                          </td>
                          <td className="py-2 pr-2 text-right">
                            <input type="number" step="0.01" className={inputCls + " w-20 text-right"} value={l.quantite} onChange={e => updateLigne(i, "quantite", e.target.value)} />
                          </td>
                          <td className="py-2 pr-2">
                            <input className={inputCls + " w-24"} value={l.unite} onChange={e => updateLigne(i, "unite", e.target.value)} />
                          </td>
                          <td className="py-2 pr-2 text-right">
                            <input type="number" step="0.01" className={inputCls + " w-24 text-right"} value={l.prix_unitaire} onChange={e => updateLigne(i, "prix_unitaire", e.target.value)} />
                          </td>
                          <td className="py-2 pr-2 text-right">
                            <select
                              className={inputCls + " w-20 text-right"}
                              value={l.tva_taux != null ? String(l.tva_taux) : ""}
                              onChange={e => {
                                const v = e.target.value;
                                setFacture(f => {
                                  if (!f) return f;
                                  const lignes = f.lignes.map((ll, idx) => idx === i ? { ...ll, tva_taux: v ? parseFloat(v) : null } : ll);
                                  return { ...f, lignes };
                                });
                              }}
                            >
                              <option value="">—</option>
                              <option value="5.5">5,5</option>
                              <option value="10">10</option>
                              <option value="20">20</option>
                            </select>
                          </td>
                          <td className="py-2 pr-2 text-right font-semibold text-[#1A1A2E]">{l.total.toFixed(2)}</td>
                          <td className="py-2 text-right">
                            <button onClick={() => deleteLigne(i)} className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Récapitulatif TVA extrait */}
                {facture.tva_recap && facture.tva_recap.length > 0 && (
                  <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-indigo-700">Récapitulatif TVA</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500">
                          <th className="py-1 text-left">Taux</th>
                          <th className="py-1 text-right">Base HT</th>
                          <th className="py-1 text-right">Montant TVA</th>
                          <th className="py-1 text-right">TTC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {facture.tva_recap.map((t, i) => (
                          <tr key={i} className="border-t border-indigo-100">
                            <td className="py-1 text-left text-[#1A1A2E]">{t.taux}%</td>
                            <td className="py-1 text-right">{t.base_ht.toFixed(2)} €</td>
                            <td className="py-1 text-right">{t.montant_tva.toFixed(2)} €</td>
                            <td className="py-1 text-right font-semibold text-[#1A1A2E]">{(t.ttc ?? (t.base_ht + t.montant_tva)).toFixed(2)} €</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
            </div>
          )}

          {step === "saving" && (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <svg className="h-10 w-10 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <p className="text-sm text-gray-700">Enregistrement…</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === "review" && (
          <div className="flex justify-end gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
            <button
              onClick={() => { setFacture(null); setStep("pick"); setError(null); }}
              className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-gray-100"
            >
              Recommencer
            </button>
            <button
              onClick={handleSave}
              className="min-h-[44px] rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-indigo-600"
            >
              Valider &amp; enregistrer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
