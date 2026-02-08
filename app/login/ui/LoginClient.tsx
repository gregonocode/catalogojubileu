"use client";

import { useMemo, useState } from "react";
import toast, { Toaster } from "react-hot-toast";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function LoginClient() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    const e = email.trim();
    return e.length > 3 && e.includes("@") && password.trim().length >= 4;
  }, [email, password]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      toast.error("Preencha e-mail e senha corretamente.");
      return;
    }

    setLoading(true);
    toast.dismiss();

    // Fake login (só visual)
    await new Promise((r) => setTimeout(r, 900));

    setLoading(false);
    toast.success("Login OK (mock) — agora você pode ligar no Supabase.");
  }

  return (
    <>
      <Toaster position="top-right" />

      {/* topo mobile (branding compacto) */}
      <div className="mb-8 lg:hidden">
        <div className="inline-flex items-center gap-3 rounded-2xl px-3 py-2 ring-1 ring-black/10">
          <div
            className="grid h-10 w-10 place-items-center rounded-xl text-white"
            style={{ backgroundColor: "#EB3410" }}
          >
            <span className="text-lg font-bold">C</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-black">Catálogo</div>
            <div className="text-xs text-black/60">Pneu Forte</div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.25)]">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-black">Entrar</h2>
          <p className="mt-1 text-sm text-black/60">
            Acesse seu painel para gerenciar produtos.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-black">E-mail</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="voce@exemplo.com"
              className="h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none ring-0 transition focus:border-black/20 focus:shadow-[0_0_0_4px_rgba(235,52,16,0.12)]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-black">Senha</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              className="h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm outline-none ring-0 transition focus:border-black/20 focus:shadow-[0_0_0_4px_rgba(235,52,16,0.12)]"
            />
          </div>

          

          <button
            type="submit"
            disabled={!canSubmit || loading}
            className={cn(
              "mt-2 h-11 w-full rounded-2xl px-4 text-sm font-semibold text-white transition",
              "disabled:cursor-not-allowed disabled:opacity-60"
            )}
            style={{ backgroundColor: "#EB3410" }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-black/40">
        Ao continuar, você concorda com os termos e política de privacidade.
      </p>
    </>
  );
}
