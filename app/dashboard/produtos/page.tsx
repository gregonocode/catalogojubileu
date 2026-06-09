// app/dashboard/produtos/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import { supabaseClient } from "@/lib/supabase/client";
import {
  PlusCircle,
  Search,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Empresa = {
  id: string;
  nome: string;
  slug: string;
};

type Produto = {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  estoque: number;
  ativo: boolean;
  imagem_url: string | null;
  criado_em: string;
  categoria_id: string | null;
};

type Categoria = {
  id: string;
  nome: string;
};

function truncateText(text: string, max = 42) {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return t.slice(0, max).trimEnd() + "...";
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ProdutosPage() {
  const [loading, setLoading] = useState(true);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const categoriasMap = useMemo(() => new Map(categorias.map((c) => [c.id, c.nome])), [categorias]);

  const [q, setQ] = useState("");
  const [onlyAtivos, setOnlyAtivos] = useState(false);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return produtos.filter((p) => {
      if (onlyAtivos && !p.ativo) return false;
      if (!query) return true;
      return (
        p.nome.toLowerCase().includes(query) ||
        (p.descricao ?? "").toLowerCase().includes(query)
      );
    });
  }, [produtos, q, onlyAtivos]);

  async function load() {
    try {
      setLoading(true);

      const { data: u, error: uErr } = await supabaseClient.auth.getUser();
      if (uErr || !u.user) {
        window.location.href = "/login";
        return;
      }

      const userId = u.user.id;

      const { data: emp, error: empErr } = await supabaseClient
        .from("empresas")
        .select("id, nome, slug")
        .eq("dono_usuario_id", userId)
        .maybeSingle();

      if (empErr) throw empErr;

      if (!emp) {
        setEmpresa(null);
        setProdutos([]);
        setCategorias([]);
        return;
      }

      setEmpresa(emp);

      const [catsRes, prodsRes] = await Promise.all([
        supabaseClient
          .from("categorias")
          .select("id, nome")
          .eq("empresa_id", emp.id)
          .order("nome", { ascending: true }),

        supabaseClient
          .from("produtos")
          .select("id, nome, descricao, preco, estoque, ativo, imagem_url, criado_em, categoria_id")
          .eq("empresa_id", emp.id)
          .order("criado_em", { ascending: false }),
      ]);

      if (catsRes.error) throw catsRes.error;
      if (prodsRes.error) throw prodsRes.error;

      setCategorias((catsRes.data ?? []) as Categoria[]);
      setProdutos((prodsRes.data ?? []) as Produto[]);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar produtos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleAtivo(p: Produto) {
    toast.dismiss();
    const next = !p.ativo;

    // otimista
    setProdutos((prev) => prev.map((x) => (x.id === p.id ? { ...x, ativo: next } : x)));

    const { error } = await supabaseClient
  .from("produtos")
  .update({ ativo: next })
  .eq("id", p.id)
  .eq("empresa_id", empresa?.id ?? "");

    if (error) {
      // rollback
      setProdutos((prev) => prev.map((x) => (x.id === p.id ? { ...x, ativo: !next } : x)));
      toast.error("Não foi possível atualizar o status.");
      return;
    }

    toast.success(next ? "Produto ativado." : "Produto desativado.");
  }

  async function removeProduto(p: Produto) {
    toast.dismiss();

    const ok = window.confirm(`Excluir o produto "${p.nome}"?`);
    if (!ok) return;

    // otimista
    const before = produtos;
    setProdutos((prev) => prev.filter((x) => x.id !== p.id));

    const { error } = await supabaseClient
  .from("produtos")
  .delete()
  .eq("id", p.id)
  .eq("empresa_id", empresa?.id ?? "");

    if (error) {
      setProdutos(before);
      toast.error("Não foi possível excluir.");
      return;
    }

    toast.success("Produto excluído.");
  }

  async function copyLinkCatalogo() {
    if (!empresa?.slug) return;

    const url = `${window.location.origin}/c/${empresa.slug}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link do catálogo copiado!");
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* =========================
          SECTION: Header
      ========================= */}
      <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm text-black/60">Produtos</div>
            <div className="text-lg font-semibold text-black">Lista de produtos</div>
            <div className="mt-1 text-xs text-black/55">
              Gerencie seus produtos e publique no catálogo.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={copyLinkCatalogo}
              disabled={!empresa}
              className={cn(
                "inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm hover:bg-black/5",
                "disabled:cursor-not-allowed disabled:opacity-60"
              )}
              title={!empresa ? "Crie sua empresa em Configuração" : "Copiar link do catálogo"}
            >
              <ExternalLink size={16} />
              Copiar link do catálogo
            </button>

            {empresa?.slug && (
              <a
                href={`/c/${empresa.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm hover:bg-black/5"
              >
                <ExternalLink size={16} />
                Abrir catálogo
              </a>
            )}

            <button
              onClick={load}
              className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm hover:bg-black/5"
            >
              <RefreshCw size={16} />
              Atualizar
            </button>

            <Link
              href="/dashboard/produtos/novo"
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: "#EB3410" }}
            >
              <PlusCircle size={16} />
              Novo produto
            </Link>
          </div>
        </div>
      </section>

      {/* =========================
          SECTION: Filtros
      ========================= */}
      <section className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-black/45" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome ou descrição..."
              className="h-11 w-full rounded-2xl border border-black/10 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-black/20 focus:shadow-[0_0_0_4px_rgba(235,52,16,0.12)]"
            />
          </div>

          <label className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm">
            <input
              type="checkbox"
              checked={onlyAtivos}
              onChange={(e) => setOnlyAtivos(e.target.checked)}
            />
            Mostrar só ativos
          </label>
        </div>
      </section>

      {/* =========================
          SECTION: Estado sem empresa
      ========================= */}
      {!loading && !empresa && (
        <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
          <div className="text-lg font-semibold text-black">Você ainda não criou sua empresa</div>
          <div className="mt-2 text-sm text-black/60">
            Vá em <b>Configuração</b> e cadastre nome/slug/WhatsApp para liberar o catálogo.
          </div>
          <div className="mt-5">
            <Link
              href="/dashboard/configuracao"
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: "#EB3410" }}
            >
              Ir para Configuração
            </Link>
          </div>
        </section>
      )}

      {/* =========================
          SECTION: Lista
      ========================= */}
      <section className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-black">Produtos</div>
            <div className="text-xs text-black/55">
              {loading ? "Carregando..." : `${filtered.length} item(ns)`}
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-black/10">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="bg-black/5 text-xs text-black/55">
  <tr>
    <th className="px-4 py-3 w-[25%]">Produto</th>
    <th className="px-4 py-3 w-[20%]">Categoria</th>
    <th className="px-4 py-3 w-[14%]">Preço</th>
    <th className="px-4 py-3 w-[7%]">Estoque</th>
    <th className="px-4 py-3 w-[15%]">Status</th>
    <th className="px-4 py-3 w-[17%] text-right whitespace-nowrap">Ações</th>
  </tr>
