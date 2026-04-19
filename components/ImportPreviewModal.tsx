"use client";

import { useState, useEffect } from "react";
import { useImport, type PreviewItem } from "@/lib/import-context";

const UNITES = ["kg", "pièce", "L", "barq.", "lot", "boîte", "sac", "100g"];
const CAT_ICONE: Record<string, string> = {
  legumes: "🥬",
  fruits: "🍎",
  boucherie: "🥩",
  poissonnerie: "🐟",
  epicerie: "🫙",
  herbes: "🌿",
  pommes_de_terre: "🥔",
  salades: "🥗",
  cremerie: "🧀",
};
const CAT_LABEL: Record<string, string> = {
  legumes: "Légumes",
  fruits: "Fruits",
  boucherie: "Boucherie",
  poissonnerie: "Poissonnerie",
  epicerie: "Épicerie",
  herbes: "Herbes aromatiques",
  pommes_de_terre: "Pommes de terre",
  salades: "Salades",
  cremerie: "Crèmerie",
};

interface EditableItem extends PreviewItem {
  editNom: string;
  editPrix: string;
  editUnite: string;
}

function toEditable(item: PreviewItem): EditableItem {
  return {
    ...item,
    editNom: item.nom,
    editPrix: item.prix.toFixed(2),
    editUnite: item.unite,
  };
}

function fromEditable(item: EditableItem): PreviewItem {
  const parsed = parseFloat(item.editPrix);
  const prix = !isNaN(parsed) && parsed > 0 ? parsed : item.prix;
  const nom = item.editNom.trim() || item.nom;
  const unite = item.editUnite.trim() || item.unite;
  return {
    nom,
    categorie: item.categorie,
    prix,
    unite,
    ancien_prix: item.ancien_prix,
    is_promo: item.is_promo,
    status: item.status,
    oldPrix: item.oldPrix,
    tarif_id: item.tarif_id,
    produit_id: item.produit_id,
  };
}

