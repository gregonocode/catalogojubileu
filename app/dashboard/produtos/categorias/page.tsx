// app/dashboard/produtos/categorias/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import { supabaseClient } from "@/lib/supabase/client";
import { ArrowLeft, Plus, Save, Trash2, Pencil, X } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Categoria = {
  id: string;
  nome: string;
  slug: string;
  criado_em: string;
};

function normalizeSlug(s: string) {
  return (s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isValidSlug(s: string) {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);
}

export default function CategoriasPage() {
  const [loading, setLoading] = useState(true);
  const [empresaId, setEmpresaId] = useState<string | null>(null);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [q, setQ] = useState("");

  // create form
  const [nomeNovo, setNomeNovo] = useState("");
  const [slugNovo, setSlugNovo] = useState("");
  const [creating, setCreating] = useState(false);

  // edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return categorias;
    return categorias.filter((c) => c.nome.toLowerCase().includes(query) || c.slug.toLowerCase().includes(query));
  }, [categorias, q]);

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
        .select("id")
        .eq("dono_usuario_id", userId)
        .maybeSingle();

      if (empErr) throw empErr;

      if (!emp) {
        setEmpresaId(null);
        setCategorias([]);
        return;
      }

      setEmpresaId(emp.id);

      const { data: cats, error: catsErr } = await supabaseClient
        .from("categorias")
        .select("id, nome, slug, criado_em")
        .eq("empresa_id", emp.id)
        .order("nome", { ascending: true });

      if (catsErr) throw catsErr;

      setCategorias((cats ?? []) as Categoria[]);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar categorias.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // slug automático a partir do nome novo
    if (!nomeNovo.trim()) {
      setSlugNovo("");
      return;
    }
    setSlugNovo(normalizeSlug(nomeNovo));
  }, [nomeNovo]);

  function startEdit(c: Categoria) {
    setEditId(c.id);
    setEditNome(c.nome);
    setEditSlug(c.slug);
  }

  function cancelEdit() {
    setEditId(null);
    setEditNome("");
    setEditSlug("");
  }

  async function createCategoria(e: React.FormEvent) {
    e.preventDefault();
    toast.dismiss();

    if (!empresaId) {
      toast.error("Crie sua empresa em Configuração primeiro.");
      return;
    }

    const nome = nomeNovo.trim();
    const slug = normalizeSlug(slugNovo || nomeNovo);

    if (nome.length < 2) return toast.error("Informe o nome da categoria.");
    if (!isValidSlug(slug)) return toast.error("Slug inválido. Use letras/números e hífen.");

    setCreating(true);

    try {
      const { data, error } = await supabaseClient
        .from("categorias")
        .insert({ empresa_id: empresaId, nome, slug })
        .select("id, nome, slug, criado_em")
        .single();

      if (error) throw error;

      setCategorias((prev) => {
        const next = [data as Categoria, ...prev];
        next.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        return next;
      });

      setNomeNovo("");
      setSlugNovo("");
      toast.success("Categoria criada!");
    } catch (err: any) {
      console.error(err);
      const msg = String(err?.message || "").toLowerCase();
      if (msg.includes("duplicate") || String(err?.code || "") === "23505") {
        toast.error("Esse slug já está em uso. Escolha outro.");
      } else {
        toast.error("Não foi possível criar a categoria.");
      }
    } finally {
      setCreating(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    toast.dismiss();

    if (!editId) return;

    const nome = editNome.trim();
    const slug = normalizeSlug(editSlug);

    if (nome.length < 2) return toast.error("Nome inválido.");
    if (!isValidSlug(slug)) return toast.error("Slug inválido.");

    setSavingEdit(true);

    try {
      const { error } = await supabaseClient
        .from("categorias")
        .update({ nome, slug })
        .eq("id", editId);

      if (error) throw error;

      setCategorias((prev) =>
        prev
          .map((c) => (c.id === editId ? { ...c, nome, slug } : c))
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      );

      toast.success("Categoria atualizada!");
      cancelEdit();
    } catch (err: any) {
      console.error(err);
      const msg = String(err?.message || "").toLowerCase();
      if (msg.includes("duplicate") || String(err?.code || "") === "23505") {
        toast.error("Esse slug já está em uso. Escolha outro.");
      } else {
        toast.error("Não foi possível salvar.");
      }
    } finally {
      setSavingEdit(false);
    }
  }

  async function removeCategoria(c: Categoria) {
    toast.dismiss();

    const ok = window.confirm(`Excluir a categoria "${c.nome}"?`);
    if (!ok) return;

    // otimista
    const before = categorias;
    setCategorias((prev) => prev.filter((x) => x.id !== c.id));

    const { error } = await supabaseClient.from("categorias").delete().eq("id", c.id);

    if (error) {
      console.error(error);
      setCategorias(before);

      // Se tiver FK em produtos, normalmente dá erro 23503
      if (String(error.code) === "23503") {
        toast.error("Essa categoria está sendo usada por produtos. Troque a categoria dos produtos antes de excluir.");
      } else {
        toast.error("Não foi possível excluir.");
      }
      return;
    }

    toast.success("Categoria excluída.");
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
            <div className="text-lg font-semibold text-black">Categorias</div>
            <div className="mt-1 text-xs text-black/55">
              Crie e organize as categorias do seu catálogo.
            </div>
          </div>

          <Link
            href="/dashboard/produtos"
            className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm hover:bg-black/5"
          >
            <ArrowLeft size={16} /> Voltar
          </Link>
        </div>
      </section>

      {/* =========================
          SECTION: Criar categoria
      ========================= */}
      <section className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
        <div className="text-sm font-semibold text-black">Criar nova categoria</div>
        <div className="mt-1 text-xs text-black/55">O slug vira a URL (ex: pneus-de-moto).</div>

        <form onSubmit={createCategoria} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2 md:col-span-1">
            <label className="text-sm font-medium text-black">Nome</label>
            <input
              value={nomeNovo}
              onChange={(e) => setNomeNovo(e.target.value)}
              placeholder="Ex: Pneus"
              className="h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition focus:border-black/20 focus:shadow-[0_0_0_4px_rgba(235,52,16,0.12)]"
            />
          </div>

          <div className="space-y-2 md:col-span-1">
            <label className="text-sm font-medium text-black">Slug</label>
            <input
              value={slugNovo}
              onChange={(e) => setSlugNovo(normalizeSlug(e.target.value))}
              placeholder="pneus"
              className="h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition focus:border-black/20 focus:shadow-[0_0_0_4px_rgba(235,52,16,0.12)]"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={creating || loading || !empresaId}
              className={cn(
                "inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white transition",
                "disabled:cursor-not-allowed disabled:opacity-60"
              )}
              style={{ backgroundColor: "#EB3410" }}
            >
              <Plus size={16} />
              {creating ? "Criando..." : "Criar"}
            </button>
          </div>
        </form>

        {!empresaId && !loading && (
          <div className="mt-3 text-sm text-black/60">
            Você precisa criar sua empresa em <b>Configuração</b> antes.
          </div>
        )}
      </section>

      {/* =========================
          SECTION: Buscar
      ========================= */}
      <section className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="w-full md:max-w-md">
            <label className="text-sm font-medium text-black">Buscar</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nome ou slug..."
              className="mt-2 h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition focus:border-black/20 focus:shadow-[0_0_0_4px_rgba(235,52,16,0.12)]"
            />
          </div>

          <button
            onClick={load}
            className="h-11 rounded-2xl border border-black/10 bg-white px-4 text-sm hover:bg-black/5"
          >
            Atualizar
          </button>
        </div>
      </section>

      {/* =========================
          SECTION: Lista
      ========================= */}
      <section className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-black">Categorias</div>
            <div className="text-xs text-black/55">
              {loading ? "Carregando..." : `${filtered.length} item(ns)`}
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-black/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/5 text-xs text-black/55">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-black/10">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-black/60">
                    Carregando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-black/60">
                    Nenhuma categoria encontrada.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const isEditing = editId === c.id;

                  return (
                    <tr key={c.id} className="hover:bg-black/5">
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            value={editNome}
                            onChange={(e) => setEditNome(e.target.value)}
                            className="h-10 w-full rounded-2xl border border-black/10 bg-white px-3 text-sm outline-none"
                          />
                        ) : (
                          <span className="font-medium text-black">{c.nome}</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-black/70">
                        {isEditing ? (
                          <input
                            value={editSlug}
                            onChange={(e) => setEditSlug(normalizeSlug(e.target.value))}
                            className="h-10 w-full rounded-2xl border border-black/10 bg-white px-3 text-sm outline-none"
                          />
                        ) : (
                          c.slug
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={saveEdit}
                                disabled={savingEdit || !isValidSlug(normalizeSlug(editSlug))}
                                className={cn(
                                  "grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-white hover:bg-black/5",
                                  "disabled:cursor-not-allowed disabled:opacity-60"
                                )}
                                title="Salvar"
                              >
                                <Save size={16} />
                              </button>

                              <button
                                onClick={cancelEdit}
                                className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-white hover:bg-black/5"
                                title="Cancelar"
                              >
                                <X size={16} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(c)}
                                className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-white hover:bg-black/5"
                                title="Editar"
                              >
                                <Pencil size={16} />
                              </button>

                              <button
                                onClick={() => removeCategoria(c)}
                                className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-white hover:bg-black/5"
                                title="Excluir"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-xs text-black/45">
          Dica: se uma categoria estiver vinculada a produtos, você precisa trocar a categoria desses produtos antes de excluir.
        </div>
      </section>
    </div>
  );
}
