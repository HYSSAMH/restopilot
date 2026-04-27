"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ParsedFacture, ParsedLigne } from "@/lib/parse-facture";

const DEBUG_FACTURE = process.env.NEXT_PUBLIC_DEBUG_FACTURE === "1";

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

const PDFJS_VERSION = "5.6.205";

/**
 * Charge pdfjs-dist en client et configure le worker CDN.
 * Singleton pour éviter de recharger à chaque appel.
 */
let _pdfjsLoaded: typeof import("pdfjs-dist") | null = null;
async function loadPdfjs() {
  if (_pdfjsLoaded) return _pdfjsLoaded;
  const mod = await import("pdfjs-dist");
  mod.GlobalWorkerOptions.workerSrc =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
  _pdfjsLoaded = mod;
  return mod;
}

/**
 * Extraction texte native d'un PDF côté client.
 *
 * Point clé : pdfjs-dist.getTextContent() ne garde pas les sauts de
 * ligne. Les items sont retournés dans un ordre lu mais sans \n. Pour
 * que les regex de parse-facture.ts (qui cherchent des patterns
 * ligne-par-ligne) fonctionnent, on reconstruit les lignes en
 * groupant les items par coordonnée Y (même Y ≈ même ligne dans
 * l'espace PDF).
 */
async function extractPdfTextClient(file: File): Promise<{ text: string; numPages: number }> {
  const { getDocument } = await loadPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;

  let text = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    type PdfItem = { str: string; transform: number[]; hasEOL?: boolean; width?: number };
    const items = content.items as PdfItem[];

    // Reconstruction des lignes par coordonnée Y (arrondie à 1px).
    // transform = [scaleX, skewY, skewX, scaleY, x, y] — on prend y.
    // Tolérance de 2px pour absorber les petits écarts de baseline.
    const lineMap = new Map<number, { y: number; items: { x: number; str: string }[] }>();
    for (const it of items) {
      const str = it.str ?? "";
      if (!str) continue;
      const x = it.transform[4];
      const y = it.transform[5];
      // Clé = y arrondi à l'entier le plus proche, avec regroupement à ±2px
      let groupKey: number | null = null;
      for (const key of lineMap.keys()) {
        if (Math.abs(key - y) <= 2) { groupKey = key; break; }
      }
      if (groupKey === null) {
        groupKey = Math.round(y);
        lineMap.set(groupKey, { y, items: [] });
      }
      lineMap.get(groupKey)!.items.push({ x, str });
    }

    // Tri des lignes par Y décroissant (PDF : origine en bas-gauche,
    // donc Y grand = haut de page) ; items dans une ligne par X croissant
    const sortedLines = Array.from(lineMap.values()).sort((a, b) => b.y - a.y);
    for (const line of sortedLines) {
      line.items.sort((a, b) => a.x - b.x);
      const lineText = line.items
        .map((it, idx, arr) => {
          // Ajoute un espace si l'item précédent ne se termine pas par un
          // espace et qu'il y a un gap d'au moins ~2px en X.
          const prev = idx > 0 ? arr[idx - 1] : null;
          const needsSpace = prev && !prev.str.endsWith(" ") && !it.str.startsWith(" ");
          return (needsSpace ? " " : "") + it.str;
        })
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      if (lineText) text += lineText + "\n";
    }
    text += "\n"; // séparateur de page
  }

  return { text: text.trim(), numPages: pdf.numPages };
}

/**
 * OCR d'un PDF scanné côté client.
 * Rend chaque page en canvas via pdfjs-dist puis passe à tesseract.js.
 */
