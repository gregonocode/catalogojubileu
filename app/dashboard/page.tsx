"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Users, ReceiptText, ArrowUpRight } from "lucide-react";
import { supabaseClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Card({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
      <div className="flex items-center justify-between">
        <div className="text-sm text-black/60">{title}</div>
        <div className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-black/5">
          {icon}
        </div>
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-black">{value}</div>
      <div className="mt-2 text-sm text-black/55">{subtitle}</div>
    </div>
  );
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type Empresa = {
  id: string;
  nome: string;
  whatsapp: string;
  slug: string;
};

type PedidoRecente = {
  id: string;
  criado_em: string;
  status: "rascunho" | "enviado_whatsapp" | "cancelado";
  total: number;
  cliente_usuario_id: string | null;
};

type Cliente = {
  usuario_id: string;
  nome: string | null;
  telefone: string | null;
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);

  const [empresa, setEmpresa] = useState<Empresa | null>(null);

  const [produtosAtivos, setProdutosAtivos] = useState(0);
  const [categorias, setCategorias] = useState(0);
  const [pedidosTotal, setPedidosTotal] = useState(0);
  const [pedidosPendentes, setPedidosPendentes] = useState(0);
  const [clientesUnicos, setClientesUnicos] = useState(0);

  const [pedidosRecentes, setPedidosRecentes] = useState<PedidoRecente[]>([]);
  const [mapaClientes, setMapaClientes] = useState<Map<string, Cliente>>(new Map());

  const totalVendasAprox = useMemo(() => {
    return pedidosRecentes.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
  }, [pedidosRecentes]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);

        const { data: userData, error: userErr } = await supabaseClient.auth.getUser();
        if (userErr || !userData.user) {
          // middleware já protege, mas aqui é fallback
          window.location.href = "/login";
          return;
        }

        const userId = userData.user.id;

        // empresa do dono
        const { data: emp, error: empErr } = await supabaseClient
          .from("empresas")
          .select("id, nome, whatsapp, slug")
          .eq("dono_usuario_id", userId)
          .maybeSingle();

        if (empErr) throw empErr;

        if (!emp) {
          if (mounted) setEmpresa(null);
          return;
        }

        if (!mounted) return;
        setEmpresa(emp);

        const empresaId = emp.id;

        // contadores + pedidos recentes em paralelo
        const [
          produtosAtivosRes,
          categoriasRes,
          pedidosRes,
          pendentesRes,
          pedidosRecentesRes,
          clientesIdsRes,
        ] = await Promise.all([
          supabaseClient
            .from("produtos")
            .select("id", { count: "exact", head: true })
            .eq("empresa_id", empresaId)
            .eq("ativo", true),

          supabaseClient
            .from("categorias")
            .select("id", { count: "exact", head: true })
            .eq("empresa_id", empresaId),

          supabaseClient
            .from("pedidos")
            .select("id", { count: "exact", head: true })
            .eq("empresa_id", empresaId),

          supabaseClient
            .from("pedidos")
            .select("id", { count: "exact", head: true })
            .eq("empresa_id", empresaId)
            .eq("status", "enviado_whatsapp"),

          supabaseClient
            .from("pedidos")
            .select("id, criado_em, status, total, cliente_usuario_id")
            .eq("empresa_id", empresaId)
            .order("criado_em", { ascending: false })
            .limit(5),

          supabaseClient
            .from("pedidos")
            .select("cliente_usuario_id")
            .eq("empresa_id", empresaId),
        ]);

        if (!mounted) return;

        setProdutosAtivos(produtosAtivosRes.count ?? 0);
        setCategorias(categoriasRes.count ?? 0);
        setPedidosTotal(pedidosRes.count ?? 0);
        setPedidosPendentes(pendentesRes.count ?? 0);

        const clientesIds = (clientesIdsRes.data ?? [])
          .map((r) => r.cliente_usuario_id)
          .filter((v): v is string => typeof v === "string");
        setClientesUnicos(new Set(clientesIds).size);

        const recentes = (pedidosRecentesRes.data ?? []) as PedidoRecente[];
        setPedidosRecentes(recentes);

        // mapa de clientes para mostrar na tabela
        const recentClientIds = Array.from(
          new Set(recentes.map((p) => p.cliente_usuario_id).filter(Boolean))
        ) as string[];

        if (recentClientIds.length > 0) {
          const { data: clientesInfo, error: cliErr } = await supabaseClient
            .from("clientes")
            .select("usuario_id, nome, telefone")
            .in("usuario_id", recentClientIds);

          if (cliErr) throw cliErr;

          const map = new Map<string, Cliente>();
          (clientesInfo ?? []).forEach((c) => map.set(c.usuario_id, c));
          setMapaClientes(map);
        } else {
          setMapaClientes(new Map());
        }
      } catch (err: unknown) {
        console.error(err);
        toast.error("Erro ao carregar dados do dashboard.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  // Estado: sem empresa ainda
  if (!loading && !empresa) {
    return (
      <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
        <div className="text-lg font-semibold text-black">Falta criar sua empresa</div>
        <p className="mt-2 text-sm text-black/60">
          Você já está logado, mas ainda não existe uma empresa cadastrada para esse usuário.
        </p>
        <div className="mt-5 rounded-2xl border border-black/10 bg-black/5 p-4 text-sm text-black/70">
          Próximo passo: criar a empresa em <b>Configuração</b>.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* topo info empresa */}
      <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-black/60">Empresa</div>
            <div className="text-lg font-semibold text-black">
              {empresa ? empresa.nome : "—"}
            </div>
            <div className="mt-1 text-xs text-black/55">
              WhatsApp: {empresa?.whatsapp ?? "—"} • Slug: {empresa?.slug ?? "—"}
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-black/5 px-4 py-3">
            <div className="text-xs text-black/55">Produtos ativos</div>
            <div className="text-base font-semibold">{loading ? "—" : produtosAtivos}</div>
          </div>
        </div>
      </div>

      {/* cards principais */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card
          title="Vendas (aprox.)"
          value={loading ? "—" : formatBRL(totalVendasAprox)}
          subtitle="Soma do total dos pedidos recentes"
          icon={<TrendingUp size={18} />}
        />
        <Card
          title="Clientes"
          value={loading ? "—" : String(clientesUnicos)}
          subtitle="Clientes únicos com pedido"
          icon={<Users size={18} />}
        />
        <Card
          title="Pedidos"
          value={loading ? "—" : String(pedidosTotal)}
          subtitle={loading ? "—" : `${pedidosPendentes} pendente(s) no WhatsApp`}
          icon={<ReceiptText size={18} />}
        />
      </div>

      {/* gráfico placeholder + resumo real */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-black">Atividade</div>
              <div className="text-xs text-black/55">vamos ligar gráficos depois</div>
            </div>

            <button className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm hover:bg-black/5">
              Detalhes <ArrowUpRight size={16} />
            </button>
          </div>

          <div className="mt-4 h-[220px] rounded-2xl border border-black/10 bg-black/5 p-4">
            <div className="h-full w-full rounded-xl bg-[linear-gradient(90deg,rgba(0,0,0,0.06)_0%,rgba(0,0,0,0.02)_50%,rgba(0,0,0,0.06)_100%)] animate-pulse" />
          </div>
        </div>

        <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
          <div className="text-sm font-semibold text-black">Resumo</div>
          <div className="mt-1 text-xs text-black/55">métricas reais</div>

          <div className="mt-4 space-y-3">
            {[
              { k: "Categorias", v: loading ? "—" : String(categorias) },
              { k: "Produtos ativos", v: loading ? "—" : String(produtosAtivos) },
              { k: "Pedidos pendentes", v: loading ? "—" : String(pedidosPendentes) },
            ].map((row) => (
              <div
                key={row.k}
                className="flex items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3"
              >
                <span className="text-sm text-black/60">{row.k}</span>
                <span className="text-sm font-semibold text-black">{row.v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* pedidos recentes */}
      <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-black">Pedidos recentes</div>
            <div className="text-xs text-black/55">últimos 5</div>
          </div>

          <button className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm hover:bg-black/5">
            Ver todos
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-black/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/5 text-xs text-black/55">
              <tr>
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-black/10">
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-black/60" colSpan={4}>
                    Carregando...
                  </td>
                </tr>
              ) : pedidosRecentes.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-black/60" colSpan={4}>
                    Nenhum pedido ainda.
                  </td>
                </tr>
              ) : (
                pedidosRecentes.map((p) => {
                  const cliente = p.cliente_usuario_id ? mapaClientes.get(p.cliente_usuario_id) : null;
                  const clienteNome = cliente?.nome ?? "Cliente";
                  const valor = Number(p.total) || 0;

                  const statusLabel =
                    p.status === "enviado_whatsapp"
                      ? "Pendente"
                      : p.status === "cancelado"
                      ? "Cancelado"
                      : "Rascunho";

                  return (
                    <tr key={p.id} className="hover:bg-black/5">
                      <td className="px-4 py-3 font-medium text-black">{p.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-black/70">{clienteNome}</td>
                      <td className="px-4 py-3 text-black/70">
                        {valor > 0 ? formatBRL(valor) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-1 text-xs font-semibold ring-1",
                            statusLabel === "Pendente"
                              ? "bg-white text-black/60 ring-black/10"
                              : "bg-black/5 text-black ring-black/10"
                          )}
                        >
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
