"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { savePushSubscription, removePushSubscription } from "@/app/actions/push";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Bell toggle for the user panel: subscribes/unsubscribes this browser to
 * push notifications. Silently does nothing where push isn't supported
 * (no Service Worker, no Notification API, or the app has no VAPID key
 * configured) rather than showing a button that can only ever error. */
export function PushNotificationToggle() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) return;

    navigator.serviceWorker.register("/sw.js").then(async (registration) => {
      const existing = await registration.pushManager.getSubscription();
      setSupported(true);
      setEnabled(!!existing);
    });
  }, []);

  async function toggle() {
    if (pending) return;
    setPending(true);
    try {
      const registration = await navigator.serviceWorker.ready;

      if (enabled) {
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
          await removePushSubscription(sub.endpoint);
          await sub.unsubscribe();
        }
        setEnabled(false);
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
        ),
      });
      const json = sub.toJSON();
      await savePushSubscription(sub.endpoint, json.keys!.p256dh, json.keys!.auth);
      setEnabled(true);
    } finally {
      setPending(false);
    }
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={enabled ? "Desativar notificações" : "Ativar notificações"}
      aria-label={enabled ? "Desativar notificações" : "Ativar notificações"}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition disabled:opacity-50 ${
        enabled
          ? "text-secondary hover:bg-card-2"
          : "text-muted hover:bg-card-2 hover:text-accent"
      }`}
    >
      {enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
    </button>
  );
}
