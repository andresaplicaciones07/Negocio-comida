// Service Worker — Negocio Comida v32
const CACHE_NAME = "negocio-comida-v32";

// Archivos propios. Se guardan uno por uno: si falta alguno, NO se rompe la instalación.
const APP_SHELL = [
  "./", "./index.html", "./manifest.json", "./app.jsx", "./privacidad.html",
  "./icon-192.png", "./icon-512.png", "./icon-512-maskable.png", "./apple-touch-icon.png",
  "./images/salchipapa.png", "./images/patacon.png", "./images/empanada.png",
];

const EXTERNOS_OPACOS = [
  "https://cdn.tailwindcss.com",
  "https://unpkg.com/@babel/standalone@7/babel.min.js",
  "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Inter:wght@400;500;600;700&display=swap",
];

// Deben ser IDÉNTICOS a los import de app.jsx
const MODULOS_ESM = [
  "https://esm.sh/react@18.2.0",
  "https://esm.sh/react-dom@18.2.0/client",
  "https://esm.sh/lucide-react@0.383.0?deps=react@18.2.0",
];

const EXTRAS = ["https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js"];

const HOSTS_CACHEABLES = ["cdn.tailwindcss.com", "unpkg.com", "esm.sh", "fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net"];

// Guarda un módulo ESM y, recursivamente, todo lo que importa.
async function guardarModulo(cache, url, vistos) {
  if (vistos.has(url) || vistos.size > 200) return;
  vistos.add(url);
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) return;
  await cache.put(url, res.clone());
  const texto = await res.text();
  const re = /(?:from|import)\s*["'](\/[^"']+)["']/g;
  let m; const hijos = [];
  while ((m = re.exec(texto))) hijos.push(new URL(m[1], url).href);
  await Promise.all(hijos.map((h) => guardarModulo(cache, h, vistos).catch(() => {})));
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const vistos = new Set();
    await Promise.allSettled([
      ...APP_SHELL.map((u) => cache.add(u)),
      ...EXTERNOS_OPACOS.map((u) => { const req = new Request(u, { mode: "no-cors" }); return fetch(req).then((r) => cache.put(req, r)); }),
      ...MODULOS_ESM.map((u) => guardarModulo(cache, u, vistos)),
      ...EXTRAS.map((u) => fetch(u, { mode: "cors" }).then((r) => r.ok && cache.put(u, r))),
      cache.add("./anuncios.json"),
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (["accounts.google.com", "www.googleapis.com", "oauth2.googleapis.com"].includes(url.hostname)) return;

  // anuncios.json: red primero, caché de respaldo
  if (url.pathname.endsWith("/anuncios.json")) {
    event.respondWith(
      fetch(req).then((r) => { const c = r.clone(); caches.open(CACHE_NAME).then((ch) => ch.put("./anuncios.json", c)); return r; })
        .catch(async () => (await caches.match("./anuncios.json", { ignoreSearch: true })) || new Response('{"anuncios":[]}', { headers: { "Content-Type": "application/json" } }))
    );
    return;
  }

  // ABRIR LA APP (navegación): siempre responde con index.html guardado,
  // aunque la URL traiga ?tienda=1, ?utm_source=... o similar.
  if (req.mode === "navigate" && !url.pathname.endsWith("privacidad.html")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const guardado = (await cache.match("./index.html")) || (await cache.match("./"));
      const actualizar = fetch("./index.html").then((r) => { if (r && r.ok) cache.put("./index.html", r.clone()); return r; }).catch(() => null);
      if (guardado) { event.waitUntil(actualizar); return guardado; }
      return (await actualizar) || new Response("Sin conexión", { status: 503 });
    })());
    return;
  }

  // Todo lo demás: Stale-While-Revalidate
  event.respondWith(
    caches.match(req, { ignoreVary: true }).then((cached) => {
      const red = fetch(req).then((response) => {
        const guardar = response && (response.status === 200 || (response.type === "opaque" && HOSTS_CACHEABLES.includes(url.hostname)));
        if (guardar) { const c = response.clone(); caches.open(CACHE_NAME).then((ch) => ch.put(req, c)); }
        return response;
      }).catch(() => cached);
      return cached || red;
    })
  );
});
