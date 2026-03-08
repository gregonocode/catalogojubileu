import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

type NotificacaoRow = {
  id: string;
  empresa_id: string;
  pedido_id: string | null;
  tipo: string;
  lida: boolean | null;
  criado_em: string;
};

type PedidoRow = {
  id: string;
  total: number | string | null;
  status: string | null;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function toNumber(v: number | string | null | undefined) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function shortId(id: string) {
  if (!id) return "";
  const a = id.split("-")[0] ?? id.slice(0, 8);
  return a.toUpperCase();
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

    const vapidPublicKey = getEnv("WEB_PUSH_VAPID_PUBLIC_KEY");
    const vapidPrivateKey = getEnv("WEB_PUSH_VAPID_PRIVATE_KEY");
    const contactEmail = getEnv("WEB_PUSH_CONTACT_EMAIL");

    webpush.setVapidDetails(contactEmail, vapidPublicKey, vapidPrivateKey);

    const body = (await req.json()) as {
      notificacao_id?: string;
    };

    const notificacaoId = body?.notificacao_id?.trim();

    if (!notificacaoId) {
      return NextResponse.json(
        { ok: false, error: "missing_notificacao_id" },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: notificacao, error: notificacaoError } = await supabase
      .from("notificacoes")
      .select("id, empresa_id, pedido_id, tipo, lida, criado_em")
      .eq("id", notificacaoId)
      .maybeSingle();

    if (notificacaoError) throw notificacaoError;

    const notif = notificacao as NotificacaoRow | null;

    if (!notif) {
      return NextResponse.json(
        { ok: false, error: "notificacao_not_found" },
        { status: 404 }
      );
    }

    const { data: subsData, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("empresa_id", notif.empresa_id);

    if (subsError) throw subsError;

    const subscriptions = (subsData ?? []) as PushSubscriptionRow[];

    if (subscriptions.length === 0) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        removed: 0,
        message: "Nenhuma subscription cadastrada para a empresa.",
      });
    }

    let pedido: PedidoRow | null = null;

    if (notif.pedido_id) {
      const { data: pedidoData, error: pedidoError } = await supabase
        .from("pedidos")
        .select("id, total, status")
        .eq("id", notif.pedido_id)
        .maybeSingle();

      if (pedidoError) throw pedidoError;
      pedido = pedidoData as PedidoRow | null;
    }

    let title = "Pneu Forte";
    let bodyText = "Você recebeu uma nova notificação.";
    let url = "/dashboard";

    if (notif.tipo === "novo_pedido") {
      title = "Novo pedido";
      bodyText = pedido
        ? `Pedido #${shortId(pedido.id)} no valor de ${formatBRL(toNumber(pedido.total))}`
        : "Você recebeu um novo pedido.";
      url = notif.pedido_id ? "/dashboard/pedidos" : "/dashboard";
    }

    if (notif.tipo === "pedido_aprovado") {
      title = "Pedido aprovado";
      bodyText = pedido
        ? `Pedido #${shortId(pedido.id)} aprovado no valor de ${formatBRL(toNumber(pedido.total))}`
        : "Um pedido foi aprovado.";
      url = notif.pedido_id ? "/dashboard/relatorios" : "/dashboard";
    }

    const payload = JSON.stringify({
      title,
      body: bodyText,
      url,
      tag: notif.pedido_id ? `pedido-${notif.pedido_id}` : `notif-${notif.id}`,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
    });

    let sent = 0;
    const invalidSubscriptionIds: string[] = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        );
        sent += 1;
      } catch (error: any) {
        console.error("Erro ao enviar push:", error);

        const statusCode = Number(error?.statusCode ?? 0);
        if (statusCode === 404 || statusCode === 410) {
          invalidSubscriptionIds.push(sub.id);
        }
      }
    }

    let removed = 0;

    if (invalidSubscriptionIds.length > 0) {
      const { error: deleteError, count } = await supabase
        .from("push_subscriptions")
        .delete({ count: "exact" })
        .in("id", invalidSubscriptionIds);

      if (deleteError) throw deleteError;
      removed = count ?? invalidSubscriptionIds.length;
    }

    return NextResponse.json({
      ok: true,
      sent,
      removed,
    });
  } catch (error) {
    console.error("POST /api/push/send error:", error);

    return NextResponse.json(
      { ok: false, error: "internal_error" },
      { status: 500 }
    );
  }
}