'use client';

import { useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

type Mode = 'signup' | 'login';

type Props = {
  open: boolean;
  onClose: () => void;
  defaultMode?: Mode;
  onAuthed?: () => void;
};

type FormState = {
  nome: string;
  email: string;
  senha: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function ClienteAuthModal({
  open,
  onClose,
  defaultMode = 'signup',
  onAuthed,
}: Props) {
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    nome: '',
    email: '',
    senha: '',
  });

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY no .env');
    }
    return createBrowserClient(url, key);
  }, []);

  if (!open) return null;

  async function handleSignup() {
    setLoading(true);
    setMsg(null);

    const nome = form.nome.trim();
    const email = form.email.trim();
    const senha = form.senha;

    if (nome.length < 2) {
      setLoading(false);
      setMsg('Digite seu nome.');
      return;
    }
    if (!email.includes('@')) {
      setLoading(false);
      setMsg('Digite um e-mail válido.');
      return;
    }
    if (senha.length < 6) {
      setLoading(false);
      setMsg('Sua senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: {
          role: 'cliente',
          nome,
        },
      },
    });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setMsg('Conta criada! Se precisar confirmar por e-mail, verifique sua caixa de entrada.');
    onAuthed?.();
    onClose();
  }

  async function handleLogin() {
    setLoading(true);
    setMsg(null);

    const email = form.email.trim();
    const senha = form.senha;

    if (!email.includes('@')) {
      setLoading(false);
      setMsg('Digite um e-mail válido.');
      return;
    }
    if (senha.length < 6) {
      setLoading(false);
      setMsg('Digite sua senha.');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    onAuthed?.();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[80]">
      {/* overlay */}
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      {/* modal */}
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">
              {mode === 'signup' ? 'Criar conta' : 'Entrar'}
            </div>
            <div className="text-sm text-black/60">
              {mode === 'signup'
                ? 'É super rápido e você já pode fazer seu pedido.'
                : 'Entre para continuar seu pedido.'}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-black/10 px-3 py-1 text-sm text-black/70 hover:bg-black/5"
          >
            Fechar
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {mode === 'signup' && (
            <div>
              <label className="text-xs font-medium text-black/70">Nome</label>
              <input
                value={form.nome}
                onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30"
                placeholder="Seu nome"
                autoComplete="name"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-black/70">E-mail</label>
            <input
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30"
              placeholder="seuemail@exemplo.com"
              autoComplete="email"
              inputMode="email"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-black/70">Senha</label>
            <input
              value={form.senha}
              onChange={(e) => setForm((s) => ({ ...s, senha: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30"
              placeholder="••••••••"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </div>

          {msg && (
            <div className="rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm text-black/80">
              {msg}
            </div>
          )}

          <button
            type="button"
            onClick={mode === 'signup' ? handleSignup : handleLogin}
            disabled={loading}
            className={cn(
              'w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm',
              'disabled:opacity-60 disabled:cursor-not-allowed',
              'bg-[#E83A1C] hover:brightness-95'
            )}
          >
            {loading
              ? 'Aguarde...'
              : mode === 'signup'
                ? 'Criar conta'
                : 'Entrar'}
          </button>

          <button
            type="button"
            onClick={() => setMode((m) => (m === 'signup' ? 'login' : 'signup'))}
            className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-black/70 hover:bg-black/5"
          >
            {mode === 'signup' ? 'Já tenho conta' : 'Quero criar conta'}
          </button>
        </div>
      </div>
    </div>
  );
}
