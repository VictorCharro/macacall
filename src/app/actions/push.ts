"use server";

import { createClient } from "@/lib/supabase/server";

export async function savePushSubscription(
  endpoint: string,
  p256dh: string,
  authKey: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Não autenticado" };

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { user_id: user.id, endpoint, p256dh, auth_key: authKey },
      { onConflict: "endpoint" },
    );

  return error ? { error: error.message } : {};
}

export async function removePushSubscription(endpoint: string) {
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
