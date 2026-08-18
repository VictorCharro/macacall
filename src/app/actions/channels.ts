"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BandoActionState } from "@/app/actions/bandos";

export async function createChannel(
  bandoId: string,
  type: "text" | "voice",
  _prevState: BandoActionState,
  formData: FormData,
): Promise<BandoActionState> {
  const name = String(formData.get("name")).trim();

  if (name.length < 2) {
    return { error: "Dê um nome ao canal" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabase
    .from("channels")
    .insert({ bando_id: bandoId, name, type });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/bandos/${bandoId}`, "layout");
  return {};
}

export async function renameChannel(
  channelId: string,
  _prevState: BandoActionState,
  formData: FormData,
): Promise<BandoActionState> {
  const name = String(formData.get("name")).trim();

  if (name.length < 2) {
    return { error: "Dê um nome ao canal" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  await supabase.from("channels").delete().eq("id", channelId);

  revalidatePath(`/bandos/${bandoId}`, "layout");
  redirect(`/bandos/${bandoId}`);
}
