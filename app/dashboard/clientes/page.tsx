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

type ClienteContatoRow = {
  id: string;
  empresa_id: string;
  nome: string;
  telefone: string | null;
  criado_em: string;
  atualizado_em: string;
};

type ModalMode = "create" | "edit";

type FormState = {
  nome: string;
  telefone: string;
};

function formatPhoneDisplay(v: string | null) {
  if (!v) return "—";
  return v;
}

function formatDateShortBR(iso: string) {
  // exemplo: 12/02/26, 09:19
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
  // mantém só dígitos, mas você pode deixar livre se preferir
  const dig = onlyDigits(v);
  return dig;
}

function Modal({
  open,
  mode,
  loading,
  title,
  form,
  setForm,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: ModalMode;
  loading: boolean;
  title: string;
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
            <div className="mt-1 text-sm text-black/60">
              {mode === "create"
                ? "Cadastre um contato para sua empresa."
                : "Edite apenas nome e telefone."}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-white hover:bg-black/5"
            aria-label="Fechar modal"
            title="Fechar"
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
              Dica: pode digitar com espaços e traços, eu salvo só os números.
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
            {loading ? "Salvando..." : mode === "create" ? "Adicionar cliente" : "Salvar alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardClientesPage() {
  const [loading, setLoading] = useState(true);

  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [rows, setRows] = useState<ClienteContatoRow[]>([]);
  const [query, setQuery] = useState("");

  // modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ClienteContatoRow | null>(null);

  const [form, setForm] = useState<FormState>({ nome: "", telefone: "" });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((c) => {
      const nome = (c.nome || "").toLowerCase();
      const tel = (c.telefone || "").toLowerCase();
      return nome.includes(q) || tel.includes(q);
    });
  }, [rows, query]);

  async function loadEmpresaAndClientes() {
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
        setRows([]);
        return;
      }

      setEmpresa(emp as Empresa);

      const { data, error } = await supabaseClient
        .from("clientes_contatos")
        .select("id, empresa_id, nome, telefone, criado_em, atualizado_em")
        .eq("empresa_id", emp.id)
        .order("criado_em", { ascending: false });

      if (error) throw error;

      const typed = (data ?? []) as unknown as ClienteContatoRow[];
      setRows(typed);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar clientes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEmpresaAndClientes();
  }, []);

  function openCreate() {
    setModalMode("create");
    setEditing(null);
    setForm({ nome: "", telefone: "" });
    setModalOpen(true);
  }

  function openEdit(row: ClienteContatoRow) {
    setModalMode("edit");
    setEditing(row);
    setForm({
      nome: row.nome ?? "",
      telefone: row.telefone ?? "",
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
        const payload = {
          empresa_id: empresa.id,
          nome,
          telefone: telefone ? normalizePhone(telefone) : null,
        };

        const { error } = await supabaseClient.from("clientes_contatos").insert(payload);
        if (error) throw error;

        toast.success("Cliente adicionado.");
      } else {
        if (!editing?.id) {
          toast.error("Cliente inválido.");
          return;
        }

        const payload = {
          nome,
          telefone: telefone ? normalizePhone(telefone) : null,
          atualizado_em: new Date().toISOString(),
        };

        const { error } = await supabaseClient
          .from("clientes_contatos")
          .update(payload)
          .eq("id", editing.id)
          .eq("empresa_id", empresa.id);

        if (error) throw error;

        toast.success("Cliente atualizado.");
      }

      setModalOpen(false);
      setEditing(null);
      await loadEmpresaAndClientes();
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível salvar o cliente.");
    } finally {
      setSaving(false);
    }
  }

  // sem empresa
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

  return (
    <div className="space-y-6">
      {/* topo */}
      <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-sm text-black/60">Clientes</div>
            <div className="mt-1 text-lg font-semibold text-black">
              {empresa?.nome ?? "—"}
            </div>
            <div className="mt-1 text-xs text-black/55">
              Lista de contatos cadastrados manualmente (separado dos clientes que fazem login).
            </div>
          </div>

          <div className="flex items-center gap-2">
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
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-black/60">
            {loading ? "Carregando..." : `${rows.length} cliente(s)`}
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-black/30 sm:max-w-sm"
          />
        </div>
      </div>

      {/* lista */}
      <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.25)]">
        <div className="overflow-hidden rounded-2xl border border-black/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-black/5 text-xs text-black/55">
              <tr>
                <th className="px-4 py-3">Nome</th>
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
                  <tr key={c.id} className="hover:bg-black/5">
                    <td className="px-4 py-3 font-medium text-black">{c.nome}</td>
                    <td className="px-4 py-3 text-black/70">{formatPhoneDisplay(c.telefone)}</td>
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
      </div>

      <Modal
        open={modalOpen}
        mode={modalMode}
        loading={saving}
        title={modalMode === "create" ? "Adicionar cliente" : "Editar cliente"}
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
