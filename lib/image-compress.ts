/**
 * Compresse une image côté client via Canvas.
 * - Redimensionne pour que le côté le plus long ≤ `maxSize` px (défaut 800)
 * - Exporte en JPEG qualité `quality` (défaut 0.85)
 * Retourne un Blob (utilisable directement dans supabase.storage.upload).
 */
export async function compressImage(
  file: File,
  maxSize = 800,
  quality = 0.85,
): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Le fichier n'est pas une image.");
  }

  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Impossible de lire le fichier."));
    reader.readAsDataURL(file);
  });

  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload  = () => resolve(el);
    el.onerror = () => reject(new Error("Image invalide."));
    el.src = dataUrl;
  });

  let w = img.naturalWidth;
  let h = img.naturalHeight;
  if (w > h && w > maxSize) {
    h = Math.round((h * maxSize) / w);
    w = maxSize;
  } else if (h > maxSize) {
    w = Math.round((w * maxSize) / h);
    h = maxSize;
  }

  const canvas = document.createElement("canvas");
  canvas.width  = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D non disponible.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);

  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Compression échouée."));
      },
      "image/jpeg",
      quality,
    );
  });
}

/**
 * Extrait le chemin Storage depuis une URL publique Supabase.
 * Retourne null si l'URL ne correspond pas au format attendu.
 */
export function extractStoragePath(url: string, bucket: string): string | null {
  const m = url.match(
    new RegExp(`/storage/v1/object/public/${bucket}/([^?]+)`),
  );
  return m ? decodeURIComponent(m[1]) : null;
}
