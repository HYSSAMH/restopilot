"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/dashboard/Navbar";
import AddressAutocomplete from "@/components/profile/AddressAutocomplete";
import SiretInput from "@/components/profile/SiretInput";
import LogoUpload from "@/components/profile/LogoUpload";
import { createClient } from "@/lib/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────────

type Role = "restaurateur" | "fournisseur";

interface ProfileData {
  id: string;
  role: Role;
  email: string;
  nom_etablissement: string;
  prenom: string | null;
  nom: string | null;

  // Commun
  nom_commercial:  string | null;
  raison_sociale:  string | null;
  siret:           string | null;
  adresse_ligne1:  string | null;
  adresse_ligne2:  string | null;
  code_postal:     string | null;
  ville:           string | null;
  telephone:       string | null;
  email_contact:   string | null;
  logo_url:        string | null;

  // Restaurateur
  adresse_livraison_ligne1: string | null;
  adresse_livraison_ligne2: string | null;
  adresse_livraison_cp:     string | null;
  adresse_livraison_ville:  string | null;
  type_restaurant:          string | null;
  nombre_couverts:          number | null;

  // Fournisseur
  adresse_facturation_ligne1: string | null;
  adresse_facturation_ligne2: string | null;
  adresse_facturation_cp:     string | null;
  adresse_facturation_ville:  string | null;
  iban:                       string | null;
  bic:                        string | null;
  zone_livraison:             string | null;
  montant_minimum_commande:   number | null;
  jours_livraison:            string[] | null;
  horaires_livraison:         string | null;
}

const TYPES_RESTAURANT = [
  "Brasserie", "Bistrot", "Gastronomique", "Fast-food", "Pizzeria",
  "Asiatique", "Boulangerie", "Café", "Food truck", "Traiteur", "Autre",
];