async function ocrPdfClient(
  file: File,
  onProgress: (s: string, pct?: number) => void,
  signal?: { cancelled: boolean },
): Promise<string> {
  const [{ getDocument }, tesseract] = await Promise.all([
    loadPdfjs(),
    import("tesseract.js"),
  ]);

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;

  const worker = await tesseract.createWorker("fra");
  let fullText = "";
  try {
    for (let p = 1; p <= pdf.numPages; p++) {
      if (signal?.cancelled) throw new Error("Annulé");
      const pct = Math.round(((p - 1) / pdf.numPages) * 100);
      onProgress(`OCR page ${p}/${pdf.numPages}…`, pct);
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
    onProgress("OCR terminé", 100);
  } finally {
    await worker.terminate();
  }
  return fullText;
}

/**
 * OCR d'une image (JPG/PNG/WebP) directement.
 */
async function ocrImageClient(
  file: File,
  onProgress: (s: string, pct?: number) => void,
): Promise<string> {
  const tesseract = await import("tesseract.js");
  onProgress("OCR de l'image…", 0);
  const worker = await tesseract.createWorker("fra");
  try {
    const { data } = await worker.recognize(file);
    onProgress("OCR terminé", 100);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

const inputCls = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-[#1A1A2E] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";

export default function FactureImportModal({ onClose, onSaved }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  const [step, setStep] = useState<Step>("pick");
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState("");
  const [progress, setProgress] = useState<string>("");
  const [progressPct, setProgressPct] = useState<number>(0);
  const [facture, setFacture] = useState<ParsedFacture | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [fileMediaType, setFileMediaType] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // File d'attente multi-factures : tableau de fichiers en attente
  // après le fichier en cours. Quand l'utilisateur dépose N fichiers,
  // on traite le 1er normalement et on stocke les autres ici. Après
  // chaque save (ou skip), on dépile.
  const [queue, setQueue] = useState<File[]>([]);
  // factures déjà parsées en attente de review (cas où un même PDF
  // contient plusieurs factures, ex: relevé Verger avec 17 factures).
  const [parsedQueue, setParsedQueue] = useState<ParsedFacture[]>([]);
  const [queueIndex, setQueueIndex] = useState(0); // 1-based pour affichage
  const [queueTotal, setQueueTotal] = useState(0);

  function reportProgress(s: string, pct?: number) {
    setProgress(s);
    if (typeof pct === "number") setProgressPct(pct);
  }

  async function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    await startBatch(files);
  }

  /**
   * Démarre le traitement d'un lot de N fichiers : on traite le
   * premier et on stocke les autres dans la file d'attente.
   */
  async function startBatch(files: File[]) {
    if (files.length === 0) return;
    const [first, ...rest] = files;
    setQueue(rest);
    setQueueIndex(1);
    setQueueTotal(files.length);
    await processFile(first);
  }

  /**
   * Passe à la facture suivante. On consomme d'abord parsedQueue
   * (cas N factures dans 1 PDF), puis queue de Files (cas N PDFs).
   * Si tout est vide → reset à pick.
   */
  async function advanceQueue() {
    setError(null);

    // 1) Reste-t-il une facture déjà parsée à reviewer ?
    if (parsedQueue.length > 0) {
      const [next, ...rest] = parsedQueue;
      setParsedQueue(rest);
      setFacture(next);
      setQueueIndex(i => i + 1);
      setStep("review");
      // garder fileBase64/fileMediaType car c'est le même PDF source
      return;
    }

    // 2) Sinon, fichier suivant dans la queue ?
    setFacture(null);
    setFileBase64(null);
    setFileMediaType(null);
    if (queue.length === 0) {
      setQueueIndex(0);
      setQueueTotal(0);
      setStep("pick");
      return;
    }
    const [next, ...restFiles] = queue;
    setQueue(restFiles);
    setQueueIndex(i => i + 1);
    await processFile(next);
  }

  async function processFile(file: File) {
    const valid = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!valid.includes(file.type)) { setError("Format non supporté (PDF, JPG, PNG, WebP)."); return; }
    if (file.size > 20 * 1024 * 1024) { setError("Fichier trop lourd (max 20 Mo)."); return; }

    setError(null);
    setFilename(file.name);
    setStep("parsing");
    setProgress("Extraction du texte…");
    setProgressPct(0);
    cancelRef.current = { cancelled: false };

    try {
      const b64 = await readBase64(file);
      const mt = file.type === "image/jpg" ? "image/jpeg" : file.type;
      setFileBase64(b64);
      setFileMediaType(mt);

      let rawText = "";

      if (mt === "application/pdf") {
        // Étape 1 — extraction texte native côté client (pdfjs-dist)
        // Rapide (< 2s pour un PDF texte classique), aucun appel serveur
        // pour la partie PDF → zéro risque de 502/timeout.
        setProgress("Extraction du texte…");
        const { text, numPages } = await extractPdfTextClient(file);
        if (DEBUG_FACTURE) {
          console.log(`[facture] pdf texte natif : ${numPages}p, ${text.length} chars`);
          console.log(`[facture] aperçu (500 premiers chars) :\n` + text.slice(0, 500));
        }

        if (text.length >= 50) {
          rawText = text;
        } else {
          // PDF scanné : OCR côté client
          setProgress("PDF scanné détecté. OCR en cours dans votre navigateur…");
          rawText = await ocrPdfClient(file, reportProgress, cancelRef.current);
          if (DEBUG_FACTURE) {
            console.log(`[facture] ocr : ${rawText.length} chars`);
            console.log(`[facture] aperçu ocr :\n` + rawText.slice(0, 500));
          }
        }
      } else {
        // Image directe : OCR client
        setProgress("OCR en cours dans votre navigateur…");
        rawText = await ocrImageClient(file, reportProgress);
      }

      // Parsing serveur : texte → ParsedFacture (léger, rapide, pas de PDF)
      setProgress("Analyse des données extraites…");
      const { first, rest } = await parseRawTextOnServer(rawText);

      if (!first) throw new Error("Aucune facture extraite.");

      // Si le PDF contenait plusieurs factures distinctes (Verger…),
      // on en met une en review et on stocke les autres.
      if (rest.length > 0) {
        setParsedQueue(p => [...p, ...rest]);
        // Met à jour le compteur du batch pour refléter le total réel
        setQueueTotal(t => t + rest.length);
      }

      setFacture(first);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
      setStep("pick");
    } finally {
      setProgress("");
    }
  }

  async function parseRawTextOnServer(rawText: string): Promise<{ first: ParsedFacture; rest: ParsedFacture[] }> {
    const res = await fetch("/api/facture-parse-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText }),
    });
    const j = await res.json().catch(() => ({}));

    if (res.ok) {
      // Le serveur renvoie soit `facture` (singulier) si une seule, soit
      // aussi `factures` (pluriel) si plusieurs ont été détectées dans
      // le même texte (cas relevé Verger : 17 factures dans un PDF).
      const data = j as { facture: ParsedFacture; factures?: ParsedFacture[] };
      const all = data.factures && data.factures.length > 0 ? data.factures : [data.facture];
      const [first, ...rest] = all;
      return { first, rest };
    }

    // 422 : aucune ligne reconnue. On rend un squelette vide avec le
    // texte extrait dans le champ 'adresse' pour que l'utilisateur
    // puisse voir ce qui a été lu et compléter/corriger.
    if (res.status === 422) {
      const sample = (j as { diagnostic?: { raw_sample?: string } }).diagnostic?.raw_sample
        ?? rawText.slice(0, 1000);
      if (DEBUG_FACTURE) console.warn("[facture] parsing échoué :\n" + rawText);
      setError(
        "Extraction automatique impossible pour ce format. Complétez manuellement — " +
        "un aperçu du texte lu est copié dans le champ 'Adresse'.",
      );
      const skeleton: ParsedFacture = {
        fournisseur: {
          nom: null, siret: null, adresse: sample, telephone: null, email: null, tva_intra: null,
        },
        numero_facture: null,
        date: null,
        date_echeance: null,
        lignes: [],
        tva_recap: [],
        montant_ht: null,
        tva: null,
        montant_ttc: null,
      };
      return { first: skeleton, rest: [] };
    }

    throw new Error((j as { error?: string }).error ?? `HTTP ${res.status}`);
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
  function addLigne() {
    setFacture(f => {
      if (!f) return f;
      const newLine: ParsedLigne = {
        nom: "",
        categorie: "epicerie",
        quantite: 1,
        unite: "u",
        prix_unitaire: 0,
        total: 0,
        tva_taux: f.tva_recap.length === 1 ? f.tva_recap[0].taux : null,
      };
      return { ...f, lignes: [...f.lignes, newLine] };
    });
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

      // ── Détection de doublon ─────────────────────────────
      if (facture.numero_facture) {
        const { data: existingFacts } = await supabase
          .from("commandes")
          .select("id, created_at, montant_total")
          .eq("restaurateur_id", user.id)
          .eq("numero_facture_externe", facture.numero_facture)
          .limit(1);
        if (existingFacts && existingFacts.length > 0) {
          const ok = window.confirm(
            `Une facture portant le numéro ${facture.numero_facture} existe déjà ` +
            `(import du ${new Date(existingFacts[0].created_at).toLocaleDateString("fr-FR")}, ` +
            `${Number(existingFacts[0].montant_total).toFixed(2)} €).\n\n` +
            `Continuer et créer un doublon ?`,
          );
          if (!ok) { setStep("review"); return; }
        }
      }

      // Récupère le nom du restaurateur depuis son profil (évite un 400
      // sur commandes.restaurateur_nom qui est NOT NULL côté DB).
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("nom_commercial, nom_etablissement, prenom, nom")
        .eq("id", user.id)
        .maybeSingle();
      const restaurateurNom =
        myProfile?.nom_commercial?.trim()
        || myProfile?.nom_etablissement?.trim()
        || [myProfile?.prenom, myProfile?.nom].filter(Boolean).join(" ").trim()
        || user.email
        || "Mon restaurant";

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

      // Insert commande — avec tentative "rich" (tva_recap) puis
      // fallback "sans tva_recap" si la migration DB n'a pas été
      // exécutée (PGRST204 "column not found").
      const basePayload = {
        restaurateur_id:         user.id,
        fournisseur_id:          fournisseurId,
        fournisseur_externe_id:  fournisseurExterneId,
        restaurateur_nom:        restaurateurNom,
        montant_total:           Math.round(montant * 100) / 100,
        statut:                  "livree",
        source:                  "import",
        numero_facture_externe:  facture.numero_facture,
        created_at:              createdAt,
      } as Record<string, unknown>;

      type SupaErr = { message: string; code?: string } | null;
      let cmd: { id: string } | null = null;
      let errCmd: SupaErr = null;
      {
        const res = await supabase.from("commandes")
          .insert({ ...basePayload, tva_recap: facture.tva_recap ?? [] })
          .select("id").single();
        cmd = (res.data ?? null) as { id: string } | null;
        errCmd = (res.error ?? null) as SupaErr;
      }
      // PGRST204 ou message "column ... does not exist" : retry sans tva_recap
      let migrationManquante = false;
      if (errCmd && (errCmd.code === "PGRST204" || /column .* does not exist/i.test(errCmd.message))) {
        migrationManquante = true;
        if (DEBUG_FACTURE) console.warn("[facture-import] tva_recap absent côté DB. Exécuter migration_tva_par_ligne.sql.");
        const res = await supabase.from("commandes")
          .insert(basePayload)
          .select("id").single();
        cmd = (res.data ?? null) as { id: string } | null;
        errCmd = (res.error ?? null) as SupaErr;
      }
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

      // 3. Mapping produit_id par fuzzy-match sur le nom (utile pour
      // les statistiques de prix moyen, mercuriale, alertes).
      const produitNoms = Array.from(new Set(facture.lignes.map(l => l.nom.toLowerCase().trim()))).filter(Boolean);
      const produitIdByNom = new Map<string, string>();
      if (produitNoms.length > 0) {
        const { data: produitsHits } = await supabase
          .from("produits")
          .select("id, nom")
          .eq("actif", true);
        const known = (produitsHits ?? []).map(p => ({ id: p.id, nomLower: p.nom.toLowerCase().trim() }));
        for (const ligneNom of produitNoms) {
          let hit = known.find(p => p.nomLower === ligneNom);
          if (!hit && ligneNom.length >= 6) {
            const prefix = ligneNom.slice(0, Math.min(ligneNom.length, 12));
            hit = known.find(p => p.nomLower.startsWith(prefix) || ligneNom.startsWith(p.nomLower.slice(0, Math.min(p.nomLower.length, 12))));
          }
          if (hit) produitIdByNom.set(ligneNom, hit.id);
        }
      }

      // 4. Lignes — tentative avec tva_taux, fallback sans, et rollback
      // de la commande si l'insert lignes échoue.
      const baseLignes = facture.lignes.map(l => ({
        commande_id:   cmd.id,
        produit_id:    produitIdByNom.get(l.nom.toLowerCase().trim()) ?? null,
        nom_snapshot:  l.nom,
        prix_snapshot: l.prix_unitaire,
        unite:         l.unite,
        quantite:      l.quantite,
      }));
      type SupaErrL = { message: string; code?: string } | null;
      let errLignes: SupaErrL = null;
      {
        const res = await supabase.from("lignes_commande").insert(
          baseLignes.map((b, i) => ({ ...b, tva_taux: facture.lignes[i].tva_taux ?? null })),
        );
        errLignes = (res.error ?? null) as SupaErrL;
      }
      if (errLignes && (errLignes.code === "PGRST204" || /column .* does not exist/i.test(errLignes.message))) {
        migrationManquante = true;
        if (DEBUG_FACTURE) console.warn("[facture-import] tva_taux absent côté DB, retry sans.");
        const res = await supabase.from("lignes_commande").insert(baseLignes);
        errLignes = (res.error ?? null) as SupaErrL;
      }
      if (errLignes) {
        // Rollback : supprime la commande créée pour ne pas laisser
        // d'enregistrement orphelin sans lignes.
        await supabase.from("commandes").delete().eq("id", cmd.id);
        throw new Error("Ajout lignes échoué (commande annulée) : " + errLignes.message);
      }

      // Alerte UI non bloquante si migration partielle
      if (migrationManquante) {
        try {
          const { pushToast } = await import("@/components/ui/Feedback");
          pushToast(
            "Migration DB partielle — exécuter migration_tva_par_ligne.sql pour conserver le récap TVA.",
            { tone: "warning" },
          );
        } catch { /* noop */ }
      }

      // Toast de confirmation pour chaque facture sauvegardée du batch
      if (queueTotal > 1) {
        try {
          const { pushToast } = await import("@/components/ui/Feedback");
          pushToast(
            `Facture ${queueIndex}/${queueTotal} enregistrée${queue.length > 0 ? " — passage à la suivante…" : ""}.`,
            { tone: "success" },
          );
        } catch { /* noop */ }
      }

      // Notifie le parent pour qu'il rafraîchisse sa liste — sans
      // fermer la modal (la modal gère sa propre fermeture pour
      // supporter le mode batch).
      onSaved();

      if (queue.length > 0) {
        // Encore des fichiers en file d'attente : on enchaîne
        await advanceQueue();
      } else {
        // Dernière facture du lot (ou import unique) : fermeture
        onClose();
      }
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
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#1A1A2E]">Importer une facture</h2>
              {queueTotal > 1 && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                  {queueIndex} / {queueTotal}
                </span>
              )}
            </div>
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
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                  const files = Array.from(e.dataTransfer.files ?? []);
                  if (files.length > 0) startBatch(files);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
                className={
                  "flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed py-16 transition-colors cursor-pointer " +
                  (isDragging
                    ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                    : "border-gray-300 bg-gray-50 hover:border-indigo-400 hover:bg-indigo-50")
                }
              >
                <svg className={"h-10 w-10 transition-colors " + (isDragging ? "text-indigo-500" : "text-gray-400")} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4m-8 12h8a2 2 0 002-2v-3" />
                </svg>
                <p className="text-sm font-medium text-[#1A1A2E]">
                  {isDragging ? "Relâchez pour importer" : "Glissez-déposez ou cliquez pour choisir"}
                </p>
                <p className="text-xs text-gray-500">PDF, JPG, PNG, WebP · 20 Mo max · multiples acceptés</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleInputChange}
              />
              {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}
            </div>
          )}

          {/* ── Étape : parsing ───────────────────── */}
          {step === "parsing" && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <svg className="h-10 w-10 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <p className="text-sm text-gray-700">{progress || "Analyse en cours…"}</p>
              <p className="text-xs text-gray-500">{filename}</p>
              {progressPct > 0 && (
                <div className="w-64 h-2 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
                  />
                </div>
              )}
              <button
                onClick={() => {
                  cancelRef.current.cancelled = true;
                  setError("Annulation demandée…");
                }}
                className="mt-2 text-xs text-gray-500 underline hover:text-gray-700"
              >
                Annuler
              </button>
            </div>
          )}

          {/* ── Étape : review ────────────────────── */}
          {step === "review" && facture && (
            <div className="flex flex-col gap-5">
              {/* Preview du fichier original */}
              {fileBase64 && fileMediaType && (
                <details className="rounded-2xl border border-gray-200 bg-white p-3">
                  <summary className="cursor-pointer text-xs font-medium text-gray-600 hover:text-gray-900">
                    Voir le document source ({fileMediaType === "application/pdf" ? "PDF" : "image"})
                  </summary>
                  <div className="mt-3 max-h-[420px] overflow-auto rounded-lg border border-gray-100 bg-gray-50 p-2">
                    {fileMediaType === "application/pdf" ? (
                      <iframe
                        src={`data:${fileMediaType};base64,${fileBase64}`}
                        title="Aperçu facture"
                        className="h-[400px] w-full rounded"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`data:${fileMediaType};base64,${fileBase64}`}
                        alt="Aperçu facture"
                        className="mx-auto max-h-[400px] w-auto rounded"
                      />
                    )}
                  </div>
                </details>
              )}

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

                <button
                  onClick={addLigne}
                  type="button"
                  className="mt-3 inline-flex items-center gap-2 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 px-4 py-2 text-sm font-medium text-indigo-700 hover:border-indigo-500 hover:bg-indigo-50"
                >
                  <span className="text-base">+</span> Ajouter une ligne
                </button>

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
              onClick={() => { setFacture(null); setStep("pick"); setError(null); setQueue([]); setParsedQueue([]); setQueueIndex(0); setQueueTotal(0); }}
              className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-gray-100"
            >
              Recommencer
            </button>
            {(queue.length > 0 || parsedQueue.length > 0) && (
              <button
                onClick={() => { advanceQueue(); }}
                className="min-h-[44px] rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
              >
                Passer cette facture
              </button>
            )}
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
