"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  PlusCircle,
  List,
  Users,
  ReceiptText,
  Settings,
  LogOut,
  Tag,
  Volume2,
  VolumeX,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { supabaseClient } from "@/lib/supabase/client";

// ✅ popup global
import NovoPedidoPopup from "@/app/dashboard/_components/NovoPedidoPopup";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  group?: string;
};

type UsuarioConfigRow = {
  usuario_id: string;
  som_novo_pedido: boolean;
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // ✅ som config
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [soundLoading, setSoundLoading] = useState<boolean>(true);

  // ✅ unlock de áudio (primeira interação do user)
  const audioUnlockRef = useRef<HTMLAudioElement | null>(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  const items = useMemo<NavItem[]>(
    () => [
      { label: "Visão geral", href: "/dashboard", icon: <LayoutDashboard size={18} />, group: "Geral" },

      { label: "Cadastrar produto", href: "/dashboard/produtos/novo", icon: <PlusCircle size={18} />, group: "Produtos" },
      { label: "Criar Categorias", href: "/dashboard/produtos/categorias", icon: <Tag size={18} />, group: "Produtos" },
      { label: "Lista de produtos", href: "/dashboard/produtos", icon: <List size={18} />, group: "Produtos" },

      { label: "Clientes", href: "/dashboard/clientes", icon: <Users size={18} />, group: "Gestão" },
      { label: "Pedidos", href: "/dashboard/pedidos", icon: <ReceiptText size={18} />, group: "Gestão" },
      { label: "Configuração", href: "/dashboard/configuracao", icon: <Settings size={18} />, group: "Gestão" },
    ],
    []
  );

  const grouped = useMemo(() => {
    const groups = new Map<string, NavItem[]>();
    for (const it of items) {
      const g = it.group ?? "Outros";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(it);
    }
    return [...groups.entries()];
  }, [items]);

  useEffect(() => {
    // prepara áudio
    audioUnlockRef.current = new Audio("/sound/money.mp3");
    audioUnlockRef.current.preload = "auto";
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadUserConfig() {
      try {
        setSoundLoading(true);

        const { data: userData, error: userErr } = await supabaseClient.auth.getUser();
        if (userErr || !userData.user) {
          setSoundEnabled(true);
          return;
        }

        const userId = userData.user.id;

        // tenta pegar config existente
        const { data, error } = await supabaseClient
          .from("usuario_config")
          .select("usuario_id, som_novo_pedido")
          .eq("usuario_id", userId)
          .maybeSingle<UsuarioConfigRow>();

        if (error) throw error;

        // se não existir, cria default true
        if (!data) {
          const { data: ins, error: insErr } = await supabaseClient
            .from("usuario_config")
            .insert({ usuario_id: userId, som_novo_pedido: true })
            .select("usuario_id, som_novo_pedido")
            .maybeSingle<UsuarioConfigRow>();

          if (insErr) throw insErr;

          if (mounted) setSoundEnabled(Boolean(ins?.som_novo_pedido ?? true));
          return;
        }

        if (mounted) setSoundEnabled(Boolean(data.som_novo_pedido));
      } catch (err) {
        console.error(err);
        // fallback seguro: liga som
        if (mounted) setSoundEnabled(true);
      } finally {
        if (mounted) setSoundLoading(false);
      }
    }

    loadUserConfig();

    return () => {
      mounted = false;
    };
  }, []);

  async function persistSoundEnabled(next: boolean) {
    const { data: userData } = await supabaseClient.auth.getUser();
    const user = userData.user;
    if (!user) return;

    // update (a linha deve existir, mas mesmo se não existir, tenta criar)
    const { error } = await supabaseClient
      .from("usuario_config")
      .upsert({ usuario_id: user.id, som_novo_pedido: next }, { onConflict: "usuario_id" });

    if (error) {
      console.error(error);
      toast.error("Não foi possível salvar o som. Tente novamente.");
    }
  }

  function unlockAudioOnce() {
    if (audioUnlocked) return;
    const a = audioUnlockRef.current;
    if (!a) return;

    // tentativa de “desbloquear” autoplay (funciona na maioria dos casos)
    a.volume = 0;
    a.currentTime = 0;

    a.play()
      .then(() => {
        a.pause();
        a.volume = 1;
        setAudioUnlocked(true);
      })
      .catch(() => {
        // se falhar, tudo bem — o usuário já clicou, normalmente o próximo play funciona
        setAudioUnlocked(true);
      });
  }

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    toast.dismiss();

    const { error } = await supabaseClient.auth.signOut();

    setLoggingOut(false);

    if (error) {
      toast.error("Não foi possível sair. Tente novamente.");
      return;
    }

    toast.success("Você saiu da conta.");
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-white text-[#0f172a]" onPointerDown={unlockAudioOnce}>
      <Toaster position="top-right" />

      {/* ✅ POPUP GLOBAL em qualquer rota do dashboard */}
      <NovoPedidoPopup soundEnabled={soundEnabled} />

      <div className="flex min-h-screen">
        {/* SIDEBAR */}
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 border-r border-black/10 bg-white md:flex",
            collapsed ? "w-[86px]" : "w-[280px]"
          )}
        >
          <div className="flex h-full w-full flex-col">
            {/* Brand */}
            <div className="flex items-center justify-between gap-3 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-2xl border border-black/10 bg-white">
                  <Image src="/logo.svg" alt="Logo Pneu Forte" fill className="object-contain p-1" priority />
                </div>

                {!collapsed && (
                  <div className="leading-tight">
                    <div className="text-sm font-semibold">Pneu Forte</div>
                    <div className="text-xs text-black/55">Painel do catálogo</div>
                  </div>
                )}
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-auto px-3 pb-4">
              <div className="space-y-4">
                {grouped.map(([group, list]) => (
                  <div key={group}>
                    {!collapsed && (
                      <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-black/45">
                        {group}
                      </div>
                    )}

                    <div className="space-y-1">
                      {list.map((it) => {
                        const active = pathname === it.href;
                        return (
                          <Link
                            key={it.href}
                            href={it.href}
                            className={cn(
                              "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition",
                              "hover:bg-black/5",
                              active && "bg-black/10"
                            )}
                          >
                            <span className="grid h-9 w-9 place-items-center rounded-xl border border-black/10 bg-white">
                              {it.icon}
                            </span>
                            {!collapsed && <span className="font-medium">{it.label}</span>}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </nav>

            {/* Footer */}
            <div className="border-t border-black/10 p-4">
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm hover:bg-black/5",
                  "disabled:cursor-not-allowed disabled:opacity-60"
                )}
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-black/10 bg-white">
                  <LogOut size={18} />
                </span>
                {!collapsed && <span className="font-medium">{loggingOut ? "Saindo..." : "Sair"}</span>}
              </button>
            </div>
          </div>
        </aside>

        {/* CONTENT */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar */}
          <header className="sticky top-0 z-10 border-b border-black/10 bg-white/80 backdrop-blur">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
              <div>
                <div className="text-sm font-semibold">Dashboard</div>
                <div className="text-xs text-black/55">Pneu Forte • gestão do catálogo</div>
              </div>

              <div className="flex items-center gap-2">
                {/* ✅ toggle do som */}
                <button
                  type="button"
                  disabled={soundLoading}
                  onClick={async () => {
                    const next = !soundEnabled;
                    setSoundEnabled(next);
                    await persistSoundEnabled(next);
                  }}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm hover:bg-black/5",
                    "disabled:cursor-not-allowed disabled:opacity-60"
                  )}
                  title="Som de novo pedido"
                >
                  {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  <span className="hidden sm:inline">Som</span>
                </button>

                <button className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm hover:bg-black/5">
                  Exportar
                </button>

                <button
                  className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm hover:bg-black/5"
                  onClick={() => router.push("/dashboard/pedidos")}
                >
                  Pedidos
                </button>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
