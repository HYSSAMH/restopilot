import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* unpdf est ESM-compatible, Next le bundle sans souci — pas
   * besoin de serverExternalPackages (ça casse le runtime Netlify
   * avec @netlify/plugin-nextjs qui ne trace pas toujours les deps
   * externalisées côté ESM → 502 Cannot find module). */
};

export default nextConfig;
