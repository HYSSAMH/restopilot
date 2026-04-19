"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/admin/AdminLayout";
import { createClient } from "@/lib/supabase/client";

interface FullProfile {
  id: string;
  role: "restaurateur" | "fournisseur" | "admin";
  email: string;
  nom_etablissement: string;
  nom_commercial: string | null;
  raison_sociale: string | null;
  siret: string | null;
  prenom: string | null;
  nom: string | null;
  adresse_ligne1: string | null;
  adresse_ligne2: string | null;
  code_postal: string | null;
  ville: string | null;
  telephone: string | null;
  email_contact: string | null;
  iban: string | null;
  bic: string | null;
  zone_livraison: string | null;
  montant_minimum_commande: number | null;
  horaires_livraison: string | null;
  actif: boolean | null;
  notes_admin: string | null;
  created_at: string | null;
}

const inputCls =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-[#1A1A2E] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60";

function Field({ label, children, span2 }: { label: string; children: React.ReactNode; span2?: boolean }) {
  return (
    <div className={span2 ? "sm:col-span-2" : ""}>
      <label className="mb-1.5 block text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-base font-semibold text-[#1A1A2E]">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export default function AdminUserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [p, setP] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [nbCommandes, setNbCommandes] = useState(0);
  const [volumeTotal, setVolumeTotal] = useState(0);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
      if (data) setP(data as FullProfile);

      // Stats commandes (suivant le rôle)
      const col = data?.role === "restaurateur" ? "restaurateur_id" : "fournisseur_id";
      const { data: cmds } = await supabase
        .from("commandes")
        .select("id, montant_total, statut")
        .eq(col, id);
      setNbCommandes((cmds ?? []).length);
      setVolumeTotal((cmds ?? []).filter(c => c.statut !== "annulee").reduce((s, c) => s + Number(c.montant_total), 0));

      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  function update<K extends keyof FullProfile>(key: K, value: FullProfile[K]) {
    setP(prev => prev ? { ...prev, [key]: value } : prev);
  }

  async function handleSave() {
    if (!p) return;
    setSaving(true); setToast(null);
    const supabase = createClient();
    const payload: Partial<FullProfile> = {
      nom_commercial:    p.nom_commercial,
      raison_sociale:    p.raison_sociale,
      siret:             p.siret?.replace(/\s/g, "") || null,
      prenom:            p.prenom,
      nom:               p.nom,
      adresse_ligne1:    p.adresse_ligne1,
      adresse_ligne2:    p.adresse_ligne2,
      code_postal:       p.code_postal,
      ville:             p.ville,
      telephone:         p.telephone,
      email_contact:     p.email_contact,
      notes_admin:       p.notes_admin,
      actif:             p.actif,
    };
    if (p.role === "fournisseur") {
      Object.assign(payload, {
        iban:                       p.iban?.replace(/\s/g, "") || null,
        bic:                        p.bic,
        zone_livraison:             p.zone_livraison,
        montant_minimum_commande:   p.montant_minimum_commande,
        horaires_livraison:         p.horaires_livraison,
      });
    }
    const { error } = await supabase.from("profiles").update(payload).eq("id", p.id);
    if (error) {
      console.error("[admin] save failed", error);
      setToast({ type: "error", msg: `Erreur : ${error.message}` });
      setSaving(false);
      return;
    }
    // Sync fournisseurs.nom si applicable
    if (p.role === "fournisseur" && p.montant_minimum_commande !== null) {
      await supabase.from("fournisseurs").update({ minimum: p.montant_minimum_commande }).eq("id", p.id);
    }
    setToast({ type: "success", msg: "Profil enregistré ✓" });
    setSaving(false);
  }

  async function toggleActif() {
    if (!p) return;
    const next = !(p.actif ?? true);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ actif: next }).eq("id", p.id);
    if (error) { setToast({ type: "error", msg: error.message }); return; }
    setP({ ...p, actif: next });
    setToast({ type: "success", msg: next ? "Compte activé" : "Compte désactivé" });
  }

  async function handleDelete() {
    if (!p) return;
    if (!confirm(`Supprimer définitivement ${p.nom_commercial || p.email} ? Cette action est irréversible.`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("profiles").delete().eq("id", p.id);
    if (error) { setToast({ type: "error", msg: error.message }); return; }
    // Note : supprime seulement le profile. Pour supprimer l'user auth.users,
    // il faut passer par l'API admin avec service_role (TODO MVP+).
    router.push("/admin/users");
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-8">
          <div className="h-64 animate-pulse rounded-2xl border border-gray-200 bg-white" />
        </div>
      </AdminLayout>
    );
  }

  if (!p) {
    return (
      <AdminLayout>
        <div className="mx-auto max-w-4xl px-4 py-10 text-center sm:px-8">
          <p className="text-gray-500">Utilisateur introuvable.</p>
          <Link href="/admin/users" className="mt-3 inline-block text-indigo-500 hover:text-indigo-600">
            ← Retour à la liste
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const displayName = p.nom_commercial || p.nom_etablissement || p.email;
  const isFour = p.role === "fournisseur";
  const isResto = p.role === "restaurateur";
  const isActive = p.actif !== false;

  return (
    <AdminLayout>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-8 sm:py-10">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
          <Link href="/admin/users" className="hover:text-gray-600">Utilisateurs</Link>
          <span>/</span>
          <span className="text-gray-600">{displayName}</span>
        </div>

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-lg font-bold text-white">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold text-[#1A1A2E]">{displayName}</h1>
                <p className="truncate text-sm text-gray-500">{p.email}</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {isFour && (
              <Link
                href={`/dashboard/fournisseur/mercuriale?as=${p.id}`}
                className="min-h-[44px] rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-600 hover:bg-indigo-100"
              >
                Ouvrir sa mercuriale →
              </Link>
            )}
            <button
              onClick={toggleActif}
              className={`min-h-[44px] rounded-xl border px-4 py-2.5 text-sm font-medium ${
                isActive
                  ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              {isActive ? "Désactiver le compte" : "Réactiver le compte"}
            </button>
          </div>
        </div>

        {/* Stats compte */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <InfoCard label="Rôle" value={p.role === "fournisseur" ? "Distributeur" : p.role === "restaurateur" ? "Restaurateur" : "Admin"} />
          <InfoCard label="Inscrit le" value={p.created_at ? new Date(p.created_at).toLocaleDateString("fr-FR") : "—"} />
          <InfoCard label={isFour ? "Commandes reçues" : "Commandes passées"} value={nbCommandes.toString()} />
          <InfoCard
            label="Volume total"
            value={volumeTotal.toLocaleString("fr-FR", { minimumFractionDigits: 2 }) + " €"}
          />
        </div>

        <div className="flex flex-col gap-5">
          {/* Identité */}
          <Section title="Identité">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom commercial">
                <input className={inputCls} value={p.nom_commercial ?? ""} onChange={e => update("nom_commercial", e.target.value)} />
              </Field>
              <Field label="Raison sociale">
                <input className={inputCls} value={p.raison_sociale ?? ""} onChange={e => update("raison_sociale", e.target.value)} />
              </Field>
              <Field label="SIRET (14 chiffres)">
                <input className={inputCls + " font-mono"} value={p.siret ?? ""} onChange={e => update("siret", e.target.value.replace(/[^\d\s]/g, ""))} />
              </Field>
              <Field label="Nom de l'établissement">
                <input className={inputCls} value={p.nom_etablissement ?? ""} onChange={e => update("nom_etablissement", e.target.value)} />
              </Field>
              <Field label="Prénom">
                <input className={inputCls} value={p.prenom ?? ""} onChange={e => update("prenom", e.target.value)} />
              </Field>
              <Field label="Nom">
                <input className={inputCls} value={p.nom ?? ""} onChange={e => update("nom", e.target.value)} />
              </Field>
            </div>
          </Section>

          {/* Contact */}
          <Section title="Contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Téléphone">
                <input className={inputCls} value={p.telephone ?? ""} onChange={e => update("telephone", e.target.value)} />
              </Field>
              <Field label="Email de contact">
                <input type="email" className={inputCls} value={p.email_contact ?? ""} onChange={e => update("email_contact", e.target.value)} />
              </Field>
            </div>
          </Section>

          {/* Adresse */}
          <Section title="Adresse">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Rue & numéro" span2>
                <input className={inputCls} value={p.adresse_ligne1 ?? ""} onChange={e => update("adresse_ligne1", e.target.value)} />
              </Field>
              <Field label="Complément">
                <input className={inputCls} value={p.adresse_ligne2 ?? ""} onChange={e => update("adresse_ligne2", e.target.value)} />
              </Field>
              <Field label="Code postal / Ville">
                <div className="flex gap-2">
                  <input className={inputCls + " w-24"} value={p.code_postal ?? ""} onChange={e => update("code_postal", e.target.value)} />
                  <input className={inputCls} value={p.ville ?? ""} onChange={e => update("ville", e.target.value)} />
                </div>
              </Field>
            </div>
          </Section>

          {/* Fournisseur-only */}
          {isFour && (
            <>
              <Section title="Coordonnées bancaires">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="IBAN">
                    <input className={inputCls + " font-mono"} value={p.iban ?? ""} onChange={e => update("iban", e.target.value.toUpperCase())} />
                  </Field>
                  <Field label="BIC">
                    <input className={inputCls + " font-mono"} value={p.bic ?? ""} onChange={e => update("bic", e.target.value.toUpperCase())} />
                  </Field>
                </div>
              </Section>
              <Section title="Livraison">
                <Field label="Zone de livraison">
                  <input className={inputCls} placeholder="ex : Paris, 92, 93, 94" value={p.zone_livraison ?? ""} onChange={e => update("zone_livraison", e.target.value)} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Minimum de commande (€)">
                    <input type="number" min="0" className={inputCls} value={p.montant_minimum_commande ?? ""} onChange={e => update("montant_minimum_commande", e.target.value ? parseFloat(e.target.value) : null)} />
                  </Field>
                  <Field label="Horaires de livraison">
                    <input className={inputCls} placeholder="ex : Lun-Ven 8h-17h" value={p.horaires_livraison ?? ""} onChange={e => update("horaires_livraison", e.target.value)} />
                  </Field>
                </div>
              </Section>
            </>
          )}

          {/* Notes admin */}
          <Section title="Notes internes (visibles uniquement par les admins)">
            <textarea
              className={inputCls + " min-h-[100px]"}
              placeholder="ex : client VIP, à rappeler, problème paiement…"
              value={p.notes_admin ?? ""}
              onChange={e => update("notes_admin", e.target.value)}
            />
          </Section>

          {/* Liens directs */}
          {(isFour || isResto) && (
            <Section title="Raccourcis">
              <div className="flex flex-wrap gap-2">
                {isFour && (
                  <Link
                    href={`/dashboard/fournisseur/mercuriale?as=${p.id}`}
                    className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-[#1A1A2E] hover:border-indigo-300 hover:text-indigo-600"
                  >
                    Gérer sa mercuriale
                  </Link>
                )}
                <Link
                  href={`/admin/commandes?user=${p.id}`}
                  className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-[#1A1A2E] hover:border-indigo-300 hover:text-indigo-600"
                >
                  Voir ses commandes
                </Link>
              </div>
            </Section>
          )}

          {/* Save bar */}
          <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-3 shadow-lg">
            <p className="text-xs text-gray-500">
              Vos modifications s&apos;appliqueront au profil de cet utilisateur.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                className="min-h-[44px] rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100"
              >
                Supprimer le profil
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="min-h-[44px] rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-600 disabled:opacity-50"
              >
                {saving ? "Sauvegarde…" : "Sauvegarder"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 max-w-xs rounded-2xl border px-4 py-3 shadow-2xl ${
          toast.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-red-200 bg-red-50 text-red-700"
        }`}>
          <p className="text-sm font-medium">{toast.msg}</p>
        </div>
      )}
    </AdminLayout>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#1A1A2E]">{value}</p>
    </div>
  );
}
