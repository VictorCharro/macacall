// Minimal push-only service worker -- no offline caching, just notifications.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "MacaCall", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "MacaCall", {
      body: payload.body,
      icon: "/favicon.ico",
      tag: payload.tag,
      data: { url: payload.url ?? "/bandos" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/bandos";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          client.navigate?.(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
