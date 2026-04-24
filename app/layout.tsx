import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ImportProvider } from "@/lib/import-context";
import { ProfileProvider } from "@/lib/auth/profile-provider";
import ImportToast from "@/components/ImportToast";
import ImportPreviewModal from "@/components/ImportPreviewModal";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  weight: ["400", "500", "600", "700"],
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  weight: ["400", "500", "600", "700"],
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "RestoPilot — Gérez votre restaurant intelligemment",
  description: "La plateforme SaaS qui connecte restaurateurs et fournisseurs.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${jetbrainsMono.variable} ${playfair.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#FAFAFA] text-[#0F172A]">
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
