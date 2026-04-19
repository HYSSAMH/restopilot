import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ImportProvider } from "@/lib/import-context";
import ImportToast from "@/components/ImportToast";
import ImportPreviewModal from "@/components/ImportPreviewModal";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "RestoPilot — Gérez votre restaurant intelligemment",
  description: "La plateforme SaaS qui connecte restaurateurs et fournisseurs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#0d0d1a] text-white">
        <ImportProvider>
          {children}
          <ImportToast />
          <ImportPreviewModal />
        </ImportProvider>
      </body>
    </html>
  );
}
