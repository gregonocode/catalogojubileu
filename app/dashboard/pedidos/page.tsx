// app/dashboard/pedidos/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import toast, { Toaster } from "react-hot-toast";
import {
  ClipboardList,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Package,
} from "lucide-react";

const PAGE_SIZE = 10;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type PedidoStatus = "rascunho" | "enviado_whatsapp" | "aprovado" | "cancelado";

type ClienteEmbed = { nome: string | null };

type PedidoRow = {
  id: string;
  empresa_id: string;
  cliente_usuario_id: string | null;
  status: PedidoStatus;
  total: number | string;
  criado_em: string;
  atualizado_em: string;
  // ⚠️ pode vir como array
  clientes?: ClienteEmbed | ClienteEmbed[] | null;
};

type Pedido = {
  id: string;
  empresa_id: string;
  cliente_usuario_id: string | null;
  status: PedidoStatus;
  total: number;
  criado_em: string;
  atualizado_em: string;
  cliente_nome: string | null;
};

type ProdutoEmbed = { nome: string | null };

type PedidoItemRow = {
  id: string;
  pedido_id: string;
  produto_id: string;
  quantidade: number;
  preco_unitario: number | string;
  subtotal: number | string;
  criado_em: string;
  produtos?: ProdutoEmbed | ProdutoEmbed[] | null;
};

type PedidoItem = {
  id: string;
  pedido_id: string;
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  criado_em: string;
  produto_nome: string | null;
};