</thead>

            <tbody className="divide-y divide-black/10">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-black/60">
                    Carregando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-black/60">
                    Nenhum produto encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const catName = p.categoria_id ? categoriasMap.get(p.categoria_id) : null;

                  return (
                    <tr key={p.id} className="hover:bg-black/5">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 overflow-hidden rounded-2xl border border-black/10 bg-black/5">
                            {p.imagem_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.imagem_url} alt={p.nome} className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs text-black/55 truncate">
                           {p.descricao ? truncateText(p.descricao, 30) : "—"}
                          </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-black/70">{catName ?? "—"}</td>
                      <td className="px-4 py-3 text-black/70">{formatBRL(Number(p.preco) || 0)}</td>
                      <td className="px-4 py-3 text-black/70">{p.estoque}</td>

                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-1 text-xs font-semibold ring-1",
                            p.ativo ? "bg-black/5 text-black ring-black/10" : "bg-white text-black/60 ring-black/10"
                          )}
                        >
                          {p.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => toggleAtivo(p)}
                            className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-white hover:bg-black/5"
                            title={p.ativo ? "Desativar" : "Ativar"}
                          >
                            {p.ativo ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>

                          {/* editar */}
                   <Link
                   href={`/dashboard/produtos/${p.id}`}
                   className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-white hover:bg-black/5"
                   title="Editar">
                  <Pencil size={16} />
                     </Link>
                          <button
                            onClick={() => removeProduto(p)}
                            className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-white hover:bg-black/5"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé listagem */}
        <div className="mt-4 text-xs text-black/45">
          Dica: desativar remove do catálogo público (não apaga do banco).
        </div>
      </section>
    </div>
  );
}
