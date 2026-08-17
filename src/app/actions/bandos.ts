"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function generateInviteCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createBando(formData: FormData) {
  const name = String(formData.get("name")).trim();

  if (name.length < 2) {
    redirect(
      `/bandos?error=${encodeURIComponent("Dê um nome ao seu bando")}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("bandos")
    .insert({
      name,
      owner_id: user.id,
      invite_code: generateInviteCode(),
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(
      `/bandos?error=${encodeURIComponent(error?.message ?? "Erro ao criar bando")}`,
    );
  }

  redirect(`/bandos/${data.id}`);
}

export async function joinBandoByCode(formData: FormData) {
  const code = String(formData.get("code")).trim().toUpperCase();
  await joinBando(code);
}

export async function joinBando(code: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login`);

  const { data: bandoId, error: bandoError } = await supabase.rpc(
    "get_bando_id_by_invite_code",
    { p_code: code },
  );

  if (bandoError || !bandoId) {
    redirect(`/bandos?error=${encodeURIComponent("Código de convite inválido")}`);
  }

  const { error: joinError } = await supabase
    .from("bando_members")
    .insert({ bando_id: bandoId, user_id: user.id });

  if (joinError && joinError.code !== "23505") {
    redirect(`/bandos?error=${encodeURIComponent(joinError.message)}`);
  }

  redirect(`/bandos/${bandoId}`);
}
