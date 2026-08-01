self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Nura", body: event.data.text() || "" };
  }

  const title = payload.title || "Nura";
  const options = {
    body: payload.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url || "/today" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetPath = event.notification.data?.url || "/today";
  const absoluteUrl = new URL(targetPath, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        try {
          const clientPath = new URL(client.url).pathname;
          if (clientPath === targetPath || client.url.startsWith(absoluteUrl)) {
            if ("focus" in client) return client.focus();
          }
        } catch {
          // ignore bad client urls
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(absoluteUrl);
    }),
  );
});
