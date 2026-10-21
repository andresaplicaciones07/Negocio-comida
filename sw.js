// Service Worker — Negocio Comida (versión tienda)
// Guarda una copia de la app y de TODAS las librerías externas para que abra sin internet.
//
// REGLA DE ORO: cada vez que cambies app.jsx u otro archivo, sube el número de CACHE_NAME
// (ej. "negocio-comida-v29") y sube sw.js a GitHub junto con los demás cambios.
const CACHE_NAME = "negocio-comida-v30";

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

// Scripts/estilos clásicos (sin CORS): se guardan como respuesta "opaca".
const EXTERNOS_OPACOS = [
  "https://cdn.tailwindcss.com",
  "https://unpkg.com/@babel/standalone@7/babel.min.js",
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Inter:wght@400;500;600;700&display=swap",
];

// Módulos ES (necesitan CORS). Deben ser IDÉNTICOS a los import de app.jsx.
// Se guardan junto con los archivos internos que cada uno importa.
const MODULOS_ESM = [
  "https://esm.sh/react@18.2.0",
  "https://esm.sh/react-dom@18.2.0/client",
  "https://esm.sh/lucide-react@0.383.0?deps=react@18.2.0",
];

// Carga bajo demanda (Excel, premium). Si no hay internet al instalar, no pasa nada.
const EXTRAS = [
  "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js",
];

const HOSTS_CACHEABLES = [
  "cdn.tailwindcss.com", "unpkg.com", "esm.sh",
  "fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net",
];

// Guarda un módulo ESM y, de forma recursiva, los archivos que importa.
async function guardarModulo(cache, url, vistos) {
  if (vistos.has(url) || vistos.size > 80) return;
  vistos.add(url);
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) return;
  await cache.put(url, res.clone());
  const texto = await res.text();
  const re = /(?:from|import)\s*["'](\/[^"']+)["']/g;
  let m;
  const hijos = [];
  while ((m = re.exec(texto))) hijos.push(new URL(m[1], url).href);
  await Promise.all(hijos.map((h) => guardarModulo(cache, h, vistos).catch(() => {})));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL);
      const vistos = new Set();
      // Si no hay internet en este momento, no se rompe la instalación.
      await Promise.allSettled([
        ...EXTERNOS_OPACOS.map((u) => {
          const req = new Request(u, { mode: "no-cors" });
          return fetch(req).then((r) => cache.put(req, r));
        }),
        ...MODULOS_ESM.map((u) => guardarModulo(cache, u, vistos)),
        ...EXTRAS.map((u) => fetch(u, { mode: "cors" }).then((r) => r.ok && cache.put(u, r))),
      ]);
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
  const url = new URL(event.request.url);

  // Anuncios: red primero, con respaldo en caché.
  if (url.pathname.endsWith("/anuncios.json")) {
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
    caches.match(event.request, { ignoreVary: true }).then((cached) => {
      // Stale-While-Revalidate: responde al instante y actualiza en segundo plano.
      const red = fetch(event.request).then((response) => {
        const guardar = response && (response.status === 200 ||
          (response.type === "opaque" && HOSTS_CACHEABLES.includes(url.hostname)));
        if (guardar) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || red;
    })
  );
});
