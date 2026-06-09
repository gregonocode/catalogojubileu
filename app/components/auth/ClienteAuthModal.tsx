'use client';

import { useEffect, useMemo, useState } from 'react';
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
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  referencia: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

function formatCep(value: string) {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
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
  const [step, setStep] = useState<1 | 2>(1);
  const [loadingCep, setLoadingCep] = useState(false);

  const [form, setForm] = useState<FormState>({
    nome: '',
    email: '',
    senha: '',
    telefone: '',
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    uf: '',
    referencia: '',
  });

  useEffect(() => {
    if (open) {
      setMode(defaultMode);
      setMsg(null);
      setLoading(false);
      setLoadingCep(false);
      setStep(1);
    }
  }, [open, defaultMode]);

  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY no .env');
    }

    return createBrowserClient(url, key);
  }, []);

  if (!open) return null;

  async function upsertCliente(usuarioId: string, nome: string, telefone?: string) {
    const telefoneLimpo = telefone ? onlyDigits(telefone) : '';
    const payload: {
      usuario_id: string;
      nome: string;
      telefone?: string | null;
    } = {
      usuario_id: usuarioId,
      nome,
    };

    if (telefone !== undefined) {
      payload.telefone = telefoneLimpo || null;
    }

    const { data, error } = await supabase
      .from('clientes')
      .upsert(payload, { onConflict: 'usuario_id' })
      .select('usuario_id, nome, telefone')
      .maybeSingle();

    if (error) {
      console.error('Erro ao salvar cliente em public.clientes:', error);
      setMsg(`Erro ao salvar seu cadastro: ${error.message}`);
      return false;
    }

    if (!data?.nome) {
      setMsg('Conta criada, mas não consegui salvar seu nome.');
      return false;
    }

    return true;
  }

  async function upsertEnderecoCliente(usuarioId: string) {
    const cepLimpo = onlyDigits(form.cep);

    const payload = {
      cliente_id: usuarioId,
      cep: cepLimpo || null,
      logradouro: form.logradouro.trim() || null,
      numero: form.numero.trim() || null,
      complemento: form.complemento.trim() || null,
      bairro: form.bairro.trim() || null,
      cidade: form.cidade.trim() || null,
      uf: form.uf.trim().toUpperCase() || null,
      referencia: form.referencia.trim() || null,
    };

    const { error } = await supabase
      .from('end_clientes')
      .upsert(payload, { onConflict: 'cliente_id' });

    if (error) {
      console.error('Erro ao salvar endereço em public.end_clientes:', error);
      setMsg(`Conta criada, mas houve erro ao salvar endereço: ${error.message}`);
      return false;
    }

    return true;
  }

  async function buscarCep() {
    const cepLimpo = onlyDigits(form.cep);

    if (cepLimpo.length !== 8) {
      setMsg('Digite um CEP válido com 8 números.');
      return;
    }

    try {
      setLoadingCep(true);
      setMsg(null);

      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`, {
        method: 'GET',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Falha ao consultar o CEP.');
      }

      const data = await response.json();

      if (data?.erro) {
        setMsg('CEP não encontrado. Preencha o endereço manualmente.');
        return;
      }

      setForm((prev) => ({
        ...prev,
        cep: formatCep(cepLimpo),
        logradouro: String(data.logradouro ?? ''),
        complemento: prev.complemento || String(data.complemento ?? ''),
        bairro: String(data.bairro ?? ''),
        cidade: String(data.localidade ?? ''),
        uf: String(data.uf ?? ''),
      }));
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      setMsg('Não foi possível buscar o CEP agora. Preencha manualmente.');
    } finally {
      setLoadingCep(false);
    }
  }

  function validarStep1() {
    const nome = form.nome.trim();
    const email = form.email.trim();
    const senha = form.senha;
    const telefone = onlyDigits(form.telefone);

    if (nome.length < 2) {
      setMsg('Digite seu nome.');
      return false;
    }

    if (!email.includes('@')) {
      setMsg('Digite um e-mail válido.');
      return false;
    }

    if (senha.length < 6) {
      setMsg('Sua senha precisa ter pelo menos 6 caracteres.');
      return false;
    }

    if (telefone.length < 10) {
      setMsg('Digite seu telefone com DDD.');
      return false;
    }

    return true;
  }

  function validarStep2() {
    const cepLimpo = onlyDigits(form.cep);

    if (cepLimpo.length !== 8) {
      setMsg('Digite um CEP válido.');
      return false;
    }

    if (form.logradouro.trim().length < 2) {
      setMsg('Digite o logradouro.');
      return false;
    }

    if (form.numero.trim().length < 1) {
      setMsg('Digite o número.');
      return false;
    }

    if (form.bairro.trim().length < 2) {
      setMsg('Digite o bairro.');
      return false;
    }

    if (form.cidade.trim().length < 2) {
      setMsg('Digite a cidade.');
      return false;
    }

    if (form.uf.trim().length !== 2) {
      setMsg('Digite o estado com 2 letras.');
      return false;
    }

    return true;
  }

  async function handleSignup() {
    setLoading(true);
    setMsg(null);

    const nome = form.nome.trim();
    const email = form.email.trim();
    const senha = form.senha;
    const telefone = onlyDigits(form.telefone);

    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        data: {
          role: 'cliente',
          nome,
          telefone,
        },
      },
    });

    if (error) {
      setLoading(false);
      setMsg(error.message);
      return;
    }

    const userId = data.user?.id ?? data.session?.user?.id ?? null;

    if (userId) {
      const okCliente = await upsertCliente(userId, nome, telefone);
      if (okCliente) {
        await upsertEnderecoCliente(userId);
      }
    }

    const loggedNow = Boolean(data.session?.user);

    setLoading(false);

    if (!loggedNow) {
      setMsg(
        'Conta criada! Se não entrar automaticamente, verifique se "Confirm email" está desativado no Supabase.'
      );
      return;
    }

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

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      setLoading(false);
      setMsg(error.message);
      return;
    }

    const userId = data.user?.id ?? null;
    const metaNome =
      typeof data.user?.user_metadata?.nome === 'string'
        ? String(data.user.user_metadata.nome).trim()
        : '';
    const metaTelefone =
      typeof data.user?.user_metadata?.telefone === 'string'
        ? String(data.user.user_metadata.telefone).trim()
        : '';

    if (userId && metaNome.length >= 2) {
      await upsertCliente(userId, metaNome, metaTelefone || undefined);
    }

    setLoading(false);
    onAuthed?.();
    onClose();
  }

  function handleNextStep() {
    setMsg(null);

    if (!validarStep1()) return;

    setStep(2);
  }

  function handleBackStep() {
    setMsg(null);
    setStep(1);
  }

  async function handleFinalSignup() {
    setMsg(null);

    if (!validarStep2()) return;

    await handleSignup();
  }

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />

      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">
              {mode === 'signup' ? 'Criar conta' : 'Entrar'}
            </div>
            <div className="text-sm text-black/60">
              {mode === 'signup'
                ? step === 1
                  ? 'Preencha seus dados para começar.'
                  : 'Agora informe seu endereço.'
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

        {mode === 'signup' && (
          <div className="mt-4 flex items-center gap-2">
            <div
              className={cn(
                'h-2 flex-1 rounded-full',
                step >= 1 ? 'bg-[#E83A1C]' : 'bg-black/10'
              )}
            />
            <div
              className={cn(
                'h-2 flex-1 rounded-full',
                step >= 2 ? 'bg-[#E83A1C]' : 'bg-black/10'
              )}
            />
          </div>
        )}

        <div className="mt-4 space-y-3">
          {mode === 'signup' && step === 1 && (
            <>
              <div>
                <label className="text-xs font-medium text-black/70">Seu nome</label>
                <input
                  value={form.nome}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      nome: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30"
                  placeholder="Ex: Jubileu"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-black/70">E-mail</label>
                <input
                  value={form.email}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      email: e.target.value,
                    }))
                  }
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
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      senha: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30"
                  placeholder="••••••••"
                  type="password"
                  autoComplete="new-password"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-black/70">Telefone</label>
                <input
                  value={form.telefone}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      telefone: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30"
                  placeholder="Ex: 93999999999"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>
            </>
          )}

          {mode === 'signup' && step === 2 && (
            <>
              <div>
                <label className="text-xs font-medium text-black/70">CEP</label>
                <div className="mt-1 flex gap-2">
                  <input
                    value={form.cep}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        cep: formatCep(e.target.value),
                      }))
                    }
                    onBlur={() => {
                      if (onlyDigits(form.cep).length === 8) {
                        buscarCep();
                      }
                    }}
                    className="w-full rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30"
                    placeholder="00000-000"
                    inputMode="numeric"
                    autoComplete="postal-code"
                  />
                  <button
                    type="button"
                    onClick={buscarCep}
                    disabled={loadingCep}
                    className="rounded-xl border border-black/10 px-4 py-2 text-sm font-medium text-black/70 hover:bg-black/5 disabled:opacity-60"
                  >
                    {loadingCep ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-black/70">Logradouro</label>
                <input
                  value={form.logradouro}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      logradouro: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30"
                  placeholder="Rua, avenida..."
                  autoComplete="address-line1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-black/70">Número</label>
                  <input
                    value={form.numero}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        numero: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30"
                    placeholder="123"
                    autoComplete="address-line2"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-black/70">Complemento</label>
                  <input
                    value={form.complemento}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        complemento: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30"
                    placeholder="Apto, bloco..."
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-black/70">Bairro</label>
                <input
                  value={form.bairro}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      bairro: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30"
                  placeholder="Seu bairro"
                  autoComplete="address-level3"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-black/70">Cidade</label>
                  <input
                    value={form.cidade}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        cidade: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30"
                    placeholder="Sua cidade"
                    autoComplete="address-level2"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-black/70">UF</label>
                  <input
                    value={form.uf}
                    onChange={(e) =>
                      setForm((s) => ({
                        ...s,
                        uf: e.target.value.toUpperCase().slice(0, 2),
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30"
                    placeholder="SP"
                    autoComplete="address-level1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-black/70">Referência</label>
                <input
                  value={form.referencia}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      referencia: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30"
                  placeholder="Próximo à praça, esquina..."
                />
              </div>
            </>
          )}

          {mode === 'login' && (
            <>
              <div>
                <label className="text-xs font-medium text-black/70">E-mail</label>
                <input
                  value={form.email}
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      email: e.target.value,
                    }))
                  }
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
                  onChange={(e) =>
                    setForm((s) => ({
                      ...s,
                      senha: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-black/10 px-3 py-2 outline-none focus:border-black/30"
                  placeholder="••••••••"
                  type="password"
                  autoComplete="current-password"
                />
              </div>
            </>
          )}

          {msg && (
            <div className="rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm text-black/80">
              {msg}
            </div>
          )}

          {mode === 'signup' && step === 1 && (
            <button
              type="button"
              onClick={handleNextStep}
              disabled={loading}
              className={cn(
                'w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm',
                'disabled:opacity-60 disabled:cursor-not-allowed',
                'bg-[#E83A1C] hover:brightness-95'
              )}
            >
              Continuar
            </button>
          )}

          {mode === 'signup' && step === 2 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleBackStep}
                disabled={loading}
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-black/70 hover:bg-black/5 disabled:opacity-60"
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={handleFinalSignup}
                disabled={loading || loadingCep}
                className={cn(
                  'w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm',
                  'disabled:opacity-60 disabled:cursor-not-allowed',
                  'bg-[#E83A1C] hover:brightness-95'
                )}
              >
                {loading ? 'Aguarde...' : 'Criar conta'}
              </button>
            </div>
          )}

          {mode === 'login' && (
            <button
              type="button"
              onClick={handleLogin}
              disabled={loading}
              className={cn(
                'w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm',
                'disabled:opacity-60 disabled:cursor-not-allowed',
                'bg-[#E83A1C] hover:brightness-95'
              )}
            >
              {loading ? 'Aguarde...' : 'Entrar'}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === 'signup' ? 'login' : 'signup'));
              setMsg(null);
              setStep(1);
            }}
            className="w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-black/70 hover:bg-black/5"
          >
            {mode === 'signup' ? 'Já tenho conta' : 'Quero criar conta'}
          </button>
        </div>
      </div>
    </div>
  );
}
