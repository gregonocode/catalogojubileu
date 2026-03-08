import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      name: "Pneu Forte Admin",
      short_name: "PF Admin",
      description: "Painel administrativo da Pneu Forte",
      start_url: "/dashboard",
      scope: "/dashboard",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#EB3410",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        {
          src: "/icons/icon-192-maskable.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "maskable",
        },
        {
          src: "/icons/icon-512-maskable.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "maskable",
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "no-store, max-age=0",
      },
    }
  );
}