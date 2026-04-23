"use client";

export const PAGE_SIZE_DEFAULT = 20;

/** Barre de pagination simple : numéros de pages + total.
 *  À placer sous n'importe quel tableau paginé. */
export function Pagination({
  page, pageSize = PAGE_SIZE_DEFAULT, total, onChange,
}: {
  page: number;            // 1-based
  pageSize?: number;
  total: number;
  onChange: (nextPage: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) {
    return (
      <p className="px-4 py-3 text-xs text-gray-500">
        {total} résultat{total > 1 ? "s" : ""}
      </p>
    );
  }
  const curr = Math.min(Math.max(1, page), totalPages);

  // Fenêtre glissante : 1 … curr-1 curr curr+1 … totalPages
  const pages: (number | "…")[] = [];
  const push = (v: number | "…") => { if (pages[pages.length - 1] !== v) pages.push(v); };
  push(1);
  if (curr - 1 > 2) push("…");
  for (let i = Math.max(2, curr - 1); i <= Math.min(totalPages - 1, curr + 1); i++) push(i);
  if (curr + 1 < totalPages - 1) push("…");
  if (totalPages > 1) push(totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-gray-500">
      <span>
        Page <span className="font-semibold text-[#1A1A2E]">{curr}</span> sur {totalPages} — {total} résultat{total > 1 ? "s" : ""}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(curr - 1)}
          disabled={curr <= 1}
          className="rounded-md border border-gray-200 bg-white px-2 py-1 hover:border-indigo-300 disabled:opacity-40"
        >
          ←
        </button>
        {pages.map((p, i) => (
          p === "…" ? (
            <span key={`e${i}`} className="px-1 text-gray-400">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`min-w-[32px] rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                p === curr
                  ? "border-indigo-500 bg-indigo-500 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              {p}
            </button>
          )
        ))}
        <button
          onClick={() => onChange(curr + 1)}
          disabled={curr >= totalPages}
          className="rounded-md border border-gray-200 bg-white px-2 py-1 hover:border-indigo-300 disabled:opacity-40"
        >
          →
        </button>
      </div>
    </div>
  );
}

/** Helper pour paginer un array en mémoire. */
export function paginate<T>(rows: T[], page: number, pageSize = PAGE_SIZE_DEFAULT): T[] {
  const start = (Math.max(1, page) - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}
