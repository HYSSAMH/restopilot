"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fmt } from "@/lib/gestion-data";

type ModeSaisie = "journalier" | "mensuel";

interface TRLigne  { emetteur: string; nb: number; valeur: number; total: number }
interface AutreLig { mode: string; montant: number; reference: string }
interface EspDet   { "50": number; "20": number; "10": number; "5": number; pieces: number }

interface CaRow {
  id:              string;
  date:            string;
  mode_saisie:     ModeSaisie;
  especes_detail:  EspDet;
  especes_total:   number;
  cb_montant:      number;
  cb_reference:    string | null;
  tr_detail:       TRLigne[];
  tr_total:        number;
  autres_detail:   AutreLig[];
  autres_total:    number;
  ca_total:        number;
  notes:           string | null;
}

const EMETTEURS_TR = ["Swile", "Edenred", "Sodexo / Pluxee", "Up - Chèque Déjeuner", "Apetiz", "Autre"];
const NEW_ESP: EspDet = { "50": 0, "20": 0, "10": 0, "5": 0, pieces: 0 };
const totalEspeces = (e: EspDet) =>
  (e["50"] || 0) * 50 + (e["20"] || 0) * 20 + (e["10"] || 0) * 10 + (e["5"] || 0) * 5 + (Number(e.pieces) || 0);

export default function SaisieCaPage() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-[10px] bg-[var(--bg-subtle)]" />}>
      <SaisieCaInner />
    </Suspense>
  );
}

