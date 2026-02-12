"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { Plus, Search, Users } from "lucide-react";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type Empresa = {
  id: string;
  nome: string;
};

type ClienteRow = {
  usuario_id: string;
  nome: string | null;
  telefone: string | null;
  criado_em: string;
};

function formatDateShortBR(iso: string) {
  // Ex: 12/02/26, 15:40
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Gera UUID v4 no browser (sem libs)
function uuidv4(): string {
  const c = globalThis.crypto;

  // browsers modernos
  if (c && "randomUUID" in c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }

  // fallback com getRandomValues (ainda sem any)
  if (c && "getRandomValues" in c && typeof c.getRandomValues === "function") {
    const buf = new Uint8Array(16);
    c.getRandomValues(buf);

    // v4 + variant
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;

    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    const b = Array.from(buf, toHex).join("");
    return `${b.slice(0, 8)}-${b.slice(8, 12)}-${b.slice(12, 16)}-${b.slice(16, 20)}-${b.slice(20)}`;
  }

  // último fallback (não-cripto) — só pra não quebrar em ambientes estranhos
  return `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}


type AddForm = {
  nome: string;
  telefone: string;
};

export default function ClientesPage() {
  const [loading, setLoading] = useState(true);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);

  const [clientes, setClientes] = useState<ClienteRow[]>([]);
  const [query, setQuery] = useState("");

  // modal
  const [openModal, setOpenModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<AddForm>({ nome: "", telefone: "" });

  const clientesFiltrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clientes;

    return clientes.filter((c) => {
      const nome = (c.nome ?? "").toLowerCase();
      const tel = (c.telefone ?? "").toLowerCase();
      return nome.includes(q) || tel.includes(q) || c.usuario_id.toLowerCase().includes(q);
    });
  }, [clientes, query]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);

        const { data: userData, error: userErr } = await supabaseClient.auth.getUser();
        if (userErr || !userData.user) {
          window.location.href = "/login";
          return;
        }

        const userId = userData.user.id;

        // empresa do dono
        const { data: emp, error: empErr } = await supabaseClient
          .from("empresas")
          .select("id, nome")
          .eq("dono_usuario_id", userId)
          .maybeSingle();

        if (empErr) throw empErr;
        if (!mounted) return;

        if (!emp) {
          setEmpresa(null);
          setClientes([]);
          return;
        }

        setEmpresa(emp);

        // ✅ COMO "clientes" não tem empresa_id, pegamos os clientes que já fizeram pedido nessa empresa:
        // pedidos (empresa_id) -> cliente_usuario_id -> clientes(usuario_id)
        const { data: rows, error: cliErr } = await supabaseClient
          .from("pedidos")
          .select(
            `
            cliente_usuario_id,
            clientes:cliente_usuario_id (
              usuario_id,
              nome,
              telefone,
              criado_em
            )
          `
          )
          .eq("empresa_id", emp.id);

        if (cliErr) throw cliErr;

        // normaliza e remove duplicados
        const map = new Map<string, ClienteRow>();
        (rows ?? []).forEach((r) => {
          const cli = (r as unknown as { clientes: ClienteRow | null }).clientes;
          if (!cli?.usuario_id) return;
          map.set(cli.usuario_id, cli);
        });

        const list = Array.from(map.values()).sort((a, b) => {
          const ta = new Date(a.criado_em).getTime();
          const tb = new Date(b.criado_em).getTime();
          return tb - ta;
        });

        if (!mounted) return;
        setClientes(list);
      } catch (err) {
        console.error(err);
        toast.error("Não foi possível carregar os clientes.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleAddCliente() {
    if (!empresa) {
      toast.error("Você precisa ter uma empresa configurada.");
      return;
    }

    const nome = form.nome.trim();
    const telefone = form.telefone.trim();

    if (nome.length < 2) {
      toast.error("Digite o nome do cliente.");
      return;
    }

    setSaving(true);
    try {
      // ⚠️ Nota importante:
      // Aqui estamos criando um cliente "manual" na tabela clientes,
      // mas isso NÃO cria login no Supabase Auth.
      // Isso serve para você organizar/gerenciar clientes no dashboard.
      const usuarioId = uuidv4();

      const { error } = await supabaseClient.from("clientes").insert({
        usuario_id: usuarioId,
        nome,
        telefone: telefone.length ? telefone : null,
      });

      if (error) throw error;

      toast.success("Cliente adicionado!");

      setClientes((prev) => [
        { usuario_id: usuarioId, nome, telefone: telefone.length ? telefone : null, criado_em: new Date().toISOString() },
        ...prev,
      ]);

      setOpenModal(false);
      setForm({ nome: "", telefone: "" });
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível adicionar o cliente.");
    } finally {
      setSaving(false);
    }
  }

  // Estado: sem empresa
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
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-black/10 bg-black/5">
              <Users size={18} />
            </div>
            <div>
              <div className="text-sm font-semibold text-black">Clientes</div>
              <div className="text-xs text-black/55">
                {empresa?.nome ?? "—"} • {loading ? "Carregando..." : `${clientes.length} cliente(s)`}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setOpenModal(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#E83A1C] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-95"
          >
            <Plus size={18} />
            Adicionar cliente
          </button>
        </div>

        {/* busca */}
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-black/10 bg-white px-3 py-2">
          <Search size={18} className="text-black/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, telefone ou ID…"
            className="w-full bg-transparent text-sm outline-none"
          />
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
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Criado em</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-black/10">
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-black/60" colSpan={4}>
                    Carregando...
                  </td>
                </tr>
              ) : clientesFiltrados.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-black/60" colSpan={4}>
                    Nenhum cliente encontrado.
                  </td>
                </tr>
              ) : (
                clientesFiltrados.map((c) => (
                  <tr key={c.usuario_id} className="hover:bg-black/5">
                    <td className="px-4 py-3 font-medium text-black">{c.nome ?? "Sem nome"}</td>
                    <td className="px-4 py-3 text-black/70">{c.telefone ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-black/60">
                      {c.usuario_id.slice(0, 8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-black/60">{formatDateShortBR(c.criado_em)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-center text-xs text-black/40">
          * Clientes listados aqui são os que já aparecem vinculados a pedidos dessa empresa.
        </div>
      </div>

      {/* modal adicionar */}
      {openModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setOpenModal(false)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />

          <div className="relative w-[92vw] max-w-md rounded-3xl border border-black/10 bg-white p-5 shadow-[0_30px_90px_-40px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-black">Adicionar cliente</div>
                <div className="mt-1 text-sm text-black/60">Cadastro simples para gestão interna.</div>
              </div>

              <button
                type="button"
                onClick={() => setOpenModal(false)}
                className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-black/60 hover:bg-black/5"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-black/70">Nome</label>
                <input
                  value={form.nome}
                  onChange={(e) => setForm((s) => ({ ...s, nome: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
                  placeholder="Ex: Jubileu"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-black/70">Telefone (opcional)</label>
                <input
                  value={form.telefone}
                  onChange={(e) => setForm((s) => ({ ...s, telefone: e.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
                  placeholder="Ex: (99) 99999-9999"
                  inputMode="tel"
                  autoComplete="tel"
                />
              </div>

              <button
                type="button"
                onClick={handleAddCliente}
                disabled={saving}
                className={cn(
                  "w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white",
                  "bg-[#E83A1C] hover:brightness-95",
                  "disabled:cursor-not-allowed disabled:opacity-60"
                )}
              >
                {saving ? "Salvando..." : "Adicionar"}
              </button>

              <div className="text-center text-xs text-black/45">
                Se você quiser que esse cliente tenha login no catálogo, a gente cria um fluxo separado.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
