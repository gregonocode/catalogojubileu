// app/dashboard/clientes/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import toast, { Toaster } from "react-hot-toast";
import { Plus, Pencil, X, Trash2 } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Empresa = {
  id: string;
  nome: string;
  slug: string;
  whatsapp: string;
};

type ClienteUsuarioRow = {
  usuario_id: string;
  nome: string | null;
  telefone: string | null;
  criado_em: string;
};

type ClienteContatoRow = {
  id: string;
  empresa_id: string;
  nome: string;
  telefone: string | null;
  criado_em: string;
  atualizado_em: string;
};

type ClienteItem =
  | {
      kind: "usuario";
      key: `u_${string}`;
      id: string; // usuario_id
      nome: string;
      telefone: string | null;
      criado_em: string;
    }
  | {
      kind: "contato";
      key: `c_${string}`;
      id: string; // id do clientes_contatos
      nome: string;
      telefone: string | null;
      criado_em: string;
    };

type FilterKind = "all" | "usuario" | "contato";

type ModalMode = "create" | "edit";

type FormState = {
  nome: string;
  telefone: string;
};

type CreateClienteForm = FormState & {
  email: string;
  senha: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  referencia: string;
};

function formatDateShortBR(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "");
}

function normalizePhone(v: string) {
  const dig = onlyDigits(v);
  return dig;
}

