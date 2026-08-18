"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { BandoActionState } from "@/app/actions/bandos";
import type { PresenceStatus } from "@/lib/types";

export async function sendFriendRequest(
  _prevState: BandoActionState,
  formData: FormData,
): Promise<BandoActionState> {
  const username = String(formData.get("username")).trim();

  if (!username) {
    return { error: "Digite um nome de usuário" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: target } = await supabase
    .from("profiles")
    .select("id, username")
    .ilike("username", username)
    .maybeSingle();

  if (!target) {
    return { error: "Nenhum macaco com esse nome de usuário" };
  }

  if (target.id === user.id) {
    return { error: "Você não pode adicionar a si mesmo" };
  }

  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: user.id, addressee_id: target.id });

  if (error) {
    if (error.code === "23505") {
      return { error: "Vocês já são amigos ou já tem um pedido pendente" };
    }
    return { error: error.message };
  }

  revalidatePath("/bandos");
  return {};
}

export async function respondFriendRequest(
  friendshipId: string,
  accept: boolean,
): Promise<BandoActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (accept) {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", friendshipId);

    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", friendshipId);

    if (error) return { error: error.message };
  }

  revalidatePath("/bandos");
  return {};
}

export async function removeFriend(
  friendshipId: string,
): Promise<BandoActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId);

  if (error) return { error: error.message };

  revalidatePath("/bandos");
  return {};
}

export async function updateStatus(status: PresenceStatus) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  await supabase.from("profiles").update({ status }).eq("id", user.id);
  revalidatePath("/bandos", "layout");
}