function SaisieCaInner() {
  const router = useRouter();
  const params = useSearchParams();
  const editIdParam = params.get("edit");
  const supa   = useMemo(() => createClient(), []);

  const [mode, setMode]       = useState<ModeSaisie>("journalier");
  const [saisieDate, setSD]   = useState<string>(new Date().toISOString().slice(0, 10));
  const [saisieMois, setSM]   = useState<string>(new Date().toISOString().slice(0, 7));
  const [especes, setEspeces] = useState<EspDet>(NEW_ESP);
  const [cbMt,   setCbMt]     = useState("");
  const [cbRef,  setCbRef]    = useState("");
  const [tr,     setTr]       = useState<TRLigne[]>([]);
  const [autres, setAutres]   = useState<AutreLig[]>([]);
  const [caMensuel, setCaMensuel] = useState("");
  const [notes, setNotes]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [editId, setEditId]   = useState<string | null>(null);
  const [loadingEdit, setLE]  = useState(false);
  const [toast, setToast]     = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // ── Précharge d'une saisie à modifier via ?edit=<id> ──
  useEffect(() => {
    if (!editIdParam) { setEditId(null); return; }
    setLE(true);
    (async () => {
      const { data, error } = await supa
        .from("ca_journalier")
        .select("*")
        .eq("id", editIdParam)
        .maybeSingle();
      if (error || !data) {
        setToast({ type: "error", msg: "Saisie introuvable." });
        setLE(false);
        return;
      }
      const r = data as CaRow;
      setEditId(r.id);
      setMode(r.mode_saisie);
      if (r.mode_saisie === "mensuel") {
        setSM(r.date.slice(0, 7));
        setCaMensuel(String(r.ca_total ?? ""));
      } else {
        setSD(r.date);
        setEspeces({ ...NEW_ESP, ...(r.especes_detail ?? {}) });
        setCbMt(String(r.cb_montant ?? ""));
        setCbRef(r.cb_reference ?? "");
        setTr(r.tr_detail ?? []);
        setAutres(r.autres_detail ?? []);
      }
      setNotes(r.notes ?? "");
      setLE(false);
    })();
  }, [editIdParam, supa]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const caTotalJour = useMemo(() => {
    if (mode === "mensuel") return parseFloat(caMensuel) || 0;
    const espT = totalEspeces(especes);
    const cbT  = parseFloat(cbMt) || 0;
    const trT  = tr.reduce((s, l) => s + (l.nb * l.valeur), 0);
    const auT  = autres.reduce((s, l) => s + (l.montant || 0), 0);
    return espT + cbT + trT + auT;
  }, [mode, caMensuel, especes, cbMt, tr, autres]);

  function resetForm() {
    setEspeces(NEW_ESP); setCbMt(""); setCbRef(""); setTr([]); setAutres([]);
    setCaMensuel(""); setNotes("");
  }

  const saveCa = useCallback(async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supa.auth.getUser();
      if (!user) throw new Error("Session expirée");

      const date = mode === "journalier" ? saisieDate : (saisieMois + "-01");
      const payload = mode === "journalier"
        ? {
            restaurateur_id: user.id,
            saisi_par:       user.id,
            date, mode_saisie: mode,
            especes_detail:  especes,
            especes_total:   totalEspeces(especes),
            cb_montant:      parseFloat(cbMt) || 0,
            cb_reference:    cbRef || null,
            tr_detail:       tr,
            tr_total:        tr.reduce((s, l) => s + l.nb * l.valeur, 0),
            autres_detail:   autres,
            autres_total:    autres.reduce((s, l) => s + (l.montant || 0), 0),
            ca_total:        caTotalJour,
            notes:           notes || null,
          }
        : {
            restaurateur_id: user.id,
            saisi_par:       user.id,
            date, mode_saisie: mode,
            ca_total:        parseFloat(caMensuel) || 0,
            notes:           notes || null,
          };

      const { error } = editId
        ? await supa.from("ca_journalier").update(payload).eq("id", editId)
        : await supa.from("ca_journalier").upsert(payload, { onConflict: "restaurateur_id,date" });

      if (error) throw new Error(error.message);

      setToast({ type: "success", msg: editId ? "Saisie mise à jour." : "CA enregistré." });
      setEditId(null);
      resetForm();
      // Nettoie le paramètre ?edit= si présent
      if (editIdParam) router.replace("/dashboard/restaurateur/gestion/saisie-ca");
    } catch (e) {
      setToast({ type: "error", msg: e instanceof Error ? e.message : "Erreur" });
    }
    setSaving(false);
  }, [supa, mode, saisieDate, saisieMois, especes, cbMt, cbRef, tr, autres, caMensuel, caTotalJour, notes, editId, editIdParam, router]);

  const inputCls = "min-h-[40px] rounded-[8px] border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)] focus:ring-2 focus:shadow-[0_0_0_3px_var(--accent-soft)]";

  return (
    <div className="flex flex-col gap-5">
      {/* Retour budget */}
      <div>
        <Link
          href="/dashboard/restaurateur/gestion/budget"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:border-indigo-300 hover:text-[var(--accent)]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span>Retour au budget</span>
        </Link>
      </div>

      <h2 className="text-[18px] font-[650] tracking-[-0.01em] text-[var(--text)]">
        {editId ? "Modifier la saisie" : "Saisir mon CA"}
      </h2>

      {loadingEdit && (
        <div className="rounded-[10px] border border-[var(--border)] bg-white p-4 text-sm text-gray-500 shadow-sm">
          Chargement de la saisie…
        </div>
      )}

      <section className="rounded-[10px] border border-[var(--border)] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[var(--text)]">Détail de la recette</h3>
          <div className="flex gap-1 rounded-[8px] border border-[var(--border)] bg-[var(--bg-subtle)] p-1">
            {(["journalier", "mensuel"] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ${mode === m ? "bg-[var(--accent)] text-white" : "text-gray-500 hover:text-[var(--text)]"}`}
              >
                {m === "journalier" ? "Journalier" : "Mensuel"}
              </button>
            ))}
          </div>
        </div>

        {/* Mode journalier */}
        {mode === "journalier" && (
          <div className="mt-4 flex flex-col gap-4">
            <label className="flex w-fit flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Date</span>
              <input type="date" value={saisieDate} onChange={e => setSD(e.target.value)} className={inputCls} />
            </label>

            {/* Espèces */}
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600">💶 Espèces</h4>
              <div className="mt-2 grid gap-2 sm:grid-cols-5">
                {(["50", "20", "10", "5"] as const).map(b => (
                  <label key={b} className="flex flex-col gap-1">
                    <span className="text-[11px] text-gray-500">Billets {b}€</span>
                    <input type="number" min="0" step="1" value={especes[b] || ""}
                           onChange={e => setEspeces({ ...especes, [b]: parseInt(e.target.value) || 0 })}
                           className={inputCls} />
                  </label>
                ))}
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-gray-500">Pièces (€)</span>
                  <input type="number" min="0" step="0.01" value={especes.pieces || ""}
                         onChange={e => setEspeces({ ...especes, pieces: parseFloat(e.target.value) || 0 })}
                         className={inputCls} />
                </label>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Total espèces : <span className="font-semibold text-[var(--text)]">{fmt(totalEspeces(especes))}</span>
              </p>
            </div>

            {/* CB */}
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600">💳 Carte bancaire</h4>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-gray-500">Montant total (€)</span>
                  <input type="number" min="0" step="0.01" value={cbMt} onChange={e => setCbMt(e.target.value)} className={inputCls} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-gray-500">N° de remise CB</span>
                  <input value={cbRef} onChange={e => setCbRef(e.target.value)} placeholder="ex : REM-20260422"
                         className={inputCls} />
                </label>
              </div>
            </div>

            {/* Tickets Restaurant */}
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600">🎫 Tickets restaurant</h4>
                <button type="button" onClick={() => setTr([...tr, { emetteur: "Swile", nb: 1, valeur: 10.5, total: 10.5 }])}
                        className="rounded-lg border border-[var(--border-strong)] bg-white px-2 py-1 text-xs hover:bg-[var(--bg-subtle)]">+ Ligne</button>
              </div>
              {tr.length === 0 ? (
                <p className="mt-2 text-xs text-gray-500">Aucun ticket saisi.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {tr.map((l, i) => (
                    <div key={i} className="grid grid-cols-[1fr_80px_100px_100px_auto] gap-2">
                      <select value={l.emetteur} onChange={e => {
                        const nl = [...tr]; nl[i] = { ...nl[i], emetteur: e.target.value }; setTr(nl);
                      }} className={inputCls}>
                        {EMETTEURS_TR.map(em => <option key={em} value={em}>{em}</option>)}
                      </select>
                      <input type="number" min="1" value={l.nb} placeholder="Nb"
                             onChange={e => {
                               const nl = [...tr];
                               const nb = parseInt(e.target.value) || 0;
                               nl[i] = { ...nl[i], nb, total: nb * nl[i].valeur };
                               setTr(nl);
                             }} className={inputCls} />
                      <input type="number" min="0" step="0.01" value={l.valeur} placeholder="Valeur u."
                             onChange={e => {
                               const nl = [...tr];
                               const valeur = parseFloat(e.target.value) || 0;
                               nl[i] = { ...nl[i], valeur, total: nl[i].nb * valeur };
                               setTr(nl);
                             }} className={inputCls} />
                      <input readOnly value={fmt(l.nb * l.valeur)} className={inputCls + " bg-[var(--bg-subtle)]"} />
                      <button type="button" onClick={() => setTr(tr.filter((_, j) => j !== i))}
                              className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">×</button>
                    </div>
                  ))}
                  <p className="text-xs text-gray-500">
                    Total TR : <span className="font-semibold text-[var(--text)]">{fmt(tr.reduce((s, l) => s + l.nb * l.valeur, 0))}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Autres */}
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-600">➕ Autres paiements</h4>
                <button type="button" onClick={() => setAutres([...autres, { mode: "virement", montant: 0, reference: "" }])}
                        className="rounded-lg border border-[var(--border-strong)] bg-white px-2 py-1 text-xs hover:bg-[var(--bg-subtle)]">+ Ligne</button>
              </div>
              {autres.length === 0 ? (
                <p className="mt-2 text-xs text-gray-500">Aucune autre entrée.</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {autres.map((l, i) => (
                    <div key={i} className="grid grid-cols-[140px_120px_1fr_auto] gap-2">
                      <select value={l.mode} onChange={e => {
                        const na = [...autres]; na[i] = { ...na[i], mode: e.target.value }; setAutres(na);
                      }} className={inputCls}>
                        <option value="virement">Virement</option>
                        <option value="cheque">Chèque</option>
                        <option value="autre">Autre</option>
                      </select>
                      <input type="number" min="0" step="0.01" value={l.montant} placeholder="Montant"
                             onChange={e => { const na = [...autres]; na[i] = { ...na[i], montant: parseFloat(e.target.value) || 0 }; setAutres(na); }}
                             className={inputCls} />
                      <input value={l.reference} placeholder="Référence"
                             onChange={e => { const na = [...autres]; na[i] = { ...na[i], reference: e.target.value }; setAutres(na); }}
                             className={inputCls} />
                      <button type="button" onClick={() => setAutres(autres.filter((_, j) => j !== i))}
                              className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mode mensuel */}
        {mode === "mensuel" && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">Mois</span>
              <input type="month" value={saisieMois} onChange={e => setSM(e.target.value)} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600">CA total du mois (€)</span>
              <input type="number" min="0" step="0.01" value={caMensuel} onChange={e => setCaMensuel(e.target.value)} className={inputCls} />
            </label>
          </div>
        )}

        {/* Notes */}
        <label className="mt-4 flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-600">Notes (optionnel)</span>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inputCls} />
        </label>

        {/* Total + save */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
          <p className="text-sm text-gray-600">
            Total CA : <span className="text-lg font-bold text-[var(--accent)]">{fmt(caTotalJour)}</span>
          </p>
          <div className="flex gap-2">
            {editId && (
              <Link
                href="/dashboard/restaurateur/gestion/saisie-ca"
                onClick={() => { setEditId(null); resetForm(); }}
                className="min-h-[44px] rounded-[8px] border border-[var(--border)] bg-white px-4 py-2 text-sm"
              >
                Annuler
              </Link>
            )}
            <button type="button" onClick={saveCa} disabled={saving || caTotalJour <= 0}
                    className="min-h-[44px] rounded-[8px] bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50">
              {saving ? "Enregistrement…" : editId ? "Mettre à jour" : "Enregistrer"}
            </button>
          </div>
        </div>
      </section>

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 max-w-md rounded-[10px] border px-4 py-3 shadow-2xl ${
          toast.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
        }`}>
          <p className="text-sm font-medium">{toast.msg}</p>
        </div>
      )}
    </div>
  );
}