function formatCep(value: string) {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.length <= 5 ? digits : `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function TagKind({ kind }: { kind: ClienteItem["kind"] }) {
  const label = kind === "usuario" ? "Usuário" : "Contato";
  const cls =
    kind === "usuario"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : "bg-slate-50 text-slate-700 ring-slate-200";

  return (
    <span className={cn("inline-flex rounded-full px-2 py-1 text-xs font-semibold ring-1", cls)}>
      {label}
    </span>
  );
}

function Modal({
  open,
  mode,
  loading,
  title,
  subtitle,
  form,
  setForm,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: ModalMode;
  loading: boolean;
  title: string;
  subtitle: string;
  form: FormState;
  setForm: (next: FormState) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!open) return null;

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
      <div className="absolute left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-black/10 bg-white p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-black">{title}</div>
            <div className="mt-1 text-sm text-black/60">{subtitle}</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-white hover:bg-black/5"
            aria-label="Fechar modal"
            title="Fechar"
            disabled={loading}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-black/70">Nome</label>
            <input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-black/30"
              placeholder="Ex: João da Oficina"
              autoComplete="name"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-black/70">Telefone (opcional)</label>
            <input
              value={form.telefone}
              onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              className="mt-1 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-black/30"
              placeholder="Ex: 93999999999"
              inputMode="tel"
              autoComplete="tel"
            />
            <div className="mt-1 text-xs text-black/45">
              Dica: pode digitar com espaços e traços
            </div>
          </div>

          <button
            type="button"
            onClick={onSubmit}
            disabled={loading}
            className={cn(
              "w-full rounded-2xl px-4 py-2.5 text-sm font-semibold text-white transition",
              "disabled:cursor-not-allowed disabled:opacity-60",
              "bg-[#E83A1C] hover:brightness-95"
            )}
          >
            {loading ? "Salvando..." : mode === "create" ? "Adicionar contato" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateClienteModal({ open, loading, form, setForm, onClose, onSubmit }: {
  open: boolean; loading: boolean; form: CreateClienteForm; setForm: (form: CreateClienteForm) => void; onClose: () => void; onSubmit: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  useEffect(() => { if (open) setStep(1); }, [open]);
  if (!open) return null;
  const update = (key: keyof CreateClienteForm, value: string) => setForm({ ...form, [key]: value });
  const next = () => {
    if (form.nome.trim().length < 2 || !form.email.includes("@") || form.senha.length < 6 || onlyDigits(form.telefone).length < 10) {
      toast.error("Preencha nome, e-mail, senha (mínimo 6) e telefone com DDD."); return;
    }
    setStep(2);
  };
  return <div className="fixed inset-0 z-[80]">
    <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-black/40" />
    <div className="absolute left-1/2 top-1/2 max-h-[92vh] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-white p-5 shadow-xl">
      <div className="flex items-start justify-between gap-3"><div><div className="text-lg font-semibold">Adicionar cliente</div><div className="mt-1 text-sm text-black/60">{step === 1 ? "Dados de acesso e contato." : "Endereço do cliente."}</div></div><button type="button" onClick={onClose} disabled={loading} className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10"><X size={18} /></button></div>
      <div className="mt-4 flex gap-2"><div className="h-2 flex-1 rounded-full bg-[#E83A1C]" /><div className={cn("h-2 flex-1 rounded-full", step === 2 ? "bg-[#E83A1C]" : "bg-black/10")} /></div>
      <div className="mt-5 space-y-3">
        {step === 1 ? <><input value={form.nome} onChange={(e) => update("nome", e.target.value)} placeholder="Nome completo" className="w-full rounded-xl border border-black/10 px-3 py-2.5" autoComplete="name" /><input value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="E-mail" className="w-full rounded-xl border border-black/10 px-3 py-2.5" inputMode="email" autoComplete="email" /><input value={form.senha} onChange={(e) => update("senha", e.target.value)} placeholder="Senha (mínimo 6 caracteres)" type="password" className="w-full rounded-xl border border-black/10 px-3 py-2.5" autoComplete="new-password" /><input value={form.telefone} onChange={(e) => update("telefone", e.target.value)} placeholder="Telefone com DDD" className="w-full rounded-xl border border-black/10 px-3 py-2.5" inputMode="tel" autoComplete="tel" /><button type="button" onClick={next} className="w-full rounded-xl bg-[#E83A1C] px-4 py-2.5 text-sm font-semibold text-white">Continuar</button></> : <><input value={form.cep} onChange={(e) => update("cep", formatCep(e.target.value))} placeholder="CEP" className="w-full rounded-xl border border-black/10 px-3 py-2.5" inputMode="numeric" /><input value={form.logradouro} onChange={(e) => update("logradouro", e.target.value)} placeholder="Logradouro" className="w-full rounded-xl border border-black/10 px-3 py-2.5" /><div className="grid grid-cols-2 gap-3"><input value={form.numero} onChange={(e) => update("numero", e.target.value)} placeholder="Número" className="rounded-xl border border-black/10 px-3 py-2.5" /><input value={form.complemento} onChange={(e) => update("complemento", e.target.value)} placeholder="Complemento" className="rounded-xl border border-black/10 px-3 py-2.5" /></div><input value={form.bairro} onChange={(e) => update("bairro", e.target.value)} placeholder="Bairro" className="w-full rounded-xl border border-black/10 px-3 py-2.5" /><div className="grid grid-cols-2 gap-3"><input value={form.cidade} onChange={(e) => update("cidade", e.target.value)} placeholder="Cidade" className="rounded-xl border border-black/10 px-3 py-2.5" /><input value={form.uf} onChange={(e) => update("uf", e.target.value.toUpperCase().slice(0, 2))} placeholder="UF" className="rounded-xl border border-black/10 px-3 py-2.5" /></div><input value={form.referencia} onChange={(e) => update("referencia", e.target.value)} placeholder="Referência" className="w-full rounded-xl border border-black/10 px-3 py-2.5" /><div className="flex gap-2"><button type="button" onClick={() => setStep(1)} className="flex-1 rounded-xl border border-black/10 px-4 py-2.5">Voltar</button><button type="button" onClick={onSubmit} disabled={loading} className="flex-1 rounded-xl bg-[#E83A1C] px-4 py-2.5 font-semibold text-white disabled:opacity-60">{loading ? "Criando..." : "Criar cliente"}</button></div></>}
      </div>
    </div>
  </div>;
}

export default function DashboardClientesPage() {
  const [loading, setLoading] = useState(true);

  const [empresa, setEmpresa] = useState<Empresa | null>(null);

  // dados brutos
  const [usuarios, setUsuarios] = useState<ClienteUsuarioRow[]>([]);
  const [contatos, setContatos] = useState<ClienteContatoRow[]>([]);

  // UI
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<FilterKind>("all");

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateClienteForm>({ nome: "", email: "", senha: "", telefone: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", referencia: "" });
  const [editing, setEditing] = useState<ClienteItem | null>(null);
  const [form, setForm] = useState<FormState>({ nome: "", telefone: "" });

  const merged: ClienteItem[] = useMemo(() => {
    const u: ClienteItem[] = usuarios.map((r) => ({
      kind: "usuario",
      key: `u_${r.usuario_id}`,
      id: r.usuario_id,
      nome: r.nome ?? "Cliente",
      telefone: r.telefone ?? null,
      criado_em: r.criado_em,
    }));

    const c: ClienteItem[] = contatos.map((r) => ({
      kind: "contato",
      key: `c_${r.id}`,
      id: r.id,
      nome: r.nome,
      telefone: r.telefone ?? null,
      criado_em: r.criado_em,
    }));

    // mistura e ordena por data desc
    return [...u, ...c].sort((a, b) => {
      const ta = new Date(a.criado_em).getTime();
      const tb = new Date(b.criado_em).getTime();
      return tb - ta;
    });
  }, [usuarios, contatos]);

  const filtered: ClienteItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();

    return merged.filter((it) => {
      if (kindFilter !== "all" && it.kind !== kindFilter) return false;
      if (!q) return true;

      const nome = (it.nome || "").toLowerCase();
      const tel = (it.telefone || "").toLowerCase();
      return nome.includes(q) || tel.includes(q);
    });
  }, [merged, query, kindFilter]);

  async function loadAll() {
    setLoading(true);
    try {
      const { data: userData, error: userErr } = await supabaseClient.auth.getUser();
      if (userErr || !userData.user) {
        window.location.href = "/login";
        return;
      }

      const userId = userData.user.id;

      const { data: emp, error: empErr } = await supabaseClient
        .from("empresas")
        .select("id, nome, whatsapp, slug")
        .eq("dono_usuario_id", userId)
        .maybeSingle();

      if (empErr) throw empErr;

      if (!emp) {
        setEmpresa(null);
        setUsuarios([]);
        setContatos([]);
        return;
      }

      const empresaTyped = emp as Empresa;
      setEmpresa(empresaTyped);

      // 1) contatos manuais
      const contatosReq = supabaseClient
        .from("clientes_contatos")
        .select("id, empresa_id, nome, telefone, criado_em, atualizado_em")
        .eq("empresa_id", empresaTyped.id)
        .order("criado_em", { ascending: false });

      // 2) usuários logados: pega IDs distintos em pedidos da empresa
      const idsReq = supabaseClient
        .from("pedidos")
        .select("cliente_usuario_id")
        .eq("empresa_id", empresaTyped.id)
        .not("cliente_usuario_id", "is", null);

      const [contatosRes, idsRes] = await Promise.all([contatosReq, idsReq]);

      if (contatosRes.error) throw contatosRes.error;
      if (idsRes.error) throw idsRes.error;

      const contatosData = (contatosRes.data ?? []) as unknown as ClienteContatoRow[];
      setContatos(contatosData);

      const ids = (idsRes.data ?? [])
        .map((r) => r.cliente_usuario_id)
        .filter((v): v is string => typeof v === "string");

      const uniqueIds = Array.from(new Set(ids));

      if (uniqueIds.length === 0) {
        setUsuarios([]);
      } else {
        const { data: usuariosData, error: uErr } = await supabaseClient
          .from("clientes")
          .select("usuario_id, nome, telefone, criado_em")
          .in("usuario_id", uniqueIds);

        if (uErr) throw uErr;

        const typed = (usuariosData ?? []) as unknown as ClienteUsuarioRow[];
        setUsuarios(typed);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar clientes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  function openCreate() {
    setCreateForm({ nome: "", email: "", senha: "", telefone: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", referencia: "" });
    setCreateOpen(true);
  }

  function openEdit(item: ClienteItem) {
    setModalMode("edit");
    setEditing(item);
    setForm({
      nome: item.nome ?? "",
      telefone: item.telefone ?? "",
    });
    setModalOpen(true);
  }

  async function handleSubmit() {
    if (!empresa?.id) {
      toast.error("Empresa não encontrada.");
      return;
    }

    const nome = form.nome.trim();
    const telefone = form.telefone.trim();

    if (nome.length < 2) {
      toast.error("Digite um nome válido.");
      return;
    }

    setSaving(true);
    try {
      {
        if (!editing) {
          toast.error("Item inválido.");
          return;
        }

        const payload = {
          nome,
          telefone: telefone ? normalizePhone(telefone) : null,
        };

        if (editing.kind === "contato") {
          const { error } = await supabaseClient
            .from("clientes_contatos")
            .update({ ...payload, atualizado_em: new Date().toISOString() })
            .eq("id", editing.id)
            .eq("empresa_id", empresa.id);

          if (error) throw error;
          toast.success("Contato atualizado.");
        } else {
          // usuário logado (tabela clientes)
          const { data: updatedRows, error: upErr } = await supabaseClient
            .from("clientes")
            .update(payload) // { nome, telefone }
            .eq("usuario_id", editing.id)
            .select("usuario_id, nome, telefone"); // sem maybeSingle

          if (upErr) throw upErr;

          const updated = updatedRows?.[0] ?? null;
          if (!updated) {
            throw new Error("Sem permissão para atualizar este cliente (RLS).");
          }

          toast.success("Usuário atualizado.");
        }
      }

      setModalOpen(false);
      setEditing(null);
      await loadAll();
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateCliente() {
    if (!empresa?.id) return;
    if (onlyDigits(createForm.cep).length !== 8 || createForm.logradouro.trim().length < 2 || !createForm.numero.trim() || createForm.bairro.trim().length < 2 || createForm.cidade.trim().length < 2 || createForm.uf.length !== 2) {
      toast.error("Preencha todos os campos obrigatórios do endereço."); return;
    }
    try {
      setSaving(true);
      const { data: { session } } = await supabaseClient.auth.getSession();
      const response = await fetch("/api/clientes", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` }, body: JSON.stringify({ empresa_id: empresa.id, ...createForm }) });
      const result = await response.json() as { error?: string; cliente?: ClienteUsuarioRow };
      if (!response.ok) throw new Error(result.error || "Não foi possível criar o cliente.");
      if (result.cliente) setUsuarios((current) => [result.cliente!, ...current]);
      setCreateOpen(false);
      toast.success("Cliente criado com acesso por e-mail e senha.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível criar o cliente."); }
    finally { setSaving(false); }
  }

  if (!loading && !empresa) {
    return (
      <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
        <div className="text-lg font-semibold text-black">Falta criar sua empresa</div>
        <p className="mt-2 text-sm text-black/60">
          Você já está logado, mas ainda não existe uma empresa cadastrada para esse usuário.
        </p>
        <div className="mt-5 rounded-2xl border border-black/10 bg-black/5 p-4 text-sm text-black/70">
          Próximo passo: criar a empresa em <b>Configuração</b>.
        </div>
      </div>
    );
  }

  const totalUsuarios = usuarios.length;
  const totalContatos = contatos.length;

 async function removeContato(item: ClienteItem) {
  toast.dismiss();

  if (!empresa?.id) {
    toast.error("Empresa não encontrada.");
    return;
  }

  if (item.kind !== "contato") {
    toast.error("Não é possível excluir usuários logados por aqui.");
    return;
  }

  const ok = window.confirm(`Excluir o contato "${item.nome}"?`);
  if (!ok) return;

  const before = contatos;
  setContatos((prev) => prev.filter((x) => x.id !== item.id));

  const { data, error } = await supabaseClient
    .from("clientes_contatos")
    .delete()
    .eq("id", item.id)
    .eq("empresa_id", empresa.id)
    .select("id");

  if (error) {
    setContatos(before);
    console.error("DELETE clientes_contatos error:", error);
    toast.error(error.message ?? "Não foi possível excluir.");
    return;
  }

  if (!data || data.length === 0) {
    setContatos(before);
    toast.error("Nada foi excluído (sem permissão/RLS ou contato não encontrado).");
    return;
  }

  toast.success("Contato excluído.");
}
  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      {/* topo */}
      
      <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm text-black/60">Clientes</div>
            <div className="mt-1 text-lg font-semibold text-black">{empresa?.nome ?? "—"}</div>
            <div className="mt-1 text-xs text-black/55">
              Usuarios e contatos!
            </div>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className={cn(
              "inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white",
              "bg-[#E83A1C] hover:brightness-95"
            )}
          >
            <Plus size={18} /> Adicionar cliente
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-black/60">
              {loading ? "Carregando..." : `${merged.length} total`}
            </span>

            <span className="text-xs text-black/40">•</span>

            <span className="text-sm text-black/60">
              <span className="font-semibold text-emerald-700">{totalUsuarios}</span> usuários
            </span>

            <span className="text-xs text-black/40">•</span>

            <span className="text-sm text-black/60">
              <span className="font-semibold text-slate-700">{totalContatos}</span> contatos
            </span>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {/* filtro */}
            <div className="inline-flex overflow-hidden rounded-2xl border border-black/10 bg-white">
              <button
                type="button"
                onClick={() => setKindFilter("all")}
                className={cn(
                  "px-3 py-2 text-sm",
                  kindFilter === "all" ? "bg-black/5 font-semibold" : "hover:bg-black/5"
                )}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setKindFilter("usuario")}
                className={cn(
                  "px-3 py-2 text-sm",
                  kindFilter === "usuario" ? "bg-black/5 font-semibold" : "hover:bg-black/5"
                )}
              >
                Usuários
              </button>
              <button
                type="button"
                onClick={() => setKindFilter("contato")}
                className={cn(
                  "px-3 py-2 text-sm",
                  kindFilter === "contato" ? "bg-black/5 font-semibold" : "hover:bg-black/5"
                )}
              >
                Contatos
              </button>
            </div>

            {/* busca */}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou telefone..."
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-black/30 sm:max-w-sm"
            />
          </div>
        </div>
      </div>

      {/* lista */}
      <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
        <div className="overflow-hidden rounded-2xl border border-black/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/5 text-xs text-black/55">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Criado</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-black/10">
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-black/60" colSpan={4}>
                    Carregando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-black/60" colSpan={4}>
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.key} className="hover:bg-black/5">
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-black">{c.nome}</span>
                        <TagKind kind={c.kind} />
                      </div>
                      <div className="mt-1 text-xs text-black/45">
                        {c.kind === "usuario" ? "Cliente logado" : "Contato manual"}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-black/70">{c.telefone ?? "—"}</td>

                    <td className="px-4 py-3 text-black/55">{formatDateShortBR(c.criado_em)}</td>

                    <td className="px-4 py-3 text-right">
  <div className="inline-flex items-center gap-2">
    <button
      type="button"
      onClick={() => openEdit(c)}
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm",
        "hover:bg-black/5"
      )}
      title="Editar"
      aria-label="Editar cliente"
    >
      <Pencil size={16} />
      <span className="hidden sm:inline">Editar</span>
    </button>

    {c.kind === "contato" && (
      <button
        type="button"
        onClick={() => removeContato(c)}
        className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-white hover:bg-black/5"
        title="Excluir contato"
        aria-label="Excluir contato"
      >
        <Trash2 size={16} />
      </button>
    )}
  </div>
</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && merged.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-black/10 bg-black/5 p-4 text-sm text-black/70">
            Ainda não existe nenhum cliente (nem usuário logado, nem contato manual).
          </div>
        ) : null}
      </div>

      <Modal
        open={modalOpen}
        mode={modalMode}
        loading={saving}
        title={modalMode === "create" ? "Adicionar contato" : "Editar cliente"}
        subtitle={
          modalMode === "create"
            ? "Isso cria um contato manual"
            : editing?.kind === "usuario"
            ? "Editando um usuário logado (tabela clientes)."
            : "Editando um contato manual (tabela clientes_contatos)."
        }
        form={form}
        setForm={setForm}
        onClose={() => {
          if (saving) return;
          setModalOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />
      <CreateClienteModal
        open={createOpen}
        loading={saving}
        form={createForm}
        setForm={setCreateForm}
        onClose={() => !saving && setCreateOpen(false)}
        onSubmit={handleCreateCliente}
      />
    </div>
  );
}
