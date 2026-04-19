"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressImage, extractStoragePath } from "@/lib/image-compress";

const MAX_PHOTOS = 3;
const BUCKET = "produits-photos";

interface Props {
  produitId: string;
  userId: string;
  nom: string;
  photos: string[];
  onChange: (photos: string[]) => void;
  onClose: () => void;
}

export default function PhotoManager({ produitId, userId, nom, photos, onChange, onClose }: Props) {
  const [working, setWorking]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const inputRef                = useRef<HTMLInputElement>(null);

  async function persistPhotos(next: string[]) {
    const supabase = createClient();
    const { error: dbErr } = await supabase
      .from("produits")
      .update({ photos: next })
      .eq("id", produitId);
    if (dbErr) throw dbErr;
    onChange(next);
  }

  async function handleFile(file: File) {
    setError(null);
    if (photos.length >= MAX_PHOTOS) {
      setError(`Maximum ${MAX_PHOTOS} photos par produit.`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Le fichier doit être une image.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("Image trop lourde (max 15 Mo avant compression).");
      return;
    }

    setWorking(true);
    try {
      const blob     = await compressImage(file, 800, 0.85);
      const supabase = createClient();
      const path     = `${userId}/${produitId}/${Date.now()}.jpg`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const url = `${data.publicUrl}?v=${Date.now()}`;

      await persistPhotos([...photos, url]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      console.error("[PhotoManager] upload failed", e);
      setError(`Upload échoué : ${msg}`);
    }
    setWorking(false);
  }

  async function handleDelete(index: number) {
    setError(null);
    const url = photos[index];
    if (!url) return;
    setWorking(true);
    try {
      const supabase = createClient();
      const path = extractStoragePath(url, BUCKET);
      if (path) {
        await supabase.storage.from(BUCKET).remove([path]);
      }
      const next = photos.filter((_, i) => i !== index);
      await persistPhotos(next);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      console.error("[PhotoManager] delete failed", e);
      setError(`Suppression échouée : ${msg}`);
    }
    setWorking(false);
  }

  async function handleSetMain(index: number) {
    if (index === 0) return;
    setError(null);
    setWorking(true);
    try {
      const next = [photos[index], ...photos.filter((_, i) => i !== index)];
      await persistPhotos(next);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      setError(`Réorganisation échouée : ${msg}`);
    }
    setWorking(false);
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#1A1A2E]">Photos</h2>
            <p className="mt-0.5 truncate text-sm text-gray-500">{nom}</p>
          </div>
          <button
            onClick={onClose}
            disabled={working}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {/* Grille 3 slots */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: MAX_PHOTOS }).map((_, i) => {
              const url = photos[i];
              if (!url) {
                return (
                  <EmptySlot
                    key={i}
                    disabled={working || i !== photos.length}
                    onClick={() => inputRef.current?.click()}
                  />
                );
              }
              return (
                <FilledSlot
                  key={url}
                  url={url}
                  isMain={i === 0}
                  working={working}
                  onDelete={() => handleDelete(i)}
                  onSetMain={() => handleSetMain(i)}
                />
              );
            })}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) handleFile(file);
            }}
          />

          {error && (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
              {error}
            </p>
          )}

          <p className="mt-4 text-xs text-gray-500">
            La première photo est la photo principale affichée dans les listes.
            Max {MAX_PHOTOS} photos · compression auto à 800 px.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4">
          <button
            onClick={onClose}
            disabled={working}
            className="min-h-[44px] rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-[#1A1A2E] hover:bg-gray-50 disabled:opacity-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────

function EmptySlot({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-200 disabled:hover:bg-gray-50 disabled:hover:text-gray-400"
    >
      <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      <span className="text-[11px] font-medium">Ajouter</span>
    </button>
  );
}

function FilledSlot({
  url, isMain, working, onDelete, onSetMain,
}: {
  url: string; isMain: boolean; working: boolean; onDelete: () => void; onSetMain: () => void;
}) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="h-full w-full object-cover" />
      {isMain && (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-indigo-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
          Principale
        </span>
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
        {!isMain && (
          <button
            onClick={onSetMain}
            disabled={working}
            className="rounded-lg bg-white/90 px-2.5 py-1 text-[11px] font-medium text-[#1A1A2E] hover:bg-white disabled:opacity-50"
          >
            Photo principale
          </button>
        )}
        <button
          onClick={onDelete}
          disabled={working}
          className="rounded-lg bg-red-500 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-600 disabled:opacity-50"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}