const JOURS = ["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];

// ── Helpers UI ──────────────────────────────────────────────────────────────

function Section({ title, children, description }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-6">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-white/40">{description}</p>}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function Field({ label, children, span2 }: { label: string; children: React.ReactNode; span2?: boolean }) {
  return (
    <div className={span2 ? "sm:col-span-2" : ""}>
      <label className="mb-1.5 block text-xs font-medium text-white/60">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-white/25 outline-none focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 disabled:opacity-60";

// ── Page ───────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const [p, setP]             = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // ── Load profile ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("profiles").select("*").eq("id", user.id).maybeSingle();

      if (data) {
        setP({ ...data, email: user.email ?? "" } as ProfileData);
      }
      setLoading(false);
    })();
  }, []);

  // ── Auto-dismiss toast ──────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Updaters ────────────────────────────────────────────────────────────
  const update = useCallback(<K extends keyof ProfileData>(key: K, value: ProfileData[K]) => {
    setP((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  // ── Save ────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!p) return;
    setSaving(true); setToast(null);

    // Validation minimale
    if (p.siret && !/^\d{14}$/.test(p.siret.replace(/\s/g, ""))) {
      setToast({ type: "error", msg: "SIRET invalide (14 chiffres requis)." });
      setSaving(false);
      return;
    }

    const supabase = createClient();

    const payload: Partial<ProfileData> = {
      nom_commercial:    p.nom_commercial,
      raison_sociale:    p.raison_sociale,
      siret:             p.siret?.replace(/\s/g, "") || null,
      adresse_ligne1:    p.adresse_ligne1,
      adresse_ligne2:    p.adresse_ligne2,
      code_postal:       p.code_postal,
      ville:             p.ville,
      telephone:         p.telephone,
      email_contact:     p.email_contact,
      logo_url:          p.logo_url,
    };

    if (p.role === "restaurateur") {
      Object.assign(payload, {
        adresse_livraison_ligne1: p.adresse_livraison_ligne1,
        adresse_livraison_ligne2: p.adresse_livraison_ligne2,
        adresse_livraison_cp:     p.adresse_livraison_cp,
        adresse_livraison_ville:  p.adresse_livraison_ville,
        type_restaurant:          p.type_restaurant,
        nombre_couverts:          p.nombre_couverts,
      });
    } else {
      Object.assign(payload, {
        adresse_facturation_ligne1: p.adresse_facturation_ligne1,
        adresse_facturation_ligne2: p.adresse_facturation_ligne2,
        adresse_facturation_cp:     p.adresse_facturation_cp,
        adresse_facturation_ville:  p.adresse_facturation_ville,
        iban:                       p.iban?.replace(/\s/g, "") || null,
        bic:                        p.bic || null,
        zone_livraison:             p.zone_livraison,
        montant_minimum_commande:   p.montant_minimum_commande,
        jours_livraison:            p.jours_livraison,
        horaires_livraison:         p.horaires_livraison,
      });
    }

    const { error } = await supabase.from("profiles").update(payload).eq("id", p.id);

    if (error) {
      console.error("[profile] update failed", error);
      setToast({ type: "error", msg: `Sauvegarde échouée : ${error.message}` });
      setSaving(false);
      return;
    }

    // Pour un fournisseur, on synchronise aussi fournisseurs.minimum (utilisé par le catalogue)
    if (p.role === "fournisseur" && p.montant_minimum_commande !== null) {
      await supabase.from("fournisseurs")
        .update({ minimum: p.montant_minimum_commande })
        .eq("id", p.id);
    }

    setToast({ type: "success", msg: "Profil enregistré avec succès ✓" });
    setSaving(false);
  }

  // ── Rendering ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d1a]">
        <Navbar />
        <div className="mx-auto max-w-3xl px-6 py-10">
          <div className="h-64 animate-pulse rounded-2xl border border-white/8 bg-white/5" />
        </div>
      </div>
    );
  }

  if (!p) {
    return (
      <div className="min-h-screen bg-[#0d0d1a]">
        <Navbar />
        <div className="mx-auto max-w-3xl px-6 py-10 text-center">
          <p className="text-white/50">Session introuvable.</p>
          <Link href="/login" className="mt-4 inline-block text-violet-400 hover:text-violet-300">Se reconnecter</Link>
        </div>
      </div>
    );
  }

  const backHref = `/dashboard/${p.role}`;
  const isFour   = p.role === "fournisseur";

  return (
    <div className="min-h-screen bg-[#0d0d1a]">
      <Navbar role={p.role} />

      <div className="mx-auto max-w-3xl px-6 py-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-white/30">
          <Link href={backHref} className="hover:text-white/60">Dashboard</Link>
          <span>/</span>
          <span className="text-white/60">Mon profil</span>
        </div>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Mon profil</h1>
          <p className="mt-1 text-sm text-white/40">
            Ces informations sont utilisées pour pré-remplir les factures et la facturation.
          </p>
        </div>

        <div className="flex flex-col gap-5">
          {/* ── Identité & contact ─────────────────────────────────── */}
          <Section title="Identité" description="Informations légales et commerciales de votre établissement.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom commercial / Enseigne">
                <input
                  className={inputCls}
                  placeholder="ex : Le Bistrot Parisien"
                  value={p.nom_commercial ?? ""}
                  onChange={(e) => update("nom_commercial", e.target.value)}
                />
              </Field>
              <Field label="Raison sociale">
                <input
                  className={inputCls}
                  placeholder="ex : SARL BISTROT PARISIEN"
                  value={p.raison_sociale ?? ""}
                  onChange={(e) => update("raison_sociale", e.target.value)}
                />
              </Field>
              <Field label="" span2>
                <SiretInput
                  value={p.siret ?? ""}
                  onChange={(v) => update("siret", v)}
                  onCompanyFound={(raison) => {
                    if (!p.raison_sociale) update("raison_sociale", raison);
                  }}
                />
              </Field>
            </div>
          </Section>

          {/* ── Contact ────────────────────────────────────────────── */}
          <Section title="Contact">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Téléphone principal">
                <input
                  className={inputCls}
                  placeholder="01 23 45 67 89"
                  value={p.telephone ?? ""}
                  onChange={(e) => update("telephone", e.target.value)}
                />
              </Field>
              <Field label="Email de contact">
                <input
                  type="email"
                  className={inputCls}
                  placeholder="contact@etablissement.fr"
                  value={p.email_contact ?? ""}
                  onChange={(e) => update("email_contact", e.target.value)}
                />
                <p className="mt-1 text-[11px] text-white/30">Email de connexion : {p.email}</p>
              </Field>
            </div>
          </Section>

          {/* ── Adresse principale ─────────────────────────────────── */}
          <Section title="Adresse principale" description="Commencez à taper pour voir les suggestions.">
            <AddressAutocomplete
              label="Rue & numéro"
              value={p.adresse_ligne1 ?? ""}
              onChange={(v) => update("adresse_ligne1", v)}
              onSelect={(a) => {
                update("adresse_ligne1", a.line1);
                update("code_postal",   a.cp);
                update("ville",         a.ville);
              }}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Complément (optionnel)">
                <input
                  className={inputCls}
                  placeholder="ex : Bâtiment B"
                  value={p.adresse_ligne2 ?? ""}
                  onChange={(e) => update("adresse_ligne2", e.target.value)}
                />
              </Field>
              <Field label="Code postal">
                <input
                  className={inputCls}
                  value={p.code_postal ?? ""}
                  onChange={(e) => update("code_postal", e.target.value)}
                />
              </Field>
              <Field label="Ville">
                <input
                  className={inputCls}
                  value={p.ville ?? ""}
                  onChange={(e) => update("ville", e.target.value)}
                />
              </Field>
            </div>
          </Section>

          {/* ── Logo ───────────────────────────────────────────────── */}
          <Section title="Logo" description="Affiché sur les factures et les commandes.">
            <LogoUpload
              userId={p.id}
              currentUrl={p.logo_url}
              onUploaded={(url) => update("logo_url", url)}
            />
          </Section>

          {/* ── Sections rôle-spécifiques ──────────────────────────── */}
          {!isFour ? (
            <>
              <Section title="Adresse de livraison" description="Si différente de l'adresse principale.">
                <AddressAutocomplete
                  label="Rue & numéro"
                  value={p.adresse_livraison_ligne1 ?? ""}
                  onChange={(v) => update("adresse_livraison_ligne1", v)}
                  onSelect={(a) => {
                    update("adresse_livraison_ligne1", a.line1);
                    update("adresse_livraison_cp",     a.cp);
                    update("adresse_livraison_ville",  a.ville);
                  }}
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Complément">
                    <input
                      className={inputCls}
                      value={p.adresse_livraison_ligne2 ?? ""}
                      onChange={(e) => update("adresse_livraison_ligne2", e.target.value)}
                    />
                  </Field>
                  <Field label="Code postal">
                    <input
                      className={inputCls}
                      value={p.adresse_livraison_cp ?? ""}
                      onChange={(e) => update("adresse_livraison_cp", e.target.value)}
                    />
                  </Field>
                  <Field label="Ville">
                    <input
                      className={inputCls}
                      value={p.adresse_livraison_ville ?? ""}
                      onChange={(e) => update("adresse_livraison_ville", e.target.value)}
                    />
                  </Field>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    update("adresse_livraison_ligne1", p.adresse_ligne1);
                    update("adresse_livraison_ligne2", p.adresse_ligne2);
                    update("adresse_livraison_cp",     p.code_postal);
                    update("adresse_livraison_ville",  p.ville);
                  }}
                  className="self-start text-xs text-violet-400 underline-offset-2 hover:text-violet-300 hover:underline"
                >
                  Copier depuis l&apos;adresse principale
                </button>
              </Section>

              <Section title="Restaurant">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Type de restaurant">
                    <select
                      className={inputCls + " bg-[#13132a]"}
                      value={p.type_restaurant ?? ""}
                      onChange={(e) => update("type_restaurant", e.target.value || null)}
                    >
                      <option value="">— Sélectionner —</option>
                      {TYPES_RESTAURANT.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Nombre de couverts">
                    <input
                      type="number" min="0"
                      className={inputCls}
                      placeholder="ex : 40"
                      value={p.nombre_couverts ?? ""}
                      onChange={(e) => update("nombre_couverts", e.target.value ? parseInt(e.target.value, 10) : null)}
                    />
                  </Field>
                </div>
              </Section>
            </>
          ) : (
            <>
              <Section title="Adresse de facturation" description="Si différente de l'adresse principale.">
                <AddressAutocomplete
                  label="Rue & numéro"
                  value={p.adresse_facturation_ligne1 ?? ""}
                  onChange={(v) => update("adresse_facturation_ligne1", v)}
                  onSelect={(a) => {
                    update("adresse_facturation_ligne1", a.line1);
                    update("adresse_facturation_cp",     a.cp);
                    update("adresse_facturation_ville",  a.ville);
                  }}
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Complément">
                    <input
                      className={inputCls}
                      value={p.adresse_facturation_ligne2 ?? ""}
                      onChange={(e) => update("adresse_facturation_ligne2", e.target.value)}
                    />
                  </Field>
                  <Field label="Code postal">
                    <input
                      className={inputCls}
                      value={p.adresse_facturation_cp ?? ""}
                      onChange={(e) => update("adresse_facturation_cp", e.target.value)}
                    />
                  </Field>
                  <Field label="Ville">
                    <input
                      className={inputCls}
                      value={p.adresse_facturation_ville ?? ""}
                      onChange={(e) => update("adresse_facturation_ville", e.target.value)}
                    />
                  </Field>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    update("adresse_facturation_ligne1", p.adresse_ligne1);
                    update("adresse_facturation_ligne2", p.adresse_ligne2);
                    update("adresse_facturation_cp",     p.code_postal);
                    update("adresse_facturation_ville",  p.ville);
                  }}
                  className="self-start text-xs text-violet-400 underline-offset-2 hover:text-violet-300 hover:underline"
                >
                  Copier depuis l&apos;adresse principale
                </button>
              </Section>

              <Section title="Coordonnées bancaires" description="Nécessaires pour recevoir les paiements.">
                <Field label="IBAN">
                  <input
                    className={inputCls + " font-mono tracking-wider"}
                    placeholder="FR76 1234 5678 9012 3456 7890 123"
                    value={p.iban ?? ""}
                    onChange={(e) => update("iban", e.target.value.toUpperCase())}
                  />
                </Field>
                <Field label="BIC / SWIFT">
                  <input
                    className={inputCls + " font-mono tracking-wider"}
                    placeholder="BNPAFRPPXXX"
                    value={p.bic ?? ""}
                    onChange={(e) => update("bic", e.target.value.toUpperCase())}
                  />
                </Field>
              </Section>

              <Section title="Livraison">
                <Field label="Zone de livraison">
                  <input
                    className={inputCls}
                    placeholder="ex : Paris, 92, 93, 94 ou Île-de-France"
                    value={p.zone_livraison ?? ""}
                    onChange={(e) => update("zone_livraison", e.target.value)}
                  />
                </Field>
                <Field label="Montant minimum de commande (€)">
                  <input
                    type="number" min="0" step="1"
                    className={inputCls}
                    placeholder="ex : 100"
                    value={p.montant_minimum_commande ?? ""}
                    onChange={(e) => update("montant_minimum_commande", e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </Field>
                <Field label="Jours de livraison">
                  <div className="flex flex-wrap gap-1.5">
                    {JOURS.map(j => {
                      const selected = p.jours_livraison?.includes(j) ?? false;
                      return (
                        <button
                          key={j}
                          type="button"
                          onClick={() => {
                            const cur = p.jours_livraison ?? [];
                            update("jours_livraison", selected ? cur.filter(x => x !== j) : [...cur, j]);
                          }}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                            selected
                              ? "bg-violet-600 text-white"
                              : "border border-white/10 bg-white/5 text-white/50 hover:text-white/80"
                          }`}
                        >
                          {j}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Horaires de livraison (texte libre)">
                  <input
                    className={inputCls}
                    placeholder="ex : 08h00 – 12h00"
                    value={p.horaires_livraison ?? ""}
                    onChange={(e) => update("horaires_livraison", e.target.value)}
                  />
                </Field>
              </Section>
            </>
          )}

          {/* ── Save bar ───────────────────────────────────────────── */}
          <div className="sticky bottom-4 z-10 mt-2 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#13132a]/90 px-5 py-3 backdrop-blur">
            <p className="text-xs text-white/40">Les modifications ne sont pas enregistrées tant que vous n&apos;avez pas cliqué sur Sauvegarder.</p>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all hover:from-violet-500 hover:to-purple-400 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Sauvegarde…
                </>
              ) : "Sauvegarder"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Toast ─────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 max-w-xs rounded-2xl border px-4 py-3 shadow-2xl ${
          toast.type === "success"
            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
            : "border-red-500/40 bg-red-500/15 text-red-300"
        }`}>
          <p className="text-sm font-medium">{toast.msg}</p>
        </div>
      )}
    </div>
  );
}
