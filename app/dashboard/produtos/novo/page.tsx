// app/dashboard/produtos/novo/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import toast, { Toaster } from "react-hot-toast";
import { Save, Image as ImageIcon, ArrowLeft, UploadCloud } from "lucide-react";
import Link from "next/link";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Categoria = { id: string; nome: string };

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

function slugifyFileName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/-+/g, "-");
}

function parseBRLToNumber(input: string) {
  // aceita "199,90" ou "199.90" ou "R$ 199,90"
  const clean = input.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(clean);
  return Number.isFinite(n) ? n : 0;
}

export default function ProdutoNovoPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [precoTxt, setPrecoTxt] = useState("0");
  const [estoqueTxt, setEstoqueTxt] = useState("0");
  const [categoriaId, setCategoriaId] = useState<string>("");

  const [ativo, setAtivo] = useState(true);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const canSave = useMemo(() => {
    const nomeOk = nome.trim().length >= 2;
    const preco = parseBRLToNumber(precoTxt);
    const estoque = Number(onlyDigits(estoqueTxt) || "0");
    const estoqueOk = Number.isFinite(estoque) && estoque >= 0;

    return (
      !!empresaId &&
      nomeOk &&
      Number.isFinite(preco) &&
      preco >= 0 &&
      estoqueOk &&
      !saving
    );
  }, [empresaId, nome, precoTxt, estoqueTxt, saving]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);

        const { data: u, error: uErr } = await supabaseClient.auth.getUser();
        if (uErr || !u.user) {
          window.location.href = "/login";
          return;
        }

        const userId = u.user.id;

        // empresa do dono
        const { data: emp, error: empErr } = await supabaseClient
          .from("empresas")
          .select("id")
          .eq("dono_usuario_id", userId)
          .maybeSingle();

        if (empErr) throw empErr;
        if (!emp) {
          toast.error("Você precisa criar sua empresa em Configuração primeiro.");
          return;
        }

        if (!mounted) return;
        setEmpresaId(emp.id);

        // categorias da empresa
        const { data: cats, error: catsErr } = await supabaseClient
          .from("categorias")
          .select("id, nome")
          .eq("empresa_id", emp.id)
          .order("nome", { ascending: true });

        if (catsErr) throw catsErr;

        if (!mounted) return;
        setCategorias((cats ?? []) as Categoria[]);

        // se tiver categorias, já seleciona a primeira
        if ((cats ?? []).length > 0) {
          setCategoriaId((cats ?? [])[0].id);
        }
      } catch (err) {
        console.error(err);
        toast.error("Erro ao carregar dados.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function uploadImagem(empresaId: string, produtoNome: string, f: File) {
    // path: empresaId/produtos/...
    const safeName = slugifyFileName(f.name);
    const ext = safeName.includes(".") ? safeName.split(".").pop() : "jpg";

    const filePath = `${empresaId}/${Date.now()}-${slugifyFileName(produtoNome || "produto")}.${ext}`;

    const { error: upErr } = await supabaseClient.storage
      .from("produtos")
      .upload(filePath, f, {
        cacheControl: "3600",
        upsert: false,
        contentType: f.type || "image/jpeg",
      });

    if (upErr) throw upErr;

    // URL pública
    const { data } = supabaseClient.storage.from("produtos").getPublicUrl(filePath);
    return data.publicUrl;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    toast.dismiss();

    if (!empresaId) {
      toast.error("Empresa não encontrada. Vá em Configuração.");
      return;
    }

    const preco = parseBRLToNumber(precoTxt);
    const estoque = Number(onlyDigits(estoqueTxt) || "0");

    if (nome.trim().length < 2) return toast.error("Informe o nome do produto.");
    if (!Number.isFinite(preco) || preco < 0) return toast.error("Preço inválido.");
    if (!Number.isFinite(estoque) || estoque < 0) return toast.error("Estoque inválido.");

    setSaving(true);

    try {
      let imagem_url: string | null = null;

      if (file) {
        imagem_url = await uploadImagem(empresaId, nome, file);
      }

      const { error } = await supabaseClient.from("produtos").insert({
        empresa_id: empresaId,
        categoria_id: categoriaId || null,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        preco,
        estoque,
        imagem_url,
        ativo,
      });

      if (error) throw error;

      toast.success("Produto cadastrado!");
      // reset
      setNome("");
      setDescricao("");
      setPrecoTxt("0");
      setEstoqueTxt("0");
      setAtivo(true);
      setFile(null);
      setPreviewUrl(null);
    } catch (err: any) {
      console.error(err);
      toast.error("Não foi possível cadastrar. Verifique e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* =========================
          SECTION: Header
      ========================= */}
      <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-black/60">Produtos</div>
            <div className="text-lg font-semibold text-black">Cadastrar produto</div>
            <div className="mt-1 text-xs text-black/55">
              Adicione nome, preço, estoque, categoria e imagem.
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
          SECTION: Form
      ========================= */}
      <section className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-black">Nome</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Pneu 175/65 R14"
                className="h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition focus:border-black/20 focus:shadow-[0_0_0_4px_rgba(235,52,16,0.12)]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-black">Categoria</label>
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition focus:border-black/20 focus:shadow-[0_0_0_4px_rgba(235,52,16,0.12)]"
              >
                {categorias.length === 0 ? (
                  <option value="">Sem categorias (crie depois)</option>
                ) : (
                  categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))
                )}
              </select>
              {categorias.length === 0 && (
                <div className="text-xs text-black/50">
                  Dica: crie uma tela de categorias depois (a gente faz).
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-black">Descrição</label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes do produto (opcional)"
              className="min-h-[90px] w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/20 focus:shadow-[0_0_0_4px_rgba(235,52,16,0.12)]"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-black">Preço (R$)</label>
              <input
                value={precoTxt}
                onChange={(e) => setPrecoTxt(e.target.value)}
                inputMode="decimal"
                placeholder="199,90"
                className="h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition focus:border-black/20 focus:shadow-[0_0_0_4px_rgba(235,52,16,0.12)]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-black">Estoque</label>
              <input
                value={estoqueTxt}
                onChange={(e) => setEstoqueTxt(e.target.value)}
                inputMode="numeric"
                placeholder="0"
                className="h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition focus:border-black/20 focus:shadow-[0_0_0_4px_rgba(235,52,16,0.12)]"
              />
            </div>

            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={ativo}
                  onChange={(e) => setAtivo(e.target.checked)}
                />
                Produto ativo
              </label>
            </div>
          </div>

          {/* =========================
              SECTION: Upload imagem
          ========================= */}
          <div className="rounded-3xl border border-black/10 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-black">Imagem do produto</div>
                <div className="text-xs text-black/55">opcional • JPG/PNG</div>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-black/5">
                <ImageIcon size={18} />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-black/15 bg-white px-4 py-8 text-sm hover:bg-black/5">
                <UploadCloud size={18} />
                <span>{file ? "Trocar imagem" : "Selecionar imagem"}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>

              <div className="rounded-2xl border border-black/10 bg-black/5 p-3">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="h-48 w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="grid h-48 place-items-center rounded-xl border border-black/10 bg-white text-sm text-black/50">
                    Sem imagem
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSave || loading}
            className={cn(
              "inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white transition",
              "disabled:cursor-not-allowed disabled:opacity-60"
            )}
            style={{ backgroundColor: "#EB3410" }}
          >
            <Save size={16} />
            {saving ? "Salvando..." : "Cadastrar produto"}
          </button>

          {loading && (
            <div className="text-center text-xs text-black/50">Carregando...</div>
          )}
        </form>
      </section>
    </div>
  );
}
