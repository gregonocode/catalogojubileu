import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function bearer(request: Request) {
  const value = request.headers.get("authorization");
  return value?.startsWith("Bearer ") ? value.slice(7) : null;
}

export async function POST(request: Request) {
  try {
    const url = env("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const token = bearer(request);
    if (!token) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const body = await request.json() as Record<string, string>;
    const empresaId = body.empresa_id?.trim();
    const nome = body.nome?.trim();
    const email = body.email?.trim().toLowerCase();
    const senha = body.senha ?? "";
    const telefone = (body.telefone ?? "").replace(/\D/g, "");
    if (!empresaId || !nome || !email?.includes("@") || senha.length < 6 || telefone.length < 10) {
      return NextResponse.json({ error: "Dados de acesso inválidos." }, { status: 400 });
    }

    const authClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: empresa, error: empresaError } = await admin.from("empresas").select("id").eq("id", empresaId).eq("dono_usuario_id", user.id).maybeSingle();
    if (empresaError) throw empresaError;
    if (!empresa) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 403 });

    const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { role: "cliente", nome, telefone } });
    if (createError || !created.user) return NextResponse.json({ error: createError?.message ?? "Não foi possível criar o acesso." }, { status: 400 });

    const userId = created.user.id;
    const { error: clienteError } = await admin.from("clientes").upsert({ usuario_id: userId, nome, telefone }, { onConflict: "usuario_id" });
    const { error: enderecoError } = await admin.from("end_clientes").upsert({ cliente_id: userId, cep: (body.cep ?? "").replace(/\D/g, "") || null, logradouro: body.logradouro?.trim() || null, numero: body.numero?.trim() || null, complemento: body.complemento?.trim() || null, bairro: body.bairro?.trim() || null, cidade: body.cidade?.trim() || null, uf: body.uf?.trim().toUpperCase() || null, referencia: body.referencia?.trim() || null }, { onConflict: "cliente_id" });
    if (clienteError || enderecoError) {
      await admin.auth.admin.deleteUser(userId);
      throw clienteError ?? enderecoError;
    }

    return NextResponse.json({ cliente: { usuario_id: userId, nome, telefone, criado_em: created.user.created_at } });
  } catch (error) {
    console.error("POST /api/clientes error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro interno." }, { status: 500 });
  }
}
