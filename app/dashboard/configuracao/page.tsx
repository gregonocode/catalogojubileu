"use client";

import { useEffect, useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { supabaseClient } from "@/lib/supabase/client";
import { Save, Building2 } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type EmpresaForm = {
  id?: string;
  nome: string;
  slug: string;
  whatsapp: string;
};

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

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

export default function ConfiguracaoPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [form, setForm] = useState<EmpresaForm>({
    nome: "Pneu Forte",
    slug: "pneu-forte",
    whatsapp: "",
  });

  const canSave = useMemo(() => {
    const nomeOk = form.nome.trim().length >= 2;
    const slugOk = form.slug.trim().length >= 2 && isValidSlug(form.slug);
    const whatsOk = onlyDigits(form.whatsapp).length >= 10; // 10+ (com DDD)
    return nomeOk && slugOk && whatsOk && !!userId && !saving;
  }, [form, userId, saving]);

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

        if (!mounted) return;
        setUserId(u.user.id);

        const { data: empresa, error: empErr } = await supabaseClient
          .from("empresas")
          .select("id, nome, slug, whatsapp")
          .eq("dono_usuario_id", u.user.id)
          .maybeSingle();

        if (empErr) throw empErr;

        if (empresa && mounted) {
          setForm({
            id: empresa.id,
            nome: empresa.nome ?? "Pneu Forte",
            slug: empresa.slug ?? "pneu-forte",
            whatsapp: empresa.whatsapp ?? "",
          });
        }
      } catch (err: unknown) {
        console.error(err);
        toast.error("Erro ao carregar configuração.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    toast.dismiss();

    if (!userId) {
      toast.error("Usuário não autenticado.");
      return;
    }

    const nome = form.nome.trim();
    const slug = normalizeSlug(form.slug);
    const whatsapp = onlyDigits(form.whatsapp);

    if (nome.length < 2) {
      toast.error("Informe o nome da empresa.");
      return;
    }

    if (!isValidSlug(slug)) {
      toast.error("Slug inválido. Use letras/números e hífen (ex: pneu-forte).");
      return;
    }

    if (whatsapp.length < 10) {
      toast.error("WhatsApp inválido. Coloque com DDD (apenas números).");
      return;
    }

    setSaving(true);

    try {
      // Se já existe empresa, atualiza
      if (form.id) {
        const { error } = await supabaseClient
          .from("empresas")
          .update({ nome, slug, whatsapp })
          .eq("id", form.id);

        if (error) throw error;

        toast.success("Configurações atualizadas!");
        setForm((prev) => ({ ...prev, slug, whatsapp, nome }));
        return;
      }

      // Se não existe, cria nova
      const { data, error } = await supabaseClient
        .from("empresas")
        .insert({
          dono_usuario_id: userId,
          nome,
          slug,
          whatsapp,
        })
        .select("id")
        .single();

      if (error) throw error;

      toast.success("Empresa criada com sucesso!");
      setForm((prev) => ({ ...prev, id: data.id, slug, whatsapp, nome }));
    } catch (err: unknown) {
      // slug unique -> erro comum
      const errorMessage =
        typeof err === "object" && err !== null && "message" in err
          ? String(err.message).toLowerCase()
          : "";
      const errorCode =
        typeof err === "object" && err !== null && "code" in err
          ? String(err.code)
          : "";
      if (errorMessage.includes("duplicate") || errorCode === "23505") {
        toast.error("Esse slug já está em uso. Escolha outro.");
      } else {
        toast.error("Não foi possível salvar. Tente novamente.");
      }
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-black/10 bg-black/5">
              <Building2 size={18} />
            </div>
            <div>
              <div className="text-lg font-semibold text-black">Configuração</div>
              <div className="text-xs text-black/55">
                Defina nome, slug e WhatsApp do catálogo.
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-black/45">Dono logado</div>
            <div className="text-xs font-medium text-black">
              {loading ? "carregando..." : userId?.slice(0, 8)}
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-black">Nome da empresa</label>
              <input
                value={form.nome}
                onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                placeholder="Pneu Forte"
                className="h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition focus:border-black/20 focus:shadow-[0_0_0_4px_rgba(235,52,16,0.12)]"
              />
              <div className="text-xs text-black/50">
                Esse nome aparece no topo do painel.
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-black">Slug (URL)</label>
              <input
                value={form.slug}
                onChange={(e) => setForm((p) => ({ ...p, slug: normalizeSlug(e.target.value) }))}
                placeholder="pneu-forte"
                className="h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition focus:border-black/20 focus:shadow-[0_0_0_4px_rgba(235,52,16,0.12)]"
              />
              <div className="text-xs text-black/50">
                Ex: <span className="font-medium">/c/pneu-forte</span> (a gente vai criar essa rota).
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-black">WhatsApp (com DDD)</label>
            <input
              value={form.whatsapp}
              onChange={(e) => setForm((p) => ({ ...p, whatsapp: onlyDigits(e.target.value) }))}
              inputMode="numeric"
              placeholder="5593999999999"
              className="h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none transition focus:border-black/20 focus:shadow-[0_0_0_4px_rgba(235,52,16,0.12)]"
            />
            <div className="text-xs text-black/50">
              Apenas números. Ex: <span className="font-medium">5593999999999</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSave}
            className={cn(
              "inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white transition",
              "disabled:cursor-not-allowed disabled:opacity-60"
            )}
            style={{ backgroundColor: "#EB3410" }}
          >
            <Save size={16} />
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </form>
      </div>

      
    </div>
  );
}
