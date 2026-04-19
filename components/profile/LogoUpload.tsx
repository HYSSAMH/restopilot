"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  userId: string;
  currentUrl: string | null;
  onUploaded: (url: string) => void;
}

export default function LogoUpload({ userId, currentUrl, onUploaded }: Props) {
  const inputRef          = useRef<HTMLInputElement>(null);
  const [uploading, setUp] = useState(false);
  const [error, setError]  = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Format non supporté (image requise).");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError("Fichier trop lourd (max 3 Mo).");
      return;
    }

    setUp(true); setError(null);
    const supabase = createClient();
    const ext  = file.name.split(".").pop() || "png";
    const path = `${userId}/logo.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("logos")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (upErr) {
      console.error("[LogoUpload]", upErr);
      setError(`Upload échoué : ${upErr.message}`);
      setUp(false);
      return;
    }

    // URL publique (bucket "logos" est public)
    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    // Cache-bust en ajoutant un timestamp
    const url = `${data.publicUrl}?v=${Date.now()}`;
    onUploaded(url);
    setUp(false);
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={currentUrl} alt="Logo" className="h-full w-full object-cover" />
        ) : (
          <span className="text-3xl text-gray-300">🏷️</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          onChange={handleFile}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-[#1A1A2E] transition-all hover:bg-white/10 disabled:opacity-50"
        >
          {uploading ? "Upload en cours…" : currentUrl ? "Changer le logo" : "Choisir une image"}
        </button>
        <p className="mt-1 text-xs text-gray-500">PNG, JPG ou WebP · 3 Mo max</p>
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}
