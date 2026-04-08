"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabase/client";
import toast, { Toaster } from "react-hot-toast";
import {
  ClipboardList,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Package,
  Plus,
  Minus,
  X,
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

type ClienteOption = {
  usuario_id: string;
  nome: string | null;
};

type ProdutoCatalogo = {
  id: string;
  nome: string;
  preco: number | string;
  estoque: number;
  ativo: boolean;
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
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [itemsByPedido, setItemsByPedido] = useState<Record<string, PedidoItem[]>>({});
  const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});

  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const [manualOpen, setManualOpen] = useState(false);
  const [creatingManual, setCreatingManual] = useState(false);

  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [produtosCatalogo, setProdutosCatalogo] = useState<ProdutoCatalogo[]>([]);
  const [loadingManualData, setLoadingManualData] = useState(false);

  const [clienteBusca, setClienteBusca] = useState("");
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string>("");
  const [manualQtd, setManualQtd] = useState<Record<string, number>>({});

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

  const clientesFiltrados = useMemo(() => {
    const q = clienteBusca.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => (c.nome ?? "").toLowerCase().includes(q));
  }, [clientes, clienteBusca]);

  const clienteSelecionado = useMemo(() => {
    return clientes.find((c) => c.usuario_id === clienteSelecionadoId) ?? null;
  }, [clientes, clienteSelecionadoId]);

  const manualItens = useMemo(() => {
    return Object.entries(manualQtd)
      .filter(([, quantidade]) => quantidade > 0)
      .map(([produtoId, quantidade]) => {
        const produto = produtosCatalogo.find((p) => p.id === produtoId);
        if (!produto) return null;

        const preco = toNumber(produto.preco);
        return {
          produto,
          quantidade,
          subtotal: preco * quantidade,
        };
      })
      .filter(Boolean) as Array<{
      produto: ProdutoCatalogo;
      quantidade: number;
      subtotal: number;
    }>;
  }, [manualQtd, produtosCatalogo]);

  const manualTotal = useMemo(() => {
    return manualItens.reduce((acc, it) => acc + it.subtotal, 0);
  }, [manualItens]);

  async function loadPedidos() {
    try {
      setLoading(true);

      const { data: empresas, error: empErr } = await supabaseClient
        .from("empresas")
        .select("id")
        .order("criado_em", { ascending: true })
        .limit(1);

      if (empErr) throw empErr;

      const empresaIdFound = empresas?.[0]?.id ?? null;
      setEmpresaId(empresaIdFound);

      if (!empresaIdFound) {
        setPedidos([]);
        setTotalCount(0);
        return;
      }

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, count, error } = await supabaseClient
        .from("pedidos")
        .select(
          `
          id, empresa_id, cliente_usuario_id, status, total, criado_em, atualizado_em,
          clientes:clientes!pedidos_cliente_usuario_id_fkey(nome)
          `,
          { count: "exact" }
        )
        .eq("empresa_id", empresaIdFound)
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

  async function loadManualData() {
  if (!empresaId) return;

  try {
    setLoadingManualData(true);

    const { data: clientesData, error: clientesErr } = await supabaseClient
      .from("clientes")
      .select("usuario_id, nome")
      .order("nome", { ascending: true });

    if (clientesErr) throw clientesErr;

    const { data: produtosData, error: produtosErr } = await supabaseClient
      .from("produtos")
      .select("id, nome, preco, estoque, ativo")
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .order("nome", { ascending: true });

    if (produtosErr) throw produtosErr;

    setClientes((clientesData ?? []) as ClienteOption[]);
    setProdutosCatalogo((produtosData ?? []) as ProdutoCatalogo[]);
  } catch (err) {
    console.error("Erro ao carregar dados do pedido manual:", err);
    toast.error("Não foi possível carregar clientes e produtos.");
  } finally {
    setLoadingManualData(false);
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

  function openManualModal() {
    setManualOpen(true);
    setClienteBusca("");
    setClienteSelecionadoId("");
    setManualQtd({});
    if (!clientes.length || !produtosCatalogo.length) {
      void loadManualData();
    }
  }

  function closeManualModal() {
    if (creatingManual) return;
    setManualOpen(false);
  }

  function incManual(produto: ProdutoCatalogo) {
    setManualQtd((prev) => {
      const current = prev[produto.id] ?? 0;
      const next = current + 1;

      if (produto.estoque === 0) return prev;
      if (produto.estoque > 0 && next > produto.estoque) return prev;

      return { ...prev, [produto.id]: next };
    });
  }

  function decManual(produto: ProdutoCatalogo) {
    setManualQtd((prev) => {
      const current = prev[produto.id] ?? 0;
      const next = Math.max(0, current - 1);
      return { ...prev, [produto.id]: next };
    });
  }

  function setExactManual(produto: ProdutoCatalogo, value: number) {
    const v = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

    setManualQtd((prev) => {
      if (produto.estoque === 0) return prev;
      if (produto.estoque > 0 && v > produto.estoque) {
        return { ...prev, [produto.id]: produto.estoque };
      }
      return { ...prev, [produto.id]: v };
    });
  }

async function criarPedidoManual() {
  if (!empresaId) {
    toast.error("Empresa não encontrada.");
    return;
  }

  if (!clienteSelecionadoId) {
    toast.error("Selecione um cliente.");
    return;
  }

  if (manualItens.length === 0) {
    toast.error("Escolha pelo menos 1 produto.");
    return;
  }

  try {
    setCreatingManual(true);

    const { data, error } = await supabaseClient.rpc("rpc_criar_pedido_manual", {
      p_empresa_id: empresaId,
      p_cliente_usuario_id: clienteSelecionadoId,
      p_itens: manualItens.map((it) => ({
        produto_id: it.produto.id,
        quantidade: it.quantidade,
      })),
    });

    if (error) throw error;

    const pedidoId =
      Array.isArray(data) && data.length > 0
        ? String((data[0] as { pedido_id: string }).pedido_id)
        : "";

    if (!pedidoId) {
      throw new Error("Pedido criado sem retorno de ID.");
    }

    toast.success("Pedido manual criado com sucesso!");

    setManualOpen(false);
    setClienteBusca("");
    setClienteSelecionadoId("");
    setManualQtd({});
    await loadPedidos();
  } catch (err) {
    console.error("Erro ao criar pedido manual:", err);
    toast.error("Não foi possível criar o pedido manual.");
  } finally {
    setCreatingManual(false);
  }
}



  useEffect(() => {
    loadPedidos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    if (manualOpen && empresaId) {
      void loadManualData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualOpen, empresaId]);

  return (
    <div className="min-h-screen bg-white text-[#0f172a]">
      <Toaster position="top-right" />

      <div className="mx-auto w-full max-w-5xl px-4 py-6">
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

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openManualModal}
                className="inline-flex items-center gap-2 rounded-2xl bg-[#EB3410] px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
              >
                <Plus size={16} /> Criar pedido manual
              </button>

              <button
                type="button"
                onClick={loadPedidos}
                className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm hover:bg-black/5"
              >
                <RefreshCw size={16} /> Atualizar
              </button>
            </div>
          </div>
        </section>

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
               role="button"
               tabIndex={0}
               onClick={() => router.push(`/dashboard/pedidos/${p.id}`)}
               onKeyDown={(e) => {
               if (e.key === "Enter" || e.key === " ") {
               e.preventDefault();
                router.push(`/dashboard/pedidos/${p.id}`);
              }
              }}
              className="cursor-pointer rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)] transition hover:-translate-y-[1px] hover:border-black/20 hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.28)]">
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
                        onClick={(e) => {
                        e.stopPropagation();
                        void toggleExpand(p.id);
                       }}
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
                          onClick={(e) => {
                         e.stopPropagation();
                         void cancelarPedido(p.id);
                       }}
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
                          onClick={(e) => {
                          e.stopPropagation();
                          void aprovarPedido(p.id);
                          }}
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
                    <div
                    className="mt-4 overflow-hidden rounded-2xl border border-black/10"
                      onClick={(e) => e.stopPropagation()}>
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

      {manualOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-t-3xl border border-black/10 bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <div>
                <div className="text-lg font-semibold text-black">Criar pedido manual</div>
                <div className="text-sm text-black/55">
                  Selecione um cliente e os produtos do pedido
                </div>
              </div>

              <button
                type="button"
                onClick={closeManualModal}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-white hover:bg-black/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid max-h-[calc(92vh-72px)] grid-cols-1 gap-0 overflow-y-auto lg:grid-cols-[1.05fr_1.2fr]">
              <div className="border-b border-black/10 p-5 lg:border-b-0 lg:border-r">
                <div className="text-sm font-semibold text-black">Cliente</div>

                <input
                  value={clienteBusca}
                  onChange={(e) => setClienteBusca(e.target.value)}
                  placeholder="Buscar cliente pelo nome"
                  className="mt-3 h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-black/20"
                />

                <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                  {loadingManualData ? (
                    <div className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/60">
                      Carregando clientes...
                    </div>
                  ) : clientesFiltrados.length === 0 ? (
                    <div className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/60">
                      Nenhum cliente encontrado.
                    </div>
                  ) : (
                    clientesFiltrados.map((cliente) => {
                      const active = cliente.usuario_id === clienteSelecionadoId;
                      return (
                        <button
                          key={cliente.usuario_id}
                          type="button"
                          onClick={() => setClienteSelecionadoId(cliente.usuario_id)}
                          className={cn(
                            "w-full rounded-2xl border p-3 text-left transition",
                            active
                              ? "border-[#EB3410] bg-[#EB3410]/5"
                              : "border-black/10 bg-white hover:bg-black/5"
                          )}
                        >
                          <div className="text-sm font-medium text-black">
                            {cliente.nome?.trim() || "Cliente sem nome"}
                          </div>
                          <div className="mt-1 text-xs text-black/45">
                            {shortId(cliente.usuario_id)}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="mt-5 rounded-2xl border border-black/10 bg-black/5 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-black/55">
                    Cliente selecionado
                  </div>
                  <div className="mt-2 text-sm font-semibold text-black">
                    {clienteSelecionado?.nome?.trim() || "Nenhum cliente selecionado"}
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="text-sm font-semibold text-black">Produtos</div>

                <div className="mt-3 space-y-3">
                  {loadingManualData ? (
                    <div className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/60">
                      Carregando produtos...
                    </div>
                  ) : produtosCatalogo.length === 0 ? (
                    <div className="rounded-2xl border border-black/10 bg-white p-4 text-sm text-black/60">
                      Nenhum produto ativo encontrado.
                    </div>
                  ) : (
                    produtosCatalogo.map((produto) => {
                      const q = manualQtd[produto.id] ?? 0;
                      const semEstoque = produto.estoque === 0;

                      return (
                        <div
                          key={produto.id}
                          className="rounded-2xl border border-black/10 bg-white p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-black">
                                {produto.nome}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-black/10 bg-black/5 px-3 py-1 text-xs font-semibold text-black">
                                  {formatBRL(toNumber(produto.preco))}
                                </span>
                                <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-black/60">
                                  {semEstoque ? "Sem estoque" : `Estoque: ${produto.estoque}`}
                                </span>
                              </div>
                            </div>

                            <div className="w-full sm:w-auto">
                              <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white p-2">
                                <button
                                  type="button"
                                  onClick={() => decManual(produto)}
                                  disabled={q <= 0}
                                  className="grid h-10 w-10 place-items-center rounded-xl border border-black/10 bg-white hover:bg-black/5 disabled:opacity-50"
                                >
                                  <Minus size={16} />
                                </button>

                                <input
                                  value={q}
                                  onChange={(e) => setExactManual(produto, Number(e.target.value))}
                                  inputMode="numeric"
                                  className="h-10 w-16 rounded-xl border border-black/10 bg-white text-center text-sm outline-none"
                                />

                                <button
                                  type="button"
                                  onClick={() => incManual(produto)}
                                  disabled={semEstoque || (produto.estoque > 0 && q >= produto.estoque)}
                                  className="grid h-10 w-10 place-items-center rounded-xl border border-black/10 bg-white hover:bg-black/5 disabled:opacity-50"
                                >
                                  <Plus size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-5 rounded-3xl border border-black/10 bg-black/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-black">Resumo do pedido</div>
                      <div className="text-xs text-black/55">
                        {manualItens.length} item(ns) selecionado(s)
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs text-black/55">Total</div>
                      <div className="text-lg font-semibold text-black">
                        {formatBRL(manualTotal)}
                      </div>
                    </div>
                  </div>

                  {manualItens.length > 0 && (
                    <div className="mt-4 overflow-hidden rounded-2xl border border-black/10 bg-white">
                      <div className="divide-y divide-black/10">
                        {manualItens.map((it) => (
                          <div
                            key={it.produto.id}
                            className="flex items-center justify-between gap-3 p-4"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-black">
                                {it.produto.nome}
                              </div>
                              <div className="mt-1 text-xs text-black/45">
                                {it.quantidade}x • {formatBRL(toNumber(it.produto.preco))}
                              </div>
                            </div>

                            <div className="shrink-0 text-sm font-semibold text-black">
                              {formatBRL(it.subtotal)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={closeManualModal}
                      disabled={creatingManual}
                      className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-medium text-black/70 hover:bg-black/5 disabled:opacity-50"
                    >
                      Fechar
                    </button>

                    <button
                      type="button"
                      onClick={criarPedidoManual}
                      disabled={creatingManual || !clienteSelecionadoId || manualItens.length === 0}
                      className="rounded-2xl bg-[#EB3410] px-4 py-3 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
                    >
                      {creatingManual ? "Criando..." : "Concluir pedido manual"}
                    </button>
                  </div>

                  
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}