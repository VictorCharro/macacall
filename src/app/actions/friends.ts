"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/authGuard";
import type { BandoActionState } from "@/app/actions/bandos";
import type { PresenceStatus } from "@/lib/types";
import { sendPushToUser } from "@/lib/push";
import { isRateLimited } from "@/lib/rateLimit";

export async function sendFriendRequest(
  _prevState: BandoActionState,
  formData: FormData,
): Promise<BandoActionState> {
  const username = String(formData.get("username")).trim();

  if (!username || username.length > 24) {
    return { error: "Digite um nome de usuário válido" };
  }

  const { supabase, user } = await requireUser();

  // 20 pedidos de amizade por 10 min é bem mais que qualquer uso legítimo
  // (mesmo alguém entrando num bando novo e adicionando todo mundo), e
  // corta o caso de spam/assédio via re-pedidos repetidos.
  if (isRateLimited(`friend-request:${user.id}`, 20, 10 * 60 * 1000)) {
    return { error: "Muitos pedidos de amizade seguidos -- espera um pouco" };
  }

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

  const { data: blocked } = await supabase
    .from("blocked_users")
    .select("blocker_id")
    .or(
      `and(blocker_id.eq.${user.id},blocked_id.eq.${target.id}),and(blocker_id.eq.${target.id},blocked_id.eq.${user.id})`,
    )
    .maybeSingle();

  if (blocked) {
    return { error: "Não foi possível enviar o pedido pra esse usuário" };
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

  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();

  await sendPushToUser(target.id, {
    title: "Novo pedido de amizade",
    body: `${senderProfile?.username ?? "Um macaco"} quer ser seu amigo`,
    url: "/bandos",
    tag: "friend-request",
  });

  revalidatePath("/bandos");
  return {};
}

export async function respondFriendRequest(
  friendshipId: string,
  accept: boolean,
): Promise<BandoActionState> {
  const { supabase } = await requireUser();

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
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId);

  if (error) return { error: error.message };

  revalidatePath("/bandos");
  return {};
}

export async function removeFriendByUserId(
  otherUserId: string,
): Promise<BandoActionState> {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("friendships")
    .delete()
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${user.id})`,
    );

  if (error) return { error: error.message };

  revalidatePath("/bandos");
  return {};
}

export async function blockUser(
  otherUserId: string,
): Promise<BandoActionState> {
  const { supabase, user } = await requireUser();

  await supabase
    .from("friendships")
    .delete()
    .or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},addressee_id.eq.${user.id})`,
    );

  const { error } = await supabase
    .from("blocked_users")
    .insert({ blocker_id: user.id, blocked_id: otherUserId });

  if (error) return { error: error.message };

  revalidatePath("/bandos");
  return {};
}

export async function updateStatus(status: PresenceStatus) {
  const { supabase, user } = await requireUser();

  await supabase.from("profiles").update({ status }).eq("id", user.id);
  revalidatePath("/bandos", "layout");
}

export async function updateStatusMessage(
  message: string,
): Promise<BandoActionState> {
  const { supabase, user } = await requireUser();

  const trimmed = message.trim().slice(0, 100);

  const { error } = await supabase
    .from("profiles")
    .update({ status_message: trimmed || null })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/bandos", "layout");
  return {};
}
