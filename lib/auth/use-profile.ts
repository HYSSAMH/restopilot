"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface Profile {
  id: string;
  role: "restaurateur" | "fournisseur";
  nom_etablissement: string;
  prenom: string | null;
  nom: string | null;
  email: string;
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) { setProfile(null); setLoading(false); }
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, role, nom_etablissement, prenom, nom, email")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;

      // Fallback : si le trigger n'a pas encore tourné (ou a échoué),
      // on hydrate depuis les user_metadata.
      if (!data) {
        const md = user.user_metadata ?? {};
        setProfile({
          id: user.id,
          role: (md.role as Profile["role"]) ?? "restaurateur",
          nom_etablissement: (md.nom_etablissement as string) ?? "Mon établissement",
          prenom: (md.prenom as string) ?? null,
          nom: (md.nom as string) ?? null,
          email: user.email ?? "",
        });
      } else {
        setProfile(data as Profile);
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  return { profile, loading };
}
