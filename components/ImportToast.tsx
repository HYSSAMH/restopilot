"use client";

import { useEffect } from "react";
import { useImport } from "@/lib/import-context";

export default function ImportToast() {
  const { state, dismiss } = useImport();

  // Auto-dismiss success after 6 s
  useEffect(() => {
    if (state.status !== "done") return;
    const t = setTimeout(dismiss, 6000);
    return () => clearTimeout(t);
  }, [state.status, dismiss]);

  // Hide during preview/applying — the modal takes over
  if (state.status === "idle" || state.status === "preview" || state.status === "applying") return null;

  const progress =
    state.status === "running" && state.progress
      ? Math.round((state.progress.page / state.progress.totalPages) * 100)
      : state.status === "running" ? 0 : 100;

  return (
    <div className="fixed bottom-6 right-6 z-[200] w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-black/50 transition-all">
      {/* Top bar */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          {/* Icon */}
          {state.status === "running" && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/20">
              <svg className="h-4 w-4 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            </div>
          )}
          {state.status === "done" && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600/20 text-emerald-400">
              ✓
            </div>
          )}
          {state.status === "error" && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-600/20 text-red-400">
              ✕
            </div>
          )}

          {/* Text */}
          <div className="min-w-0">
            {state.status === "running" && (
              <>
                <p className="text-sm font-medium text-[#1A1A2E]">Import en cours…</p>
                <p className="truncate text-xs text-gray-500">
                  {state.progress
                    ? `Page ${state.progress.page}/${state.progress.totalPages} · ${state.filename ?? ""}`
                    : `Lecture du fichier · ${state.filename ?? ""}`}
                </p>
              </>
            )}
            {state.status === "done" && (() => {
              const total = state.result!.added + state.result!.updated;
              return (
                <>
                  <p className="text-sm font-medium text-[#1A1A2E]">
                    {total > 0
                      ? `${total} produit${total > 1 ? "s" : ""} importé${total > 1 ? "s" : ""} avec succès`
                      : "Aucune modification"}
                  </p>
                  {total > 0 && (
                    <p className="text-xs text-gray-500">
                      {state.result!.added > 0 && `${state.result!.added} ajouté${state.result!.added > 1 ? "s" : ""}`}
                      {state.result!.added > 0 && state.result!.updated > 0 && " · "}
                      {state.result!.updated > 0 && `${state.result!.updated} mis à jour`}
                    </p>
                  )}
                </>
              );
            })()}
            {state.status === "error" && (
              <>
                <p className="text-sm font-medium text-[#1A1A2E]">Import échoué</p>
                <p className="truncate text-xs text-red-400/80">{state.error}</p>
              </>
            )}
          </div>
        </div>

        {/* Dismiss button (not shown during running) */}
        {state.status !== "running" && (
          <button
            onClick={dismiss}
            className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors mt-0.5"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-gray-100">
        <div
          className={`h-full transition-all duration-500 ${
            state.status === "done"  ? "bg-emerald-500" :
            state.status === "error" ? "bg-red-500" :
            "bg-violet-500"
          } ${state.status === "running" && !state.progress ? "animate-pulse" : ""}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
