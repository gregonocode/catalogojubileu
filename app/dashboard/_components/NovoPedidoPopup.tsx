"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabase/client";

type Props = {
  soundEnabled: boolean;
};

type NotificacaoRow = {
  id: string;
  empresa_id: string;
  pedido_id: string;
  tipo: string;
  lida: boolean;
  criado_em: string;
};

export default function NovoPedidoPopup({ soundEnabled }: Props) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<NotificacaoRow | null>(null);

  const subscribedRef = useRef(false);

  const audio = useMemo(() => {
    if (typeof window === "undefined") return null;
    const a = new Audio("/sound/money.mp3");
    a.preload = "auto";
    return a;
  }, []);

  function tocarSom() {
    if (!soundEnabled) return;
    if (!audio) return;

    audio.currentTime = 0;
    audio.play().catch(() => {});
  }

  async function marcarComoLida(notifId: string) {
    await supabaseClient.from("notificacoes").update({ lida: true }).eq("id", notifId);
  }

  async function obterEmpresaDoDono(userId: string) {
    const { data, error } = await supabaseClient
      .from("empresas")
      .select("id")
      .eq("dono_usuario_id", userId)
      .maybeSingle();

    if (error) throw error;
    return data?.id ?? null;
  }

  async function buscarUltimaNaoLida(empresaId: string) {
    const { data, error } = await supabaseClient
      .from("notificacoes")
      .select("id, empresa_id, pedido_id, tipo, lida, criado_em")
      .eq("empresa_id", empresaId)
      .eq("tipo", "novo_pedido")
      .eq("lida", false)
      .order("criado_em", { ascending: false })
      .limit(1);

    if (error) throw error;
    return (data?.[0] as NotificacaoRow | undefined) ?? null;
  }

  function abrirPopup(n: NotificacaoRow) {
    setCurrent(n);
    setOpen(true);
    tocarSom();
  }

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabaseClient.channel> | null = null;

    async function init() {
      // 1) garante sessão
      const { data: sess } = await supabaseClient.auth.getSession();
      const user = sess.session?.user;
      if (!user) return;

      // 2) acha empresa do dono
      const empresaId = await obterEmpresaDoDono(user.id);
      if (!empresaId) return;

      // 3) se já existe notificação não lida (caso criou antes do subscribe), mostra
      const pendente = await buscarUltimaNaoLida(empresaId);
      if (!cancelled && pendente) {
        abrirPopup(pendente);
      }

      // 4) subscribe realtime (só 1 vez)
      if (subscribedRef.current) return;
      subscribedRef.current = true;

      channel = supabaseClient
        .channel("rt-notificacoes-novo-pedido")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notificacoes",
            filter: `empresa_id=eq.${empresaId}`,
          },
          (payload) => {
            if (cancelled) return;

            const n = payload.new as NotificacaoRow;
            if (n.tipo !== "novo_pedido") return;
            if (n.lida) return;

            abrirPopup(n);
          }
        )
        .subscribe();
    }

    // tenta iniciar já
    init();

    // e também reinicia quando auth carregar/trocar (evita o caso getSession ainda vazio)
    const { data: sub } = supabaseClient.auth.onAuthStateChange(() => {
      init();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      if (channel) supabaseClient.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundEnabled, audio]);

  if (!open || !current) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      {/* overlay escuro + blur */}
      <button
        type="button"
        aria-label="Fechar"
        onClick={async () => {
          await marcarComoLida(current.id);
          setOpen(false);
          setCurrent(null);
        }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />

      {/* card */}
      <div className="relative w-[92vw] max-w-md rounded-3xl border border-black/10 bg-white p-5 shadow-[0_30px_90px_-40px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-black">Você tem um novo pedido</div>
            <div className="mt-1 text-sm text-black/60">
              Pedido:{" "}
              <span className="font-semibold">
                #{current.pedido_id.slice(0, 8).toUpperCase()}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              await marcarComoLida(current.id);
              setOpen(false);
              setCurrent(null);
            }}
            className="rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm text-black/60 hover:bg-black/5"
            title="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              await marcarComoLida(current.id);
              setOpen(false);
              setCurrent(null);
            }}
            className="flex-1 rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-medium text-black/70 hover:bg-black/5"
          >
            Ok
          </button>

          <button
            type="button"
            onClick={async () => {
              await marcarComoLida(current.id);
              setOpen(false);
              setCurrent(null);
              router.push("/dashboard/pedidos");
            }}
            className="rounded-2xl px-4 py-3 text-sm font-semibold text-white bg-[#E83A1C] hover:brightness-95"
          >
            Ver pedido
          </button>
        </div>

        <div className="mt-3 text-center text-xs text-black/45">
          Dica: você pode clicar fora para fechar.
        </div>
      </div>
    </div>
  );
}
