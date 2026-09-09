"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/authGuard";
import { revalidatePath } from "next/cache";
import type { BandoActionState } from "@/app/actions/bandos";
import { logAudit } from "@/lib/auditLog";

// Matches the `maxLength={40}` already on the channel-name input in the UI
// (CreateChannelButton.tsx) -- wasn't enforced server-side before.
const CHANNEL_NAME_MAX_LENGTH = 40;
const CHANNEL_CATEGORY_MAX_LENGTH = 40;

export async function createChannel(
  bandoId: string,
  type: "text" | "voice",
  _prevState: BandoActionState,
  formData: FormData,
): Promise<BandoActionState> {
  const name = String(formData.get("name")).trim();
  const category = String(formData.get("category") ?? "").trim();

  if (name.length < 2 || name.length > CHANNEL_NAME_MAX_LENGTH) {
    return { error: `Dê um nome ao canal (até ${CHANNEL_NAME_MAX_LENGTH} caracteres)` };
  }

  if (category.length > CHANNEL_CATEGORY_MAX_LENGTH) {
    return { error: `Categoria muito longa (máximo ${CHANNEL_CATEGORY_MAX_LENGTH} caracteres)` };
  }

  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("channels")
    .insert({ bando_id: bandoId, name, type, category: category || null });

  if (error) {
    return { error: error.message };
  }

  await logAudit(supabase, bandoId, user.id, "create_channel", name);

  revalidatePath(`/bandos/${bandoId}`, "layout");
  return {};
}

export async function updateChannelTopic(
  channelId: string,
  _prevState: BandoActionState,
  formData: FormData,
): Promise<BandoActionState> {
  const topic = String(formData.get("topic") ?? "").trim();

  if (topic.length > 200) {
    return { error: "Tópico muito longo (máximo 200 caracteres)" };
  }

  const { supabase } = await requireUser();

  const { data: channel, error } = await supabase
    .from("channels")
    .update({ topic: topic || null })
    .eq("id", channelId)
    .select("bando_id")
    .single();

  if (error || !channel) {
    return { error: error?.message ?? "Erro ao salvar o tópico" };
  }

  revalidatePath(`/bandos/${channel.bando_id}`, "layout");
  return {};
}

export async function renameChannel(
  channelId: string,
  _prevState: BandoActionState,
  formData: FormData,
): Promise<BandoActionState> {
  const name = String(formData.get("name")).trim();

  if (name.length < 2 || name.length > CHANNEL_NAME_MAX_LENGTH) {
    return { error: `Dê um nome ao canal (até ${CHANNEL_NAME_MAX_LENGTH} caracteres)` };
  }

  const { supabase } = await requireUser();

  const { data: channel, error } = await supabase
    .from("channels")
    .update({ name })
    .eq("id", channelId)
    .select("bando_id")
    .single();

  if (error || !channel) {
    return { error: error?.message ?? "Erro ao renomear canal" };
  }

  revalidatePath(`/bandos/${channel.bando_id}`, "layout");
  return {};
}

export async function deleteChannel(bandoId: string, channelId: string) {
  const { supabase, user } = await requireUser();

  const { data: channel } = await supabase
    .from("channels")
    .select("name")
    .eq("id", channelId)
    .maybeSingle();

  await supabase.from("channels").delete().eq("id", channelId);

  await logAudit(supabase, bandoId, user.id, "delete_channel", channel?.name);

  revalidatePath(`/bandos/${bandoId}`, "layout");
  redirect(`/bandos/${bandoId}`);
}
