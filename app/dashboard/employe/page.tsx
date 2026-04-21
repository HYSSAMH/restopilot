"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/auth/use-profile";

interface TRLigne  { emetteur: string; nb: number; valeur: number; total: number }
interface AutreLig { mode: string; montant: number; reference: string }
interface EspDet   { "50": number; "20": number; "10": number; "5": number; pieces: number }

const EMETTEURS_TR = ["Swile", "Edenred", "Sodexo / Pluxee", "Up - Chèque Déjeuner", "Apetiz", "Autre"];
const NEW_ESP: EspDet = { "50": 0, "20": 0, "10": 0, "5": 0, pieces: 0 };

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number.isFinite(n) ? n : 0);

const totalEspeces = (e: EspDet) =>
  (e["50"] || 0) * 50 + (e["20"] || 0) * 20 + (e["10"] || 0) * 10 + (e["5"] || 0) * 5 + (Number(e.pieces) || 0);

export default function EmployePage() {
  const router  = useRouter();
  const { profile, loading: profileLoading } = useProfile();
  const supa    = useMemo(() => createClient(), []);

  const [patronName, setPatronName] = useState<string>("");
  const [saisieDate, setSD]         = useState<string>(new Date().toISOString().slice(0, 10));
  const [especes,    setEspeces]    = useState<EspDet>(NEW_ESP);
  const [cbMt,       setCbMt]       = useState("");
  const [cbRef,      setCbRef]      = useState("");
  const [tr,         setTr]         = useState<TRLigne[]>([]);
  const [autres,     setAutres]     = useState<AutreLig[]>([]);
  const [notes,      setNotes]      = useState("");
  const [saving,     setSaving]     = useState(false);
  const [feedback,   setFeedback]   = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Sécurité côté client : redirige si pas un employé (middleware le fait déjà mais ceinture+bretelles)
  useEffect(() => {
    if (profileLoading) return;
    if (!profile) { router.replace("/login"); return; }
    if (profile.role !== "employe") {
      router.replace(profile.role === "admin" ? "/admin" : `/dashboard/${profile.role}`);
    }
  }, [profile, profileLoading, router]);

  // Charge le nom du patron (restaurant)
  const loadPatron = useCallback(async () => {
    if (!profile?.restaurant_id) return;
    const { data } = await supa
      .from("profiles")
      .select("nom_commercial, nom_etablissement")
      .eq("id", profile.restaurant_id)
      .maybeSingle();
    setPatronName(
      (data?.nom_commercial as string | null)
      ?? (data?.nom_etablissement as string | null)
      ?? "",
    );
  }, [supa, profile?.restaurant_id]);

  useEffect(() => { loadPatron(); }, [loadPatron]);

  const caTotal = useMemo(() => {
    const trTotal     = tr.reduce((s, l) => s + (l.nb || 0) * (l.valeur || 0), 0);
    const autresTotal = autres.reduce((s, l) => s + (l.montant || 0), 0);
    return totalEspeces(especes) + (parseFloat(cbMt) || 0) + trTotal + autresTotal;
  }, [especes, cbMt, tr, autres]);

  function resetForm() {
    setEspeces(NEW_ESP); setCbMt(""); setCbRef(""); setTr([]); setAutres([]); setNotes("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (!profile?.id || !profile.restaurant_id) {
      setFeedback({ type: "error", msg: "Profil incomplet. Contactez votre responsable." });
      return;
    }

    setSaving(true);
    try {
      const trTotal     = tr.reduce((s, l) => s + (l.nb || 0) * (l.valeur || 0), 0);
      const autresTotal = autres.reduce((s, l) => s + (l.montant || 0), 0);
      const payload = {
        restaurateur_id: profile.restaurant_id,
        saisi_par:       profile.id,
        date:            saisieDate,
        mode_saisie:     "journalier" as const,
        especes_detail:  especes,
        especes_total:   totalEspeces(especes),
        cb_montant:      parseFloat(cbMt) || 0,
        cb_reference:    cbRef || null,
        tr_detail:       tr,
        tr_total:        trTotal,
        autres_detail:   autres,
        autres_total:    autresTotal,
        ca_total:        caTotal,
        notes:           notes || null,
      };

      const { error } = await supa
        .from("ca_journalier")
        .upsert(payload, { onConflict: "restaurateur_id,date" });

      if (error) throw new Error(error.message);

      setFeedback({
        type: "success",
        msg: `Saisie du ${new Date(saisieDate).toLocaleDateString("fr-FR")} enregistrée — total ${fmt(caTotal)}. Merci !`,
      });
      resetForm();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setFeedback({ type: "error", msg: e instanceof Error ? e.message : "Erreur inconnue." });
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await supa.auth.signOut();
    router.replace("/login");
  }

  const inputCls = "min-h-[40px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20";

  if (profileLoading || !profile || profile.role !== "employe") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA] text-sm text-gray-500">
        Chargement…
      </div>
    );
  }

  const firstName = profile.prenom ?? "";

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header simplifié */}
      <header className="border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-400">Saisie du chiffre d&apos;affaires</p>
            <p className="text-base font-semibold text-[#1A1A2E]">
              {patronName || "RestoPilot"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">{firstName}</span>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        {feedback && (
          <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-600"
          }`}>
            {feedback.msg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Date */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <label className="flex w-fit flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Date de la recette</span>
              <input
                type="date" value={saisieDate} onChange={(e) => setSD(e.target.value)}
                className={inputCls}
              />
            </label>
          </section>

          {/* Espèces */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-600">💶 Espèces</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-5">
              {(["50", "20", "10", "5"] as const).map((b) => (
                <label key={b} className="flex flex-col gap-1">
                  <span className="text-[11px] text-gray-500">Billets {b}€</span>
                  <input
                    type="number" min="0" step="1" value={especes[b] || ""}
                    onChange={(e) => setEspeces({ ...especes, [b]: parseInt(e.target.value) || 0 })}
                    className={inputCls}
                  />
                </label>
              ))}
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-gray-500">Pièces (€)</span>
                <input
                  type="number" min="0" step="0.01" value={especes.pieces || ""}
                  onChange={(e) => setEspeces({ ...especes, pieces: parseFloat(e.target.value) || 0 })}
                  className={inputCls}
                />
              </label>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Total espèces : <span className="font-semibold text-[#1A1A2E]">{fmt(totalEspeces(especes))}</span>
            </p>
          </section>

          {/* CB */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-600">💳 Carte bancaire</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-gray-500">Montant total (€)</span>
                <input
                  type="number" min="0" step="0.01" value={cbMt}
                  onChange={(e) => setCbMt(e.target.value)} className={inputCls}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-gray-500">N° de remise CB</span>
                <input
                  value={cbRef} onChange={(e) => setCbRef(e.target.value)}
                  placeholder="ex : REM-20260422" className={inputCls}
                />
              </label>
            </div>
          </section>

          {/* TR */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-600">🎫 Tickets restaurant</h3>
              <button
                type="button"
                onClick={() => setTr([...tr, { emetteur: "Swile", nb: 1, valeur: 10.5, total: 10.5 }])}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-100"
              >
                + Ligne
              </button>
            </div>
            {tr.length === 0 ? (
              <p className="mt-3 text-xs text-gray-500">Aucun ticket saisi.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {tr.map((l, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_80px_100px_100px_auto]">
                    <select
                      value={l.emetteur}
                      onChange={(e) => {
                        const nl = [...tr]; nl[i] = { ...nl[i], emetteur: e.target.value }; setTr(nl);
                      }}
                      className={inputCls + " col-span-2 sm:col-span-1"}
                    >
                      {EMETTEURS_TR.map((em) => <option key={em} value={em}>{em}</option>)}
                    </select>
                    <input
                      type="number" min="1" value={l.nb} placeholder="Nb"
                      onChange={(e) => {
                        const nl = [...tr];
                        const nb = parseInt(e.target.value) || 0;
                        nl[i] = { ...nl[i], nb, total: nb * nl[i].valeur };
                        setTr(nl);
                      }}
                      className={inputCls}
                    />
                    <input
                      type="number" min="0" step="0.01" value={l.valeur} placeholder="Valeur u."
                      onChange={(e) => {
                        const nl = [...tr];
                        const valeur = parseFloat(e.target.value) || 0;
                        nl[i] = { ...nl[i], valeur, total: nl[i].nb * valeur };
                        setTr(nl);
                      }}
                      className={inputCls}
                    />
                    <input readOnly value={fmt(l.nb * l.valeur)} className={inputCls + " bg-gray-100"} />
                    <button
                      type="button"
                      onClick={() => setTr(tr.filter((_, j) => j !== i))}
                      className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <p className="text-xs text-gray-500">
                  Total TR : <span className="font-semibold text-[#1A1A2E]">
                    {fmt(tr.reduce((s, l) => s + l.nb * l.valeur, 0))}
                  </span>
                </p>
              </div>
            )}
          </section>

          {/* Autres */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-600">➕ Autres paiements</h3>
              <button
                type="button"
                onClick={() => setAutres([...autres, { mode: "virement", montant: 0, reference: "" }])}
                className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-100"
              >
                + Ligne
              </button>
            </div>
            {autres.length === 0 ? (
              <p className="mt-3 text-xs text-gray-500">Aucune autre entrée.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {autres.map((l, i) => (
                  <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[140px_120px_1fr_auto]">
                    <select
                      value={l.mode}
                      onChange={(e) => { const na = [...autres]; na[i] = { ...na[i], mode: e.target.value }; setAutres(na); }}
                      className={inputCls}
                    >
                      <option value="virement">Virement</option>
                      <option value="cheque">Chèque</option>
                      <option value="autre">Autre</option>
                    </select>
                    <input
                      type="number" min="0" step="0.01" value={l.montant} placeholder="Montant"
                      onChange={(e) => { const na = [...autres]; na[i] = { ...na[i], montant: parseFloat(e.target.value) || 0 }; setAutres(na); }}
                      className={inputCls}
                    />
                    <input
                      value={l.reference} placeholder="Référence"
                      onChange={(e) => { const na = [...autres]; na[i] = { ...na[i], reference: e.target.value }; setAutres(na); }}
                      className={inputCls + " col-span-2 sm:col-span-1"}
                    />
                    <button
                      type="button"
                      onClick={() => setAutres(autres.filter((_, j) => j !== i))}
                      className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Notes */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Notes (optionnel)</span>
              <textarea
                value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                className={inputCls}
                placeholder="Incident, écart de caisse, info à signaler…"
              />
            </label>
          </section>

          {/* Total + Submit */}
          <section className="sticky bottom-4 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 p-5 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-indigo-700">Total CA</p>
                <p className="text-2xl font-bold text-[#1A1A2E]">{fmt(caTotal)}</p>
              </div>
              <button
                type="submit" disabled={saving}
                className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3 text-sm font-medium text-white shadow-md shadow-indigo-500/20 transition-opacity hover:opacity-95 disabled:opacity-50"
              >
                {saving ? "Enregistrement…" : "Valider la recette"}
              </button>
            </div>
          </section>
        </form>
      </main>
    </div>
  );
}
