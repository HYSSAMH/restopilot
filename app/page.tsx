import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden px-4">
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-violet-700/20 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-purple-500/15 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/10 blur-2xl" />
      </div>

      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-10 text-center">
        {/* Logo + titre */}
        <div className="animate-fade-in-up flex flex-col items-center gap-4">
          <div className="flex items-center justify-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-purple-500 shadow-lg shadow-violet-500/30">
              <span className="text-2xl">🍽️</span>
            </div>
            <span className="text-4xl font-bold tracking-tight">
              Resto<span className="text-violet-400">Pilot</span>
            </span>
          </div>
          <p className="max-w-md text-lg text-white/60">
            La plateforme qui connecte les restaurateurs et leurs fournisseurs en toute simplicité.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href="/register"
            className="flex w-60 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-purple-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/30 transition-all hover:from-violet-500 hover:to-purple-400 hover:shadow-xl"
          >
            Créer un compte
          </Link>
          <Link
            href="/login"
            className="flex w-60 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white/80 transition-all hover:bg-white/10 hover:text-white"
          >
            Se connecter
          </Link>
        </div>

        <p className="text-xs text-white/25">
          Restaurateurs & distributeurs — gratuit, sans carte bancaire
        </p>
      </div>
    </main>
  );
}
