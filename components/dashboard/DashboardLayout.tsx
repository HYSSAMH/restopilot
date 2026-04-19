"use client";

import Sidebar from "./Sidebar";

interface Props {
  children: React.ReactNode;
  role?: "restaurateur" | "fournisseur";
}

/**
 * Layout commun à toutes les pages protégées :
 * sidebar fixe à gauche + zone de contenu à droite.
 */
export default function DashboardLayout({ children, role }: Props) {
  return (
    <div className="flex min-h-screen bg-[#F8F9FA]">
      <Sidebar role={role} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
