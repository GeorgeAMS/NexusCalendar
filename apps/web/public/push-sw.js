/*
 * Nexus Calendar — messaging service worker.
 * Registered only when the user turns on push notifications.
 * It does NOT cache anything: no offline/app-shell behavior.
 */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Nexus Calendar", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Nexus Calendar";
  const options = {
    body: payload.body || "",
    tag: payload.tag || "nexus",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url || "/notificaciones" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/notificaciones";
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
