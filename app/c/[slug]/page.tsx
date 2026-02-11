// app/c/[slug]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabase/client";
import toast, { Toaster } from "react-hot-toast";
import { Minus, Plus, ShoppingCart, ArrowLeft } from "lucide-react";

// ✅ popup + modal (separados)
import ClienteCadastroPopup from "@/app/components/auth/ClienteCadastroPopup";
import ClienteAuthModal from "@/app/components/auth/ClienteAuthModal";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Empresa = {
  id: string;
  nome: string;
  slug: string;
  whatsapp: string;
};

type Categoria = {
  id: string;
  nome: string;
  slug: string;
};

type Produto = {
  id: string;
  empresa_id: string;
  categoria_id: string | null;
  nome: string;
  descricao: string | null;
  preco: number;
  estoque: number;
  imagem_url: string | null;
  ativo: boolean;
};

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

function buildWhatsappUrl(whatsapp: string, message: string) {
  const phone = onlyDigits(whatsapp);
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${encoded}`;
}

export default function CatalogoPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params?.slug;

  const [loading, setLoading] = useState(true);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categoriaAtiva, setCategoriaAtiva] = useState<string | "todas">("todas");

  // carrinho: produtoId -> quantidade
  const [qtd, setQtd] = useState<Record<string, number>>({});

  // modal de auth (usado quando tenta finalizar sem login)
  const [authOpen, setAuthOpen] = useState(false);

  const produtosFiltrados = useMemo(() => {
    if (categoriaAtiva === "todas") return produtos;
    return produtos.filter((p) => p.categoria_id === categoriaAtiva);
  }, [produtos, categoriaAtiva]);

  const itensCarrinho = useMemo(() => {
    const items = Object.entries(qtd)
      .filter(([, q]) => q > 0)
      .map(([produtoId, q]) => {
        const p = produtos.find((x) => x.id === produtoId);
        if (!p) return null;
        return { produto: p, quantidade: q, subtotal: q * (Number(p.preco) || 0) };
      })
      .filter(Boolean) as Array<{ produto: Produto; quantidade: number; subtotal: number }>;

    return items;
  }, [qtd, produtos]);

  const total = useMemo(() => {
    return itensCarrinho.reduce((acc, it) => acc + it.subtotal, 0);
  }, [itensCarrinho]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);

        // =========================
        // SECTION: Carregar Empresa
        // =========================
        const { data: emp, error: empErr } = await supabaseClient
          .from("empresas")
          .select("id, nome, slug, whatsapp")
          .eq("slug", String(slug))
          .maybeSingle();

        if (empErr) throw empErr;

        if (!emp) {
          if (mounted) setEmpresa(null);
          return;
        }

        if (!mounted) return;
        setEmpresa(emp);

        // =========================
        // SECTION: Carregar Categorias
        // =========================
        const { data: cats, error: catsErr } = await supabaseClient
          .from("categorias")
          .select("id, nome, slug")
          .eq("empresa_id", emp.id)
          .order("nome", { ascending: true });

        if (catsErr) throw catsErr;
        if (!mounted) return;
        setCategorias(cats ?? []);

        // =========================
        // SECTION: Carregar Produtos (ativos)
        // =========================
        const { data: prods, error: prodsErr } = await supabaseClient
          .from("produtos")
          .select("id, empresa_id, categoria_id, nome, descricao, preco, estoque, imagem_url, ativo")
          .eq("empresa_id", emp.id)
          .eq("ativo", true)
          .order("nome", { ascending: true });

        if (prodsErr) throw prodsErr;
        if (!mounted) return;
        setProdutos((prods ?? []) as Produto[]);
      } catch (err) {
        console.error(err);
        toast.error("Não foi possível carregar o catálogo.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (slug) load();

    return () => {
      mounted = false;
    };
  }, [slug]);

  function inc(produto: Produto) {
    setQtd((prev) => {
      const current = prev[produto.id] ?? 0;
      const next = current + 1;

      // respeita estoque (se estoque 0, deixa bloquear)
      if (produto.estoque === 0) return prev;
      if (produto.estoque > 0 && next > produto.estoque) return prev;

      return { ...prev, [produto.id]: next };
    });
  }

  function dec(produto: Produto) {
    setQtd((prev) => {
      const current = prev[produto.id] ?? 0;
      const next = Math.max(0, current - 1);
      return { ...prev, [produto.id]: next };
    });
  }

  function setExact(produto: Produto, value: number) {
    const v = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    setQtd((prev) => {
      if (produto.estoque === 0) return prev;
      if (produto.estoque > 0 && v > produto.estoque) return { ...prev, [produto.id]: produto.estoque };
      return { ...prev, [produto.id]: v };
    });
  }

  async function finalizarWhatsApp() {
    if (!empresa) return;

    // ✅ BLOQUEIA pedido se não estiver logado
    const { data } = await supabaseClient.auth.getSession();
    const isAuthed = Boolean(data.session?.user);

    if (!isAuthed) {
      toast.error("Você precisa criar conta ou fazer login para finalizar o pedido.");
      setAuthOpen(true);
      return;
    }

    if (itensCarrinho.length === 0) {
      toast.error("Escolha pelo menos 1 item para finalizar.");
      return;
    }

    // =========================
    // SECTION: Montar Mensagem WhatsApp
    // =========================
    const lines: string[] = [];
    lines.push(`Olá! Quero fazer um pedido na ${empresa.nome}.`);
    lines.push("");
    lines.push("🛒 Itens:");

    itensCarrinho.forEach((it) => {
      const preco = Number(it.produto.preco) || 0;
      lines.push(`- ${it.quantidade}x ${it.produto.nome} (${formatBRL(preco)}) = ${formatBRL(it.subtotal)}`);
    });

    lines.push("");
    lines.push(`Total: ${formatBRL(total)}`);
    lines.push("");
    lines.push("Pode me atender, por favor?");

    const url = buildWhatsappUrl(empresa.whatsapp, lines.join("\n"));
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // =========================
  // SECTION: Estados de tela
  // =========================
  if (!loading && !empresa) {
    return (
      <div className="min-h-screen bg-white text-[#0f172a]">
        <div className="mx-auto w-full max-w-4xl px-4 py-10">
          <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)]">
            <div className="text-lg font-semibold text-black">Catálogo não encontrado</div>
            <p className="mt-2 text-sm text-black/60">
              Não achei nenhuma empresa com o slug <b>{String(slug)}</b>.
            </p>

            <button
              onClick={() => router.replace("/login")}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm hover:bg-black/5"
            >
              <ArrowLeft size={16} /> Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================
  // SECTION: Layout principal
  // =========================
  return (
    <div className="min-h-screen bg-white text-[#0f172a]">
      <Toaster position="top-right" />

      {/* ✅ Popup automático (5s) se não logado */}
      <ClienteCadastroPopup delayMs={5000} />

      {/* ✅ Modal usado quando tentar finalizar sem login */}
      <ClienteAuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        defaultMode="signup"
        onAuthed={() => {
          // só pra garantir atualização de estado após login/cadastro
          router.refresh();
        }}
      />

      <div className="mx-auto w-full max-w-4xl px-4 py-6">
        {/* =========================
            SECTION: Header Laranja
        ========================= */}
        <section
          className="rounded-3xl p-6 text-white shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)]"
          style={{ backgroundColor: "#EB3410" }}
        >
          <div className="text-xs opacity-90">Catálogo</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">
            Faça seu pedido na {empresa?.nome ?? "Pneu Forte"}
          </div>
          <div className="mt-2 text-sm opacity-90">Escolha os itens, defina as quantidades e finalize pelo WhatsApp.</div>
        </section>

        {/* =========================
            SECTION: Categorias (chips)
        ========================= */}
        <section className="mt-6">
          <div className="mb-3 text-sm font-semibold text-black">Categorias</div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategoriaAtiva("todas")}
              className={cn(
                "rounded-2xl border px-4 py-2 text-sm transition",
                categoriaAtiva === "todas"
                  ? "border-black/10 bg-black/5 text-black"
                  : "border-black/10 bg-white text-black/70 hover:bg-black/5"
              )}
            >
              Todas
            </button>

            {categorias.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoriaAtiva(c.id)}
                className={cn(
                  "rounded-2xl border px-4 py-2 text-sm transition",
                  categoriaAtiva === c.id
                    ? "border-black/10 bg-black/5 text-black"
                    : "border-black/10 bg-white text-black/70 hover:bg-black/5"
                )}
              >
                {c.nome}
              </button>
            ))}
          </div>
        </section>

        {/* =========================
            SECTION: Lista de Produtos
        ========================= */}
        <section className="mt-6">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-black">Produtos</div>
              <div className="text-xs text-black/55">{loading ? "Carregando..." : `${produtosFiltrados.length} item(ns)`}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {loading ? (
              <div className="rounded-3xl border border-black/10 bg-white p-6">
                <div className="h-5 w-44 rounded bg-black/5" />
                <div className="mt-3 h-4 w-64 rounded bg-black/5" />
                <div className="mt-6 h-11 w-full rounded-2xl bg-black/5" />
              </div>
            ) : produtosFiltrados.length === 0 ? (
              <div className="rounded-3xl border border-black/10 bg-white p-6 text-sm text-black/60">
                Nenhum produto nesta categoria.
              </div>
            ) : (
              produtosFiltrados.map((p) => {
                const q = qtd[p.id] ?? 0;
                const semEstoque = p.estoque === 0;

                return (
                  <div
                    key={p.id}
                    className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]"
                  >
                    {/* MOBILE: coluna | DESKTOP: linha */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      {/* IMAGEM */}
                      <div className="overflow-hidden rounded-2xl border border-black/10 bg-black/5 h-28 w-full sm:h-20 sm:w-20 sm:shrink-0">
                        {p.imagem_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imagem_url} alt={p.nome} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-xs text-black/40">Sem foto</div>
                        )}
                      </div>

                      {/* CONTEÚDO */}
                      <div className="min-w-0 flex-1">
                        <div className="text-base font-semibold text-black">{p.nome}</div>

                        {p.descricao ? (
                          <div className="mt-1 text-sm text-black/60">{p.descricao}</div>
                        ) : (
                          <div className="mt-1 text-sm text-black/40">—</div>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-black/10 bg-black/5 px-3 py-1 text-xs font-semibold text-black">
                            {formatBRL(Number(p.preco) || 0)}
                          </span>
                          <span className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs text-black/60">
                            {semEstoque ? "Sem estoque" : `Estoque: ${p.estoque}`}
                          </span>
                        </div>

                        {/* CONTROLES */}
                        <div className="mt-4 sm:mt-3 sm:flex sm:justify-end">
                          <div className="w-full sm:w-auto">
                            <div className="mb-2 text-xs text-black/55 sm:text-right">Quantidade</div>

                            <div
                              className={cn(
                                "flex w-full items-center gap-2 rounded-2xl border border-black/10 bg-white p-2",
                                "sm:w-auto"
                              )}
                            >
                              <button
                                type="button"
                                onClick={() => dec(p)}
                                disabled={q <= 0}
                                className={cn(
                                  "grid h-11 w-11 place-items-center rounded-xl border border-black/10 bg-white hover:bg-black/5",
                                  "disabled:cursor-not-allowed disabled:opacity-50"
                                )}
                                aria-label="Diminuir"
                              >
                                <Minus size={18} />
                              </button>

                              <input
                                value={q}
                                onChange={(e) => setExact(p, Number(e.target.value))}
                                inputMode="numeric"
                                className="h-11 flex-1 rounded-xl border border-black/10 bg-white text-center text-sm outline-none sm:w-16 sm:flex-none"
                              />

                              <button
                                type="button"
                                onClick={() => inc(p)}
                                disabled={semEstoque || (p.estoque > 0 && q >= p.estoque)}
                                className={cn(
                                  "grid h-11 w-11 place-items-center rounded-xl border border-black/10 bg-white hover:bg-black/5",
                                  "disabled:cursor-not-allowed disabled:opacity-50"
                                )}
                                aria-label="Aumentar"
                              >
                                <Plus size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* =========================
            SECTION: Resumo + Finalizar
        ========================= */}
        <section className="mt-6">
          <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-black/5">
                  <ShoppingCart size={18} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-black">Seu pedido</div>
                  <div className="text-xs text-black/55">
                    {itensCarrinho.length === 0 ? "Escolha os itens acima" : `${itensCarrinho.length} item(ns) no carrinho`}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-black/55">Total</div>
                <div className="text-lg font-semibold text-black">{formatBRL(total)}</div>
              </div>
            </div>

            {itensCarrinho.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-black/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-black/5 text-xs text-black/55">
                    <tr>
                      <th className="px-4 py-3">Produto</th>
                      <th className="px-4 py-3">Qtd</th>
                      <th className="px-4 py-3">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/10">
                    {itensCarrinho.map((it) => (
                      <tr key={it.produto.id} className="hover:bg-black/5">
                        <td className="px-4 py-3 font-medium text-black">{it.produto.nome}</td>
                        <td className="px-4 py-3 text-black/70">{it.quantidade}</td>
                        <td className="px-4 py-3 text-black/70">{formatBRL(it.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button
              type="button"
              onClick={finalizarWhatsApp}
              className={cn(
                "mt-4 h-12 w-full rounded-2xl px-4 text-sm font-semibold text-white transition",
                "disabled:cursor-not-allowed disabled:opacity-60"
              )}
              style={{ backgroundColor: "#25D366" }} // verde WhatsApp
              disabled={!empresa || itensCarrinho.length === 0}
            >
              Finalizar no WhatsApp
            </button>

            <div className="mt-3 text-center text-xs text-black/45">
              Ao finalizar, abriremos o WhatsApp com a mensagem do seu pedido.
            </div>
          </div>
        </section>

        {/* =========================
            SECTION: Rodapé
        ========================= */}
        <section className="mt-8 pb-10 text-center text-xs text-black/35">
          {empresa?.nome ?? "Pneu Forte"} • Catálogo online
        </section>
      </div>
    </div>
  );
}
