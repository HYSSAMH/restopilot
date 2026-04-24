"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth/use-profile";

type Employe = {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  actif: boolean | null;
  created_at: string | null;
  last_sign_in_at: string | null;
};

export default function EquipePage() {
  const { profile } = useProfile();
  const supa = useMemo(() => createClient(), []);

  const [employes, setEmployes]   = useState<Employe[]>([]);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState<string | null>(null);

  // Formulaire création
  const [prenom, setPrenom]       = useState("");
  const [nom, setNom]             = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [creating, setCreating]   = useState(false);
  const [created, setCreated]     = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    setErr(null);
    // Passe par l'API service_role : la RLS profiles ne laisse plus le
    // patron voir les lignes de ses employés depuis le client anon.
    try {
      const res = await fetch("/api/employees");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
      setEmployes((json.employes ?? []) as Employe[]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur de chargement");
    }
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { load(); }, [load]);

  function generatePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let out = "";
    for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
    setPassword(out);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setCreated(null);
    if (!prenom.trim() || !nom.trim()) { setErr("Prénom et nom requis."); return; }
    if (!email.trim())                 { setErr("Email requis."); return; }
    if (password.length < 8)           { setErr("Mot de passe : 8 caractères minimum."); return; }

    setCreating(true);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prenom, nom, email, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Création échouée.");
      setCreated(`Compte créé pour ${prenom} ${nom}. Transmettez le mot de passe : ${password}`);
      setPrenom(""); setNom(""); setEmail(""); setPassword("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur inconnue.");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActif(emp: Employe) {
    const next = !emp.actif;
    const res = await fetch(`/api/employees/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actif: next }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(json?.error ?? "Mise à jour échouée."); return; }
    setEmployes((prev) => prev.map((e) => (e.id === emp.id ? { ...e, actif: next } : e)));
  }

  async function handleDelete(emp: Employe) {
    if (!confirm(`Supprimer définitivement le compte de ${emp.prenom} ${emp.nom} ? Cette action est irréversible.`)) return;
    setErr(null);
    const res = await fetch(`/api/employees/${emp.id}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(json?.error ?? "Suppression échouée."); return; }
    setEmployes((prev) => prev.filter((e) => e.id !== emp.id));
  }

  return (
    <DashboardLayout role="restaurateur">
        <header className="mb-6">
          <h1 className="page-title">Mon équipe</h1>
          <p className="page-sub">
            Créez des comptes pour vos salariés — ils accèdent uniquement à la saisie du chiffre d&apos;affaires.
          </p>
        </header>

        {/* Formulaire création */}
        <form
          onSubmit={handleCreate}
          className="mb-8 rounded-[10px] border border-[var(--border)] bg-white p-6 shadow-sm"
        >
          <h2 className="text-[18px] font-[650] tracking-[-0.01em] text-[var(--text)]">Nouvel employé</h2>
          <p className="mt-1 text-xs text-gray-500">
            Un email unique et un mot de passe temporaire — le salarié pourra le changer après connexion.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="emp-prenom" className="text-xs font-medium text-gray-600">Prénom</label>
              <input
                id="emp-prenom" name="prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)] focus:border-indigo-400 focus:outline-none"
                placeholder="Marie"
              />
            </div>
            <div>
              <label htmlFor="emp-nom" className="text-xs font-medium text-gray-600">Nom</label>
              <input
                id="emp-nom" name="nom" value={nom} onChange={(e) => setNom(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)] focus:border-indigo-400 focus:outline-none"
                placeholder="Durand"
              />
            </div>
            <div>
              <label htmlFor="emp-email" className="text-xs font-medium text-gray-600">Email</label>
              <input
                id="emp-email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)] focus:border-indigo-400 focus:outline-none"
                placeholder="marie@exemple.com"
              />
            </div>
            <div>
              <label htmlFor="emp-password" className="text-xs font-medium text-gray-600">Mot de passe temporaire</label>
              <div className="mt-1 flex gap-2">
                <input
                  id="emp-password" name="password" type="text" value={password} onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)] focus:border-indigo-400 focus:outline-none"
                  placeholder="8 caractères minimum"
                />
                <button
                  type="button" onClick={generatePassword}
                  className="rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-gray-600 hover:border-indigo-300 hover:text-[var(--accent)]"
                >
                  Générer
                </button>
              </div>
            </div>
          </div>
          {err && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>
          )}
          {created && (
            <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{created}</p>
          )}
          <div className="mt-4 flex justify-end">
            <button
              type="submit" disabled={creating}
              className="rounded-[8px] bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-indigo-500/20 transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              {creating ? "Création…" : "Créer le compte"}
            </button>
          </div>
        </form>

        {/* Liste */}
        <div className="rounded-[10px] border border-[var(--border)] bg-white shadow-sm">
          <div className="border-b border-[var(--border)] px-6 py-4">
            <h2 className="text-[18px] font-[650] tracking-[-0.01em] text-[var(--text)]">
              Employés ({employes.length})
            </h2>
          </div>
          {loading ? (
            <p className="p-6 text-sm text-gray-500">Chargement…</p>
          ) : employes.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">Aucun employé pour le moment.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {employes.map((emp) => (
                <li key={emp.id} className="flex flex-wrap items-center gap-3 px-6 py-4">
                  <div className="flex-1 min-w-[220px]">
                    <p className="text-sm font-medium text-[var(--text)]">
                      {emp.prenom} {emp.nom}
                    </p>
                    <p className="text-xs text-gray-500">{emp.email}</p>
                    <p className="mt-0.5 text-[11px] text-gray-400">
                      Créé le {emp.created_at ? new Date(emp.created_at).toLocaleDateString("fr-FR") : "—"}
                      {" · "}
                      {emp.last_sign_in_at
                        ? `Dernière connexion : ${new Date(emp.last_sign_in_at).toLocaleDateString("fr-FR")}`
                        : "Jamais connecté"}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    emp.actif
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-[var(--bg-subtle)] text-gray-500"
                  }`}>
                    {emp.actif ? "Actif" : "Inactif"}
                  </span>
                  <button
                    onClick={() => handleToggleActif(emp)}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-indigo-300 hover:text-[var(--accent)]"
                  >
                    {emp.actif ? "Désactiver" : "Réactiver"}
                  </button>
                  <button
                    onClick={async () => {
                      const newPrenom = prompt("Prénom :", emp.prenom ?? "");
                      if (newPrenom == null) return;
                      const newNom = prompt("Nom :", emp.nom ?? "");
                      if (newNom == null) return;
                      const res = await fetch(`/api/employees/${emp.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ prenom: newPrenom, nom: newNom }),
                      });
                      const json = await res.json().catch(() => ({}));
                      if (!res.ok) { setErr(json?.error ?? "Mise à jour échouée."); return; }
                      await load();
                    }}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-indigo-300 hover:text-[var(--accent)]"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => handleDelete(emp)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
    </DashboardLayout>
  );
}
