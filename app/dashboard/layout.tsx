import type { Metadata } from "next";
import DashboardClientLayout from "./DashboardClientLayout";

export const metadata: Metadata = {
  title: "Pneu Forte Admin",
  description: "Painel administrativo da Pneu Forte",
  manifest: "/dashboard/manifest.webmanifest",
  themeColor: "#EB3410",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pneu Forte Admin",
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardClientLayout>{children}</DashboardClientLayout>;
}