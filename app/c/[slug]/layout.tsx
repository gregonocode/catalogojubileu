import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#EB3410",
};

export default function CatalogoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
