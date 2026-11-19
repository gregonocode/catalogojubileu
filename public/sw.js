const CACHE_NAME = "catalogo-v4";

// não cacheie o manifest aqui
const ASSETS = ["/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // nunca interceptar manifests
  if (
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/dashboard-manifest.webmanifest"
  ) {
    return;
  }

  // nunca interceptar auth / APIs sensíveis
  if (url.pathname.startsWith("/auth")) return;
  if (url.pathname.startsWith("/api")) return;
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(async (response) => {
        if (response.ok) {
          try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          } catch {
            // A cache failure must not block the network response.
          }
        }
        return response;
      })
      .catch(async () => {
        let cached;
        try {
          cached = await caches.match(request);
        } catch {
          cached = undefined;
        }
        if (cached) return cached;
        if (request.mode === "navigate") {
          try {
            return (await caches.match("/")) ?? Response.error();
          } catch {
            return Response.error();
          }
        }
        return Response.error();
      })
  );
});

// =========================
// PUSH NOTIFICATION
// =========================
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = {};

  try {
    data = event.data.json();
  } catch {
    data = {
      title: "Pneu Forte",
      body: event.data.text(),
    };
  }

  const title = data.title || "Pneu Forte";
  const body = data.body || "Você recebeu uma nova notificação.";
  const url = data.url || "/dashboard";
  const icon = data.icon || "/icons/icon-192.png";
  const badge = data.badge || "/icons/icon-192.png";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      data: { url },
      tag: data.tag || "pneu-forte-notification",
      renotify: true,
    })
  );
});

// =========================
// CLICK NA NOTIFICAÇÃO
// =========================
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
