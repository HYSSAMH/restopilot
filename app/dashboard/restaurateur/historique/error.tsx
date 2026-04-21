"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function HistoriqueError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[historique] uncaught :", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] px-4">
      <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-2xl">⚠</span>
          <h1 className="text-lg font-semibold text-[#1A1A2E]">La page n&apos;a pas pu charger</h1>
        </div>
        <p className="text-sm text-gray-600">
          Une erreur s&apos;est produite lors du chargement de vos commandes.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-50 p-3 text-[11px] text-gray-600">
          {error.message}
          {error.digest ? `\n\nDigest : ${error.digest}` : ""}
        </pre>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => reset()}
            className="min-h-[44px] rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600"
          >
            Réessayer
          </button>
          <Link
            href="/dashboard/restaurateur"
            className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-[#1A1A2E] hover:bg-gray-100"
          >
            ← Retour dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
