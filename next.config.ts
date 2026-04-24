import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // unpdf embarque pdfjs en interne ; on l'exclut du bundling Next
  // pour qu'il soit résolu en tant que package Node côté serverless.
  serverExternalPackages: ["unpdf"],
};

export default nextConfig;
