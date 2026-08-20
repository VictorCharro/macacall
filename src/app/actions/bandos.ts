"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/auditLog";

export type BandoActionState = { error?: string };

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

  revalidatePath("/bandos", "layout");
  redirect(`/bandos/${data.id}`);
}

export async function renameBando(
  bandoId: string,
  _prevState: BandoActionState,
  formData: FormData,
): Promise<BandoActionState> {
  const name = String(formData.get("name")).trim();

  if (name.length < 2) {
    return { error: "Dê um nome ao seu bando" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabase
    .from("bandos")
    .update({ name })
    .eq("id", bandoId)
    .eq("owner_id", user.id);

  if (error) {
    return { error: error.message };
  }

  await logAudit(supabase, bandoId, user.id, "rename_bando", name);

  revalidatePath("/bandos", "layout");
  return {};
}

export async function updateBandoPhoto(
  bandoId: string,
  _prevState: BandoActionState,
  formData: FormData,
): Promise<BandoActionState> {
  const file = formData.get("photo");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Escolha uma imagem" };
  }

  if (!file.type.startsWith("image/")) {
    return { error: "O arquivo precisa ser uma imagem" };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { error: "A imagem precisa ter até 5MB" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: bando } = await supabase
    .from("bandos")
    .select("owner_id")
    .eq("id", bandoId)
    .maybeSingle();

  if (!bando || bando.owner_id !== user.id) {
    return { error: "Só o dono pode trocar a foto do bando" };
  }

  const ext = file.name.split(".").pop() || "png";
  const path = `${bandoId}/icon-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("bando-photos")
    .upload(path, file, { upsert: true });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("bando-photos").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("bandos")
    .update({ photo_url: publicUrl })
    .eq("id", bandoId)
    .eq("owner_id", user.id);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath("/bandos", "layout");
  return {};
}

export async function deleteBando(bandoId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabase
    .from("bandos")
    .delete()
    .eq("id", bandoId)
    .eq("owner_id", user.id);

  if (error) {
    redirect(`/bandos?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/bandos", "layout");
  redirect("/bandos");
}

async function joinBandoCore(
  code: string,
): Promise<{ bandoId: string } | { error: string }> {
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
    return { error: "Código de convite inválido" };
  }

  const { error: joinError } = await supabase
    .from("bando_members")
    .insert({ bando_id: bandoId, user_id: user.id });

  if (joinError && joinError.code !== "23505") {
    return { error: joinError.message };
  }

  return { bandoId };
}

export async function joinBandoByCode(formData: FormData) {
  const code = String(formData.get("code")).trim().toUpperCase();
  const result = await joinBandoCore(code);

  if (!("bandoId" in result)) {
    redirect(`/bandos?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/bandos", "layout");
  redirect(`/bandos/${result.bandoId}`);
}

// Used directly from the /join/[code] server component's render (an
// already-logged-in user hitting an invite link). revalidatePath is not
// supported during render, so this variant skips it — the redirect below
// lands on a freshly rendered route anyway.
export async function joinBandoNoRevalidate(code: string) {
  const result = await joinBandoCore(code);

  if (!("bandoId" in result)) {
    redirect(`/bandos?error=${encodeURIComponent(result.error)}`);
  }

  redirect(`/bandos/${result.bandoId}`);
}
