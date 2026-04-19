"use client";

import { useEffect, useRef, useState } from "react";

export interface AddressSelection {
  line1:   string; // numéro + voie, ex : "12 rue de la Paix"
  cp:      string;
  ville:   string;
}

interface Feature {
  properties: {
    label:       string;
    name:        string;      // numéro + voie
    postcode:    string;
    city:        string;
    context:     string;
  };
}

interface Props {
  label?: string;
  placeholder?: string;
  /** Valeur affichée dans l'input (ligne 1) */
  value: string;
  /** Appelé à chaque frappe pour maintenir la valeur contrôlée */
  onChange: (v: string) => void;
  /** Appelé quand l'utilisateur sélectionne une suggestion */
  onSelect: (a: AddressSelection) => void;
  disabled?: boolean;
}

export default function AddressAutocomplete({
  label, placeholder, value, onChange, onSelect, disabled,
}: Props) {
  const [suggestions, setSuggestions] = useState<Feature[]>([]);
  const [open, setOpen]               = useState(false);
  const [loading, setLoading]         = useState(false);
  const debounceRef                   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef                    = useRef<HTMLDivElement>(null);

  // Debounced fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value || value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(value)}&limit=6&autocomplete=1`,
        );
        if (res.ok) {
          const json = await res.json();
          setSuggestions((json.features ?? []) as Feature[]);
          setOpen(true);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleSelect(f: Feature) {
    onSelect({
      line1: f.properties.name,
      cp:    f.properties.postcode,
      ville: f.properties.city,
    });
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      {label && (
        <label className="mb-1.5 block text-xs font-medium text-gray-600">{label}</label>
      )}
      <div className="relative">
        <input
          type="text"
          value={value}
          disabled={disabled}
          placeholder={placeholder ?? "ex : 12 rue de la Paix, Paris"}
          onChange={(e) => { onChange(e.target.value); if (e.target.value.length >= 3) setOpen(true); }}
          onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
          className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-[#1A1A2E] placeholder-gray-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
        />
        {loading && (
          <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl shadow-black/40">
          {suggestions.map((f, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => handleSelect(f)}
                className="flex w-full flex-col gap-0.5 px-3.5 py-2 text-left transition-colors hover:bg-white"
              >
                <span className="text-sm text-[#1A1A2E]">{f.properties.label}</span>
                <span className="text-[10px] text-gray-400">{f.properties.context}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
