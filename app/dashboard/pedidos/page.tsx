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
  id: string;
  nome: string | null;
};

type ProdutoOption = {
  id: string;
  nome: string;
  preco: number;
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
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [itemsByPedido, setItemsByPedido] = useState<Record<string, PedidoItem[]>>({});
  const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});

  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const [manualOpen, setManualOpen] = useState(false);
  const [loadingManualData, setLoadingManualData] = useState(false);
  const [savingManual, setSavingManual] = useState(false);

  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [produtosCadastro, setProdutosCadastro] = useState<ProdutoOption[]>([]);

  const [clienteBusca, setClienteBusca] = useState("");
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string>("");

  const [qtdManual, setQtdManual] = useState<Record<string, number>>({});

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
    const termo = clienteBusca.trim().toLowerCase();
    if (!termo) return clientes;
    return clientes.filter((c) => (c.nome ?? "").toLowerCase().includes(termo));
  }, [clientes, clienteBusca]);

  const itensManual = useMemo(() => {
    return Object.entries(qtdManual)
      .filter(([, quantidade]) => quantidade > 0)
      .map(([produtoId, quantidade]) => {
        const produto = produtosCadastro.find((p) => p.id === produtoId);
        if (!produto) return null;

        return {
          produto,
          quantidade,
          subtotal: quantidade * produto.preco,
        };
      })
      .filter(Boolean) as Array<{
      produto: ProdutoOption;
      quantidade: number;
      subtotal: number;
    }>;
  }, [qtdManual, produtosCadastro]);

  const totalManual = useMemo(() => {
    return itensManual.reduce((acc, item) => acc + item.subtotal, 0);
  }, [itensManual]);

  async function getEmpresaId() {
    if (empresaId) return empresaId;

    const { data: empresas, error: empErr } = await supabaseClient
      .from("empresas")
      .select("id")
      .order("criado_em", { ascending: true })
      .limit(1);

    if (empErr) throw empErr;

    const id = empresas?.[0]?.id ?? null;
    setEmpresaId(id);
    return id;
  }

  async function loadPedidos() {
    try {
      setLoading(true);

      const currentEmpresaId = await getEmpresaId();

      if (!currentEmpresaId) {
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
        .eq("empresa_id", currentEmpresaId)
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

  async function loadManualData() {
    try {
      setLoadingManualData(true);

      const currentEmpresaId = await getEmpresaId();

      if (!currentEmpresaId) {
        toast.error("Empresa não encontrada.");
        return;
      }

      const [{ data: clientesData, error: clientesErr }, { data: produtosData, error: produtosErr }] =
        await Promise.all([
          supabaseClient
            .from("clientes")
            .select("id, nome")
            .order("nome", { ascending: true }),
          supabaseClient
            .from("produtos")
            .select("id, nome, preco, estoque, ativo")
            .eq("empresa_id", currentEmpresaId)
            .eq("ativo", true)
            .order("nome", { ascending: true }),
        ]);

      if (clientesErr) throw clientesErr;
      if (produtosErr) throw produtosErr;

      setClientes((clientesData ?? []) as ClienteOption[]);
      setProdutosCadastro(
        ((produtosData ?? []) as Array<{
          id: string;
          nome: string;
          preco: number | string;
          estoque: number;
          ativo: boolean;
        }>).map((p) => ({
          id: p.id,
          nome: p.nome,
          preco: toNumber(p.preco),
          estoque: Number(p.estoque) || 0,
          ativo: Boolean(p.ativo),
        }))
      );
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível carregar clientes e produtos.");
    } finally {
      setLoadingManualData(false);
    }
  }

  function openManualModal() {
    setManualOpen(true);
    setClienteBusca("");
    setClienteSelecionadoId("");
    setQtdManual({});
    void loadManualData();
  }

  function closeManualModal() {
    if (savingManual) return;
    setManualOpen(false);
  }

  function incManual(produto: ProdutoOption) {
    setQtdManual((prev) => {
      const atual = prev[produto.id] ?? 0;
      const proximo = atual + 1;

      if (produto.estoque === 0) return prev;
      if (produto.estoque > 0 && proximo > produto.estoque) return prev;

      return { ...prev, [produto.id]: proximo };
    });
  }

  function decManual(produto: ProdutoOption) {
    setQtdManual((prev) => {
      const atual = prev[produto.id] ?? 0;
      const proximo = Math.max(0, atual - 1);
      return { ...prev, [produto.id]: proximo };
    });
  }

  function setExactManual(produto: ProdutoOption, value: number) {
    const v = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

    setQtdManual((prev) => {
      if (produto.estoque === 0) return prev;
      if (produto.estoque > 0 && v > produto.estoque) {
        return { ...prev, [produto.id]: produto.estoque };
      }
      return { ...prev, [produto.id]: v };
    });
  }

  async function criarPedidoManual() {
    try {
      const currentEmpresaId = await getEmpresaId();

      if (!currentEmpresaId) {
        toast.error("Empresa não encontrada.");
        return;
      }

      if (!clienteSelecionadoId) {
        toast.error("Selecione um cliente.");
        return;
      }

      if (itensManual.length === 0) {
        toast.error("Adicione pelo menos 1 produto.");
        return;
      }

      setSavingManual(true);

      const total = totalManual;

      const { data: pedidoCriado, error: pedidoErr } = await supabaseClient
        .from("pedidos")
        .insert({
          empresa_id: currentEmpresaId,
          cliente_usuario_id: clienteSelecionadoId,
          status: "rascunho",
          total,
        })
        .select("id")
        .single();

      if (pedidoErr) throw pedidoErr;

      const pedidoId = pedidoCriado.id as string;

      const itensInsert = itensManual.map((item) => ({
        pedido_id: pedidoId,
        produto_id: item.produto.id,
        quantidade: item.quantidade,
        preco_unitario: item.produto.preco,
        subtotal: item.subtotal,
      }));

      const { error: itensErr } = await supabaseClient.from("pedidos_itens").insert(itensInsert);

      if (itensErr) throw itensErr;

      toast.success("Pedido manual criado com sucesso!");
      setManualOpen(false);
      setQtdManual({});
      setClienteBusca("");
      setClienteSelecionadoId("");

      setPage(1);
      await loadPedidos();
      await loadItens(pedidoId);
      setExpanded((prev) => ({ ...prev, [pedidoId]: true }));
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível criar o pedido manual.");
    } finally {
      setSavingManual(false);
    }
  }

  useEffect(() => {
    loadPedidos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <div className="min-h-screen bg-white text-[#0f172a]">
      <Toaster position="top-right" />

      {manualOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4 sm:px-6">
              <div>
                <div className="text-lg font-semibold text-black">Criar pedido manual</div>
                <div className="text-sm text-black/55">
                  Selecione o cliente, marque os produtos e defina as quantidades.
                </div>
              </div>

              <button
                type="button"
                onClick={closeManualModal}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-white hover:bg-black/5"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {loadingManualData ? (
                <div className="space-y-4">
                  <div className="h-5 w-48 rounded bg-black/5" />
                  <div className="h-11 w-full rounded-2xl bg-black/5" />
                  <div className="h-5 w-56 rounded bg-black/5" />
                  <div className="h-32 w-full rounded-3xl bg-black/5" />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                  <div className="space-y-6">
                    <section className="rounded-3xl border border-black/10 bg-white p-4">
                      <div className="text-sm font-semibold text-black">Cliente</div>
                      <div className="mt-1 text-xs text-black/50">
                        Busque pelo nome e selecione um cliente cadastrado.
                      </div>

                      <input
                        type="text"
                        value={clienteBusca}
                        onChange={(e) => setClienteBusca(e.target.value)}
                        placeholder="Buscar cliente pelo nome"
                        className="mt-4 h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none focus:border-black/20"
                      />

                      <div className="mt-3 max-h-56 overflow-y-auto rounded-2xl border border-black/10">
                        {clientesFiltrados.length === 0 ? (
                          <div className="p-4 text-sm text-black/60">Nenhum cliente encontrado.</div>
                        ) : (
                          <div className="divide-y divide-black/10">
                            {clientesFiltrados.map((cliente) => {
                              const ativo = clienteSelecionadoId === cliente.id;

                              return (
                                <button
                                  key={cliente.id}
                                  type="button"
                                  onClick={() => setClienteSelecionadoId(cliente.id)}
                                  className={cn(
                                    "flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-black/5",
                                    ativo && "bg-black/5"
                                  )}
                                >
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-black">
                                      {cliente.nome?.trim() || "Cliente sem nome"}
                                    </div>
                                    <div className="mt-1 text-xs text-black/45">
                                      #{shortId(cliente.id)}
                                    </div>
                                  </div>

                                  <div
                                    className={cn(
                                      "h-4 w-4 rounded-full border",
                                      ativo ? "border-black bg-black" : "border-black/20 bg-white"
                                    )}
                                  />
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </section>

                    <section className="rounded-3xl border border-black/10 bg-white p-4">
                      <div className="text-sm font-semibold text-black">Produtos</div>
                      <div className="mt-1 text-xs text-black/50">
                        Ajuste as quantidades dos itens que entrarão no pedido.
                      </div>

                      <div className="mt-4 space-y-3">
                        {produtosCadastro.length === 0 ? (
                          <div className="rounded-2xl border border-black/10 p-4 text-sm text-black/60">
                            Nenhum produto ativo encontrado.
                          </div>
                        ) : (
                          produtosCadastro.map((produto) => {
                            const q = qtdManual[produto.id] ?? 0;
                            const semEstoque = produto.estoque === 0;

                            return (
                              <div
                                key={produto.id}
                                className="rounded-3xl border border-black/10 bg-white p-4"
                              >
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-black">
                                      {produto.nome}
                                    </div>

                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      <span className="rounded-full border border-black/10 bg-black/5 px-3 py-1 text-xs font-semibold text-black">
                                        {formatBRL(produto.preco)}
                                      </span>

                                      <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-black/60">
                                        {semEstoque ? "Sem estoque" : `Estoque: ${produto.estoque}`}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="w-full sm:w-auto">
                                    <div className="mb-2 text-xs text-black/55 sm:text-right">
                                      Quantidade
                                    </div>

                                    <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white p-2">
                                      <button
                                        type="button"
                                        onClick={() => decManual(produto)}
                                        disabled={q <= 0}
                                        className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 bg-white hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
                                        aria-label="Diminuir"
                                      >
                                        <Minus size={18} />
                                      </button>

                                      <input
                                        value={q}
                                        onChange={(e) =>
                                          setExactManual(produto, Number(e.target.value))
                                        }
                                        inputMode="numeric"
                                        className="h-11 w-16 rounded-xl border border-black/10 bg-white text-center text-sm outline-none"
                                      />

                                      <button
                                        type="button"
                                        onClick={() => incManual(produto)}
                                        disabled={semEstoque || (produto.estoque > 0 && q >= produto.estoque)}
                                        className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 bg-white hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50"
                                        aria-label="Aumentar"
                                      >
                                        <Plus size={18} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </section>
                  </div>

                  <div>
                    <section className="sticky top-0 rounded-3xl border border-black/10 bg-white p-4 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
                      <div className="flex items-center gap-2">
                        <div className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-black/5">
                          <Package size={18} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-black">Resumo do pedido</div>
                          <div className="text-xs text-black/55">
                            {itensManual.length} item(ns) selecionado(s)
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl border border-black/10 bg-black/5 px-4 py-3">
                        <div className="text-xs text-black/55">Cliente selecionado</div>
                        <div className="mt-1 text-sm font-medium text-black">
                          {clientes.find((c) => c.id === clienteSelecionadoId)?.nome?.trim() ||
                            "Nenhum cliente selecionado"}
                        </div>
                      </div>

                      {itensManual.length === 0 ? (
                        <div className="mt-4 rounded-2xl border border-black/10 p-4 text-sm text-black/60">
                          Escolha os produtos e defina as quantidades.
                        </div>
                      ) : (
                        <div className="mt-4 overflow-hidden rounded-2xl border border-black/10">
                          <div className="divide-y divide-black/10">
                            {itensManual.map((item) => (
                              <div
                                key={item.produto.id}
                                className="flex items-center justify-between gap-3 p-4"
                              >
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-medium text-black">
                                    {item.produto.nome}
                                  </div>
                                  <div className="mt-1 text-xs text-black/45">
                                    {item.quantidade}x • {formatBRL(item.produto.preco)}
                                  </div>
                                </div>

                                <div className="shrink-0 text-sm font-semibold text-black">
                                  {formatBRL(item.subtotal)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-4 flex items-center justify-between rounded-2xl border border-black/10 bg-white px-4 py-3">
                        <div>
                          <div className="text-xs text-black/55">Total</div>
                          <div className="text-lg font-semibold text-black">
                            {formatBRL(totalManual)}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={criarPedidoManual}
                        disabled={savingManual || !clienteSelecionadoId || itensManual.length === 0}
                        className="mt-4 h-12 w-full rounded-2xl bg-[#EB3410] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingManual ? "Salvando..." : "Concluir pedido manual"}
                      </button>
                    </section>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
                              : `${itemsByPedido[p.id]?.length ?? 0} item(ns)`}
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