"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import Navbar from "@/components/dashboard/Navbar";
import { createClient } from "@/lib/supabase/client";
import { useImport } from "@/lib/import-context";
import { useProfile } from "@/lib/auth/use-profile";

const PAGE_SIZE = 50;

// ── Catégories DB (source unique, avec icône + libellé) ────────────────────

const CATEGORIES = [
  { id: "legumes",         label: "Légumes",             icone: "🥬" },
  { id: "fruits",          label: "Fruits",              icone: "🍎" },
  { id: "boucherie",       label: "Boucherie",           icone: "🥩" },
  { id: "poissonnerie",    label: "Poissonnerie",        icone: "🐟" },
  { id: "epicerie",        label: "Épicerie",            icone: "🫙" },
  { id: "herbes",          label: "Herbes aromatiques",  icone: "🌿" },
  { id: "pommes_de_terre", label: "Pommes de terre",     icone: "🥔" },
  { id: "salades",         label: "Salades",             icone: "🥗" },
  { id: "cremerie",        label: "Crèmerie",            icone: "🧀" },
] as const;

type CatId = typeof CATEGORIES[number]["id"];

// Filtres de la barre (inclut "Fruits & Légumes" comme groupe agrégé)
const CATEGORY_FILTERS = [
  { id: "tous",            label: "Toutes catégories"   },
  { id: "fruits_legumes",  label: "Fruits & Légumes"    },
  { id: "boucherie",       label: "Boucherie"           },
  { id: "poissonnerie",    label: "Poissonnerie"        },
  { id: "epicerie",        label: "Épicerie"            },
  { id: "herbes",          label: "Herbes aromatiques"  },
  { id: "pommes_de_terre", label: "Pommes de terre"     },
  { id: "salades",         label: "Salades"             },
  { id: "cremerie",        label: "Crèmerie"            },
] as const;
type CategoryFilter = typeof CATEGORY_FILTERS[number]["id"];

const UNITES = ["kg", "pièce", "L", "barq.", "lot", "boîte", "sac", "100g"];

function catIcone(id: string) { return CATEGORIES.find(c => c.id === id)?.icone ?? "📦"; }
function catLabel(id: string) { return CATEGORIES.find(c => c.id === id)?.label ?? id; }

const BADGE_CONFIG: Record<string, { label: string; chip: string; dot: string }> = {
  nouveaute:   { label: "Nouveauté",   chip: "border-violet-500/30 bg-violet-500/10 text-violet-300", dot: "bg-violet-400" },
  prix_baisse: { label: "Prix baisse", chip: "border-sky-500/30 bg-sky-500/10 text-sky-300",          dot: "bg-sky-400"    },
  promotion:   { label: "Promotion",   chip: "border-amber-500/30 bg-amber-500/10 text-amber-300",    dot: "bg-amber-400"  },
};

function activeBadge(e: { badge: string | null; badge_expires_at: string | null }): string | null {
  if (!e.badge || !e.badge_expires_at) return null;
  return new Date(e.badge_expires_at).getTime() > Date.now() ? e.badge : null;
}

// ── Types ──────────────────────────────────────────────────────────────────

interface Entry {
  tarif_id: string;
  produit_id: string;
  nom: string;
  categorie: string;
  icone: string;
  prix: number;
  unite: string;
  stock: number | null;
  actif: boolean;
  badge: "nouveaute" | "prix_baisse" | "promotion" | null;
  badge_expires_at: string | null;
  created_at: string | null;
}

interface FormState {
  nom: string;
  categorie: CatId;
  prix: string;
  unite: string;
  stock: string;
  actif: boolean;
}

const EMPTY_FORM: FormState = { nom: "", categorie: "legumes", prix: "", unite: "kg", stock: "", actif: true };

