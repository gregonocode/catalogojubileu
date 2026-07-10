"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useParams } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import {
  ArrowLeft,
  Package,
  MapPin,
  Phone,
  User,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ClipboardList,
} from "lucide-react";
import { generatePedidoPdf, type PedidoPdfFormat } from "@/lib/pedidos/pdf";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type PedidoStatus = "rascunho" | "enviado_whatsapp" | "aprovado" | "cancelado";

type PedidoDetalheRow = {
  id: string;
  empresa_id: string;
  cliente_usuario_id: string | null;
  status: PedidoStatus;
  total: number | string;
  criado_em: string;
  atualizado_em: string;
  parcelado: boolean | null;
  valor_entrada: number | string | null;
  quantidade_parcelas: number | null;
  valor_parcela: number | string | null;
  desconto_ativo: boolean | null;
  desconto_tipo: "valor" | "percentual" | null;
  desconto_valor: number | string | null;
  desconto_calculado: number | string | null;
  total_com_desconto: number | string | null;
  clientes?:
    | {
        nome: string | null;
        telefone: string | null;
      }
    | Array<{
        nome: string | null;
        telefone: string | null;
      }>
    | null;
};

type ClienteRow = {
  nome: string | null;
  telefone: string | null;
};

type EnderecoRow = {
  id: string;
  cliente_id: string;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  referencia: string | null;
  created_at: string;
  updated_at: string;
};

type ProdutoEmbed = {
  nome: string | null;
  sku: string | null;
  imagem_url: string | null;
};

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

