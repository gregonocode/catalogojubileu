'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabaseClient } from '@/lib/supabase/client';
import { Search, FileDown, RefreshCcw, Eye } from 'lucide-react';
import jsPDF from 'jspdf';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type PedidoRow = {
  id: string;
  empresa_id: string;
  cliente_usuario_id: string | null;
  status: string | null;
  total: string | number | null;
  criado_em: string;
  atualizado_em: string | null;
};

type PedidoItemRow = {
  id: string;
  pedido_id: string;
  produto_id: string | null;
  quantidade: number | null;
  preco_unitario: string | number | null;
  subtotal: string | number | null;
  criado_em: string | null;
};

type ClienteRow = {
  usuario_id: string;
  nome: string | null;
  telefone: string | null;
  criado_em: string | null;
};

type ProdutoRow = {
  id: string;
  nome: string | null;
  codigo: string | null; // ajuste se o nome do campo for outro
};

type PedidoItemDetalhado = {
  id: string;
  produto_id: string | null;
  produto_nome: string;
  produto_codigo: string | null;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
};

type PedidoRelatorio = {
  id: string;
  empresa_id: string;
  cliente_usuario_id: string | null;
  status: string;
  total: number;
  criado_em: string;
  atualizado_em: string | null;
  cliente_nome: string;
  cliente_telefone: string | null;
  itens: PedidoItemDetalhado[];
};

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function shortOrderNumber(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function onlyDigits(value: string | null | undefined) {
  return (value ?? '').replace(/\D/g, '');
}

function drawLine(doc: jsPDF, y: number) {
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(0.6);
  doc.line(14, y, 196, y);
}

function generatePedidoPdf(pedido: PedidoRelatorio) {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const left = 14;
  const right = 196;
  let y = 18;

  const title = `VENDA N°${shortOrderNumber(pedido.id)}`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, pageWidth / 2, y, { align: 'center' });

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(formatDate(pedido.criado_em), pageWidth / 2, y, { align: 'center' });

  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(pedido.cliente_nome || 'Cliente sem nome', left, y);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.text(`Telefone/Whatsapp: ${pedido.cliente_telefone || '-'}`, left, y);

  y += 6;
  doc.text(`Pedido: ${pedido.id}`, left, y);

  y += 10;
  drawLine(doc, y);

  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`${pedido.itens.length} Itens`, left, y);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const quantidadeTotal = pedido.itens.reduce((acc, item) => acc + item.quantidade, 0);
  doc.text(`Quantidade: ${quantidadeTotal}`, left, y);

  y += 14;

  for (const item of pedido.itens) {
    const descricao = `${item.produto_nome}${item.produto_codigo ? ` (Cod. ${item.produto_codigo})` : ''}`;
    const descricaoLinhas = doc.splitTextToSize(descricao, 100);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(String(item.quantidade), left, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.text(descricaoLinhas, left + 16, y);

    const precoUnit = money(item.preco_unitario);
    doc.text(precoUnit, left + 16, y + descricaoLinhas.length * 5 + 1);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(money(item.subtotal), right, y, { align: 'right' });

    y += Math.max(20, descricaoLinhas.length * 5 + 12);

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
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Subtotal: ${money(pedido.total)}`, right, y, { align: 'right' });

  y += 8;
  doc.text(`Dinheiro: ${money(pedido.total)}`, right, y, { align: 'right' });

  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`Total: ${money(pedido.total)}`, right, y, { align: 'right' });

  doc.save(`pedido-${shortOrderNumber(pedido.id)}.pdf`);
}

export default function RelatoriosPage() {
  const [pedidos, setPedidos] = useState<PedidoRelatorio[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PedidoRelatorio | null>(null);

  async function loadData() {
    setLoading(true);

    try {
      const { data: pedidosData, error: pedidosError } = await supabaseClient
        .from('pedidos')
        .select('id, empresa_id, cliente_usuario_id, status, total, criado_em, atualizado_em')
        .eq('status', 'aprovado')
        .order('criado_em', { ascending: false });

      if (pedidosError) throw pedidosError;

      const pedidosRows = (pedidosData ?? []) as PedidoRow[];

      if (!pedidosRows.length) {
        setPedidos([]);
        setSelected(null);
        return;
      }

      const pedidoIds = pedidosRows.map((p) => p.id);
      const clienteIds = Array.from(
        new Set(
          pedidosRows
            .map((p) => p.cliente_usuario_id)
            .filter((v): v is string => Boolean(v))
        )
      );

      const { data: itensData, error: itensError } = await supabaseClient
        .from('pedidos_itens')
        .select('id, pedido_id, produto_id, quantidade, preco_unitario, subtotal, criado_em')
        .in('pedido_id', pedidoIds);

      if (itensError) throw itensError;

      const itensRows = (itensData ?? []) as PedidoItemRow[];

      const produtoIds = Array.from(
        new Set(
          itensRows
            .map((i) => i.produto_id)
            .filter((v): v is string => Boolean(v))
        )
      );

      const [{ data: clientesData, error: clientesError }, { data: produtosData, error: produtosError }] =
        await Promise.all([
          clienteIds.length
            ? supabaseClient
                .from('clientes')
                .select('usuario_id, nome, telefone, criado_em')
                .in('usuario_id', clienteIds)
            : Promise.resolve({ data: [], error: null }),
          produtoIds.length
            ? supabaseClient
                .from('produtos')
                .select('id, nome, codigo')
                .in('id', produtoIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

      if (clientesError) throw clientesError;
      if (produtosError) throw produtosError;

      const clientesRows = (clientesData ?? []) as ClienteRow[];
      const produtosRows = (produtosData ?? []) as ProdutoRow[];

      const clientesMap = new Map(clientesRows.map((c) => [c.usuario_id, c]));
      const produtosMap = new Map(produtosRows.map((p) => [p.id, p]));

      const itensPorPedido = new Map<string, PedidoItemDetalhado[]>();

      for (const item of itensRows) {
        const produto = item.produto_id ? produtosMap.get(item.produto_id) : null;

        const detalhado: PedidoItemDetalhado = {
          id: item.id,
          produto_id: item.produto_id,
          produto_nome: produto?.nome ?? 'Produto sem nome',
          produto_codigo: produto?.codigo ?? null,
          quantidade: Number(item.quantidade ?? 0),
          preco_unitario: Number(item.preco_unitario ?? 0),
          subtotal: Number(item.subtotal ?? 0),
        };

        const arr = itensPorPedido.get(item.pedido_id) ?? [];
        arr.push(detalhado);
        itensPorPedido.set(item.pedido_id, arr);
      }

      const finalRows: PedidoRelatorio[] = pedidosRows.map((pedido) => {
        const cliente = pedido.cliente_usuario_id
          ? clientesMap.get(pedido.cliente_usuario_id)
          : null;

        return {
          id: pedido.id,
          empresa_id: pedido.empresa_id,
          cliente_usuario_id: pedido.cliente_usuario_id,
          status: pedido.status ?? 'aprovado',
          total: Number(pedido.total ?? 0),
          criado_em: pedido.criado_em,
          atualizado_em: pedido.atualizado_em,
          cliente_nome: cliente?.nome ?? 'Cliente sem nome',
          cliente_telefone: cliente?.telefone ?? null,
          itens: itensPorPedido.get(pedido.id) ?? [],
        };
      });

      setPedidos(finalRows);
      setSelected((current) => {
        if (!current) return finalRows[0] ?? null;
        return finalRows.find((p) => p.id === current.id) ?? finalRows[0] ?? null;
      });
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
      setPedidos([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pedidos;

    const qDigits = onlyDigits(q);

    return pedidos.filter((pedido) => {
      const idMatch =
        pedido.id.toLowerCase().includes(q) ||
        shortOrderNumber(pedido.id).toLowerCase().includes(q);

      const nomeMatch = pedido.cliente_nome.toLowerCase().includes(q);

      const telefoneMatch = qDigits
        ? onlyDigits(pedido.cliente_telefone).includes(qDigits)
        : false;

      return idMatch || nomeMatch || telefoneMatch;
    });
  }, [pedidos, search]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900">
              Relatórios
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Pesquise pedidos aprovados e gere o PDF de impressão.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-[280px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por pedido, cliente ou telefone..."
                className="h-11 w-full rounded-2xl border border-zinc-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-zinc-400"
              />
            </div>

            <button
              type="button"
              onClick={loadData}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="rounded-3xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-4">
            <h2 className="text-sm font-bold text-zinc-900">
              Pedidos aprovados ({filtered.length})
            </h2>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-3">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="animate-pulse rounded-2xl border border-zinc-100 p-4"
                  >
                    <div className="h-4 w-28 rounded bg-zinc-200" />
                    <div className="mt-3 h-3 w-40 rounded bg-zinc-100" />
                    <div className="mt-2 h-3 w-24 rounded bg-zinc-100" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500">
                Nenhum pedido aprovado encontrado.
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((pedido) => {
                  const active = selected?.id === pedido.id;

                  return (
                    <button
                      key={pedido.id}
                      type="button"
                      onClick={() => setSelected(pedido)}
                      className={cn(
                        'w-full rounded-2xl border p-4 text-left transition',
                        active
                          ? 'border-emerald-300 bg-emerald-50'
                          : 'border-zinc-200 bg-white hover:bg-zinc-50'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-extrabold text-zinc-900">
                            VENDA N°{shortOrderNumber(pedido.id)}
                          </div>
                          <div className="mt-1 text-sm text-zinc-600">
                            {pedido.cliente_nome}
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {formatDate(pedido.criado_em)}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                            aprovado
                          </div>
                          <div className="mt-2 text-sm font-extrabold text-zinc-900">
                            {money(pedido.total)}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white shadow-sm">
          {!selected ? (
            <div className="flex min-h-[420px] items-center justify-center p-8 text-center text-sm text-zinc-500">
              Selecione um pedido para visualizar e gerar o PDF.
            </div>
          ) : (
            <div className="p-5">
              <div className="flex flex-col gap-4 border-b border-zinc-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-zinc-900">
                    VENDA N°{shortOrderNumber(selected.id)}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {formatDate(selected.criado_em)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setSelected(selected)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                  >
                    <Eye className="h-4 w-4" />
                    Visualizando
                  </button>

                  <button
                    type="button"
                    onClick={() => generatePedidoPdf(selected)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#01A920] px-4 text-sm font-bold text-white transition hover:opacity-90"
                  >
                    <FileDown className="h-4 w-4" />
                    Baixar PDF
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                    Cliente
                  </div>
                  <div className="mt-2 text-lg font-bold text-zinc-900">
                    {selected.cliente_nome}
                  </div>
                  <div className="mt-1 text-sm text-zinc-600">
                    {selected.cliente_telefone || 'Sem telefone'}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                    Resumo
                  </div>
                  <div className="mt-2 text-sm text-zinc-700">
                    Itens: <span className="font-bold">{selected.itens.length}</span>
                  </div>
                  <div className="mt-1 text-sm text-zinc-700">
                    Quantidade total:{' '}
                    <span className="font-bold">
                      {selected.itens.reduce((acc, item) => acc + item.quantidade, 0)}
                    </span>
                  </div>
                  <div className="mt-2 text-lg font-extrabold text-zinc-900">
                    {money(selected.total)}
                  </div>
                </div>
              </div>

              <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-zinc-50">
                      <tr className="text-left text-xs font-bold uppercase tracking-wide text-zinc-500">
                        <th className="px-4 py-3">Qtd</th>
                        <th className="px-4 py-3">Produto</th>
                        <th className="px-4 py-3">Unitário</th>
                        <th className="px-4 py-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.itens.map((item) => (
                        <tr key={item.id} className="border-t border-zinc-100">
                          <td className="px-4 py-4 text-sm font-bold text-zinc-900">
                            {item.quantidade}
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm font-semibold text-zinc-900">
                              {item.produto_nome}
                            </div>
                            {item.produto_codigo ? (
                              <div className="mt-1 text-xs text-zinc-500">
                                Cód. {item.produto_codigo}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-4 text-sm text-zinc-700">
                            {money(item.preco_unitario)}
                          </td>
                          <td className="px-4 py-4 text-right text-sm font-extrabold text-zinc-900">
                            {money(item.subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-zinc-200 bg-zinc-50">
                        <td colSpan={3} className="px-4 py-4 text-right text-sm font-bold text-zinc-700">
                          Total
                        </td>
                        <td className="px-4 py-4 text-right text-base font-extrabold text-zinc-900">
                          {money(selected.total)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}