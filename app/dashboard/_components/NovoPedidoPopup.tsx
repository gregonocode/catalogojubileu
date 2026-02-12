"use client";

import { useEffect, useMemo, useState } from "react";
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

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function NovoPedidoPopup({ soundEnabled }: Props) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<NotificacaoRow | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabaseClient.channel> | null = null;

    async function start() {
      const { data: userData } = await supabaseClient.auth.getUser();
      const user = userData.user;
      if (!user) return;

      const { data: emp } = await supabaseClient
        .from("empresas")
        .select("id")
        .eq("dono_usuario_id", user.id)
        .maybeSingle();

      if (!emp?.id) return;

      channel = supabaseClient
        .channel("rt-notificacoes-novo-pedido")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notificacoes",
            filter: `empresa_id=eq.${emp.id}`,
          },
          (payload) => {
            if (cancelled) return;
            const n = payload.new as NotificacaoRow;

            if (n.tipo !== "novo_pedido") return;
            if (n.lida) return;

            setCurrent(n);
            setOpen(true);
            tocarSom();
          }
        )
        .subscribe();
    }

    start();

    return () => {
      cancelled = true;
      if (channel) supabaseClient.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundEnabled, audio]);

  if (!open || !current) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[90] w-[92vw] max-w-sm">
      <div className="rounded-3xl border border-black/10 bg-white p-4 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)]">
        <div className="text-sm font-semibold text-black">Você tem um novo pedido</div>
        <div className="mt-1 text-xs text-black/60">
          Pedido: <span className="font-semibold">#{current.pedido_id.slice(0, 8).toUpperCase()}</span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              await marcarComoLida(current.id);
              setOpen(false);
              setCurrent(null);
            }}
            className="flex-1 rounded-2xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-black/70 hover:bg-black/5"
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
            className={cn(
              "rounded-2xl px-4 py-2.5 text-sm font-semibold text-white",
              "bg-[#E83A1C] hover:brightness-95"
            )}
          >
            Ver pedido
          </button>
        </div>
      </div>
    </div>
  );
}
