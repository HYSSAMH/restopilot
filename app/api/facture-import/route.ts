import { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * DEPRECATED — conservé pour éviter un 404 sur d'anciennes versions
 * client qui pointeraient encore ici. Le nouveau flux est 100% côté
 * navigateur : extraction texte PDF via pdfjs-dist + OCR via
 * tesseract.js, puis POST du texte brut à /api/facture-parse-text
 * pour le parsing regex serveur.
 */
export async function GET() {
  return Response.json({
    ok: false,
    deprecated: true,
    message:
      "Cette route est dépréciée. L'extraction PDF se fait désormais côté client. " +
      "Utilisez /api/facture-parse-text avec le texte extrait en client.",
  });
}

export async function POST(_req: NextRequest) {
  return Response.json(
    {
      ok: false,
      deprecated: true,
      error:
        "Route dépréciée : la modale FactureImportModal doit extraire le texte côté client (pdfjs-dist + tesseract.js) et POSTer ensuite sur /api/facture-parse-text.",
    },
    { status: 410 },
  );
}
