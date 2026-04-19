import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ImportProvider } from "@/lib/import-context";
import { ProfileProvider } from "@/lib/auth/profile-provider";
import ImportToast from "@/components/ImportToast";
import ImportPreviewModal from "@/components/ImportPreviewModal";

const inter = Inter({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  title: "RestoPilot — Gérez votre restaurant intelligemment",
  description: "La plateforme SaaS qui connecte restaurateurs et fournisseurs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#F8F9FA] text-[#1A1A2E]">
        <ProfileProvider>
          <ImportProvider>
            {children}
            <ImportToast />
            <ImportPreviewModal />
          </ImportProvider>
        </ProfileProvider>
      </body>
    </html>
  );
}
