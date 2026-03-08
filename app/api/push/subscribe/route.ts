import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type PushSubscriptionJson = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

function getBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader) return null;

  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer" || !token) return null;

  return token;
}

export async function POST(req: Request) {
  try {
    const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

    const body = (await req.json()) as {
      empresa_id?: string;
      user_id?: string;
      subscription?: PushSubscriptionJson;
    };

    const empresaId = body?.empresa_id?.trim();
    const userId = body?.user_id?.trim();
    const subscription = body?.subscription;

    if (!empresaId || !userId || !subscription) {
      return NextResponse.json(
        { ok: false, error: "missing_fields" },
        { status: 400 }
      );
    }

    const endpoint = subscription.endpoint?.trim();
    const p256dh = subscription.keys?.p256dh?.trim();
    const auth = subscription.keys?.auth?.trim();
    const expirationTime =
      typeof subscription.expirationTime === "number"
        ? subscription.expirationTime
        : null;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { ok: false, error: "invalid_subscription" },
        { status: 400 }
      );
    }

    const accessToken = getBearerToken(req);

    if (!accessToken) {
      return NextResponse.json(
        { ok: false, error: "missing_bearer_token" },
        { status: 401 }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 }
      );
    }

    if (user.id !== userId) {
      return NextResponse.json(
        { ok: false, error: "user_mismatch" },
        { status: 403 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: empresa, error: empresaError } = await supabaseAdmin
      .from("empresas")
      .select("id, dono_usuario_id")
      .eq("id", empresaId)
      .maybeSingle();

    if (empresaError) {
      throw empresaError;
    }

    if (!empresa) {
      return NextResponse.json(
        { ok: false, error: "empresa_not_found" },
        { status: 404 }
      );
    }

    if (empresa.dono_usuario_id !== user.id) {
      return NextResponse.json(
        { ok: false, error: "forbidden_empresa" },
        { status: 403 }
      );
    }

    const payload = {
      empresa_id: empresaId,
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      expiration_time: expirationTime,
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabaseAdmin
      .from("push_subscriptions")
      .upsert(payload, {
        onConflict: "endpoint",
      });

    if (upsertError) {
      throw upsertError;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
  console.error("POST /api/push/subscribe error:", error);

  const message =
    error instanceof Error ? error.message : "internal_error";

  return NextResponse.json(
    { ok: false, error: message },
    { status: 500 }
  );
}
}