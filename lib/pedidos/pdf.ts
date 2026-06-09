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

export function generatePedidoPdf(pedido: PedidoPdfData) {
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
