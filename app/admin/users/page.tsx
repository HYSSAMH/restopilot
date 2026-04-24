"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/admin/AdminLayout";
import { createClient } from "@/lib/supabase/client";

interface Row {
  id: string;
  role: "restaurateur" | "fournisseur" | "admin";
  nom_etablissement: string;
  nom_commercial: string | null;
  email: string;
  prenom: string | null;
  nom: string | null;
  actif: boolean | null;
  created_at: string | null;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function roleBadge(role: Row["role"]) {
  const cfg: Record<Row["role"], string> = {
    restaurateur: "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]",
    fournisseur:  "border-emerald-200 bg-emerald-50 text-emerald-600",
    admin:        "border-rose-200 bg-rose-50 text-rose-600",
  };
  const label: Record<Row["role"], string> = {
    restaurateur: "Restaurateur",
    fournisseur:  "Distributeur",
    admin:        "Admin",
  };
  return <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cfg[role]}`}>{label[role]}</span>;
}

export default function UsersListPage() {
  const [rows, setRows]         = useState<Row[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [roleFilter, setRoleF]  = useState<"tous" | Row["role"]>("tous");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("id, role, nom_etablissement, nom_commercial, email, prenom, nom, actif, created_at")
        .order("created_at", { ascending: false });
      if (data) setRows(data as Row[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    let arr = rows;
    if (roleFilter !== "tous") arr = arr.filter(r => r.role === roleFilter);
    if (search) {
      const s = search.toLowerCase();
      arr = arr.filter(r =>
        r.email.toLowerCase().includes(s) ||
        r.nom_etablissement?.toLowerCase().includes(s) ||
        r.nom_commercial?.toLowerCase().includes(s) ||
        r.prenom?.toLowerCase().includes(s) ||
        r.nom?.toLowerCase().includes(s),
      );
    }
    return arr;
  }, [rows, roleFilter, search]);

  return (
    <AdminLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--text)]">Utilisateurs</h1>
          <p className="mt-1 text-sm text-gray-500">
            {rows.length} compte{rows.length > 1 ? "s" : ""} au total.
          </p>
        </div>

        {/* Filtres */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou email…"
            className="flex-1 min-w-48 rounded-[8px] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:shadow-[0_0_0_3px_var(--accent-soft)]"
          />
          <div className="flex gap-1 rounded-[8px] border border-[var(--border)] bg-white p-1">
            {([
              { id: "tous",         label: "Tous"          },
              { id: "restaurateur", label: "Restaurateurs" },
              { id: "fournisseur",  label: "Distributeurs" },
              { id: "admin",        label: "Admins"        },
            ] as const).map(f => (
              <button
                key={f.id}
                onClick={() => setRoleF(f.id)}
                className={`min-h-[40px] rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  roleFilter === f.id
                    ? "bg-[var(--accent)] text-white"
                    : "text-gray-500 hover:text-[var(--text)]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Liste */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-[10px] border border-[var(--border)] bg-white" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[10px] border border-[var(--border)] bg-white py-20 text-center text-gray-500">
            Aucun utilisateur ne correspond.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[10px] border border-[var(--border)] bg-white shadow-sm">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)] text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="px-5 py-3 text-left">Utilisateur</th>
                  <th className="px-5 py-3 text-left">Email</th>
                  <th className="px-5 py-3 text-left">Rôle</th>
                  <th className="px-5 py-3 text-left">Inscrit le</th>
                  <th className="px-5 py-3 text-left">Statut</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => {
                  const display = r.nom_commercial || r.nom_etablissement;
                  const active = r.actif !== false;
                  return (
                    <tr key={r.id} className="hover:bg-[var(--bg-subtle)]">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-xs font-bold text-white">
                            {(display || r.email).charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[var(--text)]">{display}</p>
                            {(r.prenom || r.nom) && (
                              <p className="truncate text-[11px] text-gray-500">{[r.prenom, r.nom].filter(Boolean).join(" ")}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{r.email}</td>
                      <td className="px-5 py-3">{roleBadge(r.role)}</td>
                      <td className="px-5 py-3 text-gray-500">{fmtDate(r.created_at)}</td>
                      <td className="px-5 py-3">
                        <span className={`flex w-fit items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                          active ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-[var(--border)] bg-[var(--bg-subtle)] text-gray-500"
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-gray-400"}`} />
                          {active ? "Actif" : "Désactivé"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/admin/users/${r.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:border-indigo-300 hover:text-[var(--accent)]"
                        >
                          Gérer →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
