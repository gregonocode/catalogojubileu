import type { Metadata } from "next";
import DashboardClientLayout from "./DashboardClientLayout";

export const metadata: Metadata = {
  title: "Pneu Forte Admin",
  description: "Painel administrativo da Pneu Forte",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <head>
        <link rel="manifest" href="/dashboard-manifest.webmanifest" />
        <meta name="theme-color" content="#EB3410" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>

      <DashboardClientLayout>{children}</DashboardClientLayout>
    </>
  );
}