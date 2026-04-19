import Link from "next/link";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#F8F9FA] px-4">
      {/* Soft background accents */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-100/60 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-violet-100/50 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-10 text-center">
        {/* Logo + titre */}
        <div className="flex flex-col items-center gap-4 animate-fade-in-up">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25">
              <span className="text-2xl">🍽️</span>
            </div>
            <span className="text-4xl font-bold tracking-tight text-[#1A1A2E]">
              Resto<span className="text-indigo-500">Pilot</span>
            </span>
          </div>
          <p className="max-w-md text-lg text-gray-600">
            La plateforme qui connecte les restaurateurs et leurs fournisseurs en toute simplicité.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/register"
            className="flex w-60 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition-all hover:bg-indigo-600 hover:shadow-lg"
          >
            Créer un compte
          </Link>
          <Link
            href="/login"
            className="flex w-60 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3.5 text-sm font-semibold text-[#1A1A2E] transition-all hover:bg-gray-50"
          >
            Se connecter
          </Link>
        </div>

        <p className="text-xs text-gray-400">
          Restaurateurs &amp; distributeurs — gratuit, sans carte bancaire
        </p>
      </div>
    </main>
  );
}
