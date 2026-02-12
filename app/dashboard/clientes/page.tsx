// app/dashboard/clientes/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { Plus, Pencil, X } from "lucide-react";

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
    setModalMode("create");
    setEditing(null);
    setForm({ nome: "", telefone: "" });
    setModalOpen(true);
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
      if (modalMode === "create") {
        // cria contato manual
        const payload = {
          empresa_id: empresa.id,
          nome,
          telefone: telefone ? normalizePhone(telefone) : null,
        };

        const { error } = await supabaseClient.from("clientes_contatos").insert(payload);
        if (error) throw error;

        toast.success("Contato adicionado.");
      } else {
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

  return (
    <div className="space-y-6">
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
            <Plus size={18} /> Adicionar contato
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
            ? "Isso cria um contato manual (não precisa login)."
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
    </div>
  );
}
