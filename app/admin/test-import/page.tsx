"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";

type Etape = "idle" | "extracting" | "ocr" | "parsing" | "done" | "error";

interface ExtractResult { text: string; pages: number; char_count: number; duration_ms: number }

const PDFJS_VERSION = "5.6.205";

let _pdfjsLoaded: typeof import("pdfjs-dist") | null = null;
async function loadPdfjs() {
  if (_pdfjsLoaded) return _pdfjsLoaded;
  const mod = await import("pdfjs-dist");
  mod.GlobalWorkerOptions.workerSrc =
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
  _pdfjsLoaded = mod;
  return mod;
}

async function extractPdfTextClient(file: File): Promise<{ text: string; numPages: number }> {
  const { getDocument } = await loadPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;

  let text = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    type PdfItem = { str: string; transform: number[] };
    const items = content.items as PdfItem[];

    const lineMap = new Map<number, { y: number; items: { x: number; str: string }[] }>();
    for (const it of items) {
      const str = it.str ?? "";
      if (!str) continue;
      const x = it.transform[4];
      const y = it.transform[5];
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

    const sortedLines = Array.from(lineMap.values()).sort((a, b) => b.y - a.y);
    for (const line of sortedLines) {
      line.items.sort((a, b) => a.x - b.x);
      const lineText = line.items
        .map((it, idx, arr) => {
          const prev = idx > 0 ? arr[idx - 1] : null;
          const needsSpace = prev && !prev.str.endsWith(" ") && !it.str.startsWith(" ");
          return (needsSpace ? " " : "") + it.str;
        })
        .join("")
        .replace(/\s+/g, " ")
        .trim();
      if (lineText) text += lineText + "\n";
    }
    text += "\n";
  }
  return { text: text.trim(), numPages: pdf.numPages };
}

async function ocrPdfClient(file: File): Promise<string> {
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

async function ocrImageClient(file: File): Promise<string> {
  const tesseract = await import("tesseract.js");
  const worker = await tesseract.createWorker("fra");
  try {
    const { data } = await worker.recognize(file);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

/**
 * Page admin de diagnostic d\u0027import facture.
 *
 * Pipeline 100% client :
 *   1. Extraction texte natif (pdfjs-dist) — rapide
 *   2. Si peu de texte : OCR (tesseract.js)
 *   3. POST du texte brut à /api/facture-parse-text → JSON parsé
 *
 * Aucune commande créée. Utile pour calibrer le parser sur des
 * factures réelles.
 */
export default function TestImportPage() {
  const [filename, setFilename] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [etape, setEtape] = useState<Etape>("idle");
  const [error, setError] = useState<string | null>(null);
  const [extract, setExtract] = useState<ExtractResult | null>(null);
  const [parseResult, setParseResult] = useState<unknown>(null);
  const [rawResponse, setRawResponse] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setExtract(null);
    setParseResult(null);
    setRawResponse(null);
    setFilename(file.name);
    setMediaType(file.type);

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImage = file.type.startsWith("image/");
    if (!isPdf && !isImage) {
      setError("Format non supporté (PDF, JPG, PNG, WebP).");
      return;
    }

    let rawText = "";
    const t0 = performance.now();

    try {
      if (isPdf) {
        setEtape("extracting");
        const { text, numPages } = await extractPdfTextClient(file);
        if (text.length >= 50) {
          rawText = text;
          setExtract({ text, pages: numPages, char_count: text.length, duration_ms: Math.round(performance.now() - t0) });
        } else {
          setEtape("ocr");
          rawText = await ocrPdfClient(file);
          setExtract({ text: rawText, pages: numPages, char_count: rawText.length, duration_ms: Math.round(performance.now() - t0) });
        }
      } else {
        setEtape("ocr");
        rawText = await ocrImageClient(file);
        setExtract({ text: rawText, pages: 1, char_count: rawText.length, duration_ms: Math.round(performance.now() - t0) });
      }

      setEtape("parsing");
      const res = await fetch("/api/facture-parse-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      const txt = await res.text();
      setRawResponse(txt);
      let json: { error?: string; facture?: unknown; factures?: unknown };
      try { json = JSON.parse(txt); }
      catch { throw new Error("Réponse non-JSON : " + txt.slice(0, 200)); }
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setParseResult(json.factures ?? json.facture);
      setEtape("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setEtape("error");
    }
  }

  return (
    <AdminLayout>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-10">
        <h1 className="text-2xl font-bold text-[var(--text)]">Tester l&apos;extraction facture</h1>
        <p className="mt-1 text-sm text-gray-500">
          Diagnostic : upload PDF ou image → extraction texte client (pdfjs-dist) → parsing serveur (regex).
          Aucune commande n&apos;est créée.
        </p>

        <section className="mt-6 rounded-[10px] border border-[var(--border)] bg-white p-5 shadow-sm">
          <label
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            className={
              "flex cursor-pointer flex-col items-center gap-2 rounded-[8px] border-2 border-dashed px-4 py-8 text-sm font-medium transition-colors " +
              (isDragging
                ? "border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200"
                : "border-indigo-300 bg-[var(--accent-soft)]/40 text-[var(--accent)] hover:bg-[var(--accent-soft)]")
            }
          >
            <input
              type="file"
              accept=".pdf,image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.currentTarget.value = "";
              }}
            />
            <span className="text-2xl">📎</span>
            <span>
              {isDragging
                ? "Relâchez pour importer"
                : filename || "Glissez-déposez ou cliquez pour choisir un PDF / image"}
            </span>
          </label>

          {etape !== "idle" && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {etape === "extracting" && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">1/2 Extraction texte (pdfjs)…</span>}
              {etape === "ocr"        && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">OCR (tesseract.js)…</span>}
              {etape === "parsing"    && <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[var(--accent)]">2/2 Parsing serveur…</span>}
              {etape === "done"       && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">✓ Terminé</span>}
              {etape === "error"      && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700">❌ Erreur</span>}
              {mediaType && <span className="text-gray-500">{mediaType}</span>}
            </div>
          )}
          {error && (
            <div className="mt-3 rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </section>

        {extract && (
          <section className="mt-4 rounded-[10px] border border-[var(--border)] bg-white p-5 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--text)]">Étape 1 — Texte brut extrait</h2>
              <p className="text-xs text-gray-500">
                {extract.pages} page{extract.pages > 1 ? "s" : ""} · {extract.char_count} caractères · {extract.duration_ms} ms
              </p>
            </div>
            {extract.char_count < 50 ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                ⚠ Très peu de texte — PDF probablement scanné, OCR enclenché.
              </p>
            ) : null}
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--bg-subtle)] p-3 font-mono text-[11px] text-gray-700">
              {extract.text || "(vide)"}
            </pre>
          </section>
        )}

        {parseResult != null && (
          <section className="mt-4 rounded-[10px] border border-emerald-200 bg-emerald-50/30 p-5 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-emerald-900">
              Étape 2 — JSON structuré (parser regex)
            </h2>
            <pre className="max-h-96 overflow-auto rounded-lg bg-white p-3 font-mono text-[11px] text-gray-800">
              {JSON.stringify(parseResult, null, 2)}
            </pre>
          </section>
        )}

        {rawResponse && etape === "error" && (
          <section className="mt-4 rounded-[10px] border border-[var(--border)] bg-white p-5 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-[var(--text)]">Réponse serveur brute</h2>
            <pre 
className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--bg-subtle)] p-3 font-mono text-[11px] text-gray-700">
              {rawResponse}
            </pre>
          </section>
        )}
      </div>
    </AdminLayout>
  );
}
