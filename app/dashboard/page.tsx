"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Users, ReceiptText, ArrowUpRight, ChevronDown } from "lucide-react";
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

type PedidoStatus = "rascunho" | "enviado_whatsapp" | "aprovado" | "cancelado";

type PedidoRecente = {
  id: string;
  criado_em: string;
  status: PedidoStatus;
  total: number;
  cliente_usuario_id: string | null;
};

type Cliente = {
  usuario_id: string;
  nome: string | null;
  telefone: string | null;
};

type PeriodoFiltro = "hoje" | "semana" | "mes" | "total";

function startOfDayLocal(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function addDaysLocal(d: Date, days: number) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function toIsoForSupabase(d: Date) {
  return d.toISOString();
}

function getPeriodoRange(periodo: PeriodoFiltro) {
  const now = new Date();
  const todayStart = startOfDayLocal(now);
  const tomorrowStart = startOfDayLocal(addDaysLocal(now, 1));

  if (periodo === "hoje") {
    return { from: todayStart, to: tomorrowStart };
  }

  if (periodo === "semana") {
    // últimos 7 dias (inclui hoje)
    const from = startOfDayLocal(addDaysLocal(now, -6));
    return { from, to: tomorrowStart };
  }

  if (periodo === "mes") {
    // últimos 30 dias (inclui hoje)
    const from = startOfDayLocal(addDaysLocal(now, -29));
    return { from, to: tomorrowStart };
  }

  return { from: null as Date | null, to: null as Date | null };
}

function statusLabel(status: PedidoStatus) {
  if (status === "rascunho") return "Pendente";
  if (status === "enviado_whatsapp") return "Enviado";
  if (status === "aprovado") return "Aprovado";
  if (status === "cancelado") return "Cancelado";
  return status;
}

function statusBadgeClass(status: PedidoStatus) {
  if (status === "aprovado") return "bg-green-50 text-green-700 ring-green-200";
  if (status === "cancelado") return "bg-red-50 text-red-700 ring-red-200";
  if (status === "enviado_whatsapp") return "bg-white text-black/70 ring-black/10";
  return "bg-black/5 text-black ring-black/10"; // rascunho
}

type SerieDia = { key: string; label: string; total: number };

function fmtDiaLabel(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function diaKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);

  const [empresa, setEmpresa] = useState<Empresa | null>(null);

  const [produtosAtivos, setProdutosAtivos] = useState(0);
  const [categorias, setCategorias] = useState(0);
  const [pedidosTotal, setPedidosTotal] = useState(0);
  const [pedidosPendentes, setPedidosPendentes] = useState(0);
  const [clientesUnicos, setClientesUnicos] = useState(0);

  const [periodo, setPeriodo] = useState<PeriodoFiltro>("semana");

  const [vendasAprovadas, setVendasAprovadas] = useState(0);
  const [serieAprovadas, setSerieAprovadas] = useState<SerieDia[]>([]);

  const [pedidosRecentes, setPedidosRecentes] = useState<PedidoRecente[]>([]);
  const [mapaClientes, setMapaClientes] = useState<Map<string, Cliente>>(new Map());

  const periodoLabel = useMemo(() => {
    if (periodo === "hoje") return "Hoje";
    if (periodo === "semana") return "Esta semana";
    if (periodo === "mes") return "Este mês";
    return "Todo período";
  }, [periodo]);

  const maxSerie = useMemo(() => {
    return Math.max(1, ...serieAprovadas.map((x) => x.total));
  }, [serieAprovadas]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);

        const { data: userData, error: userErr } = await supabaseClient.auth.getUser();
        if (userErr || !userData.user) {
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

        // período
        const range = getPeriodoRange(periodo);
        const fromIso = range.from ? toIsoForSupabase(range.from) : null;
        const toIso = range.to ? toIsoForSupabase(range.to) : null;

        // contadores + recentes em paralelo
        const [
          produtosAtivosRes,
          categoriasRes,
          pedidosTotalRes,
          pendentesRes,
          pedidosRecentesRes,
          clientesIdsRes,
          aprovadosPeriodoRes,
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
            .in("status", ["rascunho", "enviado_whatsapp"]),

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

          // pedidos aprovados no período (para soma + gráfico)
          (() => {
            let q = supabaseClient
              .from("pedidos")
              .select("id, total, criado_em, status")
              .eq("empresa_id", empresaId)
              .eq("status", "aprovado");

            if (fromIso) q = q.gte("criado_em", fromIso);
            if (toIso) q = q.lt("criado_em", toIso);

            return q;
          })(),
        ]);

        if (!mounted) return;

        setProdutosAtivos(produtosAtivosRes.count ?? 0);
        setCategorias(categoriasRes.count ?? 0);
        setPedidosTotal(pedidosTotalRes.count ?? 0);
        setPedidosPendentes(pendentesRes.count ?? 0);

        const clientesIds = (clientesIdsRes.data ?? [])
          .map((r) => r.cliente_usuario_id)
          .filter((v): v is string => typeof v === "string");
        setClientesUnicos(new Set(clientesIds).size);

        // recentes
        const recentes = (pedidosRecentesRes.data ?? []) as PedidoRecente[];
        setPedidosRecentes(recentes);

        // mapa clientes (para recentes)
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

        // vendas aprovadas no período + série (por dia)
        const aprovados = (aprovadosPeriodoRes.data ?? []) as Array<{
          id: string;
          total: number;
          criado_em: string;
          status: "aprovado";
        }>;

        const soma = aprovados.reduce((acc, p) => acc + (Number(p.total) || 0), 0);
        setVendasAprovadas(soma);

        // construir série (hoje/semana/mes) ou "total" -> usamos últimos 14 dias pra não ficar gigante
        const shouldUseRange =
          periodo === "hoje" || periodo === "semana" || periodo === "mes";

        const now = new Date();
        const seriesFrom = shouldUseRange
          ? (range.from ?? startOfDayLocal(addDaysLocal(now, -13)))
          : startOfDayLocal(addDaysLocal(now, -13));
        const seriesTo = shouldUseRange
          ? (range.to ?? startOfDayLocal(addDaysLocal(now, 1)))
          : startOfDayLocal(addDaysLocal(now, 1));

        const days: SerieDia[] = [];
        for (let d = startOfDayLocal(seriesFrom); d < seriesTo; d = addDaysLocal(d, 1)) {
          days.push({ key: diaKey(d), label: fmtDiaLabel(d), total: 0 });
        }

        const index = new Map<string, number>();
        days.forEach((x, i) => index.set(x.key, i));

        aprovados.forEach((p) => {
          const dt = new Date(p.criado_em);
          const k = diaKey(new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()));
          const i = index.get(k);
          if (typeof i === "number") days[i]!.total += Number(p.total) || 0;
        });

        setSerieAprovadas(days);
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
  }, [periodo]);

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
      {/* topo empresa + filtro */}
      <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-black/60">Empresa</div>
            <div className="text-lg font-semibold text-black">{empresa ? empresa.nome : "—"}</div>
            <div className="mt-1 text-xs text-black/55">
              WhatsApp: {empresa?.whatsapp ?? "—"} • Slug: {empresa?.slug ?? "—"}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-2xl border border-black/10 bg-black/5 px-4 py-3">
              <div className="text-xs text-black/55">Produtos ativos</div>
              <div className="text-base font-semibold">{loading ? "—" : produtosAtivos}</div>
            </div>

            {/* dropdown período */}
            <div className="relative">
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value as PeriodoFiltro)}
                className="h-[50px] appearance-none rounded-2xl border border-black/10 bg-white pl-4 pr-10 text-sm font-medium text-black/80 outline-none hover:bg-black/5"
                aria-label="Filtrar período"
              >
                <option value="hoje">Hoje</option>
                <option value="semana">Esta semana</option>
                <option value="mes">Este mês</option>
                <option value="total">Todo período</option>
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/50" />
            </div>
          </div>
        </div>
      </div>

      {/* cards principais */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card
          title={`Vendas (${periodoLabel})`}
          value={loading ? "—" : formatBRL(vendasAprovadas)}
          subtitle="Somente pedidos aprovados"
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
          subtitle={loading ? "—" : `${pedidosPendentes} pendente(s)`} // rascunho + enviado
          icon={<ReceiptText size={18} />}
        />
      </div>

      {/* gráfico funcional + resumo */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-black">Atividade</div>
              <div className="text-xs text-black/55">
                Vendas aprovadas por dia ({periodo !== "total" ? periodoLabel : "últimos 14 dias"})
              </div>
            </div>

            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm hover:bg-black/5"
            >
              Detalhes <ArrowUpRight size={16} />
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
            {loading ? (
              <div className="h-[220px] w-full rounded-xl bg-black/5 animate-pulse" />
            ) : (
              <div className="h-[220px]">
                <div className="flex h-full items-end gap-2">
                  {serieAprovadas.map((d) => {
                    const h = Math.max(3, Math.round((d.total / maxSerie) * 100)); // %
                    return (
                      <div key={d.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                        <div
                          className="w-full rounded-xl border border-black/10 bg-black/5"
                          style={{ height: `${h}%` }}
                          title={`${d.label} • ${formatBRL(d.total)}`}
                        />
                        <div className="text-[11px] text-black/45">{d.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
              { k: `Vendas (${periodoLabel})`, v: loading ? "—" : formatBRL(vendasAprovadas) },
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

          <button
            type="button"
            className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm hover:bg-black/5"
          >
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

                  return (
                    <tr key={p.id} className="hover:bg-black/5">
                      <td className="px-4 py-3 font-medium text-black">{p.id.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-black/70">{clienteNome}</td>
                      <td className="px-4 py-3 text-black/70">{valor > 0 ? formatBRL(valor) : "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-1 text-xs font-semibold ring-1",
                            statusBadgeClass(p.status)
                          )}
                        >
                          {statusLabel(p.status)}
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
