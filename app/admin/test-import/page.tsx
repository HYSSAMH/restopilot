"use client";

import { useState } from "react";
import AdminLayout from "@/components/admin/AdminLayout";

type Etape = "idle" | "extracting" | "analyzing" | "done" | "error";

interface ExtractResult { text: string; pages: number; char_count: number; duration_ms: number }

export default function TestImportPage() {
  const [filename, setFilename] = useState("");
  const [mediaType, setMediaType] = useState("");
  const [etape, setEtape] = useState<Etape>("idle");
  const [error, setError] = useState<string | null>(null);

  const [extract, setExtract] = useState<ExtractResult | null>(null);
  const [parseResult, setParseResult] = useState<unknown>(null);
  const [rawResponse, setRawResponse] = useState<string | null>(null);

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
      setError("Format non supporté (PDF, JPG, PNG, WebP uniquement).");
      return;
    }

    // Base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error("Lecture échouée"));
      r.onload  = () => {
        const s = r.result as string;
        const i = s.indexOf(",");
        resolve(i >= 0 ? s.slice(i + 1) : s);
      };
      r.readAsDataURL(file);
    });

    // Étape 1 : extraction texte via /api/extract-pdf (PDF uniquement)
    if (isPdf) {
      setEtape("extracting");
      try {
        const res = await fetch("/api/extract-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileBase64: base64 }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
        setExtract({ text: json.text, pages: json.pages, char_count: json.char_count, duration_ms: json.duration_ms });
      } catch (e) {
        setError("Extraction texte : " + (e instanceof Error ? e.message : String(e)));
        setEtape("error");
        return;
      }
    }

    // Étape 2 : analyse Claude via /api/facture-import (le serveur fait lui-même
    // unpdf si nécessaire, ou route vers le prompt image)
    setEtape("analyzing");
    try {
      const res = await fetch("/api/facture-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64: base64, mediaType: file.type || "application/pdf" }),
      });
      const txt = await res.text();
      setRawResponse(txt);
      let json: { error?: string; facture?: unknown };
      try { json = JSON.parse(txt); }
      catch { throw new Error("Réponse non-JSON : " + txt.slice(0, 200)); }
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setParseResult(json.facture);
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
          Page de diagnostic : upload un PDF ou une image, vois le texte brut extrait par unpdf
          puis le JSON retourné par Claude. Aucune commande n&apos;est créée dans la DB.
        </p>

        <section className="mt-6 rounded-[10px] border border-[var(--border)] bg-white p-5 shadow-sm">
          <label className="flex cursor-pointer items-center gap-3 rounded-[8px] border border-dashed border-indigo-300 bg-[var(--accent-soft)]/40 px-4 py-4 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)]">
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
            <span>📎</span>
            <span>{filename || "Choisir un PDF ou une image"}</span>
          </label>

          {etape !== "idle" && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {etape === "extracting" && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">1/2 Extraction texte…</span>}
              {etape === "analyzing"  && <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[var(--accent)]">2/2 Analyse Claude…</span>}
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
              <h2 className="text-sm font-semibold text-[var(--text)]">
                Étape 1 — Texte brut extrait (unpdf)
              </h2>
              <p className="text-xs text-gray-500">
                {extract.pages} page{extract.pages > 1 ? "s" : ""} · {extract.char_count} caractères · {extract.duration_ms} ms
              </p>
            </div>
            {extract.char_count < 50 ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                ⚠ Peu de texte extrait — probablement un PDF scanné. Le serveur basculera automatiquement
                en mode image (Claude vision).
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
              Étape 2 — JSON structuré par Claude
            </h2>
            <pre className="max-h-96 overflow-auto rounded-lg bg-white p-3 font-mono text-[11px] text-gray-800">
              {JSON.stringify(parseResult, null, 2)}
            </pre>
          </section>
        )}

        {rawResponse && etape === "error" && (
          <section className="mt-4 rounded-[10px] border border-[var(--border)] bg-white p-5 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-[var(--text)]">Réponse serveur brute</h2>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[var(--bg-subtle)] p-3 font-mono text-[11px] text-gray-700">
              {rawResponse}
            </pre>
          </section>
        )}
      </div>
    </AdminLayout>
  );
}
