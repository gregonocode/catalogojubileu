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
  desconto_ativo?: boolean;
  desconto_tipo?: "valor" | "percentual" | null;
  desconto_valor?: number | null;
  desconto_calculado?: number | null;
  total_com_desconto?: number | null;
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

function valorParcelaFinal(pedido: PedidoPdfData, totalFinal: number) {
  if (!pedido.quantidade_parcelas || pedido.quantidade_parcelas < 1) {
    return pedido.valor_parcela ?? null;
  }
  return Math.round(((totalFinal - (pedido.valor_entrada ?? 0)) / pedido.quantidade_parcelas) * 100) / 100;
}

type PedidoPdfPagamento = {
  parcela: string;
  vencimento: string;
  valor: number;
};

function formatarVencimento(date: Date) {
  const weekday = date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  const day = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${day}`;
}

function gerarPagamentos(pedido: PedidoPdfData, totalFinal: number): PedidoPdfPagamento[] {
  const createdAt = new Date(pedido.criado_em);
  const saleDate = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;
  const baseDate = new Date(saleDate.getFullYear(), saleDate.getMonth(), saleDate.getDate());
  const quantity = pedido.quantidade_parcelas ?? 0;

  if (!pedido.parcelado || quantity < 1) {
    return [{ parcela: "À vista", vencimento: formatarVencimento(baseDate), valor: totalFinal }];
  }

  const payments: PedidoPdfPagamento[] = [];
  const entrance = pedido.valor_entrada ?? 0;
  if (entrance > 0) {
    payments.push({ parcela: "Entrada", vencimento: formatarVencimento(baseDate), valor: entrance });
  }

  const amountPerInstallment = valorParcelaFinal(pedido, totalFinal) ?? 0;
  const totalFinanced = Math.max(0, totalFinal - entrance);
  for (let index = 0; index < quantity; index += 1) {
    const dueDate = new Date(baseDate);
    dueDate.setDate(dueDate.getDate() + (index + 1) * 7);
    const amount = index === quantity - 1
      ? Math.round((totalFinanced - amountPerInstallment * (quantity - 1)) * 100) / 100
      : amountPerInstallment;

    payments.push({
      parcela: `${index + 1}/${quantity}`,
      vencimento: formatarVencimento(dueDate),
      valor: amount,
    });
  }

  return payments;
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

function drawPaymentTable(
  doc: jsPDF,
  payments: PedidoPdfPagamento[],
  title: string,
  top: number,
  rowHeight = 8.5
) {
  const left = 14;
  const right = 196;
  const tableWidth = right - left;
  const columns = [left, left + 27, left + 91, left + 127, right];
  const headerHeight = 8;
  let y = top;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(25, 35, 45);
  doc.text(title, left, y + 5.5);
  y += 8;

  doc.setFillColor(49, 66, 82);
  doc.setDrawColor(90, 105, 118);
  doc.setLineWidth(0.25);
  doc.rect(left, y, tableWidth, headerHeight, "FD");
  for (const column of columns.slice(1, -1)) doc.line(column, y, column, y + headerHeight);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  const headers = ["Parcela", "Vencimento", "Valor", "Pago em / Assinatura"];
  headers.forEach((header, index) => {
    doc.text(header, (columns[index] + columns[index + 1]) / 2, y + 5.3, { align: "center" });
  });
  y += headerHeight;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(35, 42, 48);
  doc.setDrawColor(145, 153, 160);
  payments.forEach((payment) => {
    doc.rect(left, y, tableWidth, rowHeight, "S");
    for (const column of columns.slice(1, -1)) doc.line(column, y, column, y + rowHeight);
    const baseline = y + rowHeight / 2 + 1.1;
    doc.text(payment.parcela, (columns[0] + columns[1]) / 2, baseline, { align: "center" });
    doc.text(payment.vencimento, (columns[1] + columns[2]) / 2, baseline, { align: "center" });
    doc.text(formatBRL(payment.valor), (columns[2] + columns[3]) / 2, baseline, { align: "center" });
    y += rowHeight;
  });

  return y;
}

function drawSignatureFields(doc: jsPDF, lineY: number) {
  const left = 14;
  const right = 196;
  const signatureWidth = 72;
  const leftStart = left + 5;
  const rightStart = right - 5 - signatureWidth;

  doc.setDrawColor(70, 70, 70);
  doc.setLineWidth(0.35);
  doc.line(leftStart, lineY, leftStart + signatureWidth, lineY);
  doc.line(rightStart, lineY, rightStart + signatureWidth, lineY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(55, 55, 55);
  doc.text("Assinatura do cliente", leftStart + signatureWidth / 2, lineY + 6, { align: "center" });
  doc.text("Responsável pela venda", rightStart + signatureWidth / 2, lineY + 6, { align: "center" });
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
  const totalFinal = pedido.desconto_ativo && pedido.total_com_desconto !== null && pedido.total_com_desconto !== undefined ? pedido.total_com_desconto : pedido.total;
  const pagamentos = gerarPagamentos(pedido, totalFinal);
  const rowHeight = 8.5;
  const footerHeight = 8 + 8 + pagamentos.length * rowHeight + 22 + 6 + 16;
  const footerTop = 297 - footerHeight;
  const temDesconto = pedido.desconto_ativo && pedido.desconto_calculado !== null && pedido.desconto_calculado !== undefined;
  const alturaTotais = 10 + 14 + 8 + (temDesconto ? 8 : 0) + 10;
  const podeCompartilharPagina = footerTop > 20 + alturaTotais + 8;
  const tituloPagamento = pedido.parcelado && pedido.quantidade_parcelas
    ? `Forma de pagamento: ${pedido.quantidade_parcelas} parcela${pedido.quantidade_parcelas === 1 ? "" : "s"} semanal${pedido.quantidade_parcelas === 1 ? "" : "is"}, vencimento a cada 7 dias`
    : "Forma de pagamento: à vista";
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
    const alturaItem = Math.max(20, linhas.length * 5 + 12);

    if (y + alturaItem > 250) {
      doc.addPage();
      y = 20;
    }

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

    y += alturaItem;

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(left, y - 4, right, y - 4);

  }

  const limiteTotais = podeCompartilharPagina ? footerTop - 8 : 282;
  if (y + alturaTotais > limiteTotais) {
    doc.addPage();
    y = 20;
  }

  y += 10;
  drawLine(doc, y);

  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`Subtotal: ${formatBRL(pedido.total)}`, right, y, { align: "right" });

  y += 8;
  doc.text(`Dinheiro: ${formatBRL(totalFinal)}`, right, y, { align: "right" });

  if (temDesconto) {
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Desconto: -${formatBRL(pedido.desconto_calculado)}`, right, y, { align: "right" });
  }

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Total: ${formatBRL(totalFinal)}`, right, y, { align: "right" });

  if (podeCompartilharPagina) {
    const tableBottom = drawPaymentTable(doc, pagamentos, tituloPagamento, footerTop, rowHeight);
    drawSignatureFields(doc, tableBottom + 22);
  } else {
    const rowsPerPage = 26;
    for (let offset = 0; offset < pagamentos.length; offset += rowsPerPage) {
      doc.addPage();
      const pagePayments = pagamentos.slice(offset, offset + rowsPerPage);
      const isLastPaymentPage = offset + pagePayments.length >= pagamentos.length;
      drawPaymentTable(
        doc,
        pagePayments,
        offset === 0 ? tituloPagamento : `${tituloPagamento} (continuação)`,
        20,
        rowHeight
      );
      if (isLastPaymentPage) drawSignatureFields(doc, 270);
    }
  }

  doc.save(`pedido-${formatPedidoShortId(pedido.id)}.pdf`);
}

function generatePedidoPdvPdf(pedido: PedidoPdfData) {
  const pageWidth = 80;
  const left = 4;
  const right = pageWidth - 4;
  const contentWidth = right - left;
  const totalFinal = pedido.desconto_ativo && pedido.total_com_desconto !== null && pedido.total_com_desconto !== undefined ? pedido.total_com_desconto : pedido.total;
  const parcelaFinal = valorParcelaFinal(pedido, totalFinal);
  const measureDoc = new jsPDF({ orientation: "p", unit: "mm", format: [pageWidth, 200] });
  const endereco = measureDoc.splitTextToSize(`Endereço: ${pedido.cliente_endereco || "-"}`, contentWidth);
  const itemLines = pedido.itens.map((item) =>
    measureDoc.splitTextToSize(item.produto_nome || item.produto_id, contentWidth)
  );
  const parcelamentoLines = pedido.parcelado && pedido.quantidade_parcelas && parcelaFinal !== null ? 13 : 0;
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
  doc.text(`TOTAL: ${formatBRL(totalFinal)}`, right, y, { align: "right" });

  if (pedido.desconto_ativo && pedido.desconto_calculado !== null && pedido.desconto_calculado !== undefined) {
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Desconto: -${formatBRL(pedido.desconto_calculado)}`, right, y, { align: "right" });
  }

  if (pedido.parcelado && pedido.quantidade_parcelas && parcelaFinal !== null) {
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("PAGAMENTO PARCELADO", right, y, { align: "right" });
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Entrada: ${formatBRL(pedido.valor_entrada ?? 0)}`, right, y, { align: "right" });
    y += 4;
    doc.text(`${pedido.quantidade_parcelas}x de ${formatBRL(parcelaFinal)}`, right, y, { align: "right" });
  }

  doc.save(`pedido-${formatPedidoShortId(pedido.id)}-pdv.pdf`);
}
