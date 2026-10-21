// Service Worker — Salchi costeño (versión tienda)
// Guarda una copia de la app (y de las librerías externas que usa) para que abra
// sin conexión después de la primera vez que se abre con internet.
//
// IMPORTANTE: si subes cambios nuevos a GitHub, cambia el número de
// CACHE_NAME (ej. "negocio-comida-v28") para que los celulares reciban
// la versión nueva en vez de la guardada en caché.
const CACHE_NAME = "negocio-comida-v28";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./app.jsx",
  "./privacidad.html",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png",
  "./images/salchipapa.png",
  "./images/patacon.png",
  "./images/empanada.png",
];
// Librerías externas que la app necesita para abrir sin internet.
// ⚠️ IMPORTANTE: incluye React, ReactDOM e íconos desde esm.sh,
// Tailwind, Babel y las fuentes. Sin esto la app no abre la primera vez sin conexión.
const EXTERNOS = [
  "https://cdn.tailwindcss.com",
  "https://unpkg.com/@babel/standalone@7/babel.min.js",
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Inter:wght@400;500;600;700&display=swap",
  // React y ReactDOM desde esm.sh (mismas URLs exactas que usa app.jsx)
  "https://esm.sh/react@18.2.0",
  "https://esm.sh/react-dom@18.2.0/client",
  // Íconos de lucide-react (con el pin de versión y deps exactos)
  "https://esm.sh/lucide-react@0.383.0?deps=react@18.2.0",
];
// Solo se guardan respuestas "opacas" (sin permiso CORS) de estos sitios de confianza.
const HOSTS_CACHEABLES = ["cdn.tailwindcss.com", "unpkg.com", "esm.sh", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL);
      // Si no hay internet en este momento, no se rompe la instalación: se guardan después, al usarse.
      await Promise.allSettled(EXTERNOS.map((u) => {
        const req = new Request(u, { mode: "no-cors" });
        return fetch(req).then((r) => cache.put(req, r));
      }));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // Los anuncios siempre se piden a internet primero (para que veas los cambios al instante);
  // si no hay conexión, usa la última copia guardada.
  if (new URL(event.request.url).pathname.endsWith("/anuncios.json")) {
    event.respondWith(
      fetch(event.request).then((r) => {
        const clone = r.clone();
        caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        return r;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const host = new URL(event.request.url).hostname;
          const guardar = response && (response.status === 200 || (response.type === "opaque" && HOSTS_CACHEABLES.includes(host)));
          if (guardar) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
