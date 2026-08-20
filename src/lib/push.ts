import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/**
 * Fires a browser push to every device the user has subscribed on. Runs
 * inline in the same server action that created the event (new DM,
 * mention, friend request) rather than through a queue -- traffic on a
 * friends-and-family server is nowhere near where that would matter, and it
 * keeps this project's whole notification path in one place.
 *
 * Reads the recipient's subscriptions through get_push_subscriptions(), a
 * SECURITY DEFINER RPC -- the sender's own session has no RLS access to
 * someone else's push_subscriptions rows otherwise, and this avoids needing
 * a service-role key anywhere in the app.
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!process.env.VAPID_PRIVATE_KEY) return;
  ensureConfigured();

  const supabase = await createClient();
  const { data: subs } = await supabase.rpc("get_push_subscriptions", {
    p_user_id: userId,
  });

  if (!subs || subs.length === 0) return;

  type Sub = { id: string; endpoint: string; p256dh: string; auth_key: string };

  await Promise.all(
    (subs as Sub[]).map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth_key },
          },
          JSON.stringify(payload),
        );
      } catch (err) {
        // 404/410 means the browser dropped the subscription (uninstalled,
        // cleared data, etc.) -- clean it up so we stop retrying it forever.
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await supabase.rpc("prune_push_subscription", { p_id: sub.id });
        }
      }
    }),
  );
}
