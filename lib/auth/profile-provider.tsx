"use client";

import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  role: "restaurateur" | "fournisseur";
  nom_etablissement: string;
  prenom: string | null;
  nom: string | null;
  email: string;

  // Profil détaillé (nullable)
  nom_commercial?:   string | null;
  raison_sociale?:   string | null;
  siret?:            string | null;
  adresse_ligne1?:   string | null;
  adresse_ligne2?:   string | null;
  code_postal?:      string | null;
  ville?:            string | null;
  telephone?:        string | null;
  email_contact?:    string | null;
  logo_url?:         string | null;

  // Restaurateur
  adresse_livraison_ligne1?: string | null;
  adresse_livraison_ligne2?: string | null;
  adresse_livraison_cp?:     string | null;
  adresse_livraison_ville?:  string | null;
  type_restaurant?:          string | null;
  nombre_couverts?:          number | null;

  // Fournisseur
  adresse_facturation_ligne1?: string | null;
  adresse_facturation_ligne2?: string | null;
  adresse_facturation_cp?:     string | null;
  adresse_facturation_ville?:  string | null;
  iban?:                       string | null;
  bic?:                        string | null;
  zone_livraison?:             string | null;
  montant_minimum_commande?:   number | null;
  jours_livraison?:            string[] | null;
  horaires_livraison?:         string | null;
}

interface ProfileContextValue {
  profile: Profile | null;
  loading: boolean;
  /** Force un refetch immédiat (ex: après save sur /profile). */
  refresh: () => Promise<void>;
  /** Helper UI : nom d'affichage principal (nom_commercial → nom_etablissement → prenom nom → email). */
  displayName: string;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

/**
 * Nom d'affichage consolidé — utilisé partout dans l'UI.
 * Jamais de hardcode, toujours ce helper.
 */
export function profileDisplayName(p?: Profile | null): string {
  if (!p) return "Mon compte";
  return (
    p.nom_commercial?.trim()
    || p.nom_etablissement?.trim()
    || [p.prenom, p.nom].filter(Boolean).join(" ").trim()
    || p.email
    || "Mon compte"
  );
}

// ── Provider ───────────────────────────────────────────────────────────────

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  const fetchProfile = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setProfile(null);
      setLoading(false);
      currentUserIdRef.current = null;
      return;
    }
    currentUserIdRef.current = user.id;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (data) {
      setProfile({ ...data, email: user.email ?? data.email ?? "" } as Profile);
    } else {
      // Fallback : metadata si la row profiles n'existe pas encore
      const md = user.user_metadata ?? {};
      setProfile({
        id: user.id,
        role: (md.role as Profile["role"]) ?? "restaurateur",
        nom_etablissement: (md.nom_etablissement as string) ?? "Mon établissement",
        prenom: (md.prenom as string) ?? null,
        nom: (md.nom as string) ?? null,
        email: user.email ?? "",
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    // Initial fetch
    fetchProfile();

    // Re-fetch on auth change (login/logout/token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === "SIGNED_OUT") {
        setProfile(null);
        currentUserIdRef.current = null;
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
        return;
      }
      fetchProfile();
    });

    // Realtime : s'abonne aux UPDATE sur la ligne profil de l'utilisateur courant.
    // Réinstallé à chaque changement d'utilisateur.
    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      channelRef.current = supabase
        .channel(`profile-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          () => { if (!cancelled) fetchProfile(); },
        )
        .subscribe();
    };
    setupRealtime();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchProfile]);

  const value: ProfileContextValue = {
    profile,
    loading,
    refresh: fetchProfile,
    displayName: profileDisplayName(profile),
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside ProfileProvider");
  return ctx;
}
