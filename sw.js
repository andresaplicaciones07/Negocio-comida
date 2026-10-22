// Service Worker — Negocio Comida v31
// ESTRATEGIA: URLs explícitas y fijas (sin recursión). Más confiable en TWA.
const CACHE_NAME = "negocio-comida-v31";

// Archivos propios de la app
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./app.jsx",
  "./privacidad.html",
  "./anuncios.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png",
  "./images/salchipapa.png",
  "./images/patacon.png",
  "./images/empanada.png",
];

// Scripts externos sin CORS (modo no-cors = respuesta opaca, sirve igual para cargar)
const EXTERNOS_OPACOS = [
  "https://cdn.tailwindcss.com",
  "https://unpkg.com/@babel/standalone@7/babel.min.js",
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Inter:wght@400;500;600;700&display=swap",
];

// Módulos ESM con CORS — URLs EXACTAS del app.jsx (sin recursión, sin adivinanzas)
// Incluye las redirecciones conocidas de esm.sh para React 18.2
const MODULOS_ESM_EXACTOS = [
  // React
  "https://esm.sh/react@18.2.0",
  "https://esm.sh/stable/react@18.2.0/es2022/react.mjs",
  // ReactDOM client
  "https://esm.sh/react-dom@18.2.0/client",
  "https://esm.sh/stable/react-dom@18.2.0/es2022/client.js",
  "https://esm.sh/stable/react-dom@18.2.0/es2022/react-dom.mjs",
  // Lucide React
  "https://esm.sh/lucide-react@0.383.0?deps=react@18.2.0",
  "https://esm.sh/stable/lucide-react@0.383.0/es2022/lucide-react.mjs",
  // Scheduler (dependencia interna de React)
  "https://esm.sh/stable/scheduler@0.23.0/es2022/scheduler.mjs",
];

// Fuentes gstatic (opacas)
const FUENTES_OPACOS = [
  // Se cachean automáticamente en el fetch handler cuando se cargan
];

// ExcelJS (opcional, solo si hay internet al instalar)
const EXTRAS = [
  "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js",
];

const HOSTS_CACHEABLES = [
  "cdn.tailwindcss.com",
  "unpkg.com",
  "esm.sh",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "cdn.jsdelivr.net",
];

// Intenta cachear una URL con CORS; no falla si no hay internet
async function cachearESM(cache, url) {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (res.ok) {
      await cache.put(url, res.clone());
      // Sigue la URL final (después de redirección) para cachearla también
      if (res.url && res.url !== url) {
        await cache.put(res.url, res.clone());
      }
    }
  } catch {
    // Sin internet al instalar: no pasa nada, se cachea en el primer uso
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // 1. Archivos propios: críticos, deben estar sí o sí
      await cache.addAll(APP_SHELL);

      // 2. Todo lo demás en paralelo, sin bloquear si falla
      await Promise.allSettled([
        // Scripts opacos (Tailwind, Babel, Fuentes)
        ...EXTERNOS_OPACOS.map((u) => {
          const req = new Request(u, { mode: "no-cors" });
          return fetch(req).then((r) => cache.put(req, r)).catch(() => {});
        }),
        // Módulos ESM con URLs exactas
        ...MODULOS_ESM_EXACTOS.map((u) => cachearESM(cache, u)),
        // ExcelJS (opcional)
        ...EXTRAS.map((u) =>
          fetch(u, { mode: "cors" })
            .then((r) => r.ok && cache.put(u, r))
            .catch(() => {})
        ),
      ]);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // anuncios.json: red primero, caché de respaldo
  if (url.pathname.endsWith("/anuncios.json")) {
    event.respondWith(
      fetch(event.request)
        .then((r) => {
          const clone = r.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          return r;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Google Drive y OAuth: siempre red (no cachear tokens ni datos privados)
  if (
    url.hostname === "accounts.google.com" ||
    url.hostname === "www.googleapis.com" ||
    url.hostname === "oauth2.googleapis.com"
  ) {
    return; // deja pasar sin interceptar
  }

  event.respondWith(
    caches.match(event.request, { ignoreVary: true }).then((cached) => {
      // Stale-While-Revalidate: responde al instante con caché y actualiza en fondo
      const red = fetch(event.request)
        .then((response) => {
          const esHost = HOSTS_CACHEABLES.includes(url.hostname);
          const guardar =
            response &&
            (response.status === 200 ||
              (response.type === "opaque" && esHost));
          if (guardar) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => {
              c.put(event.request, clone);
              // Cachear también la URL final si hubo redirección
              if (response.url && response.url !== event.request.url) {
                response.clone && c.put(response.url, response.clone());
              }
            });
          }
          return response;
        })
        .catch(() => cached);

      return cached || red;
    })
  );
});