type PedidoDetalhe = {
  id: string;
  empresa_id: string;
  cliente_usuario_id: string | null;
  status: PedidoStatus;
  total: number;
  criado_em: string;
  atualizado_em: string;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  parcelado: boolean;
  valor_entrada: number | null;
  quantidade_parcelas: number | null;
  valor_parcela: number | null;
  desconto_ativo: boolean;
  desconto_tipo: "valor" | "percentual" | null;
  desconto_valor: number | null;
  desconto_calculado: number | null;
  total_com_desconto: number | null;
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
  produto_sku: string | null;
  imagem_url: string | null;
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

function formatDateTimeLong(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
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

function pickCliente(v: PedidoDetalheRow["clientes"]) {
  if (!v) return { nome: null, telefone: null };
  if (Array.isArray(v)) {
    return {
      nome: v[0]?.nome ?? null,
      telefone: v[0]?.telefone ?? null,
    };
  }
  return {
    nome: v.nome ?? null,
    telefone: v.telefone ?? null,
  };
}

function pickProduto(v: ProdutoEmbed | ProdutoEmbed[] | null | undefined) {
  if (!v) {
    return {
      nome: null,
      sku: null,
      imagem_url: null,
    };
  }

  if (Array.isArray(v)) {
    return {
      nome: v[0]?.nome ?? null,
      sku: v[0]?.sku ?? null,
      imagem_url: v[0]?.imagem_url ?? null,
    };
  }

  return {
    nome: v.nome ?? null,
    sku: v.sku ?? null,
    imagem_url: v.imagem_url ?? null,
  };
}

function formatEndereco(endereco: EnderecoRow | null) {
  if (!endereco) return "Endereço não informado";

  const linha1 = [endereco.logradouro, endereco.numero].filter(Boolean).join(", ");
  const linha2 = [endereco.bairro, endereco.cidade, endereco.uf].filter(Boolean).join(" • ");
  const linha3 = [
    endereco.cep ? `CEP ${endereco.cep}` : null,
    endereco.complemento ? `Compl. ${endereco.complemento}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return [linha1, linha2, linha3].filter(Boolean).join(" — ");
}

export default function PedidoDetalhePage() {
  const params = useParams();
  const pedidoId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [loading, setLoading] = useState(true);
  const [pedido, setPedido] = useState<PedidoDetalhe | null>(null);
  const [endereco, setEndereco] = useState<EnderecoRow | null>(null);
  const [itens, setItens] = useState<PedidoItem[]>([]);
  const [actionLoading, setActionLoading] = useState<"aprovar" | "cancelar" | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [parcelado, setParcelado] = useState(false);
  const [valorEntrada, setValorEntrada] = useState("");
  const [quantidadeParcelas, setQuantidadeParcelas] = useState("");
  const [parcelamentoSaving, setParcelamentoSaving] = useState(false);
  const [mostrarCalculoParcelas, setMostrarCalculoParcelas] = useState(false);
  const [descontoAtivo, setDescontoAtivo] = useState(false);
  const [tipoDesconto, setTipoDesconto] = useState<"valor" | "percentual">("valor");
  const [valorDesconto, setValorDesconto] = useState("");
  const [descontoSaving, setDescontoSaving] = useState(false);

  const totalItens = useMemo(() => {
    return itens.reduce((acc, item) => acc + item.quantidade, 0);
  }, [itens]);

  const subtotalCalculado = useMemo(() => {
    return itens.reduce((acc, item) => acc + item.subtotal, 0);
  }, [itens]);

  const valorParcelaCalculado = useMemo(() => {
    if (!pedido) return null;
    const entrada = Number(valorEntrada);
    const parcelas = Number(quantidadeParcelas);
    if (!Number.isFinite(entrada) || entrada < 0 || !Number.isInteger(parcelas) || parcelas < 1) {
      return null;
    }
    return Math.round(((pedido.total - entrada) / parcelas) * 100) / 100;
  }, [pedido, quantidadeParcelas, valorEntrada]);

  const descontoCalculado = useMemo(() => {
    if (!pedido) return null;
    const valor = Number(valorDesconto);
    if (!Number.isFinite(valor) || valor < 0) return null;
    return Math.round((tipoDesconto === "percentual" ? pedido.total * (valor / 100) : valor) * 100) / 100;
  }, [pedido, tipoDesconto, valorDesconto]);

  async function loadPedido() {
  try {
    if (!pedidoId) {
      setPedido(null);
      setEndereco(null);
      setItens([]);
      setLoading(false);
      return;
    }

    setLoading(true);

      const { data: pedidoData, error: pedidoError } = await supabaseClient
        .from("pedidos")
        .select(
          `
          id, empresa_id, cliente_usuario_id, status, total, criado_em, atualizado_em,
          parcelado, valor_entrada, quantidade_parcelas, valor_parcela,
          desconto_ativo, desconto_tipo, desconto_valor, desconto_calculado, total_com_desconto,
          clientes:clientes!pedidos_cliente_usuario_id_fkey(nome, telefone)
          `
        )
        .eq("id", pedidoId)
        .maybeSingle();

      if (pedidoError) throw pedidoError;

      if (!pedidoData) {
        setPedido(null);
        setEndereco(null);
        setItens([]);
        return;
      }

      const pedidoRow = pedidoData as unknown as PedidoDetalheRow;
      const clienteJoin = pickCliente(pedidoRow.clientes);
      let clienteDireto: ClienteRow | null = null;

      if (pedidoRow.cliente_usuario_id) {
        const { data: clienteData, error: clienteError } = await supabaseClient
          .from("clientes")
          .select("nome, telefone")
          .eq("usuario_id", pedidoRow.cliente_usuario_id)
          .maybeSingle();

        if (clienteError) throw clienteError;
        clienteDireto = (clienteData as ClienteRow | null) ?? null;
      }

      const pedidoNormalizado: PedidoDetalhe = {
        id: pedidoRow.id,
        empresa_id: pedidoRow.empresa_id,
        cliente_usuario_id: pedidoRow.cliente_usuario_id ?? null,
        status: pedidoRow.status,
        total: toNumber(pedidoRow.total),
        criado_em: pedidoRow.criado_em,
        atualizado_em: pedidoRow.atualizado_em,
        cliente_nome: clienteDireto?.nome ?? clienteJoin.nome,
        cliente_telefone: clienteDireto?.telefone ?? clienteJoin.telefone,
        parcelado: pedidoRow.parcelado ?? false,
        valor_entrada: toNullableNumber(pedidoRow.valor_entrada),
        quantidade_parcelas: pedidoRow.quantidade_parcelas ?? null,
        valor_parcela: toNullableNumber(pedidoRow.valor_parcela),
        desconto_ativo: pedidoRow.desconto_ativo ?? false,
        desconto_tipo: pedidoRow.desconto_tipo ?? null,
        desconto_valor: toNullableNumber(pedidoRow.desconto_valor),
        desconto_calculado: toNullableNumber(pedidoRow.desconto_calculado),
        total_com_desconto: toNullableNumber(pedidoRow.total_com_desconto),
      };

      setPedido(pedidoNormalizado);
      setParcelado(pedidoNormalizado.parcelado);
      setValorEntrada(pedidoNormalizado.valor_entrada?.toFixed(2) ?? "");
      setQuantidadeParcelas(pedidoNormalizado.quantidade_parcelas?.toString() ?? "");
      setMostrarCalculoParcelas(pedidoNormalizado.parcelado);
      setDescontoAtivo(pedidoNormalizado.desconto_ativo);
      setTipoDesconto(pedidoNormalizado.desconto_tipo ?? "valor");
      setValorDesconto(pedidoNormalizado.desconto_valor?.toFixed(2) ?? "");

      if (pedidoRow.cliente_usuario_id) {
        const { data: enderecoData, error: enderecoError } = await supabaseClient
          .from("end_clientes")
          .select("*")
          .eq("cliente_id", pedidoRow.cliente_usuario_id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (enderecoError) throw enderecoError;

        setEndereco((enderecoData as EnderecoRow | null) ?? null);
      } else {
        setEndereco(null);
      }

      const { data: itensData, error: itensError } = await supabaseClient
        .from("pedidos_itens")
        .select(
          `
          id, pedido_id, produto_id, quantidade, preco_unitario, subtotal, criado_em,
          produtos:produtos!pedidos_itens_produto_id_fkey(nome, sku, imagem_url)
          `
        )
        .eq("pedido_id", pedidoId)
        .order("criado_em", { ascending: true });

      if (itensError) throw itensError;

      const itensRows = (itensData ?? []) as unknown as PedidoItemRow[];

      const itensNormalizados: PedidoItem[] = itensRows.map((it) => {
        const produto = pickProduto(it.produtos);

        return {
          id: it.id,
          pedido_id: it.pedido_id,
          produto_id: it.produto_id,
          quantidade: it.quantidade,
          preco_unitario: toNumber(it.preco_unitario),
          subtotal: toNumber(it.subtotal),
          criado_em: it.criado_em,
          produto_nome: produto.nome,
          produto_sku: produto.sku,
          imagem_url: produto.imagem_url,
        };
      });

      setItens(itensNormalizados);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível carregar os detalhes do pedido.");
    } finally {
      setLoading(false);
    }
  }

  async function aprovarPedido() {
    if (!pedido) return;

    try {
      setActionLoading("aprovar");

      const { error } = await supabaseClient.rpc("rpc_aprovar_pedido", {
        p_pedido_id: pedido.id,
      });

      if (error) throw error;

      toast.success("Pedido aprovado! Estoque atualizado.");
      await loadPedido();
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível aprovar o pedido.");
    } finally {
      setActionLoading(null);
    }
  }

  async function cancelarPedido() {
    if (!pedido) return;

    try {
      setActionLoading("cancelar");

      const { error } = await supabaseClient.rpc("rpc_cancelar_pedido", {
        p_pedido_id: pedido.id,
      });

      if (error) throw error;

      toast.success("Pedido cancelado.");
      await loadPedido();
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível cancelar o pedido.");
    } finally {
      setActionLoading(null);
    }
  }

  async function salvarParcelamento() {
    if (!pedido) return;

    const entrada = Number(valorEntrada);
    const parcelas = Number(quantidadeParcelas);

    if (parcelado && (!Number.isFinite(entrada) || entrada < 0 || entrada > pedido.total)) {
      toast.error("Informe uma entrada entre R$ 0,00 e o total do pedido.");
      return;
    }

    if (parcelado && (!Number.isInteger(parcelas) || parcelas < 1)) {
      toast.error("Informe uma quantidade válida de parcelas.");
      return;
    }

    try {
      setParcelamentoSaving(true);
      const valorParcela = parcelado ? valorParcelaCalculado : null;
      const { error } = await supabaseClient
        .from("pedidos")
        .update({
          parcelado,
          valor_entrada: parcelado ? entrada : null,
          quantidade_parcelas: parcelado ? parcelas : null,
          valor_parcela: valorParcela,
        })
        .eq("id", pedido.id);

      if (error) throw error;

      setPedido((current) =>
        current
          ? {
              ...current,
              parcelado,
              valor_entrada: parcelado ? entrada : null,
              quantidade_parcelas: parcelado ? parcelas : null,
              valor_parcela: valorParcela,
            }
          : current
      );
      toast.success(parcelado ? "Parcelamento salvo." : "Parcelamento removido.");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível salvar o parcelamento.");
    } finally {
      setParcelamentoSaving(false);
    }
  }

  async function salvarDesconto() {
    if (!pedido) return;
    const valor = Number(valorDesconto);
    if (!Number.isFinite(valor) || valor < 0 || (tipoDesconto === "percentual" && valor > 100) || (descontoCalculado ?? 0) > pedido.total) {
      toast.error("Informe um desconto válido para o total do pedido.");
      return;
    }

    try {
      setDescontoSaving(true);
      const calculado = descontoCalculado ?? 0;
      const totalComDesconto = Math.round((pedido.total - calculado) * 100) / 100;
      const { error } = await supabaseClient
        .from("pedidos")
        .update({
          desconto_ativo: descontoAtivo,
          desconto_tipo: descontoAtivo ? tipoDesconto : null,
          desconto_valor: descontoAtivo ? valor : null,
          desconto_calculado: descontoAtivo ? calculado : null,
          total_com_desconto: descontoAtivo ? totalComDesconto : null,
        })
        .eq("id", pedido.id);
      if (error) throw error;

      setPedido((current) => current ? {
        ...current,
        desconto_ativo: descontoAtivo,
        desconto_tipo: descontoAtivo ? tipoDesconto : null,
        desconto_valor: descontoAtivo ? valor : null,
        desconto_calculado: descontoAtivo ? calculado : null,
        total_com_desconto: descontoAtivo ? totalComDesconto : null,
      } : current);
      toast.success("Desconto salvo.");
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível salvar o desconto.");
    } finally {
      setDescontoSaving(false);
    }
  }

  function exportarPedidoPdf(format: PedidoPdfFormat = "a4") {
    if (!pedido) {
      toast.error("Pedido ainda não carregado.");
      return;
    }

    generatePedidoPdf({
      id: pedido.id,
      total: pedido.total,
      criado_em: pedido.criado_em,
      cliente_nome: pedido.cliente_nome,
      cliente_telefone: pedido.cliente_telefone,
      cliente_endereco: formatEndereco(endereco),
      parcelado: pedido.parcelado,
      valor_entrada: pedido.valor_entrada,
      quantidade_parcelas: pedido.quantidade_parcelas,
      valor_parcela: pedido.valor_parcela,
      desconto_ativo: pedido.desconto_ativo,
      desconto_tipo: pedido.desconto_tipo,
      desconto_valor: pedido.desconto_valor,
      desconto_calculado: pedido.desconto_calculado,
      total_com_desconto: pedido.total_com_desconto,
      itens,
    }, format);
    setExportModalOpen(false);
  }

  useEffect(() => {
    loadPedido();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoId]);

  useEffect(() => {
    function handleExportPedido() {
      setExportModalOpen(true);
    }

    window.addEventListener("dashboard:export-pedido", handleExportPedido);
    return () => {
      window.removeEventListener("dashboard:export-pedido", handleExportPedido);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido, endereco, itens]);

  const finalizado = isFinalizado(pedido?.status ?? "");

  return (
    <div className="min-h-screen bg-white text-[#0f172a]">
      <Toaster position="top-right" />

      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <div className="mb-4">
          <Link
            href="/dashboard/pedidos"
            className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/70 hover:bg-black/5"
          >
            <ArrowLeft size={16} />
            Voltar para pedidos
          </Link>
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="rounded-3xl border border-black/10 bg-white p-6">
              <div className="h-6 w-52 rounded bg-black/5" />
              <div className="mt-3 h-4 w-72 rounded bg-black/5" />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-3xl border border-black/10 bg-white p-6 lg:col-span-2">
                <div className="h-5 w-40 rounded bg-black/5" />
                <div className="mt-4 h-24 rounded-2xl bg-black/5" />
              </div>

              <div className="rounded-3xl border border-black/10 bg-white p-6">
                <div className="h-5 w-32 rounded bg-black/5" />
                <div className="mt-4 h-24 rounded-2xl bg-black/5" />
              </div>
            </div>
          </div>
        ) : !pedido ? (
          <div className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/60">
            Pedido não encontrado.
          </div>
        ) : (
          <div className="space-y-4">
            <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="grid h-11 w-11 place-items-center rounded-2xl border border-black/10 bg-black/5">
                      <ClipboardList size={18} />
                    </div>

                    <div>
                      <div className="text-lg font-semibold text-black">
                        Pedido #{shortId(pedido.id)}
                      </div>
                      <div className="mt-1 text-sm text-black/55">
                        Criado em {formatDateTimeLong(pedido.criado_em)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-semibold",
                        pedido.status === "aprovado" &&
                          "border-green-200 bg-green-50 text-green-700",
                        pedido.status === "cancelado" &&
                          "border-red-200 bg-red-50 text-red-700",
                        (pedido.status === "rascunho" ||
                          pedido.status === "enviado_whatsapp") &&
                          "border-black/10 bg-black/5 text-black/70"
                      )}
                    >
                      {statusLabel(pedido.status)}
                    </span>

                    <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-black/60">
                      Atualizado em {formatDateTimeLong(pedido.atualizado_em)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={loadPedido}
                    className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm hover:bg-black/5"
                  >
                    <RefreshCw size={16} />
                    Atualizar
                  </button>

                  <button
                    type="button"
                    onClick={cancelarPedido}
                    disabled={finalizado || actionLoading !== null}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/70 hover:bg-black/5",
                      (finalizado || actionLoading !== null) &&
                        "cursor-not-allowed opacity-40 hover:bg-white"
                    )}
                  >
                    <XCircle size={16} />
                    {actionLoading === "cancelar" ? "Cancelando..." : "Cancelar"}
                  </button>

                  <button
                    type="button"
                    onClick={aprovarPedido}
                    disabled={finalizado || actionLoading !== null}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-2xl bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white hover:brightness-95",
                      (finalizado || actionLoading !== null) &&
                        "cursor-not-allowed opacity-40 hover:brightness-100"
                    )}
                  >
                    <CheckCircle2 size={16} />
                    {actionLoading === "aprovar" ? "Aprovando..." : "Aprovar"}
                  </button>
                </div>
              </div>
            </section>

            {exportModalOpen && (
              <div
                className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="exportar-pedido-titulo"
                onMouseDown={() => setExportModalOpen(false)}
              >
                <div
                  className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <h2 id="exportar-pedido-titulo" className="text-lg font-semibold text-black">
                    Formato de exportação
                  </h2>
                  <p className="mt-2 text-sm text-black/60">
                    Escolha o formato do PDF para este pedido.
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => exportarPedidoPdf("a4")}
                      className="rounded-2xl border border-black/10 p-4 text-left hover:bg-black/5"
                    >
                      <span className="block font-semibold text-black">A4</span>
                      <span className="mt-1 block text-xs text-black/55">Formato padrão, em página A4.</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => exportarPedidoPdf("pdv")}
                      className="rounded-2xl border border-black/10 p-4 text-left hover:bg-black/5"
                    >
                      <span className="block font-semibold text-black">PDV</span>
                      <span className="mt-1 block text-xs text-black/55">Bobina térmica com largura de 80 mm.</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setExportModalOpen(false)}
                    className="mt-4 w-full rounded-2xl border border-black/10 px-4 py-2 text-sm hover:bg-black/5"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)] lg:col-span-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-black">
                  <User size={16} />
                  Dados do cliente
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-black/10 bg-black/5 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-black/50">
                      Nome
                    </div>
                    <div className="mt-2 text-sm font-semibold text-black">
                      {pedido.cliente_nome?.trim() || "Cliente sem nome"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-black/5 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-black/50">
                      <Phone size={12} />
                      Telefone
                    </div>
                    <div className="mt-2 text-sm font-semibold text-black">
                      {pedido.cliente_telefone?.trim() || "Não informado"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-black">
                    <MapPin size={16} />
                    Endereço de entrega
                  </div>

                  <div className="mt-3 text-sm text-black/75">
                    {formatEndereco(endereco)}
                  </div>

                  {endereco?.referencia ? (
                    <div className="mt-3 rounded-2xl border border-black/10 bg-black/5 p-3 text-sm text-black/70">
                      <span className="font-semibold text-black">Referência:</span>{" "}
                      {endereco.referencia}
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
                  <label className="flex cursor-pointer items-center justify-between gap-4">
                    <span>
                      <span className="block text-sm font-semibold text-black">Dividir em parcelas</span>
                      <span className="mt-1 block text-xs text-black/55">Registre a entrada e o valor das parcelas deste pedido.</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={parcelado}
                      onChange={(event) => {
                        setParcelado(event.target.checked);
                        setMostrarCalculoParcelas(false);
                      }}
                      className="h-5 w-5 accent-[#EB3410]"
                    />
                  </label>

                  {parcelado && (
                    <div className="mt-4 border-t border-black/10 pt-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-sm text-black/70">
                          Valor da entrada
                          <input type="number" min="0" max={pedido.total} step="0.01" inputMode="decimal" value={valorEntrada} onChange={(event) => { setValorEntrada(event.target.value); setMostrarCalculoParcelas(false); }} placeholder="0,00" className="mt-1 h-11 w-full rounded-xl border border-black/10 px-3 outline-none focus:border-black/25" />
                        </label>
                        <label className="text-sm text-black/70">
                          Número de parcelas
                          <input type="number" min="1" step="1" inputMode="numeric" value={quantidadeParcelas} onChange={(event) => { setQuantidadeParcelas(event.target.value); setMostrarCalculoParcelas(false); }} placeholder="Ex.: 3" className="mt-1 h-11 w-full rounded-xl border border-black/10 px-3 outline-none focus:border-black/25" />
                        </label>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (valorParcelaCalculado === null || valorParcelaCalculado < 0) {
                              toast.error("Preencha uma entrada e uma quantidade de parcelas válidas.");
                              return;
                            }
                            setMostrarCalculoParcelas(true);
                          }}
                          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm hover:bg-black/5"
                        >
                          Calcular
                        </button>
                        {mostrarCalculoParcelas && valorParcelaCalculado !== null && valorParcelaCalculado >= 0 && (
                          <span className="text-sm font-semibold text-black">{quantidadeParcelas}x de {formatBRL(valorParcelaCalculado)}</span>
                        )}
                      </div>
                    </div>
                  )}

                  {parcelado && (
                    <button type="button" onClick={salvarParcelamento} disabled={parcelamentoSaving} className="mt-4 rounded-xl bg-[#EB3410] px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60">
                      {parcelamentoSaving ? "Salvando..." : "Salvar parcelamento"}
                    </button>
                  )}

                  <div className="mt-4 border-t border-black/10 pt-4">
                    <label className="flex cursor-pointer items-center justify-between gap-4">
                      <span>
                        <span className="block text-sm font-semibold text-black">Aplicar desconto</span>
                        <span className="mt-1 block text-xs text-black/55">Escolha um desconto em valor ou percentual.</span>
                      </span>
                      <input type="checkbox" checked={descontoAtivo} onChange={(event) => setDescontoAtivo(event.target.checked)} className="h-5 w-5 accent-[#EB3410]" />
                    </label>

                    {descontoAtivo && (
                      <div className="mt-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="text-sm text-black/70">
                            Tipo de desconto
                            <select value={tipoDesconto} onChange={(event) => setTipoDesconto(event.target.value as "valor" | "percentual")} className="mt-1 h-11 w-full rounded-xl border border-black/10 bg-white px-3 outline-none focus:border-black/25">
                              <option value="valor">Valor (R$)</option>
                              <option value="percentual">Percentual (%)</option>
                            </select>
                          </label>
                          <label className="text-sm text-black/70">
                            {tipoDesconto === "valor" ? "Valor do desconto" : "Percentual do desconto"}
                            <input type="number" min="0" max={tipoDesconto === "valor" ? pedido.total : 100} step="0.01" inputMode="decimal" value={valorDesconto} onChange={(event) => setValorDesconto(event.target.value)} placeholder={tipoDesconto === "valor" ? "Ex.: 100,00" : "Ex.: 10"} className="mt-1 h-11 w-full rounded-xl border border-black/10 px-3 outline-none focus:border-black/25" />
                          </label>
                        </div>
                        {descontoCalculado !== null && descontoCalculado >= 0 && descontoCalculado <= pedido.total && (
                          <div className="mt-3 rounded-xl bg-black/5 px-3 py-2 text-sm text-black/70">
                            Desconto: <b>{formatBRL(descontoCalculado)}</b> · Total final: <b>{formatBRL(pedido.total - descontoCalculado)}</b>
                          </div>
                        )}
                        <button type="button" onClick={salvarDesconto} disabled={descontoSaving} className="mt-4 rounded-xl bg-[#EB3410] px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60">
                          {descontoSaving ? "Salvando..." : "Salvar desconto"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
                <div className="text-sm font-semibold text-black">Resumo</div>

                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-black/10 bg-black/5 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-black/50">
                      Total do pedido
                    </div>
                    <div className="mt-2 text-2xl font-bold text-black">
                      {formatBRL(pedido.total)}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-black/50">
                      Itens
                    </div>
                    <div className="mt-2 text-lg font-semibold text-black">
                      {totalItens} unidade(s)
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-black/50">
                      Linhas do pedido
                    </div>
                    <div className="mt-2 text-lg font-semibold text-black">
                      {itens.length} item(ns)
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-black/50">
                      Conferência dos itens
                    </div>
                    <div className="mt-2 text-sm font-medium text-black">
                      {formatBRL(subtotalCalculado)}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <section className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
              <div className="flex items-center justify-between gap-2 border-b border-black/10 bg-black/5 px-5 py-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-black">
                  <Package size={16} />
                  Itens do pedido
                </div>
                <div className="text-xs text-black/50">{itens.length} item(ns)</div>
              </div>

              {itens.length === 0 ? (
                <div className="p-5 text-sm text-black/60">Nenhum item encontrado.</div>
              ) : (
                <div className="divide-y divide-black/10">
                  {itens.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-black/10 bg-black/5">
                          {item.imagem_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imagem_url}
                              alt={item.produto_nome ?? "Produto"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Package size={22} className="text-black/35" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-black">
                            {item.produto_nome ?? item.produto_id}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/50">
                            {item.produto_sku ? (
                              <span className="rounded-full border border-black/10 bg-white px-2 py-1">
                                SKU: {item.produto_sku}
                              </span>
                            ) : null}

                            <span className="rounded-full border border-black/10 bg-white px-2 py-1">
                              {item.quantidade}x
                            </span>

                            <span className="rounded-full border border-black/10 bg-white px-2 py-1">
                              Unitário: {formatBRL(item.preco_unitario)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-left sm:text-right">
                        <div className="text-xs text-black/50">Subtotal</div>
                        <div className="text-lg font-semibold text-black">
                          {formatBRL(item.subtotal)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function toNullableNumber(v: number | string | null) {
  return v === null ? null : toNumber(v);
}