type StatusFilter = "tous" | "actifs" | "inactifs";
type BadgeFilter  = "tous" | "nouveaute" | "prix_baisse" | "promotion";
type SortKey      = "date_desc" | "date_asc" | "name_asc" | "price_asc" | "price_desc";

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color?: string }) {
  return (
    <div className={`rounded-2xl border px-5 py-4 ${color ?? "border-white/8 bg-white/5"}`}>
      <p className="text-xs text-white/40">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-white/30">{sub}</p>}
    </div>
  );
}

// Calcule les numéros de pages à afficher autour de la page courante
function getPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, total, current - 1, current, current + 1]);
  if (current <= 3) { set.add(2); set.add(3); set.add(4); }
  if (current >= total - 2) { set.add(total - 1); set.add(total - 2); set.add(total - 3); }
  const valid = Array.from(set).filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  for (let i = 0; i < valid.length; i++) {
    if (i > 0 && valid[i] - valid[i - 1] > 1) out.push("…");
    out.push(valid[i]);
  }
  return out;
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function MercurialePage() {
  const { state: importState, startImport } = useImport();
  const { profile } = useProfile();
  const fournisseurId = profile?.id ?? null;

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtres / tri / pagination
  const [search, setSearch]                 = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("tous");
  const [statusFilter, setStatusFilter]     = useState<StatusFilter>("tous");
  const [badgeFilter, setBadgeFilter]       = useState<BadgeFilter>("tous");
  const [sortBy, setSortBy]                 = useState<SortKey>("date_desc");
  const [currentPage, setCurrentPage]       = useState(1);

  // Sélection multiple
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm]       = useState<null | "delete" | "deactivate">(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Modale ajout / édition
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm]           = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Suppression unitaire
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting]           = useState(false);

  // Import
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef                  = useRef<HTMLInputElement>(null);

  // ── Data fetch ────────────────────────────────────────────────────────────

  const fetchEntries = useCallback(async () => {
    if (!fournisseurId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("tarifs")
      .select("id, prix, unite, stock, actif, badge, badge_expires_at, created_at, produits!inner ( id, nom, categorie, icone )")
      .eq("fournisseur_id", fournisseurId)
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    if (data) {
      setEntries((data as unknown as Array<{
        id: string; prix: number; unite: string; stock: number | null; actif: boolean;
        badge: Entry["badge"]; badge_expires_at: string | null; created_at: string | null;
        produits: { id: string; nom: string; categorie: string; icone: string };
      }>).map(t => ({
        tarif_id:         t.id,
        produit_id:       t.produits.id,
        nom:              t.produits.nom,
        categorie:        t.produits.categorie,
        icone:            t.produits.icone,
        prix:             t.prix,
        unite:            t.unite,
        stock:            t.stock ?? null,
        actif:            t.actif,
        badge:            t.badge ?? null,
        badge_expires_at: t.badge_expires_at ?? null,
        created_at:       t.created_at ?? null,
      })));
    }
    setLoading(false);
  }, [fournisseurId]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);
  useEffect(() => {
    if (importState.status === "done") fetchEntries();
  }, [importState.status, fetchEntries]);

  // Reset page 1 quand filtres/recherche changent
  useEffect(() => { setCurrentPage(1); }, [categoryFilter, statusFilter, badgeFilter, search, sortBy]);

  // ── Filtre + tri ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let arr = entries;

    if (categoryFilter === "fruits_legumes") {
      arr = arr.filter(e => e.categorie === "legumes" || e.categorie === "fruits");
    } else if (categoryFilter !== "tous") {
      arr = arr.filter(e => e.categorie === categoryFilter);
    }

    if (statusFilter === "actifs")   arr = arr.filter(e =>  e.actif);
    if (statusFilter === "inactifs") arr = arr.filter(e => !e.actif);

    if (badgeFilter !== "tous") {
      arr = arr.filter(e => activeBadge(e) === badgeFilter);
    }

    if (search) {
      const s = search.toLowerCase();
      arr = arr.filter(e => e.nom.toLowerCase().includes(s));
    }

    const sorted = [...arr];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "name_asc":   return a.nom.localeCompare(b.nom, "fr");
        case "price_asc":  return a.prix - b.prix;
        case "price_desc": return b.prix - a.prix;
        case "date_asc":   return (a.created_at ?? "").localeCompare(b.created_at ?? "");
        case "date_desc":
        default:           return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      }
    });
    return sorted;
  }, [entries, categoryFilter, statusFilter, badgeFilter, search, sortBy]);

  const totalFiltered = filtered.length;
  const totalPages    = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
  const safePage      = Math.min(currentPage, totalPages);
  const pageStart     = (safePage - 1) * PAGE_SIZE;
  const pageItems     = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  const nbActifs      = entries.filter(e => e.actif).length;
  const nbInactifs    = entries.length - nbActifs;
  const nbStockFaible = entries.filter(e => e.stock !== null && e.stock < 10).length;

  // ── Sélection ─────────────────────────────────────────────────────────────

  const pageIds = pageItems.map(e => e.tarif_id);
  const allPageSelected  = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
  const somePageSelected = pageIds.some(id => selectedIds.has(id));

  function togglePageSelection() {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach(id => next.delete(id));
      else                 pageIds.forEach(id => next.add(id));
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds(new Set(filtered.map(e => e.tarif_id)));
  }

  function clearSelection() { setSelectedIds(new Set()); }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkProcessing(true);
    const supabase = createClient();
    await supabase.from("tarifs").delete().in("id", ids);
    setEntries(prev => prev.filter(e => !selectedIds.has(e.tarif_id)));
    setSelectedIds(new Set());
    setBulkProcessing(false);
    setBulkConfirm(null);
  }

  async function handleBulkDeactivate() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkProcessing(true);
    const supabase = createClient();
    await supabase.from("tarifs").update({ actif: false }).in("id", ids);
    setEntries(prev => prev.map(e => selectedIds.has(e.tarif_id) ? { ...e, actif: false } : e));
    setSelectedIds(new Set());
    setBulkProcessing(false);
    setBulkConfirm(null);
  }

  // ── Ajout / édition ───────────────────────────────────────────────────────

  function openAdd() {
    setEditingId(null); setForm(EMPTY_FORM); setFormError(null); setModalOpen(true);
  }
  function openEdit(e: Entry) {
    setEditingId(e.tarif_id);
    const cat = (CATEGORIES.find(c => c.id === e.categorie)?.id ?? "legumes") as CatId;
    setForm({ nom: e.nom, categorie: cat, prix: e.prix.toFixed(2), unite: e.unite, stock: e.stock?.toString() ?? "", actif: e.actif });
    setFormError(null); setModalOpen(true);
  }
  function closeModal() { setModalOpen(false); setEditingId(null); setFormError(null); }

  async function handleSave() {
    if (!form.nom.trim()) { setFormError("Le nom est requis."); return; }
    const prix = parseFloat(form.prix);
    if (!form.prix || isNaN(prix) || prix <= 0) { setFormError("Prix invalide."); return; }
    if (!form.unite.trim()) { setFormError("L'unité est requise."); return; }
    const stock = form.stock ? parseInt(form.stock, 10) : null;
    if (form.stock && (isNaN(stock!) || stock! < 0)) { setFormError("Stock invalide."); return; }

    setSaving(true); setFormError(null);
    const supabase = createClient();

    if (editingId) {
      const entry = entries.find(e => e.tarif_id === editingId)!;
      await supabase.from("produits").update({ nom: form.nom.trim(), categorie: form.categorie, icone: catIcone(form.categorie) }).eq("id", entry.produit_id);
      const { error } = await supabase.from("tarifs").update({ prix, unite: form.unite.trim(), stock, actif: form.actif }).eq("id", editingId);
      if (error) { setFormError("Erreur lors de la mise à jour."); setSaving(false); return; }
    } else {
      if (!fournisseurId) { setFormError("Session expirée."); setSaving(false); return; }
      const { data: newProd, error: errP } = await supabase.from("produits")
        .insert({ nom: form.nom.trim(), categorie: form.categorie, icone: catIcone(form.categorie), actif: true })
        .select("id").single();
      if (errP || !newProd) { setFormError("Erreur lors de la création du produit."); setSaving(false); return; }
      const { error: errT } = await supabase.from("tarifs").insert({ produit_id: newProd.id, fournisseur_id: fournisseurId, prix, unite: form.unite.trim(), stock, actif: form.actif });
      if (errT) { setFormError("Erreur lors de l'ajout à la mercuriale."); setSaving(false); return; }
    }
    await fetchEntries();
    closeModal(); setSaving(false);
  }

  async function handleToggle(entry: Entry) {
    const supabase = createClient();
    const { error } = await supabase.from("tarifs").update({ actif: !entry.actif }).eq("id", entry.tarif_id);
    if (!error) setEntries(prev => prev.map(e => e.tarif_id === entry.tarif_id ? { ...e, actif: !e.actif } : e));
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("tarifs").delete().eq("id", confirmDelete);
    setEntries(prev => prev.filter(e => e.tarif_id !== confirmDelete));
    setConfirmDelete(null); setDeleting(false);
  }

  // ── Import ────────────────────────────────────────────────────────────────

  function handleImportClick() {
    setImportError(null);
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const valid = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!valid.includes(file.type)) { setImportError("Format non supporté. Utilisez PDF, JPG ou PNG."); return; }
    if (file.size > 20 * 1024 * 1024) { setImportError("Fichier trop grand (max 20 MB)."); return; }
    startImport(file);
  }

  const hasActiveFilters =
    categoryFilter !== "tous" || statusFilter !== "tous" || badgeFilter !== "tous" || search.length > 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0d0d1a]">
      <Navbar role="fournisseur" />

      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-white/30">
          <Link href="/dashboard/fournisseur" className="hover:text-white/60 transition-colors">Dashboard</Link>
          <span>/</span>
          <span className="text-white/60">Ma mercuriale</span>
        </div>

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Ma mercuriale</h1>
            <p className="mt-1 text-sm text-white/40">
              Gérez vos produits, prix et stocks visibles par les restaurateurs.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileInputRef} type="file" accept="application/pdf,image/jpeg,image/jpg,image/png" className="hidden" onChange={handleFileChange} />
            <button
              onClick={handleImportClick}
              disabled={importState.status === "running"}
              className="flex shrink-0 items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-600/15 px-4 py-2.5 text-sm font-medium text-violet-300 transition-all hover:bg-violet-600/30 hover:text-violet-200 disabled:opacity-50"
            >
              {importState.status === "running" ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  {importState.progress
                    ? `Page ${importState.progress.page}/${importState.progress.totalPages}…`
                    : "Analyse en cours…"}
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Importer PDF / image
                </>
              )}
            </button>
            <button
              onClick={openAdd}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 hover:from-violet-500 hover:to-purple-400 transition-all"
            >
              <span className="text-lg leading-none">+</span>
              Ajouter un produit
            </button>
          </div>
        </div>

        {importError && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3">
            <span className="text-red-400">⚠</span>
            <p className="flex-1 text-sm text-red-400">{importError}</p>
            <button onClick={() => setImportError(null)} className="text-red-400/60 hover:text-red-400">✕</button>
          </div>
        )}

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total produits" value={entries.length} />
          <StatCard label="Actifs"         value={nbActifs}   color="border-emerald-500/25 bg-emerald-500/8" />
          <StatCard label="Désactivés"     value={nbInactifs} />
          <StatCard
            label="Stock faible"
            value={nbStockFaible}
            sub="< 10 unités"
            color={nbStockFaible > 0 ? "border-amber-500/25 bg-amber-500/8" : "border-white/8 bg-white/5"}
          />
        </div>

        {/* ── Filtres ─────────────────────────────────────────────────── */}
        <div className="mb-4 space-y-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4">
          {/* Search + dropdowns */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-48 flex-1">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un produit..."
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-4 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value as CategoryFilter)}
              className="rounded-xl border border-white/10 bg-[#13132a] px-3.5 py-2 text-sm text-white outline-none focus:border-violet-500/50"
            >
              {CATEGORY_FILTERS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortKey)}
              className="rounded-xl border border-white/10 bg-[#13132a] px-3.5 py-2 text-sm text-white outline-none focus:border-violet-500/50"
            >
              <option value="date_desc">Plus récents</option>
              <option value="date_asc">Plus anciens</option>
              <option value="name_asc">Nom A → Z</option>
              <option value="price_asc">Prix croissant</option>
              <option value="price_desc">Prix décroissant</option>
            </select>
          </div>

          {/* Chips: statut + badge */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-white/40">Statut :</span>
              <div className="flex gap-1 rounded-xl border border-white/8 bg-white/5 p-1">
                {(["tous", "actifs", "inactifs"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                      statusFilter === f ? "bg-violet-600 text-white shadow" : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-white/40">Badge :</span>
              <div className="flex gap-1 rounded-xl border border-white/8 bg-white/5 p-1">
                {([
                  { id: "tous",        label: "Tous"        },
                  { id: "nouveaute",   label: "Nouveautés"  },
                  { id: "prix_baisse", label: "Prix baisse" },
                  { id: "promotion",   label: "Promotions"  },
                ] as const).map(f => (
                  <button
                    key={f.id}
                    onClick={() => setBadgeFilter(f.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      badgeFilter === f.id ? "bg-violet-600 text-white shadow" : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearch(""); setCategoryFilter("tous"); setStatusFilter("tous"); setBadgeFilter("tous");
                }}
                className="ml-auto text-xs text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        </div>

        {/* ── Résumé + actions groupées ──────────────────────────────── */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
          <p className="text-sm text-white/40">
            {totalFiltered === entries.length ? (
              <><span className="font-semibold text-white/70">{entries.length}</span> produit{entries.length > 1 ? "s" : ""}</>
            ) : (
              <>
                <span className="font-semibold text-white/70">{totalFiltered}</span>
                {" "}produit{totalFiltered > 1 ? "s" : ""} affiché{totalFiltered > 1 ? "s" : ""} sur {entries.length}
              </>
            )}
          </p>

          {selectedIds.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300">
                {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}
              </span>
              {selectedIds.size < totalFiltered && (
                <button
                  onClick={selectAllFiltered}
                  className="text-xs text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
                >
                  Sélectionner les {totalFiltered} filtrés
                </button>
              )}
              <button
                onClick={() => setBulkConfirm("deactivate")}
                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white"
              >
                Désactiver la sélection
              </button>
              <button
                onClick={() => setBulkConfirm("delete")}
                className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-300 transition-all hover:bg-red-500/30 hover:text-red-200"
              >
                Supprimer la sélection
              </button>
              <button
                onClick={clearSelection}
                className="text-xs text-white/30 hover:text-white/60"
              >
                Annuler
              </button>
            </div>
          ) : null}
        </div>

        {/* ── Table ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl border border-white/8 bg-white/5" />
            ))}
          </div>
        ) : pageItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/8 bg-white/5 py-24 text-center">
            <span className="text-5xl">{entries.length === 0 ? "📦" : "🔍"}</span>
            <p className="text-white/50">
              {entries.length === 0
                ? "Votre mercuriale est vide pour l'instant."
                : "Aucun produit ne correspond à vos filtres."}
            </p>
            {entries.length === 0 && (
              <button
                onClick={openAdd}
                className="mt-1 rounded-xl bg-violet-600/20 px-4 py-2 text-sm font-medium text-violet-300 hover:bg-violet-600 hover:text-white transition-all"
              >
                Ajouter votre premier produit
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/8">
            {/* Header row */}
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] items-center gap-4 border-b border-white/8 bg-white/[0.03] px-5 py-3 text-xs font-medium uppercase tracking-wide text-white/30">
              <label className="flex h-5 w-5 cursor-pointer items-center justify-center" title="Tout sélectionner (page en cours)">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  ref={el => { if (el) el.indeterminate = !allPageSelected && somePageSelected; }}
                  onChange={togglePageSelection}
                  className="h-4 w-4 cursor-pointer rounded border-white/20 bg-white/5 accent-violet-600"
                />
              </label>
              <span>Produit</span>
              <span className="hidden w-24 sm:block">Catégorie</span>
              <span className="w-24 text-right">Prix</span>
              <span className="hidden w-16 text-right sm:block">Stock</span>
              <span className="w-20 text-center">Statut</span>
              <span className="w-20 text-right">Actions</span>
            </div>

            <div className="divide-y divide-white/5">
              {pageItems.map(entry => {
                const selected = selectedIds.has(entry.tarif_id);
                const badge    = activeBadge(entry);
                return (
                  <div
                    key={entry.tarif_id}
                    className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] items-center gap-4 px-5 py-3.5 transition-colors ${
                      selected ? "bg-violet-600/10 hover:bg-violet-600/15" : "hover:bg-white/[0.02]"
                    }`}
                  >
                    <label className="flex h-5 w-5 cursor-pointer items-center justify-center">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelect(entry.tarif_id)}
                        className="h-4 w-4 cursor-pointer rounded border-white/20 bg-white/5 accent-violet-600"
                      />
                    </label>

                    {/* Produit */}
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="shrink-0 text-xl">{entry.icone}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{entry.nom}</p>
                        {badge && (
                          <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${BADGE_CONFIG[badge].chip}`}>
                            <span className={`h-1 w-1 rounded-full ${BADGE_CONFIG[badge].dot}`} />
                            {BADGE_CONFIG[badge].label}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="hidden w-24 text-xs text-white/40 sm:block">{catLabel(entry.categorie)}</span>

                    <div className="w-24 text-right">
                      <span className="text-sm font-semibold text-white">{entry.prix.toFixed(2)} €</span>
                      <span className="ml-1 text-xs text-white/30">/{entry.unite}</span>
                    </div>

                    <div className="hidden w-16 text-right sm:block">
                      {entry.stock !== null ? (
                        <span className={`text-sm font-medium ${entry.stock < 10 ? "text-amber-400" : "text-white/60"}`}>
                          {entry.stock}
                        </span>
                      ) : (
                        <span className="text-sm text-white/20">—</span>
                      )}
                    </div>

                    <div className="flex w-20 justify-center">
                      <button
                        onClick={() => handleToggle(entry)}
                        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all ${
                          entry.actif
                            ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                            : "bg-white/8 text-white/30 hover:bg-white/12"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${entry.actif ? "bg-emerald-400" : "bg-white/30"}`} />
                        {entry.actif ? "Actif" : "Inactif"}
                      </button>
                    </div>

                    <div className="flex w-20 items-center justify-end gap-1.5">
                      <button
                        onClick={() => openEdit(entry)}
                        title="Modifier"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/40 transition-colors hover:bg-violet-600/20 hover:text-violet-300"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setConfirmDelete(entry.tarif_id)}
                        title="Supprimer"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/40 transition-colors hover:bg-red-500/20 hover:text-red-400"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Pagination ─────────────────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-white/40">
              Page <span className="font-semibold text-white/70">{safePage}</span> sur {totalPages}
              {" · "}
              {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, totalFiltered)} / {totalFiltered}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
              >
                ‹
              </button>
              {getPageNumbers(safePage, totalPages).map((p, i) =>
                p === "…" ? (
                  <span key={`dots-${i}`} className="px-1.5 text-xs text-white/30">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs font-medium transition-colors ${
                      p === safePage
                        ? "border-violet-500/50 bg-violet-600 text-white"
                        : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modale ajout / édition ──────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full max-w-md rounded-2xl border border-white/12 bg-[#13132a] p-6 shadow-2xl shadow-black/50">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {editingId ? "Modifier le produit" : "Ajouter un produit"}
              </h2>
              <button onClick={closeModal} className="text-white/30 hover:text-white/60 transition-colors text-xl leading-none">✕</button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50">Nom du produit *</label>
                <input
                  value={form.nom}
                  onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  placeholder="ex : Tomates cerises"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50">Catégorie *</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, categorie: cat.id }))}
                      className={`flex flex-col items-center gap-1 rounded-xl border py-2 text-xs transition-all ${
                        form.categorie === cat.id
                          ? "border-violet-500/50 bg-violet-600/20 text-violet-300"
                          : "border-white/8 bg-white/5 text-white/40 hover:bg-white/8"
                      }`}
                    >
                      <span className="text-xl">{cat.icone}</span>
                      <span className="text-[10px] leading-tight text-center px-1">{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/50">Prix unitaire (€) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.prix}
                    onChange={e => setForm(f => ({ ...f, prix: e.target.value }))}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-white/50">Unité *</label>
                  <select
                    value={form.unite}
                    onChange={e => setForm(f => ({ ...f, unite: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-[#13132a] px-3.5 py-2.5 text-sm text-white outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                  >
                    {UNITES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/50">
                  Stock disponible <span className="text-white/25">(optionnel — laisser vide si illimité)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                  placeholder="ex : 50"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
                <div>
                  <p className="text-sm text-white/70">Visible dans le catalogue</p>
                  <p className="text-xs text-white/30">Les restaurateurs peuvent commander ce produit</p>
                </div>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, actif: !f.actif }))}
                  className={`relative h-6 w-11 rounded-full transition-colors ${form.actif ? "bg-emerald-500" : "bg-white/15"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.actif ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              {formError && (
                <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
                  {formError}
                </p>
              )}
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-white/50 transition-all hover:bg-white/8 hover:text-white/70"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-purple-400 disabled:opacity-50"
              >
                {saving ? "Enregistrement…" : editingId ? "Enregistrer" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm suppression unitaire ──────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-white/12 bg-[#13132a] p-6 text-center shadow-2xl shadow-black/50">
            <span className="text-4xl">🗑️</span>
            <h2 className="mt-3 text-lg font-bold text-white">Supprimer ce produit ?</h2>
            <p className="mt-1.5 text-sm text-white/40">
              Il sera retiré de votre mercuriale et ne sera plus visible dans le catalogue restaurateur.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-white/50 transition-all hover:bg-white/8"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 rounded-xl border border-red-500/30 bg-red-500/20 py-2.5 text-sm font-semibold text-red-400 transition-all hover:bg-red-500 hover:text-white disabled:opacity-50"
              >
                {deleting ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm actions groupées ──────────────────────────────────── */}
      {bulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !bulkProcessing && setBulkConfirm(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-white/12 bg-[#13132a] p-6 text-center shadow-2xl shadow-black/50">
            <span className="text-4xl">{bulkConfirm === "delete" ? "🗑️" : "⏸️"}</span>
            <h2 className="mt-3 text-lg font-bold text-white">
              {bulkConfirm === "delete" ? "Supprimer" : "Désactiver"} {selectedIds.size} produit{selectedIds.size > 1 ? "s" : ""} ?
            </h2>
            <p className="mt-1.5 text-sm text-white/40">
              {bulkConfirm === "delete"
                ? "Cette action est irréversible. Les produits seront retirés de votre mercuriale."
                : "Les produits ne seront plus visibles dans le catalogue restaurateur, mais restent modifiables."}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setBulkConfirm(null)}
                disabled={bulkProcessing}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-white/50 transition-all hover:bg-white/8 disabled:opacity-30"
              >
                Annuler
              </button>
              <button
                onClick={bulkConfirm === "delete" ? handleBulkDelete : handleBulkDeactivate}
                disabled={bulkProcessing}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all disabled:opacity-50 ${
                  bulkConfirm === "delete"
                    ? "border border-red-500/30 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white"
                    : "border border-white/10 bg-white/8 text-white/80 hover:bg-white/15"
                }`}
              >
                {bulkProcessing ? "Application…" : bulkConfirm === "delete" ? "Supprimer" : "Désactiver"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
