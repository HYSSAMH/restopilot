import { NextRequest } from "next/server";

export const runtime = "nodejs";

/**
 * DEPRECATED — même logique que facture-import : tout le PDF-handling
 * se fait côté client désormais. Cette route admin est conservée en
 * stub pour éviter 404 sur les outils de diagnostic.
 */
export async function GET() {
  return Response.json({
    ok: false,
    deprecated: true,
    message: "Extraction PDF faite côté client (pdfjs-dist). Pour tester, ouvrez /admin/test-import.",
  });
}

export async function POST(_req: NextRequest) {
  return Response.json(
    {
      ok: false,
      deprecated: true,
      error: "Route dépréciée. Le PDF est traité côté navigateur.",
    },
    { status: 410 },
  );
}
