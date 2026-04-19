"use client";

import { useEffect, useRef, useState } from "react";

type Status = "idle" | "checking" | "valid" | "invalid" | "not_found";

interface Props {
  value: string;
  onChange: (v: string) => void;
  /** Appelé quand l'API renvoie une raison sociale — utile pour pré-remplir le champ parent */
  onCompanyFound?: (raisonSociale: string) => void;
  disabled?: boolean;
}

/** Luhn classique appliqué à 14 chiffres (SIREN+NIC). */
function luhnValid(siret: string): boolean {
  if (!/^\d{14}$/.test(siret)) return false;
  // Cas particulier LA POSTE (SIREN 356000000) : somme divisible par 5
  if (siret.startsWith("356000000")) {
    const sum = siret.split("").reduce((s, c) => s + parseInt(c, 10), 0);
    return sum % 5 === 0;
  }
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let d = parseInt(siret[i], 10);
    // positions paires depuis la droite (index 0,2,4,... depuis la droite = 13,11,9,... index from left)
    // Convention SIRET : doubler les positions paires (1ère, 3ème… en partant de la GAUCHE = index 0,2,4…)
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export default function SiretInput({ value, onChange, onCompanyFound, disabled }: Props) {
  const [status, setStatus]     = useState<Status>("idle");
  const [companyName, setName]  = useState<string | null>(null);
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setName(null);

    const digits = value.replace(/\s/g, "");
    if (!digits) { setStatus("idle"); return; }
    if (!/^\d{14}$/.test(digits)) { setStatus("invalid"); return; }
    if (!luhnValid(digits))       { setStatus("invalid"); return; }

    setStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://recherche-entreprises.api.gouv.fr/search?q=${digits}&per_page=1`,
        );
        if (!res.ok) { setStatus("valid"); return; } // Luhn ok mais API down → on accepte
        const json = await res.json();
        const hit = (json.results ?? [])[0];
        if (!hit) { setStatus("not_found"); return; }
        const raison =
          hit.nom_raison_sociale ??
          hit.nom_complet ??
          hit.nom_commercial ??
          null;
        setName(raison);
        setStatus("valid");
        if (raison && onCompanyFound) onCompanyFound(raison);
      } catch {
        setStatus("valid"); // pas d'erreur bloquante, Luhn ok
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const statusUI = (() => {
    switch (status) {
      case "checking":
        return <span className="text-gray-500">⏳ Vérification…</span>;
      case "valid":
        return (
          <span className="text-emerald-400">
            ✓ SIRET valide{companyName ? ` · ${companyName}` : ""}
          </span>
        );
      case "invalid":
        return <span className="text-red-400">✕ SIRET invalide (14 chiffres requis)</span>;
      case "not_found":
        return <span className="text-amber-400">⚠ SIRET introuvable dans le registre</span>;
      default:
        return null;
    }
  })();

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-600">Numéro SIRET *</label>
      <input
        type="text"
        inputMode="numeric"
        maxLength={17} // 14 chiffres + 3 espaces au max si l'utilisateur en tape
        placeholder="14 chiffres"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/[^\d\s]/g, ""))}
        className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 font-mono text-sm tracking-wider text-[#1A1A2E] placeholder-gray-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
      />
      <p className="mt-1.5 text-xs">{statusUI ?? <span className="text-gray-400">Ex : 732 829 320 00074</span>}</p>
    </div>
  );
}
