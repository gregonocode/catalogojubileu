"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  List,
  Users,
  ReceiptText,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { FaMotorcycle } from "react-icons/fa";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  group?: string;
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const items = useMemo<NavItem[]>(
    () => [
      { label: "Visão geral", href: "/dashboard", icon: <LayoutDashboard size={18} />, group: "Geral" },

      { label: "Cadastrar produto", href: "/dashboard/produtos/novo", icon: <PlusCircle size={18} />, group: "Produtos" },
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

  return (
    <div className="min-h-screen bg-white text-[#0f172a]">
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
                {/* sem círculo com iniciais */}
                <div className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-black/5">
                  <FaMotorcycle size={18} />
                </div>

                {!collapsed && (
                  <div className="leading-tight">
                    <div className="text-sm font-semibold">StartMotos</div>
                    <div className="text-xs text-black/55">Painel do catálogo</div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setCollapsed((v) => !v)}
                className="grid h-9 w-9 place-items-center rounded-xl border border-black/10 bg-white hover:bg-black/5"
                aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
                title={collapsed ? "Expandir" : "Recolher"}
              >
                {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
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
                onClick={() => alert("Depois a gente liga logout real 😉")}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-sm hover:bg-black/5"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl border border-black/10 bg-white">
                  <LogOut size={18} />
                </span>
                {!collapsed && <span className="font-medium">Sair</span>}
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
                <div className="text-xs text-black/55">Vendas e clientes (visual)</div>
              </div>

              <div className="flex items-center gap-2">
                <button className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm hover:bg-black/5">
                  Exportar
                </button>
                <button className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm hover:bg-black/5">
                  Novo pedido
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
