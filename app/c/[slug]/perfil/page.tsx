"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { ArrowLeft, LogOut, User } from "lucide-react";

type Perfil = {
  id: string;
  email: string;
  nome: string;
  role: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function PerfilClientePage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params?.slug;

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Faltam envs do Supabase.");
    return createBrowserClient(url, key);
  }, []);

  const [loading, setLoading] = useState(true);
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);

      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!mounted) return;

      if (!user) {
        // se não estiver logado, volta pro catálogo
        router.replace(`/c/${slug}`);
        return;
      }

      const nome = (user.user_metadata?.nome as string | undefined) ?? "—";
      const role = (user.user_metadata?.role as string | undefined) ?? "—";

      setPerfil({
        id: user.id,
        email: user.email ?? "—",
        nome,
        role,
      });

      setLoading(false);
    }

    load();

    return () => {
      mounted = false;
    };
  }, [router, slug, supabase]);

  async function sair() {
    await supabase.auth.signOut();
    router.replace(`/c/${slug}`);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-white text-[#0f172a]">
      <div className="mx-auto w-full max-w-2xl px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push(`/c/${slug}`)}
            className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm hover:bg-black/5"
          >
            <ArrowLeft size={16} /> Voltar
          </button>

          <button
            type="button"
            onClick={sair}
            className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm text-black/70 hover:bg-black/5"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>

        <div className="mt-6 rounded-3xl border border-black/10 bg-white p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)]">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-full border border-black/10 bg-black/5">
              <User size={20} />
            </div>
            <div>
              <div className="text-lg font-semibold">Seu perfil</div>
              <div className="text-sm text-black/55">Informações básicas da sua conta</div>
            </div>
          </div>

          {loading ? (
            <div className="mt-6 space-y-3">
              <div className="h-4 w-40 rounded bg-black/5" />
              <div className="h-4 w-64 rounded bg-black/5" />
              <div className="h-4 w-32 rounded bg-black/5" />
            </div>
          ) : (
            <div className="mt-6 space-y-4 text-sm">
              <div className="rounded-2xl border border-black/10 bg-white p-4">
                <div className="text-xs text-black/55">Nome</div>
                <div className="mt-1 font-semibold text-black">{perfil?.nome ?? "—"}</div>
              </div>

              <div className="rounded-2xl border border-black/10 bg-white p-4">
                <div className="text-xs text-black/55">E-mail</div>
                <div className="mt-1 font-semibold text-black">{perfil?.email ?? "—"}</div>
              </div>

              <div className="rounded-2xl border border-black/10 bg-white p-4">
                <div className="text-xs text-black/55">Tipo</div>
                <div className="mt-1 font-semibold text-black">{perfil?.role ?? "—"}</div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={sair}
            className={cn(
              "mt-6 h-12 w-full rounded-2xl px-4 text-sm font-semibold text-white transition",
              "hover:brightness-95"
            )}
            style={{ backgroundColor: "#EB3410" }}
          >
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  );
}