function toNumber(v: number | string) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatBRL(v: number) {
  return (Number(v) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function shortId(id: string) {
  if (!id) return "";
  const a = id.split("-")[0] ?? id.slice(0, 8);
  return a.toUpperCase();
}

function formatShortDateTime(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy}, ${hh}:${mi}`;
}

function isFinalizado(status: string): boolean {
  return status === "aprovado" || status === "cancelado";
}

function statusLabel(status: string) {
  if (status === "rascunho") return "pendente";
  if (status === "enviado_whatsapp") return "enviado";
  if (status === "aprovado") return "aprovado";
  if (status === "cancelado") return "cancelado";
  return status;
}

// 0 = aparece em cima / 1 = embaixo
function statusRank(status: string): number {
  return isFinalizado(status) ? 1 : 0;
}

function pickClienteNome(v: ClienteEmbed | ClienteEmbed[] | null | undefined) {
  if (!v) return null;
  if (Array.isArray(v)) return v[0]?.nome ?? null;
  return v.nome ?? null;
}

function pickProdutoNome(v: ProdutoEmbed | ProdutoEmbed[] | null | undefined) {
  if (!v) return null;
  if (Array.isArray(v)) return v[0]?.nome ?? null;
  return v.nome ?? null;
}

export default function PedidosPage() {
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [page, setPage] = useState(1); // 1-based
  const [totalCount, setTotalCount] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [itemsByPedido, setItemsByPedido] = useState<Record<string, PedidoItem[]>>({});
  const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});

  const totalPedidos = useMemo(() => pedidos.length, [pedidos]);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), [totalCount]);
  const pedidosOrdenados = useMemo(() => {
    const copy = [...pedidos];
    copy.sort((a, b) => {
      const ra = statusRank(a.status);
      const rb = statusRank(b.status);
      if (ra !== rb) return ra - rb;

      const da = new Date(a.criado_em).getTime();
      const db = new Date(b.criado_em).getTime();
      return db - da;
    });
    return copy;
  }, [pedidos]);

  async function loadPedidos() {
    try {
      setLoading(true);

      // 1) pega a empresa do dono logado
      const { data: empresas, error: empErr } = await supabaseClient
        .from("empresas")
        .select("id")
        .order("criado_em", { ascending: true })
        .limit(1);

      if (empErr) throw empErr;

      const empresaId = empresas?.[0]?.id;
      if (!empresaId) {
        setPedidos([]);
        setTotalCount(0);
        return;
      }

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // 2) busca pedidos só dessa empresa
      const { data, count, error } = await supabaseClient
        .from("pedidos")
        .select(
          `
          id, empresa_id, cliente_usuario_id, status, total, criado_em, atualizado_em,
          clientes:clientes!pedidos_cliente_usuario_id_fkey(nome)
          `,
          { count: "exact" }
        )
        .eq("empresa_id", empresaId)
        .order("criado_em", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const rows = (data ?? []) as unknown as PedidoRow[];

      const normalized: Pedido[] = rows.map((r) => ({
        id: r.id,
        empresa_id: r.empresa_id,
        cliente_usuario_id: r.cliente_usuario_id ?? null,
        status: r.status,
        total: toNumber(r.total),
        criado_em: r.criado_em,
        atualizado_em: r.atualizado_em,
        cliente_nome: pickClienteNome(r.clientes),
      }));

      setTotalCount(count ?? 0);
      setPedidos(normalized);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível carregar os pedidos.");
    } finally {
      setLoading(false);
    }
  }

  async function loadItens(pedidoId: string) {
    if (itemsByPedido[pedidoId]?.length) return;

    setLoadingItems((prev) => ({ ...prev, [pedidoId]: true }));

    try {
      const { data, error } = await supabaseClient
        .from("pedidos_itens")
        .select(
          `
          id, pedido_id, produto_id, quantidade, preco_unitario, subtotal, criado_em,
          produtos:produtos!pedidos_itens_produto_id_fkey(nome)
          `
        )
        .eq("pedido_id", pedidoId)
        .order("criado_em", { ascending: true });

      if (error) throw error;

      const rows = (data ?? []) as unknown as PedidoItemRow[];

      const normalized: PedidoItem[] = rows.map((it) => ({
        id: it.id,
        pedido_id: it.pedido_id,
        produto_id: it.produto_id,
        quantidade: it.quantidade,
        preco_unitario: toNumber(it.preco_unitario),
        subtotal: toNumber(it.subtotal),
        criado_em: it.criado_em,
        produto_nome: pickProdutoNome(it.produtos),
      }));

      setItemsByPedido((prev) => ({ ...prev, [pedidoId]: normalized }));
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível carregar os itens do pedido.");
    } finally {
      setLoadingItems((prev) => ({ ...prev, [pedidoId]: false }));
    }
  }

  async function toggleExpand(pedidoId: string) {
    setExpanded((prev) => {
      const nextOpen = !prev[pedidoId];
      return { ...prev, [pedidoId]: nextOpen };
    });

    const willOpen = !expanded[pedidoId];
    if (willOpen) await loadItens(pedidoId);
  }

  async function aprovarPedido(pedidoId: string) {
    try {
      const { error } = await supabaseClient.rpc("rpc_aprovar_pedido", {
        p_pedido_id: pedidoId,
      });
      if (error) throw error;

      toast.success("Pedido aprovado! Estoque atualizado.");
      await loadPedidos();
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível aprovar o pedido.");
    }
  }

  async function cancelarPedido(pedidoId: string) {
    try {
      const { error } = await supabaseClient.rpc("rpc_cancelar_pedido", {
        p_pedido_id: pedidoId,
      });
      if (error) throw error;

      toast.success("Pedido cancelado.");
      await loadPedidos();
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível cancelar o pedido.");
    }
  }

  useEffect(() => {
    loadPedidos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <div className="min-h-screen bg-white text-[#0f172a]">
      <Toaster position="top-right" />

      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        {/* Header */}
        <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl border border-black/10 bg-black/5">
                <ClipboardList size={18} />
              </div>
              <div>
                <div className="text-lg font-semibold text-black">Pedidos</div>
                <div className="text-sm text-black/55">
                  {loading ? "Carregando..." : `${totalPedidos} pedido(s)`}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={loadPedidos}
              className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm hover:bg-black/5"
            >
              <RefreshCw size={16} /> Atualizar
            </button>
          </div>
        </section>

        {/* Lista */}
        <section className="mt-6 pb-10">
          {loading ? (
            <div className="rounded-3xl border border-black/10 bg-white p-6">
              <div className="h-5 w-44 rounded bg-black/5" />
              <div className="mt-3 h-4 w-72 rounded bg-black/5" />
              <div className="mt-6 h-10 w-full rounded-2xl bg-black/5" />
            </div>
          ) : pedidos.length === 0 ? (
            <div className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/60">
              Nenhum pedido encontrado.
            </div>
          ) : (
            <div className="space-y-3">
              {pedidosOrdenados.map((p) => {
                const isExpanded = Boolean(expanded[p.id]);
                const finalizado = isFinalizado(p.status);
                const clienteNome = p.cliente_nome?.trim() || "Cliente sem nome";
                const itens = itemsByPedido[p.id] ?? [];
                const itensCount = itens.length;

                return (
                  <div
                    key={p.id}
                    className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-black">
                            Pedido #{shortId(p.id)}
                          </div>

                          <span
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs font-semibold",
                              p.status === "aprovado" && "border-green-200 bg-green-50 text-green-700",
                              p.status === "cancelado" && "border-red-200 bg-red-50 text-red-700",
                              (p.status === "rascunho" || p.status === "enviado_whatsapp") &&
                                "border-black/10 bg-black/5 text-black/70"
                            )}
                            title={p.status}
                          >
                            {statusLabel(p.status)}
                          </span>
                        </div>

                        <div className="mt-1 text-sm text-black/70">{clienteNome}</div>

                        <div className="mt-1 text-xs text-black/45">
                          {formatShortDateTime(p.criado_em)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-black/55">Total</div>
                        <div className="text-lg font-semibold text-black">
                          {formatBRL(p.total)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => toggleExpand(p.id)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm hover:bg-black/5"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        {isExpanded ? "Ocultar itens" : "Ver itens"}
                        <span className="ml-1 text-xs text-black/45">
                          {itensCount > 0 ? `(${itensCount})` : ""}
                        </span>
                      </button>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => cancelarPedido(p.id)}
                          disabled={finalizado}
                          className={cn(
                            "rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium text-black/70 hover:bg-black/5",
                            finalizado && "cursor-not-allowed opacity-40 hover:bg-white"
                          )}
                        >
                          Cancelar
                        </button>

                        <button
                          type="button"
                          onClick={() => aprovarPedido(p.id)}
                          disabled={finalizado}
                          className={cn(
                            "rounded-xl bg-[#16a34a] px-3 py-2 text-sm font-semibold text-white hover:brightness-95",
                            finalizado && "cursor-not-allowed opacity-40 hover:brightness-100"
                          )}
                        >
                          Aprovar
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-black/10">
                        <div className="flex items-center justify-between gap-2 bg-black/5 px-4 py-3">
                          <div className="flex items-center gap-2 text-xs font-semibold text-black/70">
                            <Package size={14} /> Itens do pedido
                          </div>
                          <div className="text-xs text-black/45">
                            {loadingItems[p.id]
                              ? "Carregando..."
                              : `${(itemsByPedido[p.id]?.length ?? 0)} item(ns)`}
                          </div>
                        </div>

                        {loadingItems[p.id] ? (
                          <div className="p-4">
                            <div className="h-4 w-56 rounded bg-black/5" />
                            <div className="mt-2 h-4 w-72 rounded bg-black/5" />
                          </div>
                        ) : (itemsByPedido[p.id]?.length ?? 0) === 0 ? (
                          <div className="p-4 text-sm text-black/60">
                            Nenhum item encontrado.
                          </div>
                        ) : (
                          <div className="divide-y divide-black/10">
                            {(itemsByPedido[p.id] ?? []).map((it) => (
                              <div
                                key={it.id}
                                className="flex items-center justify-between gap-3 p-4 hover:bg-black/5"
                              >
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-black">
                                    {it.produto_nome ?? it.produto_id}
                                  </div>
                                  <div className="mt-1 text-xs text-black/45">
                                    {it.quantidade}x • {formatBRL(it.preco_unitario)}
                                  </div>
                                </div>

                                <div className="shrink-0 text-sm font-semibold text-black">
                                  {formatBRL(it.subtotal)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="mt-4 flex items-center justify-between">
                <div className="text-xs text-black/50">
                  Página {page} de {totalPages} • {totalCount} pedido(s)
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/70 hover:bg-black/5 disabled:opacity-50"
                  >
                    Anterior
                  </button>

                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black/70 hover:bg-black/5 disabled:opacity-50"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
