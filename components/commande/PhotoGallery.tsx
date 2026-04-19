"use client";

import { useState } from "react";

interface Props {
  nom: string;
  icone: string;
  photos: string[];
  onClose: () => void;
}

export default function PhotoGallery({ nom, icone, photos, onClose }: Props) {
  const [idx, setIdx] = useState(0);
  const hasPhotos = photos.length > 0;
  const count = photos.length;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold text-[#1A1A2E]">{nom}</h2>
            {hasPhotos && (
              <p className="mt-0.5 text-xs text-gray-500">
                Photo {idx + 1} / {count}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center overflow-hidden bg-gray-50">
          {hasPhotos ? (
            <div className="relative flex h-full w-full items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photos[idx]}
                alt=""
                className="max-h-[70vh] w-auto object-contain"
              />
              {count > 1 && (
                <>
                  <button
                    onClick={() => setIdx((i) => (i - 1 + count) % count)}
                    className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-xl text-[#1A1A2E] shadow hover:bg-white"
                    aria-label="Précédente"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => setIdx((i) => (i + 1) % count)}
                    className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-xl text-[#1A1A2E] shadow hover:bg-white"
                    aria-label="Suivante"
                  >
                    ›
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-16">
              <span className="text-6xl">{icone}</span>
              <p className="text-sm text-gray-500">Aucune photo pour ce produit.</p>
            </div>
          )}
        </div>

        {count > 1 && (
          <div className="flex gap-2 overflow-x-auto border-t border-gray-200 px-5 py-3">
            {photos.map((url, i) => (
              <button
                key={url}
                onClick={() => setIdx(i)}
                className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                  i === idx ? "border-indigo-500" : "border-transparent opacity-70 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
