import jsPDF from "jspdf";

export type PedidoPdfItem = {
  id: string;
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  produto_nome: string | null;
};

export type PedidoPdfData = {
  id: string;
  total: number;
  criado_em: string;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  cliente_endereco: string | null;
  parcelado?: boolean;
  valor_entrada?: number | null;
  quantidade_parcelas?: number | null;
  valor_parcela?: number | null;
  itens: PedidoPdfItem[];
};

export function formatPedidoShortId(id: string) {
  if (!id) return "";
  const a = id.split("-")[0] ?? id.slice(0, 8);
  return a.toUpperCase();
}

function formatBRL(v: number) {
  return (Number(v) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
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

function drawLine(doc: jsPDF, y: number) {
  doc.setDrawColor(20, 20, 20);
  doc.setLineWidth(0.6);
  doc.line(14, y, 196, y);
}

export type PedidoPdfFormat = "a4" | "pdv";

export function generatePedidoPdf(pedido: PedidoPdfData, format: PedidoPdfFormat = "a4") {
  if (format === "pdv") {
    generatePedidoPdvPdf(pedido);
    return;
  }

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
  doc.text(`VENDA N°${formatPedidoShortId(pedido.id)}`, pageWidth / 2, y, {
    align: "center",
  });

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

  if (pedido.parcelado && pedido.quantidade_parcelas && pedido.valor_parcela !== null && pedido.valor_parcela !== undefined) {
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Pagamento parcelado", left, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Entrada: ${formatBRL(pedido.valor_entrada ?? 0)}`, left, y);
    y += 5;
    doc.text(`${pedido.quantidade_parcelas}x de ${formatBRL(pedido.valor_parcela)}`, left, y);
    y += 4;
    drawLine(doc, y);
  }

  y += 24;
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

  doc.save(`pedido-${formatPedidoShortId(pedido.id)}.pdf`);
}

function generatePedidoPdvPdf(pedido: PedidoPdfData) {
  const pageWidth = 80;
  const left = 4;
  const right = pageWidth - 4;
  const contentWidth = right - left;
  const measureDoc = new jsPDF({ orientation: "p", unit: "mm", format: [pageWidth, 200] });
  const endereco = measureDoc.splitTextToSize(`Endereço: ${pedido.cliente_endereco || "-"}`, contentWidth);
  const itemLines = pedido.itens.map((item) =>
    measureDoc.splitTextToSize(item.produto_nome || item.produto_id, contentWidth)
  );
  const parcelamentoLines = pedido.parcelado && pedido.quantidade_parcelas && pedido.valor_parcela !== null && pedido.valor_parcela !== undefined ? 13 : 0;
  const height = Math.max(
    110,
    51 + parcelamentoLines + endereco.length * 4 + itemLines.reduce((total, lines) => total + lines.length * 4 + 11, 0)
  );
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: [pageWidth, height] });
  let y = 8;

  const separator = () => {
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.2);
    doc.line(left, y, right, y);
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`PEDIDO #${formatPedidoShortId(pedido.id)}`, pageWidth / 2, y, { align: "center" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(formatPdfDate(pedido.criado_em), pageWidth / 2, y, { align: "center" });

  y += 5;
  separator();
  y += 5;
  doc.setFontSize(8);
  doc.text(`Cliente: ${pedido.cliente_nome || "Cliente sem nome"}`, left, y);
  y += 4;
  doc.text(`Telefone: ${pedido.cliente_telefone || "-"}`, left, y);
  y += 4;
  doc.text(endereco, left, y);
  y += endereco.length * 4 + 2;
  separator();

  if (pedido.parcelado && pedido.quantidade_parcelas && pedido.valor_parcela !== null && pedido.valor_parcela !== undefined) {
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("PAGAMENTO PARCELADO", left, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Entrada: ${formatBRL(pedido.valor_entrada ?? 0)}`, left, y);
    y += 4;
    doc.text(`${pedido.quantidade_parcelas}x de ${formatBRL(pedido.valor_parcela)}`, left, y);
    y += 3;
    separator();
  }

  y += 5;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("ITENS", left, y);
  y += 5;

  pedido.itens.forEach((item, index) => {
    const nome = doc.splitTextToSize(item.produto_nome || item.produto_id, contentWidth);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(nome, left, y);
    y += nome.length * 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`${item.quantidade} x ${formatBRL(item.preco_unitario)}`, left, y);
    doc.text(formatBRL(item.subtotal), right, y, { align: "right" });
    y += 5;
    if (index < pedido.itens.length - 1) {
      separator();
      y += 4;
    }
  });

  y += 2;
  separator();
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`TOTAL: ${formatBRL(pedido.total)}`, right, y, { align: "right" });

  doc.save(`pedido-${formatPedidoShortId(pedido.id)}-pdv.pdf`);
}