export default function ImportPreviewModal() {
  const { state, confirmImport, cancelImport } = useImport();
  const [items, setItems] = useState<EditableItem[]>([]);
  const [showUnchanged, setShowUnchanged] = useState(false);

  useEffect(() => {
    if (state.status === "preview") {
      setItems(state.previewItems.map(toEditable));
      setShowUnchanged(false);
    }
  }, [state.status, state.previewItems]);

  if (state.status !== "preview" && state.status !== "applying") return null;

  const isApplying = state.status === "applying";

  const nouveauxIdx = items
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => item.status === "nouveau");
  const updatedIdx = items
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => item.status === "updated");
  const unchangedIdx = items
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => item.status === "unchanged");

  const changeCount = nouveauxIdx.length + updatedIdx.length;

  function updateField(
    idx: number,
    field: "editNom" | "editPrix" | "editUnite",
    value: string,
  ) {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)),
    );
  }

  function handleConfirm() {
    const finalItems = items.map(fromEditable);
    void confirmImport(finalItems);
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#13132a] shadow-2xl shadow-black/60">
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/8 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">
              Vérification avant import
            </h2>
            <p className="mt-0.5 truncate text-sm text-white/40">
              {items.length} produit{items.length > 1 ? "s" : ""} détecté
              {items.length > 1 ? "s" : ""}
              {state.filename && <> · {state.filename}</>}
            </p>
          </div>
          {!isApplying && (
            <button
              onClick={cancelImport}
              className="shrink-0 text-xl leading-none text-white/30 transition-colors hover:text-white/60"
            >
              ✕
            </button>
          )}
        </div>

        {/* Summary chips */}
        <div className="flex shrink-0 flex-wrap gap-2 border-b border-white/8 bg-white/[0.02] px-6 py-3">
          {nouveauxIdx.length > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {nouveauxIdx.length} nouveau{nouveauxIdx.length > 1 ? "x" : ""}
            </span>
          )}
          {updatedIdx.length > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-400">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              {updatedIdx.length} mis à jour
            </span>
          )}
          {unchangedIdx.length > 0 && (
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/40">
              <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
              {unchangedIdx.length} inchangé
              {unchangedIdx.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Scrollable list */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {nouveauxIdx.length > 0 && (
            <Section title="Nouveaux produits" color="emerald" count={nouveauxIdx.length}>
              {nouveauxIdx.map(({ item, idx }) => (
                <EditRow
                  key={idx}
                  item={item}
                  idx={idx}
                  disabled={isApplying}
                  onChange={updateField}
                />
              ))}
            </Section>
          )}

          {updatedIdx.length > 0 && (
            <Section title="Prix mis à jour" color="sky" count={updatedIdx.length}>
              {updatedIdx.map(({ item, idx }) => (
                <EditRow
                  key={idx}
                  item={item}
                  idx={idx}
                  disabled={isApplying}
                  onChange={updateField}
                />
              ))}
            </Section>
          )}

          {unchangedIdx.length > 0 && (
            <div>
              <button
                onClick={() => setShowUnchanged((v) => !v)}
                className="flex items-center gap-2 text-xs font-medium text-white/40 transition-colors hover:text-white/70"
              >
                <span
                  className={`transition-transform ${showUnchanged ? "rotate-90" : ""}`}
                >
                  ▶
                </span>
                {unchangedIdx.length} produit{unchangedIdx.length > 1 ? "s" : ""} inchangé
                {unchangedIdx.length > 1 ? "s" : ""}
                {!showUnchanged && " (cliquer pour afficher)"}
              </button>
              {showUnchanged && (
                <div className="mt-3 space-y-1.5">
                  {unchangedIdx.map(({ item, idx }) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/[0.02] px-4 py-2.5 opacity-60"
                    >
                      <span className="shrink-0 text-lg">
                        {CAT_ICONE[item.categorie] ?? "📦"}
                      </span>
                      <span className="flex-1 truncate text-sm text-white/60">
                        {item.nom}
                      </span>
                      <span className="shrink-0 text-xs text-white/30">
                        {CAT_LABEL[item.categorie] ?? item.categorie}
                      </span>
                      <span className="shrink-0 text-sm text-white/40">
                        {item.prix.toFixed(2)} €/{item.unite}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-white/8 bg-white/[0.02] px-6 py-4">
          <p className="text-xs text-white/30">
            {changeCount} modification{changeCount !== 1 ? "s" : ""} · badges
            valables 7 jours
          </p>
          <div className="flex gap-3">
            <button
              onClick={cancelImport}
              disabled={isApplying}
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/60 transition-all hover:bg-white/8 disabled:opacity-30"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={isApplying || changeCount === 0}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-purple-400 disabled:opacity-50"
            >
              {isApplying ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                  Application…
                </>
              ) : (
                `Confirmer l'import${changeCount > 0 ? ` (${changeCount})` : ""}`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Subcomponents ──────────────────────────────────────────────────────────

function Section({
  title,
  color,
  count,
  children,
}: {
  title: string;
  color: "emerald" | "sky";
  count: number;
  children: React.ReactNode;
}) {
  const titleColor = color === "emerald" ? "text-emerald-400" : "text-sky-400";
  const dotColor = color === "emerald" ? "bg-emerald-400" : "bg-sky-400";
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dotColor}`} />
        <span className={`text-xs font-semibold uppercase tracking-wide ${titleColor}`}>
          {title}
        </span>
        <span className="text-xs text-white/25">({count})</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function EditRow({
  item,
  idx,
  disabled,
  onChange,
}: {
  item: EditableItem;
  idx: number;
  disabled: boolean;
  onChange: (
    idx: number,
    field: "editNom" | "editPrix" | "editUnite",
    value: string,
  ) => void;
}) {
  const borderColor =
    item.status === "nouveau"
      ? "border-emerald-500/20 bg-emerald-500/[0.04]"
      : "border-sky-500/20 bg-sky-500/[0.04]";

  const uniteInList = UNITES.includes(item.editUnite);

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 ${borderColor}`}
    >
      <span className="shrink-0 text-xl">
        {CAT_ICONE[item.categorie] ?? "📦"}
      </span>

      {/* Nom */}
      <input
        value={item.editNom}
        onChange={(e) => onChange(idx, "editNom", e.target.value)}
        disabled={disabled}
        className="min-w-0 flex-1 basis-40 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white outline-none placeholder-white/20 focus:border-violet-500/50 disabled:opacity-60"
      />

      {/* Catégorie chip */}
      <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/40">
        {CAT_LABEL[item.categorie] ?? item.categorie}
      </span>

      {/* Promo badge */}
      {item.is_promo && (
        <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
          PROMO
        </span>
      )}

      {/* Old price (crossed out, only for updated) */}
      {item.status === "updated" && item.oldPrix !== undefined && (
        <span className="shrink-0 text-xs text-white/30 line-through">
          {item.oldPrix.toFixed(2)} €
        </span>
      )}

      {/* Prix */}
      <div className="flex shrink-0 items-center gap-1">
        <input
          type="number"
          min="0"
          step="0.01"
          value={item.editPrix}
          onChange={(e) => onChange(idx, "editPrix", e.target.value)}
          disabled={disabled}
          className="w-20 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-right text-sm text-white outline-none focus:border-violet-500/50 disabled:opacity-60"
        />
        <span className="text-sm text-white/40">€</span>
      </div>

      {/* Unité */}
      <select
        value={item.editUnite}
        onChange={(e) => onChange(idx, "editUnite", e.target.value)}
        disabled={disabled}
        className="shrink-0 rounded-lg border border-white/10 bg-[#13132a] px-2.5 py-1.5 text-sm text-white outline-none focus:border-violet-500/50 disabled:opacity-60"
      >
        {UNITES.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
        {!uniteInList && (
          <option value={item.editUnite}>{item.editUnite}</option>
        )}
      </select>
    </div>
  );
}
