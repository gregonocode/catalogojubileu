//app\dashboard\relatorios\page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import toast, { Toaster } from "react-hot-toast";
import { Search, RefreshCw, FileDown, Eye, Package } from "lucide-react";
import { generatePedidoPdf } from "@/lib/pedidos/pdf";
import jsPDF from "jspdf";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type ClienteEmbed = {
  nome: string | null;
  telefone?: string | null;
  end_clientes?: EndClienteEmbed | EndClienteEmbed[] | null;
};

type PedidoRow = {
  id: string;
  empresa_id: string;
  cliente_usuario_id: string | null;
  status: "rascunho" | "enviado_whatsapp" | "aprovado" | "cancelado";
  total: number | string;
  criado_em: string;
  atualizado_em: string;
  clientes?: ClienteEmbed | ClienteEmbed[] | null;
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

type Pedido = {
  id: string;
  empresa_id: string;
  cliente_usuario_id: string | null;
  status: "rascunho" | "enviado_whatsapp" | "aprovado" | "cancelado";
  total: number;
  criado_em: string;
  atualizado_em: string;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  cliente_endereco: string | null;
  itens: PedidoItem[];
};


type EndClienteEmbed = {
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  referencia?: string | null;
};

function toNumber(v: number | string | null | undefined) {
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

function formatPdfDate(iso: string) {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = d.toLocaleString("pt-BR", { month: "short" });
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd} de ${mm} de ${yyyy} - ${hh}:${mi}`;
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

function pickCliente(v: ClienteEmbed | ClienteEmbed[] | null | undefined) {
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
function pickEndereco(
  v: EndClienteEmbed | EndClienteEmbed[] | null | undefined
): EndClienteEmbed | null {
  if (!v) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

function montarEndereco(endereco: EndClienteEmbed | null | undefined) {
  if (!endereco) return null;

  const partes = [
    endereco.logradouro?.trim(),
    endereco.numero?.trim(),
    endereco.complemento?.trim(),
    endereco.bairro?.trim(),
    endereco.cidade?.trim(),
    endereco.uf?.trim(),
    endereco.cep?.trim(),
  ].filter(Boolean);

  return partes.length ? partes.join(", ") : null;
}

function pickProdutoNome(v: ProdutoEmbed | ProdutoEmbed[] | null | undefined) {
  if (!v) return null;
  if (Array.isArray(v)) return v[0]?.nome ?? null;
  return v.nome ?? null;
}

function drawLine(doc: jsPDF, y: number) {
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(0.6);
  doc.line(14, y, 196, y);
}

function generatePedidoPdfLegacy(pedido: Pedido) {
  const doc = new jsPDF({
    orientation: "p",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const left = 14;
  const right = 196;
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(`VENDA N°${shortId(pedido.id)}`, pageWidth / 2, y, { align: "center" });

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text(formatPdfDate(pedido.criado_em), pageWidth / 2, y, { align: "center" });

  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(pedido.cliente_nome || "Cliente sem nome", left, y);

    y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.text(`Telefone/Whatsapp: ${pedido.cliente_telefone || "-"}`, left, y);

  y += 6;
  const enderecoTexto = `Endereço: ${pedido.cliente_endereco || "-"}`;
  const enderecoLinhas = doc.splitTextToSize(enderecoTexto, 182);
  doc.text(enderecoLinhas, left, y);

  y += enderecoLinhas.length * 5 + 4;
 drawLine(doc, y);

 y += 12;

  y += 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`${pedido.itens.length} Itens`, left, y);

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const qtdTotal = pedido.itens.reduce((acc, item) => acc + item.quantidade, 0);
  doc.text(`Quantidade: ${qtdTotal}`, left, y);

  y += 14;

  for (const item of pedido.itens) {
    const nome = item.produto_nome || item.produto_id;
    const linhas = doc.splitTextToSize(nome, 105);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(String(item.quantidade), left, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.text(linhas, left + 16, y);

    doc.text(formatBRL(item.preco_unitario), left + 16, y + linhas.length * 5 + 1);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(formatBRL(item.subtotal), right, y, { align: "right" });

    y += Math.max(20, linhas.length * 5 + 12);

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(left, y - 4, right, y - 4);

    if (y > 250) {
      doc.addPage();
      y = 20;
    }
  }

  y += 10;
  drawLine(doc, y);

  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Subtotal: ${formatBRL(pedido.total)}`, right, y, { align: "right" });

  y += 8;
  doc.text(`Dinheiro: ${formatBRL(pedido.total)}`, right, y, { align: "right" });

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Total: ${formatBRL(pedido.total)}`, right, y, { align: "right" });

  doc.save(`pedido-${shortId(pedido.id)}.pdf`);
}

export default function RelatoriosPage() {
  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [selected, setSelected] = useState<Pedido | null>(null);
  const [search, setSearch] = useState("");

  async function loadRelatorios() {
    try {
      setLoading(true);

      const { data: empresas, error: empErr } = await supabaseClient
        .from("empresas")
        .select("id")
        .order("criado_em", { ascending: true })
        .limit(1);

      if (empErr) throw empErr;

      const empresaId = empresas?.[0]?.id;
      if (!empresaId) {
        setPedidos([]);
        setSelected(null);
        return;
      }

            const { data, error } = await supabaseClient
        .from("pedidos")
        .select(
          `
          id, empresa_id, cliente_usuario_id, status, total, criado_em, atualizado_em,
          clientes:clientes!pedidos_cliente_usuario_id_fkey(
            nome,
            telefone,
            end_clientes(
              cep,
              logradouro,
              numero,
              complemento,
              bairro,
              cidade,
              uf,
              referencia
            )
          )
          `
        )
        .eq("empresa_id", empresaId)
        .eq("status", "aprovado")
        .order("criado_em", { ascending: false });

      if (error) throw error;

      const rows = (data ?? []) as unknown as PedidoRow[];
      const pedidoIds = rows.map((r) => r.id);

      let itensMap: Record<string, PedidoItem[]> = {};

      if (pedidoIds.length > 0) {
        const { data: itensData, error: itensError } = await supabaseClient
          .from("pedidos_itens")
          .select(
            `
            id, pedido_id, produto_id, quantidade, preco_unitario, subtotal, criado_em,
            produtos:produtos!pedidos_itens_produto_id_fkey(nome)
            `
          )
          .in("pedido_id", pedidoIds)
          .order("criado_em", { ascending: true });

        if (itensError) throw itensError;

        const itensRows = (itensData ?? []) as unknown as PedidoItemRow[];

        for (const it of itensRows) {
          const item: PedidoItem = {
            id: it.id,
            pedido_id: it.pedido_id,
            produto_id: it.produto_id,
            quantidade: toNumber(it.quantidade),
            preco_unitario: toNumber(it.preco_unitario),
            subtotal: toNumber(it.subtotal),
            criado_em: it.criado_em,
            produto_nome: pickProdutoNome(it.produtos),
          };

          if (!itensMap[it.pedido_id]) itensMap[it.pedido_id] = [];
          itensMap[it.pedido_id].push(item);
        }
      }

            const normalized: Pedido[] = rows.map((r) => {
        const cliente = pickCliente(r.clientes);
        const endereco = pickEndereco(
          Array.isArray(r.clientes) ? r.clientes[0]?.end_clientes : r.clientes?.end_clientes
        );

        return {
          id: r.id,
          empresa_id: r.empresa_id,
          cliente_usuario_id: r.cliente_usuario_id ?? null,
          status: r.status,
          total: toNumber(r.total),
          criado_em: r.criado_em,
          atualizado_em: r.atualizado_em,
          cliente_nome: cliente.nome,
          cliente_telefone: cliente.telefone,
          cliente_endereco: montarEndereco(endereco),
          itens: itensMap[r.id] ?? [],
        };
      });

      setPedidos(normalized);
      setSelected((prev) => normalized.find((p) => p.id === prev?.id) ?? normalized[0] ?? null);
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível carregar os relatórios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRelatorios();
  }, []);

  const pedidosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pedidos;

    return pedidos.filter((p) => {
      const nome = (p.cliente_nome ?? "").toLowerCase();
      const id = p.id.toLowerCase();
      const sid = shortId(p.id).toLowerCase();
      return nome.includes(q) || id.includes(q) || sid.includes(q);
    });
  }, [pedidos, search]);

  return (
    <div className="min-h-screen bg-white text-[#0f172a]">
      <Toaster position="top-right" />

      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-lg font-semibold text-black">Relatórios</div>
              <div className="text-sm text-black/55">
                {loading ? "Carregando..." : `${pedidosFiltrados.length} pedido(s) aprovado(s)`}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-[280px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por pedido ou cliente..."
                  className="h-11 w-full rounded-2xl border border-black/10 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-black/30"
                />
              </div>

              <button
                type="button"
                onClick={loadRelatorios}
                className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm hover:bg-black/5"
              >
                <RefreshCw size={16} />
                Atualizar
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[390px_minmax(0,1fr)]">
          <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)]">
            <div className="mb-3 text-sm font-semibold text-black">Pedidos aprovados</div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-black/10 p-4">
                    <div className="h-4 w-28 rounded bg-black/5" />
                    <div className="mt-2 h-3 w-40 rounded bg-black/5" />
                    <div className="mt-2 h-3 w-24 rounded bg-black/5" />
                  </div>
                ))}
              </div>
            ) : pedidosFiltrados.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 p-6 text-sm text-black/60">
                Nenhum pedido aprovado encontrado.
              </div>
            ) : (
              <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
                {pedidosFiltrados.map((p) => {
                  const active = selected?.id === p.id;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelected(p)}
                      className={cn(
                        "w-full rounded-2xl border p-4 text-left transition",
                        active
                          ? "border-green-200 bg-green-50"
                          : "border-black/10 bg-white hover:bg-black/5"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-black">
                            Pedido #{shortId(p.id)}
                          </div>
                          <div className="mt-1 truncate text-sm text-black/70">
                            {p.cliente_nome || "Cliente sem nome"}
                          </div>
                          <div className="mt-1 text-xs text-black/45">
                            {formatShortDateTime(p.criado_em)}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green-700">
                            aprovado
                          </div>
                          <div className="mt-2 text-sm font-semibold text-black">
                            {formatBRL(p.total)}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)]">
            {!selected ? (
              <div className="flex min-h-[420px] items-center justify-center text-sm text-black/55">
                Selecione um pedido para visualizar o relatório.
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4 border-b border-black/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-2xl font-bold text-black">
                      VENDA N°{shortId(selected.id)}
                    </div>
                    <div className="mt-1 text-sm text-black/55">
                      {formatPdfDate(selected.criado_em)}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm text-black/70"
                    >
                      <Eye size={16} />
                      Visualizando
                    </button>

                    <button
                      type="button"
                      onClick={() => generatePedidoPdf(selected)}
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
                    >
                      <FileDown size={16} />
                      Baixar PDF
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-black/10 bg-black/[0.03] p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-black/45">
                      Cliente
                    </div>
                    <div className="mt-2 text-lg font-semibold text-black">
                      {selected.cliente_nome || "Cliente sem nome"}
                    </div>
                    <div className="mt-1 text-sm text-black/60">
                      {selected.cliente_telefone || "Sem telefone"}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-black/[0.03] p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-black/45">
                      Resumo
                    </div>
                    <div className="mt-2 text-sm text-black/70">
                      Itens: <span className="font-semibold">{selected.itens.length}</span>
                    </div>
                    <div className="mt-1 text-sm text-black/70">
                      Quantidade total:{" "}
                      <span className="font-semibold">
                        {selected.itens.reduce((acc, item) => acc + item.quantidade, 0)}
                      </span>
                    </div>
                    <div className="mt-2 text-lg font-bold text-black">
                      {formatBRL(selected.total)}
                    </div>
                  </div>
                </div>

                <div className="mt-6 overflow-hidden rounded-2xl border border-black/10">
                  <div className="flex items-center justify-between gap-2 bg-black/5 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-black/70">
                      <Package size={14} />
                      Itens do pedido
                    </div>
                    <div className="text-xs text-black/45">
                      {selected.itens.length} item(ns)
                    </div>
                  </div>

                  {selected.itens.length === 0 ? (
                    <div className="p-4 text-sm text-black/60">Nenhum item encontrado.</div>
                  ) : (
                    <div className="divide-y divide-black/10">
                      {selected.itens.map((it) => (
                        <div
                          key={it.id}
                          className="flex items-center justify-between gap-3 p-4"
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
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
