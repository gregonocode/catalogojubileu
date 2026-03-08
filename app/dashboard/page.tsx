"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  TrendingUp,
  Users,
  ReceiptText,
  ChevronDown,
  Bell,
  BellRing,
} from "lucide-react";
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
  icon: ReactNode;
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

type PushPermissionState = NotificationPermission | "unsupported" | "checking";

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
    const from = startOfDayLocal(addDaysLocal(now, -6));
    return { from, to: tomorrowStart };
  }

  if (periodo === "mes") {
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
  return "bg-black/5 text-black ring-black/10";
}

type StatusResumo = {
  aprovado: number;
  pendente: number;
  cancelado: number;
  total: number;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);

  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [produtosAtivos, setProdutosAtivos] = useState(0);
  const [categorias, setCategorias] = useState(0);
  const [pedidosTotal, setPedidosTotal] = useState(0);
  const [pedidosPendentes, setPedidosPendentes] = useState(0);
  const [clientesUnicos, setClientesUnicos] = useState(0);

  const [periodo, setPeriodo] = useState<PeriodoFiltro>("semana");

  const [vendasPeriodo, setVendasPeriodo] = useState<Array<{ status: string; total: number }>>(
    []
  );

  const [pedidosRecentes, setPedidosRecentes] = useState<PedidoRecente[]>([]);
  const [mapaClientes, setMapaClientes] = useState<Map<string, Cliente>>(new Map());

  const [pushPermission, setPushPermission] = useState<PushPermissionState>("checking");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const periodoLabel = useMemo(() => {
    if (periodo === "hoje") return "Hoje";
    if (periodo === "semana") return "Esta semana";
    if (periodo === "mes") return "Este mês";
    return "Todo período";
  }, [periodo]);

  const resumoStatus = useMemo<StatusResumo>(() => {
    const sum = { aprovado: 0, pendente: 0, cancelado: 0, total: 0 };

    for (const r of vendasPeriodo) {
      const st = r.status;
      const val = Number(r.total) || 0;

      if (st === "aprovado") sum.aprovado += val;
      else if (st === "enviado_whatsapp" || st === "rascunho") sum.pendente += val;
      else if (st === "cancelado") sum.cancelado += val;

      sum.total += val;
    }

    return sum;
  }, [vendasPeriodo]);

  function pct(part: number) {
    if (resumoStatus.total <= 0) return 0;
    return (part / resumoStatus.total) * 100;
  }

  async function syncPushStatus() {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushPermission("unsupported");
      setPushEnabled(false);
      return;
    }

    setPushPermission(Notification.permission);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setPushEnabled(Boolean(subscription));
    } catch (err) {
      console.error("Erro ao verificar push subscription:", err);
      setPushEnabled(false);
    }
  }

  async function enablePushNotifications() {
    if (!empresa?.id || !currentUserId) {
      toast.error("Empresa ou usuário não carregado ainda.");
      return;
    }

    if (typeof window === "undefined") return;

    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushPermission("unsupported");
      toast.error("Seu navegador não suporta notificações push.");
      return;
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      toast.error("Falta configurar NEXT_PUBLIC_VAPID_PUBLIC_KEY.");
      return;
    }

    try {
      setPushLoading(true);

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      let permission = Notification.permission;

      if (permission !== "granted") {
        permission = await Notification.requestPermission();
      }

      setPushPermission(permission);

      if (permission !== "granted") {
        toast.error("Permissão de notificação não concedida.");
        return;
      }

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      const {
  data: { session },
} = await supabaseClient.auth.getSession();

const accessToken = session?.access_token;

if (!accessToken) {
  throw new Error("Sessão inválida para registrar notificações.");
}

const res = await fetch("/api/push/subscribe", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    empresa_id: empresa.id,
    user_id: currentUserId,
    subscription: subscription.toJSON(),
  }),
});

      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "Falha ao salvar inscrição de notificação.");
      }

      setPushEnabled(true);
      toast.success("Notificações ativadas com sucesso.");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível ativar as notificações.");
    } finally {
      setPushLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrapPush() {
      if (typeof window === "undefined") return;

      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (mounted) {
          setPushPermission("unsupported");
          setPushEnabled(false);
        }
        return;
      }

      try {
        await navigator.serviceWorker.register("/sw.js");
        if (!mounted) return;

        setPushPermission(Notification.permission);
        await syncPushStatus();
      } catch (err) {
        console.error("Erro ao registrar service worker:", err);
      }
    }

    bootstrapPush();

    return () => {
      mounted = false;
    };
  }, []);

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
        if (mounted) setCurrentUserId(userId);

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

        const range = getPeriodoRange(periodo);
        const fromIso = range.from ? toIsoForSupabase(range.from) : null;
        const toIso = range.to ? toIsoForSupabase(range.to) : null;

        let vendasQuery = supabaseClient
          .from("pedidos")
          .select("status, total")
          .eq("empresa_id", empresaId);

        if (fromIso) vendasQuery = vendasQuery.gte("criado_em", fromIso);
        if (toIso) vendasQuery = vendasQuery.lt("criado_em", toIso);

        const { data: vendasRows, error: vendasErr } = await vendasQuery;
        if (vendasErr) throw vendasErr;

        const [
          produtosAtivosRes,
          categoriasRes,
          pedidosTotalRes,
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

        const recentes = (pedidosRecentesRes.data ?? []) as PedidoRecente[];
        setPedidosRecentes(recentes);

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

        setVendasPeriodo(
          (vendasRows ?? []).map((r) => ({
            status: String(r.status),
            total: Number(r.total) || 0,
          }))
        );
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
      <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-black/60">Empresa</div>
            <div className="text-lg font-semibold text-black">{empresa ? empresa.nome : "—"}</div>
            <div className="mt-1 text-xs text-black/55">
              WhatsApp: {empresa?.whatsapp ?? "—"} • Slug: {empresa?.slug ?? "—"}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-2xl border border-black/10 bg-black/5 px-4 py-3">
              <div className="text-xs text-black/55">Produtos ativos</div>
              <div className="text-base font-semibold">{loading ? "—" : produtosAtivos}</div>
            </div>

            <button
              type="button"
              onClick={enablePushNotifications}
              disabled={
                pushLoading ||
                pushPermission === "unsupported" ||
                !empresa ||
                !currentUserId ||
                pushEnabled
              }
              className={cn(
                "inline-flex h-[50px] items-center gap-2 rounded-2xl px-4 text-sm font-medium transition",
                pushEnabled
                  ? "border border-green-200 bg-green-50 text-green-700"
                  : "border border-black/10 bg-white text-black/80 hover:bg-black/5",
                (pushLoading || pushPermission === "unsupported" || !empresa || !currentUserId) &&
                  "cursor-not-allowed opacity-60"
              )}
              title={
                pushPermission === "unsupported"
                  ? "Seu navegador não suporta notificações push"
                  : pushEnabled
                    ? "Notificações já ativadas"
                    : "Ativar notificações"
              }
            >
              {pushEnabled ? <BellRing size={16} /> : <Bell size={16} />}
              {pushLoading
                ? "Ativando..."
                : pushPermission === "unsupported"
                  ? "Sem suporte"
                  : pushEnabled
                    ? "Notificações ativas"
                    : "Ativar notificações"}
            </button>

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
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/50"
              />
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs text-black/55">
          {pushPermission === "unsupported" && "Este navegador não suporta notificações push."}
          {pushPermission === "default" &&
            "Ative as notificações para receber aviso de novas vendas no app do dashboard."}
          {pushPermission === "denied" &&
            "As notificações foram bloqueadas no navegador. Libere manualmente nas permissões do site."}
          {pushPermission === "granted" && pushEnabled && "Seu dashboard já está pronto para receber notificações."}
          {pushPermission === "granted" && !pushEnabled && "Permissão concedida. Falta concluir a inscrição do dispositivo."}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card
          title="Vendas (aprovadas)"
          value={loading ? "—" : formatBRL(resumoStatus.aprovado)}
          subtitle="Soma dos pedidos aprovados no período"
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
          subtitle={loading ? "—" : `${pedidosPendentes} pendente(s)`}
          icon={<ReceiptText size={18} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold text-black">Resumo por Status</div>
              <div className="mt-1 text-xs text-black/55">
                Distribuição do faturamento por status do pedido.
              </div>
            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-black/5">
              <ReceiptText className="h-5 w-5 text-black/70" />
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-full">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold text-black">Aprovados</span>
                  <span className="text-black/60">
                    {pct(resumoStatus.aprovado).toFixed(1)}% • {formatBRL(resumoStatus.aprovado)}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-black/5">
                  <div
                    className="h-2.5 rounded-full bg-emerald-600 transition-[width]"
                    style={{ width: `${pct(resumoStatus.aprovado)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-full">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold text-black">Pendentes</span>
                  <span className="text-black/60">
                    {pct(resumoStatus.pendente).toFixed(1)}% • {formatBRL(resumoStatus.pendente)}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-black/5">
                  <div
                    className="h-2.5 rounded-full bg-blue-600 transition-[width]"
                    style={{ width: `${pct(resumoStatus.pendente)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-full">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-semibold text-black">Cancelados</span>
                  <span className="text-black/60">
                    {pct(resumoStatus.cancelado).toFixed(1)}% • {formatBRL(resumoStatus.cancelado)}
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-black/5">
                  <div
                    className="h-2.5 rounded-full bg-amber-600 transition-[width]"
                    style={{ width: `${pct(resumoStatus.cancelado)}%` }}
                  />
                </div>
              </div>
            </div>

            {!loading && resumoStatus.total === 0 ? (
              <div className="mt-6 rounded-2xl border border-black/10 bg-black/5 p-4 text-sm text-black/60">
                Nenhuma venda encontrada para este período.
              </div>
            ) : null}
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
              { k: `Vendas (${periodoLabel})`, v: loading ? "—" : formatBRL(resumoStatus.aprovado) },
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