import React, { useState, useEffect, useMemo, useRef } from "https://esm.sh/react@18.2.0";
import ReactDOM from "https://esm.sh/react-dom@18.2.0/client";
import {
  ShoppingCart, Plus, Minus, X, Trash2, Pencil, Wallet,
  BarChart3, Check, ChevronRight, Receipt,
  CircleDollarSign, HandCoins, Printer, Download, Upload, ArrowLeft, Beaker, MessageCircle,
  Camera, ImagePlus, Paperclip, ArrowUpRight, ArrowDownRight, ClipboardList, Search, Flame, Gift,
} from "https://esm.sh/lucide-react@0.383.0?deps=react@18.2.0";

/* ============================= HELPERS BÁSICOS ============================= */
const EMOJIS = ["🌭", "🍟", "🧀", "🌶️", "🥓", "🍔", "🍖", "🧅", "🍗", "🌽", "🥔", "🍅", "🥚", "🫓", "🥙", "🌮", "🍿", "🥤", "🧃", "🍕", "🥗", "🍳"];
const FOTOS = [
  { id: "salchipapa", label: "Salchipapa", src: "./images/salchipapa.png" },
  { id: "patacon", label: "Patacón", src: "./images/patacon.png" },
  { id: "empanada", label: "Empanada", src: "./images/empanada.png" },
];
const UNIDADES = ["g", "ml", "un", "paquete"];
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayISO = () => isoLocal(new Date());
// Hora actual en formato 24h "HH:MM" (para registrar a qué hora se hizo cada movimiento)
const horaAhora = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
// Muestra "2:35 p. m." a partir de "14:35"
const fmtHora = (h) => {
  if (!h) return "";
  const [hh, mm] = h.split(":").map(Number);
  if (Number.isNaN(hh)) return "";
  return `${hh % 12 || 12}:${String(mm || 0).padStart(2, "0")} ${hh >= 12 ? "p. m." : "a. m."}`;
};
// Orden del más reciente al más antiguo (fecha + hora). Los movimientos viejos sin hora quedan al final de su día.
const porRecienteLedger = (a, b) => {
  const ka = `${a.fecha} ${a.hora || "00:00"}`, kb = `${b.fecha} ${b.hora || "00:00"}`;
  return ka < kb ? 1 : ka > kb ? -1 : 0;
};
const diaRelativo = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return isoLocal(d); };
const cop = (n) => (Math.round(n || 0)).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const uid = () => Math.random().toString(36).slice(2, 10);
const fmtDate = (iso) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
const DOW_ABBR = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MES_ABBR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
// Fecha larga y legible para el libro de caja, ej: "vie, 05 sep 2026"
const fmtDateLong = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return `${DOW_ABBR[dt.getDay()]}, ${String(d).padStart(2, "0")} ${MES_ABBR[(m || 1) - 1]} ${y}`;
};

/* ============================= ESTADO DEL PEDIDO, CANALES Y PRUEBA GRATIS ============================= */
const ESTADOS = [
  { id: "pendiente", label: "Pendiente", emoji: "🕒", color: "#E85D3D", bg: "#FBEAE4", accion: "👨‍🍳 Empezar a preparar" },
  { id: "preparacion", label: "En preparación", emoji: "👨‍🍳", color: "#D98C1F", bg: "#FBF3E1", accion: "🛎️ Marcar como listo" },
  { id: "listo", label: "Listo", emoji: "🛎️", color: "#5B8C5A", bg: "#EDF4EC", accion: "✅ Marcar como entregado" },
  { id: "entregado", label: "Entregado", emoji: "✅", color: "#8A7A6C", bg: "#F0E9D8", accion: "" },
];
// Las ventas viejas (que no tienen estado) cuentan como ya entregadas.
const estadoDe = (v) => v.estado || "entregado";
const estadoInfo = (id) => ESTADOS.find((e) => e.id === id) || ESTADOS[ESTADOS.length - 1];
const estadoSiguiente = (id) => ESTADOS[Math.min(ESTADOS.findIndex((e) => e.id === id) + 1, ESTADOS.length - 1)].id;
const estadoAnterior = (id) => ESTADOS[Math.max(ESTADOS.findIndex((e) => e.id === id) - 1, 0)].id;

// Canales de venta: Directo y WhatsApp vienen listos. Los demás (Rappi, DiDi...) los agrega el usuario con su % de comisión (Premium).
const CANALES_BASE = [
  { id: "directo", nombre: "Directo", comision: 0 },
  { id: "whatsapp", nombre: "WhatsApp", comision: 0 },
];
function mezclarCanales(guardados) {
  const propios = Array.isArray(guardados) ? guardados.filter((c) => c && c.custom && c.nombre) : [];
  return [...CANALES_BASE, ...propios];
}
const comisionDe = (total, pct) => Math.round(((Number(total) || 0) * (Number(pct) || 0)) / 100);

// Prueba gratis de DIAS_PRUEBA días con todo Premium, SIN tarjeta. Empieza cuando el usuario toca "Activar mis 4 días gratis"
// e inicia sesión con Google. La fecha de inicio se guarda en la carpeta oculta de SU Drive (drive.appdata): si desinstala y
// reinstala, al volver a activar recupera los días que le quedaban y no se reinicia. Si atrasan el reloj del celular, no ganan tiempo.
const DIAS_PRUEBA = 4;
const MS_DIA = 24 * 60 * 60 * 1000;
function cargarPrueba() {
  let p = loadKey("skp-prueba", null);
  if (p && p.inicio) return p;
  if (KEY_PREFIX) { p = { inicio: new Date().toISOString(), visto: Date.now() }; saveKey("skp-prueba", p); return p; } // modo demo: Premium abierto para las capturas
  const viejo = loadKey("skp-trial-inicio", null); // versión anterior: la prueba arrancaba sola; se respeta para no quitarle nada a nadie
  if (viejo && !Number.isNaN(Number(viejo))) { p = { inicio: new Date(Number(viejo)).toISOString(), visto: Date.now() }; saveKey("skp-prueba", p); return p; }
  return null;
}
// Días que le quedan a la prueba (0 si no se activó o ya terminó). Si el reloj se atrasa, usa la última hora vista.
function diasDePrueba(p, ahoraMs) {
  if (!p || !p.inicio) return 0;
  const ini = Date.parse(p.inicio);
  if (Number.isNaN(ini)) return 0;
  const ahora = Math.max(ahoraMs, p.visto || 0);
  return Math.max(0, Math.ceil(DIAS_PRUEBA - (ahora - ini) / MS_DIA));
}

/* ============================= VERSIÓN, TIENDA Y MODO DEMO ============================= */
const APP_VERSION = "30";
// --- Play Store: rellena esto cuando publiques ---
const FORZAR_TIENDA = false;      // true = fuerza la "versión para la tienda" (solo para pruebas)
const PLAY_PACKAGE = "com.andresaroca.salchicosteno"; // Paquete real de PWA Builder / Play Console
const PLAY_SKU = "premium_mensual"; // ID del producto/suscripción que crees en Play Console
const GOOGLE_CLIENT_ID = "19743819745-5j7routqcjcsl5gvh8anpfnp9a9u2fqf.apps.googleusercontent.com";      // ID de cliente OAuth (tipo Web) de Google Cloud para la copia en Drive. Vacío = Drive usa el menú de compartir.
const DRIVE_ARCHIVO = "negocio-comida-backup.json";
const DRIVE_PRUEBA = "negocio-comida-prueba.json";   // guarda la fecha de inicio de la prueba (carpeta oculta de la app en el Drive del usuario)
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata"; // solo la carpeta oculta de la app, nunca el resto del Drive
let _dtok = null; // token de Drive: solo en memoria, nunca en localStorage
// ---------- Validar una copia de seguridad ANTES de reemplazar los datos ----------
const LISTAS_BACKUP = ["products", "insumos", "pctItems", "ledger", "fiado", "ventas", "cierres", "canales", "combos", "sabores"];
const MAX_FILAS_BACKUP = 50000;
const MAX_BYTES_BACKUP = 25 * 1024 * 1024;
function validarBackup(data) {
  const esObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
  const malo = (m) => ({ ok: false, error: m });
  if (!esObj(data)) return malo("Ese archivo no es una copia de seguridad de Negocio Comida");
  if (![...LISTAS_BACKUP, "categorias", "cfg", "qrPago"].some((k) => k in data)) return malo("Ese archivo no parece una copia de seguridad de Negocio Comida");
  for (const k of LISTAS_BACKUP) {
    if (!(k in data)) continue;
    const v = data[k];
    if (!Array.isArray(v)) return malo(`La copia está dañada (${k})`);
    if (v.length > MAX_FILAS_BACKUP) return malo(`La copia trae demasiados datos (${k})`);
    for (const it of v) {
      if (!esObj(it)) return malo(`La copia está dañada (${k})`);
      if ("id" in it && typeof it.id !== "string" && typeof it.id !== "number") return malo(`La copia está dañada (${k})`);
    }
  }
  if ("categorias" in data && (!Array.isArray(data.categorias) || data.categorias.length > 1000 || data.categorias.some((c) => typeof c !== "string" || c.length > 200))) return malo("La copia está dañada (categorías)");
  if ("cfg" in data && !esObj(data.cfg)) return malo("La copia está dañada (configuración)");
  if ("qrPago" in data) {
    const q = data.qrPago;
    if (!esObj(q) || ("telefono" in q && typeof q.telefono !== "string") || ("foto" in q && q.foto !== null && typeof q.foto !== "string")) return malo("La copia está dañada (código QR)");
  }
  const n = (k) => (Array.isArray(data[k]) ? data[k].length : 0);
  const partes = [[n("products"), "productos"], [n("ventas"), "ventas"], [n("fiado"), "fiados"], [n("insumos"), "insumos"], [n("ledger"), "movimientos de caja"], [n("cierres"), "cierres"]]
    .filter(([c]) => c > 0).map(([c, t]) => `${c} ${t}`);
  return { ok: true, resumen: partes.length ? partes.join(", ") : "sin productos ni ventas" };
}

// Versiones de los textos legales (terminos.html y privacidad.html). Si cambias un texto, sube la versión aquí y a todos se les vuelve a pedir aceptarlo.
const TC_VERSION = "tc_v1";
const PP_VERSION = "pp_v2";
const consentVigente = (c) => !!(c && c.tc && c.tc.version === TC_VERSION && c.privacidad && c.privacidad.version === PP_VERSION);
// Fecha y hora local con su zona (ej. 2026-11-03T08:03:00-05:00), para saber exactamente cuándo se aceptó
function fechaHoraLocalISO(d) {
  const p = (n) => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset(); const sg = off >= 0 ? "+" : "-";
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${sg}${p(Math.floor(Math.abs(off) / 60))}:${p(Math.abs(off) % 60)}`;
}
// ¿Estamos dentro de la app instalada desde Google Play? (referrer android-app:// o ?tienda=1 en la URL de inicio)
const esModoTienda = (() => {
  try {
    if (FORZAR_TIENDA) return true;
    const q = new URLSearchParams(window.location.search);
    if (q.get("tienda") === "1") localStorage.setItem("skp-tienda", "1");
    if (document.referrer && document.referrer.startsWith("android-app://")) localStorage.setItem("skp-tienda", "1");
    return localStorage.getItem("skp-tienda") === "1";
  } catch { return false; }
})();
const urlPlay = PLAY_PACKAGE ? `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}` : "";
// Modo demo (?demo=1): usa un almacenamiento aparte con datos de ejemplo, para tomar las capturas de pantalla sin tocar tus datos reales.
const KEY_PREFIX = (() => { try { return new URLSearchParams(window.location.search).get("demo") === "1" ? "demo-" : ""; } catch { return ""; } })();
const webBase = () => window.location.href.split("#")[0].split("?")[0].replace(/index\.html$/, "");
const catProd = (p) => p.categoria || "Salchipapas";
const fmtNum = (n) => (Math.round((Number(n) || 0) * 100) / 100).toLocaleString("es-CO");

// Días que han pasado desde una fecha "AAAA-MM-DD" hasta hoy
const diasDesdeFecha = (iso) => {
  if (!iso) return 0;
  const [y, m, d] = iso.split("-").map(Number);
  const a = new Date(y, (m || 1) - 1, d || 1);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((b - a) / MS_DIA));
};
const textoHace = (dias) => (dias === 0 ? "hoy" : dias === 1 ? "ayer" : `hace ${dias} días`);

/* ============================= INVENTARIO DE INSUMOS (aviso cuando se acaba) ============================= */
// Solo se controla el inventario de los insumos que tienen "cantidad en bodega". Los demás funcionan igual que antes.
const rastreaStock = (i) => i.stock !== undefined && i.stock !== null && i.stock !== "" && !Number.isNaN(Number(i.stock));
const estadoStock = (i) => {
  if (!rastreaStock(i)) return null;
  const st = Number(i.stock);
  if (st <= 0) return "agotado";
  if (Number(i.minimo) > 0 && st <= Number(i.minimo)) return "bajo";
  return "ok";
};
// Un renglón del pedido puede traer adiciones pegadas (it.adds) o ser un combo (it.comp).
// Esta función lo "abre" en productos sueltos para que el inventario y los informes cuenten bien.
function expandirItem(it) {
  const out = [];
  if (it.comp && it.comp.length) it.comp.forEach((c) => out.push({ productId: c.productId, qty: c.qty * it.qty }));
  else if (it.productId) out.push({ productId: it.productId, qty: it.qty });
  (it.adds || []).forEach((a) => out.push({ productId: a.productId, qty: a.qty * it.qty }));
  return out;
}
// Cuánto de cada insumo se gasta con estos productos vendidos (según las recetas)
function consumoDeItems(items, products) {
  const m = {};
  (items || []).forEach((it) => {
    expandirItem(it).forEach((x) => {
      const p = products.find((y) => y.id === x.productId);
      if (!p) return;
      (p.receta || []).forEach((r) => { m[r.insumoId] = (m[r.insumoId] || 0) + r.cantidad * x.qty; });
    });
  });
  return m;
}

/* ============================= TIPOS DE PRODUCTO: comida, adición, bebida ============================= */
// Los productos viejos no tienen "tipo": si estaban en la pestaña "Adiciones" cuentan como adición y si están en "Gaseosa(s)/Bebida(s)" como bebida.
const tipoDe = (p) => p.tipo || (/^adicion/i.test(sinTildes(p.categoria || "")) ? "adicion" : /^(gaseosa|bebida)/i.test(sinTildes(p.categoria || "")) ? "bebida" : "comida");
function sinTildes(t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim(); }
// Cuántos sabores de bebida como máximo
const MAX_SABORES = 5;

/* ============================= CARRITO GUARDADO (sobrevive a recargar la app) ============================= */
const CARRITO_VIDA_MS = 12 * 60 * 60 * 1000; // un pedido sin terminar se conserva 12 horas
function cargarCarrito() {
  const g = loadKey("skp-cart", null);
  if (!g || !Array.isArray(g.l) || !g.t || Date.now() - g.t > CARRITO_VIDA_MS) return [];
  return g.l.filter((c) => c && typeof c === "object" && c.lid && Number(c.qty) > 0 && (c.productId || c.comboId));
}
// Dos renglones son "el mismo" si tienen mismo producto, mismas adiciones y mismo sabor
const claveLinea = (c) => `${c.productId || ""}|${c.comboId || ""}|${(c.adds || []).map((a) => `${a.productId}x${a.qty}`).sort().join(",")}|${c.sabor || ""}`;
// signo = 1 descuenta del inventario, signo = -1 lo devuelve
const aplicarConsumo = (insumos, consumo, signo) => insumos.map((i) => (rastreaStock(i) && consumo[i.id] ? { ...i, stock: Math.round((Number(i.stock) - signo * consumo[i.id]) * 100) / 100 } : i));

/* ============================= TICKET PARA IMPRESORA DE 58 mm ============================= */
function filasTicket(venta, cfg) {
  const f = [];
  f.push({ c: true, b: true, t: cfg.nombre });
  f.push({ c: true, t: `${fmtDate(venta.fecha)} ${fmtHora(venta.hora)}`.trim() });
  if (venta.num) f.push({ c: true, t: `Pedido #${venta.num}` });
  if (venta.cliente) f.push({ t: `Cliente: ${venta.cliente}` });
  f.push({ sep: true });
  venta.items.forEach((i) => f.push({ l: `${i.qty}x ${i.nombre.replace("Salchipapa ", "")}`, r: cop(i.qty * i.precio) }));
  if (venta.domicilio) {
    f.push({ l: "Domicilio", r: cop(venta.domicilio.costo) });
    f.push({ t: `Dir: ${venta.domicilio.direccion}` });
    if (venta.domicilio.domiciliario) f.push({ t: `Domiciliario: ${venta.domicilio.domiciliario}` });
  }
  f.push({ sep: true });
  f.push({ b: true, l: "TOTAL", r: cop(venta.total) });
  f.push({ t: venta.pago === "fiado" ? "Fiado (pendiente de pago)" : venta.metodoPago === "transferencia" ? "Pago: transferencia" : "Pago: efectivo" });
  if (venta.canalNombre && venta.canalNombre !== "Directo") f.push({ t: `Canal: ${venta.canalNombre}` });
  const pie = cfg.pieTicket ?? "¡Gracias por tu compra!";
  if (pie) { f.push({ sep: true }); f.push({ c: true, t: pie }); }
  return f;
}
const escHtml = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function ticketHTML(venta, cfg) {
  const cuerpo = filasTicket(venta, cfg).map((x) => {
    if (x.sep) return '<div class="sep"></div>';
    if (x.l !== undefined) return `<div class="r${x.b ? " b" : ""}"><span>${escHtml(x.l)}</span><span>${escHtml(x.r)}</span></div>`;
    return `<div class="${x.c ? "c " : ""}${x.b ? "b" : ""}">${escHtml(x.t)}</div>`;
  }).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title><style>@page{size:58mm auto;margin:0}html,body{margin:0;padding:0;background:#fff}body{width:48mm;margin:0 auto;padding:3mm 0 8mm;font:12px/1.35 "Courier New",monospace;color:#000}.c{text-align:center}.b{font-weight:bold}.r{display:flex;justify-content:space-between;gap:6px}.sep{border-top:1px dashed #000;margin:5px 0}</style></head><body>${cuerpo}</body></html>`;
}
// Versión en texto plano de 32 columnas (sirve para apps de impresora Bluetooth que reciben texto)
function ticketTexto(venta, cfg, w = 32) {
  const cortar = (txt) => { const out = []; let r = String(txt); while (r.length > w) { let k = r.lastIndexOf(" ", w); if (k < 8) k = w; out.push(r.slice(0, k)); r = r.slice(k).trimStart(); } out.push(r); return out; };
  const centrar = (txt) => cortar(txt).map((x) => " ".repeat(Math.max(0, Math.floor((w - x.length) / 2))) + x).join("\n");
  return filasTicket(venta, cfg).map((x) => {
    if (x.sep) return "-".repeat(w);
    if (x.l !== undefined) { const r = String(x.r); let l = String(x.l); if (l.length + r.length + 1 > w) l = l.slice(0, Math.max(1, w - r.length - 1)); return l + " ".repeat(w - l.length - r.length) + r; }
    return x.c ? centrar(x.t) : cortar(x.t).join("\n");
  }).join("\n");
}
function imprimirTicket(venta, cfg) {
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(f);
  const doc = f.contentWindow.document;
  doc.open(); doc.write(ticketHTML(venta, cfg)); doc.close();
  setTimeout(() => {
    try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { console.error(e); }
    setTimeout(() => f.remove(), 4000);
  }, 300);
}
async function compartirTicketTexto(venta, cfg) {
  const texto = ticketTexto(venta, cfg);
  try { if (navigator.share) { await navigator.share({ text: texto }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
  try { await navigator.clipboard.writeText(texto); alert("Ticket copiado. Pégalo en tu app de impresora."); } catch { alert(texto); }
}

/* ============================= COPIA EN GOOGLE DRIVE ============================= */
function cargarGIS() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) { resolve(); return; }
    const sc = document.createElement("script");
    sc.src = "https://accounts.google.com/gsi/client"; sc.async = true;
    sc.onload = () => resolve(); sc.onerror = () => reject(new Error("sin conexión"));
    document.head.appendChild(sc);
  });
}
async function driveToken() {
  if (_dtok && _dtok.exp > Date.now() + 60000) return _dtok.t;
  await cargarGIS();
  return new Promise((resolve, reject) => {
    const tc = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (r) => {
        if (r && r.access_token) { _dtok = { t: r.access_token, exp: Date.now() + (Number(r.expires_in) || 3600) * 1000 }; resolve(r.access_token); }
        else reject(new Error((r && r.error) || "sin permiso"));
      },
      error_callback: (e) => reject(new Error((e && e.type) || "cancelado")),
    });
    tc.requestAccessToken({ prompt: "" });
  });
}
async function driveBuscar(token, nombre, masAntiguo) {
  const q = encodeURIComponent(`name='${nombre}' and trashed=false`);
  const orden = masAntiguo ? "createdTime" : "modifiedTime%20desc";
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,name,createdTime,modifiedTime)&orderBy=${orden}&pageSize=1`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`drive ${r.status}`);
  const d = await r.json();
  return (d.files || [])[0] || null;
}
async function driveSubir(token, nombre, contenido) {
  const ex = await driveBuscar(token, nombre);
  const limite = `nc${uid()}${uid()}`;
  const meta = ex ? {} : { name: nombre, mimeType: "application/json", parents: ["appDataFolder"] };
  const cuerpo = `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${limite}\r\nContent-Type: application/json\r\n\r\n${contenido}\r\n--${limite}--`;
  const url = ex ? `https://www.googleapis.com/upload/drive/v3/files/${ex.id}?uploadType=multipart` : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
  const r = await fetch(url, { method: ex ? "PATCH" : "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${limite}` }, body: cuerpo });
  if (!r.ok) throw new Error(`drive ${r.status}`);
}
async function driveBajar(token, nombre) {
  const ex = await driveBuscar(token, nombre);
  if (!ex) return null;
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${ex.id}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`drive ${r.status}`);
  return r.text();
}
// Inicio de la prueba según la hora de GOOGLE (fecha en que se creó el archivo en el Drive del usuario), no la del celular.
// Si el archivo ya existe (reinstalación o datos borrados), devuelve la fecha original: la prueba NO se reinicia.
async function driveInicioPrueba(token) {
  let ex = await driveBuscar(token, DRIVE_PRUEBA, true);
  if (!ex) { await driveSubir(token, DRIVE_PRUEBA, JSON.stringify({ v: 2 })); ex = await driveBuscar(token, DRIVE_PRUEBA, true); }
  const t = ex && ex.createdTime ? Date.parse(ex.createdTime) : NaN;
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}
// Hora real: la cabecera "Date" que responde nuestro propio sitio. Sirve para que atrasar el reloj del celular no alargue la prueba.
async function horaServidor() {
  try {
    const r = await fetch("./sw.js?h=" + Date.now(), { cache: "no-store" });
    const t = Date.parse(r.headers.get("date") || "");
    return Number.isNaN(t) ? null : t;
  } catch { return null; }
}
async function driveLeerJSON(token, nombre) {
  const txt = await driveBajar(token, nombre);
  if (!txt) return null;
  try { return JSON.parse(txt); } catch { return null; }
}

/* ============================= GOOGLE PLAY BILLING (solo en la versión de la tienda) ============================= */
// Usa la API de bienes digitales de Chrome (TWA). Solo funciona cuando la app está instalada desde Google Play.
async function playService() {
  if (!("getDigitalGoodsService" in window)) throw new Error("no-dg");
  return window.getDigitalGoodsService("https://play.google.com/billing");
}
async function playDetalles() {
  const sv = await playService();
  const d = await sv.getDetails([PLAY_SKU]);
  return d && d[0] ? d[0] : null;
}
// Confirma (acknowledge) la suscripción. Si falla no pasa nada grave: se reintenta al abrir la app (Google reembolsa solo si pasan 3 días sin confirmar).
async function playConfirmar(sv, token) {
  try { await sv.acknowledge(token, "subscription"); return true; }
  catch (e) { console.warn("acknowledge pendiente", e); return false; }
}
async function playComprar() {
  const sv = await playService();
  const req = new PaymentRequest([{ supportedMethods: "https://play.google.com/billing", data: { sku: PLAY_SKU } }]);
  const resp = await req.show();
  const token = resp.details && resp.details.purchaseToken;
  if (!token) { await resp.complete("fail"); throw new Error("sin-token"); }
  const confirmado = await playConfirmar(sv, token); // si falla, NO impide activar Premium: se reintenta al abrir la app
  try { await resp.complete("success"); } catch { /* ya está pagado: no se cancela por esto */ }
  return { token, confirmado };
}
async function playComprasActivas() {
  const sv = await playService();
  const l = await sv.listPurchases();
  return (l || []).filter((x) => x.itemId === PLAY_SKU);
}
// Al abrir la app (versión de la tienda) decide qué hacer con Premium según lo que diga Google Play:
//  "activar"    = hay suscripción activa y la app no estaba en Premium (reinstalación, datos borrados, otro celular o compra que no alcanzó a activarse)
//  "quitar"     = estaba en Premium pero ya no hay suscripción (se canceló o venció)
//  "actualizar" = se logró confirmar (acknowledge) una compra que había quedado pendiente
//  "nada"       = todo igual
async function revisarCompras(premiumActual) {
  const l = await playComprasActivas();
  if (!Array.isArray(l)) return { accion: "nada" };
  if (l.length === 0) return { accion: premiumActual && premiumActual.tienda ? "quitar" : "nada" };
  const token = (l[0] && l[0].purchaseToken) || (premiumActual && premiumActual.token) || "";
  let confirmado = !!(premiumActual && premiumActual.confirmado);
  if (!confirmado && token) { const sv = await playService(); confirmado = await playConfirmar(sv, token); }
  if (!premiumActual) return { accion: "activar", token, confirmado };
  return { accion: confirmado !== !!premiumActual.confirmado ? "actualizar" : "nada", token, confirmado };
}

/* ============================= CATÁLOGO PARA CLIENTES (enlace con el menú dentro) ============================= */
const codificarCatalogo = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const decodificarCatalogo = (t) => JSON.parse(decodeURIComponent(escape(atob(t.replace(/-/g, "+").replace(/_/g, "/")))));
const conPais = (tel) => { const d = String(tel || "").replace(/\D/g, ""); return d.length === 10 ? `57${d}` : d; };

/* ============================= FOTOS ADJUNTAS: comprime antes de guardar ============================= */
// Redimensiona y comprime una foto (recibo, comprobante de pago) a un dataURL liviano
// para que no llene el almacenamiento del navegador.
function resizeImageFile(file, maxDim = 1100, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("No se pudo procesar la imagen"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
          else { width = Math.round(width * (maxDim / height)); height = maxDim; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width || 1; canvas.height = height || 1;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ============================= DATOS DEL NEGOCIO (nombre y mensajes editables) ============================= */
const DEFAULT_CONFIG = {
  nombre: "Negocio Comida",
  msgPago: "Puedes pagar por transferencia escaneando el QR o al número:",
  msgFiado: "Te recuerdo que tienes un saldo pendiente. ¡Gracias por pagar pronto!",
  diasFiado: 7,
  pieTicket: "¡Gracias por tu compra!",
  telefonoPedidos: "",
};
const ConfigCtx = React.createContext({ cfg: DEFAULT_CONFIG, qrPago: { telefono: "", foto: null }, esPremium: false, gate: (f, fn) => fn, abrirPremium: () => {}, canales: CANALES_BASE, setCanales: () => {}, esPremiumPago: false, enPrueba: false, diasPrueba: 0 });
const useCfg = () => React.useContext(ConfigCtx);

/* ============================= FIADO: solo lo que SÍ se debe ahora ============================= */
// Los pedidos fiados quedan guardados en Ventas para siempre (para los informes), pero en la ficha
// del cliente solo deben verse los que componen su deuda actual. Se asume que los abonos pagan
// primero lo más antiguo, así que lo pendiente son los pedidos más recientes hasta cubrir el saldo.
function pedidosPendientesDe(ventas, cliente) {
  const nombre = String(cliente.nombre || "").toLowerCase();
  const todos = (ventas || []).filter((v) => v.pago === "fiado" && v.cliente && v.cliente.toLowerCase() === nombre)
    .sort((a, b) => (a.fecha + (a.hora || "")) < (b.fecha + (b.hora || "")) ? 1 : -1);
  const out = [];
  let acum = 0;
  for (const v of todos) {
    if (acum >= cliente.monto) break;
    out.push(v);
    acum += v.total;
  }
  return out;
}
// Abonos del ciclo actual: los que vinieron después del último "Pago total" de ese cliente.
function abonosActualesDe(ledger, cliente) {
  const k = (l) => (l.fecha || "") + (l.hora || "");
  const mios = (ledger || []).filter((l) => l.concepto === `Abono fiado — ${cliente.nombre}` || l.concepto === `Pago total fiado — ${cliente.nombre}`);
  const ultimoTotal = mios.filter((l) => l.concepto.startsWith("Pago total")).map(k).sort().pop();
  return mios.filter((l) => !ultimoTotal || k(l) > ultimoTotal).sort((a, b) => (k(a) < k(b) ? 1 : -1));
}

/* ============================= WHATSAPP: mensaje de cobro a un cliente fiado ============================= */
function mensajeFiado(cliente, pedidos, cfg = DEFAULT_CONFIG, qrPago = {}) {
  const lineas = pedidos.length
    ? pedidos.map((v) => `• ${v.items.map((i) => `${i.qty}x ${i.nombre.replace("Salchipapa ", "")}`).join(", ")} — ${cop(v.total)} (${fmtDate(v.fecha)})`).join("\n")
    : "";
  const recordatorio = (cfg.msgFiado || "").trim();
  const pagar = qrPago.telefono ? `\n\n${(cfg.msgPago || "Número para pagar:").trim()} *${qrPago.telefono}*` : "";
  return `Hola ${cliente.nombre} 👋 Te escribo de ${cfg.nombre}.\nTienes un saldo pendiente de *${cop(cliente.monto)}*.${lineas ? `\n\nTu pedido fiado:\n${lineas}` : ""}${recordatorio ? `\n\n${recordatorio}` : ""}${pagar}`;
}
function whatsappUrl(cliente, pedidos, cfg, qrPago) {
  const texto = encodeURIComponent(mensajeFiado(cliente, pedidos, cfg, qrPago));
  const tel = (cliente.telefono || "").replace(/\D/g, "");
  return tel ? `https://wa.me/${tel}?text=${texto}` : `https://wa.me/?text=${texto}`;
}

/* ============================= DATOS DE EJEMPLO (solo se usan en el modo demo ?demo=1; la app real arranca vacía) ============================= */
/* ============================= SEED: estructura de costos (% agregables/editables/eliminables) ============================= */
const DEMO_PCT_ITEMS = [
  { id: "fijos", label: "Fijos (arriendo + moto + gas)", valor: 10 },
  { id: "manoObra", label: "Mano de obra", valor: 25 },
  { id: "operativos", label: "Operativos", valor: 2 },
  { id: "impuestos", label: "Impuestos", valor: 4 },
  { id: "marketing", label: "Marketing", valor: 3 },
  { id: "merma", label: "Merma", valor: 2 },
];

/* ============================= SEED: Insumos (de tu Excel, editables) ============================= */
const DEMO_INSUMOS = [
  { id: "aceite", nombre: "Aceite", unidad: "ml", unidadCompra: "ml", cantidadCompra: 3000, valorCompra: 21000, costoUnitario: 7 },
  { id: "ricostilla", nombre: "Ricostilla", unidad: "un", unidadCompra: "sobres", cantidadCompra: 10, valorCompra: 4600, costoUnitario: 460 },
  { id: "toallaCocina", nombre: "Toalla de cocina", unidad: "un", unidadCompra: "hojas", cantidadCompra: 240, valorCompra: 6800, costoUnitario: 28.33 },
  { id: "papa", nombre: "Papa", unidad: "g", unidadCompra: "libras", cantidadCompra: 25, valorCompra: 29000, costoUnitario: 2.5573 },
  { id: "salchicha", nombre: "Salchicha", unidad: "g", unidadCompra: "g", cantidadCompra: 1500, valorCompra: 10500, costoUnitario: 7 },
  { id: "quesoCosteno", nombre: "Queso costeño", unidad: "g", unidadCompra: "g", cantidadCompra: 1000, valorCompra: 28000, costoUnitario: 28 },
  { id: "ripio", nombre: "Ripio de papa", unidad: "g", unidadCompra: "g", cantidadCompra: 1000, valorCompra: 10000, costoUnitario: 10 },
  { id: "butifarra", nombre: "Butifarra", unidad: "un", unidadCompra: "un", cantidadCompra: 66, valorCompra: 21500, costoUnitario: 325.76 },
  { id: "chorizo", nombre: "Chorizo", unidad: "un", unidadCompra: "un", cantidadCompra: 10, valorCompra: 16700, costoUnitario: 1670 },
  { id: "carne", nombre: "Carne", unidad: "g", unidadCompra: "g", cantidadCompra: 1200, valorCompra: 40000, costoUnitario: 33.33 },
  { id: "pollo", nombre: "Pollo", unidad: "g", unidadCompra: "g", cantidadCompra: 1000, valorCompra: 13000, costoUnitario: 13 },
  { id: "empaqueJ1", nombre: "Empaque J1", unidad: "un", unidadCompra: "un", cantidadCompra: 200, valorCompra: 58000, costoUnitario: 290 },
  { id: "bolsaJ1", nombre: "Bolsa J1", unidad: "un", unidadCompra: "un", cantidadCompra: 200, valorCompra: 10000, costoUnitario: 50 },
  { id: "antigrasa", nombre: "Papel antigrasa", unidad: "un", unidadCompra: "un", cantidadCompra: 100, valorCompra: 8500, costoUnitario: 85 },
  { id: "empaqueP1", nombre: "Empaque P1", unidad: "un", unidadCompra: "un", cantidadCompra: 200, valorCompra: 79000, costoUnitario: 395 },
  { id: "bolsaP1", nombre: "Bolsa P1", unidad: "un", unidadCompra: "un", cantidadCompra: 200, valorCompra: 13000, costoUnitario: 65 },
  { id: "salsaTomate", nombre: "Salsa de tomate", unidad: "g", unidadCompra: "g", cantidadCompra: 1000, valorCompra: 5500, costoUnitario: 5.5 },
  { id: "salsaMayonesa", nombre: "Mayonesa", unidad: "g", unidadCompra: "g", cantidadCompra: 1000, valorCompra: 7700, costoUnitario: 7.7 },
  { id: "ajo", nombre: "Ajo", unidad: "paquete", unidadCompra: "paquete", cantidadCompra: 27, valorCompra: 1500, costoUnitario: 55.56 },
  { id: "salsaPina", nombre: "Salsa de piña", unidad: "g", unidadCompra: "g", cantidadCompra: 1000, valorCompra: 6900, costoUnitario: 6.9 },
  { id: "vinagre", nombre: "Vinagre", unidad: "ml", unidadCompra: "ml", cantidadCompra: 3000, valorCompra: 7400, costoUnitario: 2.47 },
  { id: "azucar", nombre: "Azúcar", unidad: "g", unidadCompra: "g", cantidadCompra: 1000, valorCompra: 2100, costoUnitario: 2.1 },
  { id: "salsaCarne", nombre: "Salsa de carne", unidad: "g", unidadCompra: "g", cantidadCompra: 185, valorCompra: 7300, costoUnitario: 39.46 },
  { id: "mostaza", nombre: "Mostaza", unidad: "g", unidadCompra: "g", cantidadCompra: 80, valorCompra: 1950, costoUnitario: 24.38 },
  { id: "leche", nombre: "Leche", unidad: "g", unidadCompra: "g", cantidadCompra: 900, valorCompra: 3600, costoUnitario: 4 },
  { id: "sal", nombre: "Sal", unidad: "g", unidadCompra: "g", cantidadCompra: 1000, valorCompra: 2650, costoUnitario: 2.65 },
  { id: "gas", nombre: "Gas (referencia)", unidad: "g", unidadCompra: "g", cantidadCompra: 20000, valorCompra: 115000, costoUnitario: 5.75 },
];

// Mezcla de salsa compartida entre las 3 recetas (de tu Excel)
const SALSA_MIX = [
  { insumoId: "salsaTomate", cantidad: 15 },
  { insumoId: "salsaMayonesa", cantidad: 15 },
  { insumoId: "ajo", cantidad: 0.05 },
  { insumoId: "salsaPina", cantidad: 10 },
  { insumoId: "vinagre", cantidad: 10 },
  { insumoId: "azucar", cantidad: 3 },
  { insumoId: "salsaCarne", cantidad: 5 },
  { insumoId: "mostaza", cantidad: 5 },
  { insumoId: "leche", cantidad: 5 },
  { insumoId: "sal", cantidad: 2 },
];

/* ============================= SEED: Productos y sus recetas ============================= */
const DEMO_PRODUCTS = [
  {
    id: "sencilla", nombre: "Salchipapa Sencilla", emoji: "🌭", foto: "./images/salchipapa.png", precio: 16000, categoria: "Salchipapas",
    receta: [
      { insumoId: "papa", cantidad: 600 },
      { insumoId: "salchicha", cantidad: 90 },
      { insumoId: "ripio", cantidad: 30 },
      { insumoId: "quesoCosteno", cantidad: 80 },
      { insumoId: "butifarra", cantidad: 1 },
      { insumoId: "empaqueJ1", cantidad: 1 },
      { insumoId: "bolsaJ1", cantidad: 1 },
      { insumoId: "antigrasa", cantidad: 1 },
      ...SALSA_MIX,
    ],
  },
  {
    id: "tradicional", nombre: "Salchipapa Tradicional", emoji: "🍔", foto: "./images/patacon.png", precio: 22000, categoria: "Salchipapas",
    receta: [
      { insumoId: "papa", cantidad: 750 },
      { insumoId: "salchicha", cantidad: 90 },
      { insumoId: "butifarra", cantidad: 2 },
      { insumoId: "chorizo", cantidad: 1 },
      { insumoId: "ripio", cantidad: 30 },
      { insumoId: "quesoCosteno", cantidad: 80 },
      { insumoId: "empaqueJ1", cantidad: 1 },
      { insumoId: "bolsaJ1", cantidad: 1 },
      { insumoId: "antigrasa", cantidad: 1 },
      ...SALSA_MIX,
    ],
  },
  {
    id: "especial", nombre: "Salchipapa Especial", emoji: "🍖", foto: "./images/empanada.png", precio: 28000, categoria: "Salchipapas",
    receta: [
      { insumoId: "papa", cantidad: 900 },
      { insumoId: "salchicha", cantidad: 90 },
      { insumoId: "butifarra", cantidad: 2 },
      { insumoId: "chorizo", cantidad: 1 },
      { insumoId: "ripio", cantidad: 30 },
      { insumoId: "quesoCosteno", cantidad: 80 },
      { insumoId: "carne", cantidad: 20 },
      { insumoId: "pollo", cantidad: 60 },
      { insumoId: "empaqueJ1", cantidad: 1 },
      { insumoId: "bolsaJ1", cantidad: 1 },
      { insumoId: "antigrasa", cantidad: 1 },
      ...SALSA_MIX,
    ],
  },
];

const SEED_LEDGER = [];

const SEED_FIADO = [];

/* ============================= HELPERS DE COSTOS ============================= */
const UNIT_FACTORS = { g: 1, kg: 1000, libras: 453.6, lb: 453.6, ml: 1, litros: 1000, l: 1000, un: 1, paquete: 1 };
const UNIT_FAMILY = { g: "peso", kg: "peso", libras: "peso", lb: "peso", ml: "vol", litros: "vol", l: "vol" };
function calcCostoUnitario(valorCompra, cantidadCompra, unidadCompra, unidadReceta) {
  const v = Number(valorCompra) || 0;
  const c = Number(cantidadCompra) || 0;
  if (!c) return 0;
  const famCompra = UNIT_FAMILY[(unidadCompra || "").toLowerCase()] || "cant";
  const famReceta = UNIT_FAMILY[(unidadReceta || "").toLowerCase()] || "cant";
  let cantidadEnUnidadReceta;
  if (famCompra === famReceta && famCompra !== "cant") {
    const factorCompra = UNIT_FACTORS[(unidadCompra || "").toLowerCase()] || 1;
    const factorReceta = UNIT_FACTORS[(unidadReceta || "").toLowerCase()] || 1;
    cantidadEnUnidadReceta = c * (factorCompra / factorReceta);
  } else {
    cantidadEnUnidadReceta = c;
  }
  return cantidadEnUnidadReceta ? v / cantidadEnUnidadReceta : 0;
}
function insumosMapFrom(insumos) {
  const m = {};
  insumos.forEach((i) => (m[i.id] = i));
  return m;
}
function costoReceta(product, insumosMap) {
  return (product.receta || []).reduce((s, r) => s + r.cantidad * (insumosMap[r.insumoId]?.costoUnitario || 0), 0);
}
// pctItems: [{id,label,valor}] — estructura de costos totalmente editable (agregar/quitar categorías)
function structureFor(product, insumosMap, pctItems) {
  const precio = product.precio;
  const insumosCost = costoReceta(product, insumosMap);
  const items = pctItems.map((pi) => ({ id: pi.id, label: pi.label, monto: precio * ((Number(pi.valor) || 0) / 100) }));
  const totalPct = items.reduce((s, i) => s + i.monto, 0);
  const utilidad = precio - insumosCost - totalPct;
  return { insumos: insumosCost, items, utilidad, precio };
}

/* ============================= STORAGE (localStorage: funciona sin conexión) ============================= */
function loadKey(key, seed) {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + key);
    return raw ? JSON.parse(raw) : seed;
  } catch {
    return seed;
  }
}
function saveKey(key, value) {
  try { localStorage.setItem(KEY_PREFIX + key, JSON.stringify(value)); return true; } catch (e) { console.error("storage error", e); return false; }
}

/* ============================= APP ============================= */
export default function App() {
  const [products, setProducts] = useState(() => loadKey("skp-products", []));
  const [insumos, setInsumos] = useState(() => loadKey("skp-insumos", []));
  const [pctItems, setPctItems] = useState(() => loadKey("skp-pct-items", []));
  const [ledger, setLedger] = useState(() => loadKey("skp-ledger", SEED_LEDGER));
  const [fiado, setFiado] = useState(() => loadKey("skp-fiado", SEED_FIADO));
  const [ventas, setVentas] = useState(() => loadKey("skp-ventas", []));
  const [trash, setTrash] = useState(() => loadKey("skp-trash", []));
  const [categorias, setCategorias] = useState(() => loadKey("skp-categorias", null) || [...new Set(loadKey("skp-products", []).map((p) => p.categoria || "Salchipapas"))]);
  const [newCat, setNewCat] = useState(null);
  const [newTipo, setNewTipo] = useState(null); // tipo con el que se abre "Nuevo producto" (adicion | bebida) desde Adiciones y sabores
  const [lastBackup, setLastBackup] = useState(() => loadKey("skp-last-backup", null));
  const [tab, setTab] = useState("catalogo");
  const [cart, setCart] = useState(() => cargarCarrito());
  const [cartOpen, setCartOpen] = useState(false);
  // Combos y sabores de bebida: el dueño los agrega, edita y elimina desde la app
  const [combos, setCombos] = useState(() => loadKey("skp-combos", []));
  const [sabores, setSabores] = useState(() => loadKey("skp-sabores", []));
  const [opcionesModal, setOpcionesModal] = useState(null); // { productId } → "¿Lleva adición?"
  const [saborModal, setSaborModal] = useState(null);       // { productId | comboId, adds } → elegir sabor
  const [complementosModal, setComplementosModal] = useState(false);
  const [comboModal, setComboModal] = useState(null);       // "new" | combo
  const [sugerenciaBebida, setSugerenciaBebida] = useState(false);
  const [hayVersionNueva, setHayVersionNueva] = useState(false);
  // El pedido en curso se guarda en el teléfono cada vez que cambia
  useEffect(() => { saveKey("skp-cart", { t: Date.now(), l: cart }); }, [cart]);
  // Aviso cuando se descargó una versión nueva de la app
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const habiaControlador = !!navigator.serviceWorker.controller;
    const f = () => { if (habiaControlador) setHayVersionNueva(true); };
    navigator.serviceWorker.addEventListener("controllerchange", f);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", f);
  }, []);
  const [productModal, setProductModal] = useState(null);
  const [recetaModal, setRecetaModal] = useState(null);
  const [insumoModal, setInsumoModal] = useState(null);
  const [movModal, setMovModal] = useState(null); // { tipo: "ingreso" | "gasto" } | null
  const [ledgerEdit, setLedgerEdit] = useState(null);
  const [abonoEdit, setAbonoEdit] = useState(null);
  const [ventaEdit, setVentaEdit] = useState(null);
  const [ventaResumen, setVentaResumen] = useState(null);
  const [clienteModal, setClienteModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [qrPago, setQrPago] = useState(() => loadKey("skp-qr-pago", { telefono: "", foto: null }));
  const [cfg, setCfg] = useState(() => ({ ...DEFAULT_CONFIG, ...loadKey("skp-config", {}) }));
  const [nombreModal, setNombreModal] = useState(false);
  const [premium, setPremium] = useState(() => { const p = loadKey("skp-premium", null); return p && p.tienda ? p : null; });
  const [premiumModal, setPremiumModal] = useState(null); // null = cerrado, string = motivo
  const [canales, setCanales] = useState(() => mezclarCanales(loadKey("skp-canales", null)));
  const [cierres, setCierres] = useState(() => loadKey("skp-cierres", []));
  const [cierreModal, setCierreModal] = useState(false);
  const [avisoPruebaVisible, setAvisoPruebaVisible] = useState(true);
  useEffect(() => { const t = setTimeout(() => setAvisoPruebaVisible(false), 3000); return () => clearTimeout(t); }, []);
  const [lastDrive, setLastDrive] = useState(() => loadKey("skp-last-drive", null));
  const [rating, setRating] = useState(() => loadKey("skp-rating", {}));
  const [prueba, setPrueba] = useState(() => cargarPrueba());
  // Consentimiento: dos casillas (términos y privacidad) con fecha y versión. No se pide en el modo demo (?demo=1).
  const [consent, setConsent] = useState(() => loadKey("skp-consent", null));
  const necesitaConsent = !KEY_PREFIX && !consentVigente(consent);
  const aceptarConsent = () => { const f = fechaHoraLocalISO(new Date()); const c = { tc: { version: TC_VERSION, fecha: f }, privacidad: { version: PP_VERSION, fecha: f } }; saveKey("skp-consent", c); setConsent(c); };
  const [ahora, setAhora] = useState(() => Date.now());
  const esPremiumPago = !!premium;
  const pruebaActivada = !!(prueba && prueba.inicio);
  const diasPrueba = diasDePrueba(prueba, ahora);
  const enPrueba = !esPremiumPago && diasPrueba > 0;
  const esPremium = esPremiumPago || enPrueba; // durante la prueba gratis todo Premium está abierto
  const abrirPremium = (motivo) => setPremiumModal(motivo || "");
  // Envuelve una acción: si no es Premium abre la ventana de Premium en vez de ejecutarla
  const gate = (motivo, fn) => (...args) => { if (esPremium) return fn(...args); abrirPremium(motivo); return undefined; };
  const activarPremiumTienda = (token, confirmado) => { const pr = { tienda: true, sku: PLAY_SKU, token, activadoEn: new Date().toISOString(), confirmado: !!confirmado }; setPremium(pr); saveKey("skp-premium", pr); setPremiumModal(null); showToast("¡Premium activado! 👑"); };
  // Activar la prueba: inicia sesión con Google y guarda/recupera la fecha de inicio en la carpeta oculta del Drive del usuario.
  const activarPrueba = async () => {
    if (pruebaActivada) { if (diasPrueba === 0) abrirPremium(""); return; }
    try {
      let inicio = new Date().toISOString();
      if (GOOGLE_CLIENT_ID) {
        if (!navigator.onLine) throw new Error("offline");
        const token = await driveToken();
        // La fecha de inicio la pone GOOGLE al crear el archivo (no el celular): cambiar la hora del celular no sirve.
        // Si ya existía (reinstalación o datos borrados), la prueba sigue desde su fecha original.
        inicio = (await driveInicioPrueba(token)) || inicio;
      }
      const servidor = await horaServidor();
      const p = { inicio, visto: servidor || Date.now() };
      saveKey("skp-prueba", p); setPrueba(p);
      const n = diasDePrueba(p, Date.now());
      if (n > 0) { setPremiumModal(null); showToast(`¡Prueba activada! Te quedan ${n} día${n === 1 ? "" : "s"} de Premium`); }
      else showToast(`Tu prueba de ${DIAS_PRUEBA} días ya se usó con esta cuenta de Google`);
    } catch (e) {
      const m = String((e && e.message) || "");
      showToast(m === "offline" || m === "sin conexión" ? "Necesitas internet para activar tu prueba." : "No se completó el inicio de sesión con Google. Intenta de nuevo.");
    }
  };
  const fileInputRef = useRef(null);

  useEffect(() => {
    const onBeforeInstall = (e) => { e.preventDefault(); setInstallPrompt(e); };
    const onInstalled = () => { setInstallPrompt(null); showToast("¡App instalada en tu celular! 🎉"); };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  // La papelera guarda cada eliminación por 30 días; pasado ese tiempo se borra sola.
  useEffect(() => {
    const limite = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const vigente = trash.filter((t) => new Date(t.deletedAt).getTime() > limite);
    if (vigente.length !== trash.length) saveKey("skp-trash", vigente) && setTrash(vigente);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = {
    products: (v) => { setProducts(v); saveKey("skp-products", v); },
    insumos: (v) => { setInsumos(v); saveKey("skp-insumos", v); },
    pctItems: (v) => { setPctItems(v); saveKey("skp-pct-items", v); },
    ledger: (v) => { setLedger(v); if (!saveKey("skp-ledger", v)) showToast("No se pudo guardar (memoria llena). Elimina fotos viejas o usa una más liviana."); },
    fiado: (v) => { setFiado(v); saveKey("skp-fiado", v); },
    ventas: (v) => { setVentas(v); saveKey("skp-ventas", v); },
    trash: (v) => { setTrash(v); saveKey("skp-trash", v); },
    categorias: (v) => { setCategorias(v); saveKey("skp-categorias", v); },
    qrPago: (v) => { setQrPago(v); saveKey("skp-qr-pago", v); },
    cfg: (v) => { setCfg(v); saveKey("skp-config", v); },
    canales: (v) => { setCanales(v); saveKey("skp-canales", v); },
    cierres: (v) => { setCierres(v); saveKey("skp-cierres", v); },
    combos: (v) => { setCombos(v); saveKey("skp-combos", v); },
    sabores: (v) => { setSabores(v); saveKey("skp-sabores", v); },
  };
  const showToast = (msg, opts) => {
    setToast({ msg, actionLabel: opts?.actionLabel, onAction: opts?.onAction });
    setTimeout(() => setToast(null), opts ? 6000 : 2200);
  };
  const insumosMap = useMemo(() => insumosMapFrom(insumos), [insumos]);
  const calificar = () => { const r = { ...rating, calificado: true }; setRating(r); saveKey("skp-rating", r); window.open(urlPlay, "_blank"); };
  const despuesCalificar = () => { const r = { ...rating, hasta: Date.now() + 7 * MS_DIA }; setRating(r); saveKey("skp-rating", r); };
  const nuncaCalificar = () => { const r = { ...rating, nunca: true }; setRating(r); saveKey("skp-rating", r); };
  useEffect(() => { document.title = cfg.nombre || "Negocio Comida"; }, [cfg.nombre]);
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 60000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (pruebaActivada && !esPremiumPago && diasPrueba === 0 && !loadKey("skp-trial-aviso", false)) {
      saveKey("skp-trial-aviso", true);
      showToast("Terminó tu prueba gratis de 4 días", {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esPremiumPago, diasPrueba, pruebaActivada]);
  // Si atrasan el reloj del celular no ganan días de prueba: se recuerda la última hora vista (se actualiza cada 10 minutos).
  useEffect(() => {
    if (prueba && prueba.inicio && ahora > (prueba.visto || 0) + 600000) { const p = { ...prueba, visto: ahora }; saveKey("skp-prueba", p); setPrueba(p); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ahora]);
  // Con internet, se compara con la hora real del servidor: así atrasar el reloj del celular no alarga la prueba.
  useEffect(() => {
    let vivo = true;
    const sync = () => {
      if (!navigator.onLine) return;
      horaServidor().then((t) => {
        if (!vivo || !t) return;
        setPrueba((p) => { if (!p || !p.inicio || t <= (p.visto || 0)) return p; const n = { ...p, visto: t }; saveKey("skp-prueba", n); return n; });
      });
    };
    sync();
    const id = setInterval(sync, 3600000);
    return () => { vivo = false; clearInterval(id); };
  }, []);
  // En la versión de la tienda, al abrir la app se revisa Google Play: restaura Premium si ya pagó, lo quita si se canceló
  // y reintenta confirmar (acknowledge) una compra que haya quedado pendiente.
  useEffect(() => {
    if (!esModoTienda) return;
    revisarCompras(premium).then((r) => {
      if (r.accion === "quitar") { setPremium(null); try { localStorage.removeItem(KEY_PREFIX + "skp-premium"); } catch {} }
      else if (r.accion === "activar") { const pr = { tienda: true, sku: PLAY_SKU, token: r.token, activadoEn: new Date().toISOString(), confirmado: r.confirmado }; setPremium(pr); saveKey("skp-premium", pr); showToast("Premium restaurado 👑"); }
      else if (r.accion === "actualizar" && premium) { const pr = { ...premium, confirmado: r.confirmado }; setPremium(pr); saveKey("skp-premium", pr); }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Deshacer / Papelera: cada eliminación queda guardada 30 días por si te equivocas ---------- */
  const withUndo = (label, keys, accion) => {
    const antes = { products, insumos, pctItems, ledger, fiado, ventas, categorias, cierres, combos, sabores };
    const snapshot = {}; keys.forEach((k) => { snapshot[k] = antes[k]; });
    accion();
    const id = uid();
    persist.trash([{ id, label, keys, snapshot, deletedAt: new Date().toISOString() }, ...trash].slice(0, 40));
    showToast(label, { actionLabel: "Deshacer", onAction: () => deshacer(id) });
  };
  const trashRef = useRef(trash);
  trashRef.current = trash;
  const deshacer = (id) => {
    const entry = trashRef.current.find((t) => t.id === id);
    if (!entry) return;
    entry.keys.forEach((k) => persist[k](entry.snapshot[k]));
    persist.trash(trashRef.current.filter((t) => t.id !== id));
    showToast("Restaurado ✅");
  };
  const vaciarPapelera = () => { persist.trash([]); showToast("Papelera vaciada"); };

  /* ---------- Copia de seguridad ---------- */
  const marcarRespaldoHecho = () => { const now = new Date().toISOString(); setLastBackup(now); saveKey("skp-last-backup", now); };
  const armarBackup = () => ({ products, insumos, pctItems, ledger, fiado, ventas, categorias, cfg, qrPago, canales, cierres, combos, sabores, exportedAt: new Date().toISOString() });
  const exportarBackupLibre = () => {
    const data = armarBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `negocio-comida-backup-${todayISO()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    marcarRespaldoHecho();
    showToast("Copia de seguridad descargada");
  };
  // Respaldo con un toque: si el celular lo permite, abre el menú para enviar el archivo
  // directo por WhatsApp, Drive, correo, etc. Si no, cae en la descarga normal de arriba.
  const respaldarAhoraLibre = async () => {
    const data = armarBackup();
    const filename = `negocio-comida-backup-${todayISO()}.json`;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    let file = null;
    try { file = new File([blob], filename, { type: "application/json" }); } catch { file = null; }
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `Respaldo ${cfg.nombre}` });
        marcarRespaldoHecho();
        showToast("Respaldo enviado ✅");
      } catch (e) { /* el usuario canceló el envío, no pasa nada */ }
      return;
    }
    exportarBackupLibre();
  };
  const exportarBackup = gate("Copia de seguridad", exportarBackupLibre);
  const respaldarAhora = gate("Copia de seguridad", respaldarAhoraLibre);
  // Restaurar: primero se VALIDA el archivo, luego se muestra qué trae y qué se va a reemplazar, y solo si el usuario confirma se aplica.
  const aplicarBackup = (data) => {
    const v = validarBackup(data);
    if (!v.ok) { showToast(v.error); return false; }
    const ahora = `${products.length} productos, ${ventas.length} ventas, ${fiado.length} fiados`;
    if (!window.confirm(`Esta copia trae: ${v.resumen}.\n\nAhora en este celular tienes: ${ahora}.\n\nAl restaurar se REEMPLAZAN esos datos. ¿Continuar?`)) return false;
    if (Array.isArray(data.products)) persist.products(data.products);
    if (Array.isArray(data.categorias)) persist.categorias(data.categorias);
    if (Array.isArray(data.insumos)) persist.insumos(data.insumos);
    if (Array.isArray(data.pctItems)) persist.pctItems(data.pctItems);
    if (Array.isArray(data.ledger)) persist.ledger(data.ledger);
    if (Array.isArray(data.fiado)) persist.fiado(data.fiado);
    if (Array.isArray(data.ventas)) persist.ventas(data.ventas);
    if (Array.isArray(data.cierres)) persist.cierres(data.cierres);
    if (Array.isArray(data.canales)) persist.canales(mezclarCanales(data.canales));
    if (Array.isArray(data.combos)) persist.combos(data.combos);
    if (Array.isArray(data.sabores)) persist.sabores(data.sabores);
    if (data.cfg && typeof data.cfg === "object") persist.cfg({ ...DEFAULT_CONFIG, ...data.cfg });
    if (data.qrPago && typeof data.qrPago === "object") persist.qrPago(data.qrPago);
    showToast("Copia de seguridad restaurada ✅");
    return true;
  };
  const restaurarBackup = (file) => {
    if (!file) return;
    if (file.size > MAX_BYTES_BACKUP) { showToast("Ese archivo es demasiado grande para ser una copia de seguridad"); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try { aplicarBackup(JSON.parse(e.target.result)); }
      catch { showToast("Ese archivo no es una copia de seguridad válida"); }
    };
    reader.readAsText(file);
  };
  // Google Drive: si ya configuraste GOOGLE_CLIENT_ID sube el archivo directo; si no, abre el menú de compartir para elegir Drive.
  const respaldarDriveLibre = async () => {
    if (!GOOGLE_CLIENT_ID) { showToast("Elige Google Drive en el menú"); await respaldarAhoraLibre(); return; }
    try {
      showToast("Conectando con Google Drive…");
      const token = await driveToken();
      await driveSubir(token, DRIVE_ARCHIVO, JSON.stringify(armarBackup()));
      const now = new Date().toISOString();
      setLastDrive(now); saveKey("skp-last-drive", now); marcarRespaldoHecho();
      showToast("Copia guardada en Google Drive ☁️");
    } catch (e) { console.error(e); showToast("No se pudo guardar en Drive. Revisa tu internet."); }
  };
  const restaurarDriveLibre = async () => {
    if (!GOOGLE_CLIENT_ID) { showToast("Usa «Restaurar» y elige el archivo desde tu Drive"); fileInputRef.current?.click(); return; }
    try {
      const token = await driveToken();
      const txt = await driveBajar(token, DRIVE_ARCHIVO);
      if (!txt) { showToast("No encontré ninguna copia en tu Drive"); return; }
      aplicarBackup(JSON.parse(txt));
    } catch (e) { console.error(e); showToast("No se pudo leer la copia de Drive"); }
  };
  const respaldarDrive = gate("Copia en Google Drive", respaldarDriveLibre);
  const restaurarDrive = gate("Copia en Google Drive", restaurarDriveLibre);

  /* ---------- Carrito ---------- */
  // Cada renglón del carrito = un producto (o combo) + sus adiciones + su sabor. Dos renglones iguales se juntan.
  const cartLines = cart.map((c) => {
    if (c.comboId) {
      const combo = combos.find((x) => x.id === c.comboId);
      if (!combo) return null;
      const prod = { id: `combo:${combo.id}`, nombre: combo.nombre, emoji: combo.emoji || "🎁", foto: "", precio: combo.precio };
      return { ...c, prod, adds: [], base: combo.nombre, nombre: combo.nombre + (c.sabor ? ` (${c.sabor})` : ""), unit: combo.precio, comp: combo.items || [] };
    }
    const prod = products.find((p) => p.id === c.productId);
    if (!prod) return null;
    const adds = (c.adds || []).map((a) => { const ap = products.find((p) => p.id === a.productId); return ap ? { productId: ap.id, nombre: ap.nombre, precio: ap.precio, qty: a.qty } : null; }).filter(Boolean);
    const extras = adds.reduce((s, a) => s + a.precio * a.qty, 0);
    const textoAdds = adds.map((a) => ` + ${a.qty > 1 ? `${a.qty}x ` : ""}${a.nombre}`).join("");
    return { ...c, prod, adds, base: prod.nombre, nombre: prod.nombre + (c.sabor ? ` · ${c.sabor}` : "") + textoAdds, unit: prod.precio + extras };
  }).filter(Boolean);
  const cartTotal = cartLines.reduce((s, l) => s + l.unit * l.qty, 0);
  const cartCount = cartLines.reduce((s, l) => s + l.qty, 0);
  // Cuántas unidades de ese producto hay en el pedido (sin contar combos)
  const qtyInCart = (productId) => cartLines.filter((l) => !l.comboId && l.productId === productId).reduce((s, l) => s + l.qty, 0);
  // Agrega un renglón (suma 1 si ya existe uno igual)
  const agregarLinea = ({ productId, comboId, adds = [], sabor = "" }) => {
    const nueva = { productId: comboId ? undefined : productId, comboId, adds: adds.filter((a) => a.qty > 0), sabor };
    setCart((prev) => {
      const k = claveLinea(nueva);
      const found = prev.find((c) => claveLinea(c) === k);
      if (found) return prev.map((c) => c === found ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...nueva, lid: uid(), qty: 1 }];
    });
  };
  const changeQtyLinea = (lid, delta) => {
    setCart((prev) => prev.map((c) => c.lid === lid ? { ...c, qty: c.qty + delta } : c).filter((c) => c.qty > 0));
  };
  // ¿Este producto necesita preguntar algo al agregarlo? (adiciones para comidas, sabor para bebidas)
  const hayAdiciones = products.some((p) => tipoDe(p) === "adicion");
  const necesitaOpciones = (p) => (tipoDe(p) === "comida" && !p.sinAdiciones && hayAdiciones) || (tipoDe(p) === "bebida" && sabores.some((s) => !s.agotado));
  // Toque en "Agregar" de un producto: pregunta adiciones/sabor si hace falta; si no, lo agrega directo
  const tocarAgregar = (p) => {
    if (tipoDe(p) === "comida" && !p.sinAdiciones && hayAdiciones) { setOpcionesModal({ productId: p.id }); return; }
    if (tipoDe(p) === "bebida" && sabores.some((s) => !s.agotado)) { setSaborModal({ productId: p.id, adds: [] }); return; }
    agregarLinea({ productId: p.id });
    if (tipoDe(p) === "comida") setSugerenciaBebida(true);
  };
  // El botón +/− de las tarjetas sin opciones mueve el renglón simple (sin adiciones ni sabor)
  const changeQtyProducto = (productId, delta) => {
    const simple = cart.find((c) => c.productId === productId && !c.comboId && !(c.adds || []).length && !c.sabor);
    if (simple) changeQtyLinea(simple.lid, delta);
    else if (delta > 0) agregarLinea({ productId });
  };
  const tocarCombo = (combo) => {
    const llevaBebida = (combo.items || []).some((i) => { const p = products.find((x) => x.id === i.productId); return p && tipoDe(p) === "bebida"; });
    if (llevaBebida && sabores.some((s) => !s.agotado)) { setSaborModal({ comboId: combo.id }); return; }
    agregarLinea({ comboId: combo.id });
  };
  // Cuando el pedido ya tiene comida pero ninguna bebida, se sugiere una (solo si hay bebidas creadas)
  const hayBebidas = products.some((p) => tipoDe(p) === "bebida" && p.precio > 0);
  const pedidoTieneBebida = cartLines.some((l) => !l.comboId && tipoDe(l.prod) === "bebida") || cartLines.some((l) => l.comboId && (l.comp || []).some((i) => { const p = products.find((x) => x.id === i.productId); return p && tipoDe(p) === "bebida"; }));
  const mostrarSugerencia = sugerenciaBebida && hayBebidas && !pedidoTieneBebida && cartLines.length > 0 && !cartOpen && tab === "catalogo";
  useEffect(() => { if (!sugerenciaBebida) return; const t = setTimeout(() => setSugerenciaBebida(false), 9000); return () => clearTimeout(t); }, [sugerenciaBebida, cart]);

  /* ---------- Cerrar pedido ---------- */
  const confirmOrder = ({ pago, metodoPago, cliente, fecha: fechaElegida, canalId, entregado, domicilio }) => {
    const fecha = fechaElegida || todayISO();
    // precio = lo que cuesta UNA unidad ya con sus adiciones; nombre = cómo se lee en el ticket ("Salchipapa + Queso")
    const items = cartLines.map((l) => ({
      lid: l.lid, productId: l.prod.id, nombre: l.nombre, base: l.base, qty: l.qty, precio: l.unit,
      ...(l.adds.length ? { adds: l.adds.map((a) => ({ productId: a.productId, nombre: a.nombre, precio: a.precio, qty: a.qty })) } : {}),
      ...(l.sabor ? { sabor: l.sabor } : {}),
      ...(l.comboId ? { comp: (l.comp || []).map((c) => ({ productId: c.productId, qty: c.qty })) } : {}),
    }));
    const nombreCliente = cliente ? cliente.trim() : "";
    const ventaId = uid();
    const canal = canales.find((c) => c.id === canalId) || canales[0];
    const pctCanal = esPremium ? Number(canal.comision) || 0 : 0;
    const entregadoYa = !!entregado || fecha !== todayISO(); // un pedido de otro día se asume ya entregado
    const num = ventas.filter((v) => v.fecha === fecha).reduce((m, v) => Math.max(m, v.num || 0), 0) + 1;
    const dom = domicilio && domicilio.direccion && domicilio.direccion.trim()
      ? { direccion: domicilio.direccion.trim(), costo: Math.max(0, Number(domicilio.costo) || 0), domiciliario: (domicilio.domiciliario || "").trim() }
      : null;
    const subtotal = cartTotal;
    const total = subtotal + (dom ? dom.costo : 0); // el domicilio se cobra aparte de los productos
    const venta = {
      id: ventaId, num, creadoAt: Date.now(), fecha, hora: horaAhora(), items, pago,
      metodoPago: pago === "pago" ? metodoPago : null, cliente: nombreCliente || null, total, subtotal, domicilio: dom,
      estado: entregadoYa ? "entregado" : "pendiente",
      canal: canal.id, canalNombre: canal.nombre, comisionPct: pctCanal, comision: comisionDe(subtotal, pctCanal),
    };
    persist.ventas([venta, ...ventas]);
    if (pago === "pago") {
      const nombres = items.map((i) => `${i.qty}x ${i.nombre}`).join(", ");
      const concepto = nombreCliente ? `Venta (${nombreCliente}) — ${nombres}` : `Venta — ${nombres}`;
      persist.ledger([{ id: uid(), tipo: "ingreso", concepto, monto: total, fecha, hora: horaAhora(), ventaId, metodoPago }, ...ledger]);
      showToast("Pedido pagado → Libro de Caja ✅");
    } else {
      const existing = fiado.find((f) => f.nombre.toLowerCase() === nombreCliente.toLowerCase());
      if (existing) persist.fiado(fiado.map((f) => f.id === existing.id ? { ...f, monto: f.monto + total, fecha } : f));
      else persist.fiado([{ id: uid(), nombre: nombreCliente, monto: total, fecha }, ...fiado]);
      showToast(`Fiado a ${nombreCliente} → Libreta de Fiado ✅`);
    }
    // Inventario: descuenta lo que gasta la receta y avisa si algún insumo queda bajo o agotado
    const consumo = consumoDeItems(items, products);
    if (Object.keys(consumo).length) {
      const nuevos = aplicarConsumo(insumos, consumo, 1);
      persist.insumos(nuevos);
      const peor = nuevos.filter((i) => ["bajo", "agotado"].includes(estadoStock(i)) && estadoStock(insumos.find((x) => x.id === i.id)) !== estadoStock(i));
      if (peor.length) setTimeout(() => showToast(`⚠️ Se acaba: ${peor.slice(0, 3).map((i) => i.nombre).join(", ")}`), 2300);
    }
    setCart([]); setCartOpen(false);
    setVentaResumen(venta);
  };

  /* ---------- Pedidos: cambiar el estado ---------- */
  const cambiarEstado = (ventaId, nuevo) => {
    persist.ventas(ventas.map((v) => v.id === ventaId ? { ...v, estado: nuevo, estadoAt: Date.now() } : v));
    if (nuevo === "listo") showToast("Pedido listo 🛎️");
    else if (nuevo === "entregado") showToast("Pedido entregado ✅");
  };
  // Canal y comisión al editar una venta: si no cambió el canal se respeta el % con que se vendió.
  const canalPropsEdit = (original, updated) => {
    const idOriginal = original.canal || "directo";
    if (updated.canalId === idOriginal) {
      const pct = original.comisionPct || 0;
      return { canal: idOriginal, canalNombre: original.canalNombre || "Directo", comisionPct: pct, comision: comisionDe(updated.subtotal ?? updated.total, pct) };
    }
    const nuevo = canales.find((c) => c.id === updated.canalId);
    if (!nuevo) return {};
    const pct = esPremium ? Number(nuevo.comision) || 0 : 0;
    return { canal: nuevo.id, canalNombre: nuevo.nombre, comisionPct: pct, comision: comisionDe(updated.subtotal ?? updated.total, pct) };
  };

  /* ---------- Cierre de caja ---------- */
  const guardarCierre = (c) => {
    const resto = cierres.filter((x) => x.fecha !== c.fecha);
    persist.cierres([c, ...resto].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0)));
    showToast("Cierre de caja guardado 🔒");
  };
  // Guarda el cierre y borra los movimientos y ventas ya cerrados (hasta esa fecha).
  // El resumen del cierre queda guardado; el fiado pendiente y los pedidos sin entregar NO se tocan.
  const guardarCierreYLimpiar = (c) => {
    exportarBackupLibre(); // copia de seguridad automática antes de borrar
    const resto = cierres.filter((x) => x.fecha !== c.fecha);
    persist.cierres([c, ...resto].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0)));
    const debe = new Set(fiado.filter((f) => f.monto > 0).map((f) => String(f.nombre || "").toLowerCase()));
    persist.ledger(ledger.filter((l) => l.fecha > c.fecha));
    persist.ventas(ventas.filter((v) => v.fecha > c.fecha || estadoDe(v) !== "entregado" || (v.pago === "fiado" && v.cliente && debe.has(String(v.cliente).toLowerCase()))));
    showToast("Cierre guardado y movimientos anteriores limpiados 🧹");
  };
  const eliminarCierre = (id) => {
    withUndo("Cierre de caja eliminado", ["cierres"], () => persist.cierres(cierres.filter((c) => c.id !== id)));
  };

  /* ---------- Ventas: editar o eliminar una venta ya registrada (por si se equivocaron) ---------- */
  const editarVenta = (original, updated) => {
    const nombreNuevo = (updated.cliente || "").trim();
    const nombreViejo = (original.cliente || "").trim();
    const nombresItems = updated.items.map((i) => `${i.qty}x ${i.nombre}`).join(", ");
    const conceptoNuevo = nombreNuevo ? `Venta (${nombreNuevo}) — ${nombresItems}` : `Venta — ${nombresItems}`;
    let nextFiado = fiado;
    let nextLedger = ledger;

    if (original.pago === "fiado" && updated.pago === "fiado") {
      if (nombreViejo && nombreNuevo && nombreViejo.toLowerCase() === nombreNuevo.toLowerCase()) {
        nextFiado = nextFiado.map((f) => f.nombre.toLowerCase() === nombreViejo.toLowerCase() ? { ...f, monto: Math.max(0, f.monto - original.total + updated.total) } : f);
      } else {
        if (nombreViejo) nextFiado = nextFiado.map((f) => f.nombre.toLowerCase() === nombreViejo.toLowerCase() ? { ...f, monto: Math.max(0, f.monto - original.total) } : f);
        if (nombreNuevo) {
          const existing = nextFiado.find((f) => f.nombre.toLowerCase() === nombreNuevo.toLowerCase());
          nextFiado = existing
            ? nextFiado.map((f) => f.id === existing.id ? { ...f, monto: f.monto + updated.total } : f)
            : [{ id: uid(), nombre: nombreNuevo, monto: updated.total, fecha: updated.fecha }, ...nextFiado];
        }
      }
    } else if (original.pago === "pago" && updated.pago === "pago") {
      nextLedger = nextLedger.map((l) => l.ventaId === original.id ? { ...l, monto: updated.total, fecha: updated.fecha, concepto: conceptoNuevo, metodoPago: updated.metodoPago } : l);
    } else if (original.pago === "fiado" && updated.pago === "pago") {
      if (nombreViejo) nextFiado = nextFiado.map((f) => f.nombre.toLowerCase() === nombreViejo.toLowerCase() ? { ...f, monto: Math.max(0, f.monto - original.total) } : f);
      nextLedger = [{ id: uid(), tipo: "ingreso", concepto: conceptoNuevo, monto: updated.total, fecha: updated.fecha, hora: horaAhora(), ventaId: original.id, metodoPago: updated.metodoPago }, ...nextLedger];
    } else if (original.pago === "pago" && updated.pago === "fiado") {
      nextLedger = nextLedger.filter((l) => l.ventaId !== original.id);
      if (nombreNuevo) {
        const existing = nextFiado.find((f) => f.nombre.toLowerCase() === nombreNuevo.toLowerCase());
        nextFiado = existing
          ? nextFiado.map((f) => f.id === existing.id ? { ...f, monto: f.monto + updated.total } : f)
          : [{ id: uid(), nombre: nombreNuevo, monto: updated.total, fecha: updated.fecha }, ...nextFiado];
      }
    }

    persist.fiado(nextFiado);
    persist.ledger(nextLedger);
    const nuevoEstado = updated.estado || estadoDe(original);
    persist.ventas(ventas.map((v) => v.id === original.id ? {
      ...v, items: updated.items, pago: updated.pago, metodoPago: updated.pago === "pago" ? updated.metodoPago : null, cliente: nombreNuevo || null, total: updated.total, fecha: updated.fecha,
      subtotal: updated.subtotal ?? updated.total, domicilio: updated.domicilio || null,
      ...canalPropsEdit(original, updated),
      estado: nuevoEstado, ...(nuevoEstado !== estadoDe(original) ? { estadoAt: Date.now() } : {}),
    } : v));
    const consOld = consumoDeItems(original.items, products), consNew = consumoDeItems(updated.items, products);
    if (JSON.stringify(consOld) !== JSON.stringify(consNew)) persist.insumos(aplicarConsumo(aplicarConsumo(insumos, consNew, 1), consOld, -1));
    showToast("Venta actualizada");
    setVentaEdit(null);
  };
  const eliminarVenta = (venta) => {
    withUndo("Venta eliminada", ["ventas", "ledger", "fiado", "insumos"], () => {
      persist.insumos(aplicarConsumo(insumos, consumoDeItems(venta.items, products), -1));
      if (venta.pago === "fiado" && venta.cliente) {
        persist.fiado(fiado.map((f) => f.nombre.toLowerCase() === venta.cliente.toLowerCase() ? { ...f, monto: Math.max(0, f.monto - venta.total) } : f));
      }
      if (venta.pago === "pago") {
        persist.ledger(ledger.filter((l) => l.ventaId !== venta.id));
      }
      persist.ventas(ventas.filter((v) => v.id !== venta.id));
    });
    setVentaEdit(null);
  };

  /* ---------- Fiado ---------- */
  const registrarAbono = (id, monto, metodoPago) => {
    const cliente = fiado.find((f) => f.id === id);
    if (!cliente || monto <= 0) return;
    const nuevoSaldo = Math.max(0, cliente.monto - monto);
    const esPagoTotal = nuevoSaldo === 0;
    if (esPagoTotal) persist.fiado(fiado.filter((f) => f.id !== id));
    else persist.fiado(fiado.map((f) => f.id === id ? { ...f, monto: nuevoSaldo } : f));
    const concepto = esPagoTotal ? `Pago total fiado — ${cliente.nombre}` : `Abono fiado — ${cliente.nombre}`;
    persist.ledger([{ id: uid(), tipo: "ingreso", concepto, monto, fecha: todayISO(), hora: horaAhora(), metodoPago }, ...ledger]);
    showToast(esPagoTotal ? `${cliente.nombre} pagó todo lo que debía 🎉` : `Abono de ${cliente.nombre} registrado`);
    setClienteModal(null);
  };
  const editarAbono = (entry, nuevoMonto, nuevaFecha, metodoPago) => {
    const nombreCliente = entry.concepto.replace(/^(Abono fiado|Pago total fiado) — /, "");
    const delta = entry.monto - nuevoMonto; // si el abono bajó, se le devuelve la diferencia a la deuda
    const existente = fiado.find((f) => f.nombre.toLowerCase() === nombreCliente.toLowerCase());
    if (existente) persist.fiado(fiado.map((f) => f.id === existente.id ? { ...f, monto: Math.max(0, f.monto + delta) } : f));
    else if (delta > 0) persist.fiado([{ id: uid(), nombre: nombreCliente, monto: delta, fecha: nuevaFecha }, ...fiado]);
    persist.ledger(ledger.map((l) => l.id === entry.id ? { ...l, monto: nuevoMonto, fecha: nuevaFecha, metodoPago } : l));
    showToast("Abono actualizado");
    setAbonoEdit(null);
  };
  const eliminarAbono = (entry) => {
    withUndo("Abono eliminado", ["fiado", "ledger"], () => {
      const nombreCliente = entry.concepto.replace(/^(Abono fiado|Pago total fiado) — /, "");
      const existente = fiado.find((f) => f.nombre.toLowerCase() === nombreCliente.toLowerCase());
      if (existente) persist.fiado(fiado.map((f) => f.id === existente.id ? { ...f, monto: f.monto + entry.monto } : f));
      else persist.fiado([{ id: uid(), nombre: nombreCliente, monto: entry.monto, fecha: entry.fecha }, ...fiado]);
      persist.ledger(ledger.filter((l) => l.id !== entry.id));
    });
    setAbonoEdit(null);
  };
  const agregarFiado = (id, monto, concepto, fecha) => {
    const cliente = fiado.find((f) => f.id === id);
    const fechaFinal = fecha || todayISO();
    persist.fiado(fiado.map((f) => f.id === id ? { ...f, monto: f.monto + monto } : f));
    const ventaId = uid();
    const items = [{ productId: null, nombre: concepto || "Fiado directo", qty: 1, precio: monto }];
    persist.ventas([{ id: ventaId, fecha: fechaFinal, hora: horaAhora(), items, pago: "fiado", cliente: cliente.nombre, total: monto }, ...ventas]);
    showToast(`Se le agregó ${cop(monto)} a ${cliente.nombre}`);
  };
  const editarFiado = (data) => { persist.fiado(fiado.map((f) => f.id === data.id ? data : f)); showToast("Cliente actualizado"); setClienteModal(null); };
  const eliminarFiado = (id) => {
    withUndo("Cliente eliminado", ["fiado"], () => persist.fiado(fiado.filter((f) => f.id !== id)));
    setClienteModal(null);
  };

  /* ---------- Caja ---------- */
  const registrarMovimiento = (tipo, concepto, monto, fecha, foto, metodoPago, hora) => {
    persist.ledger([{ id: uid(), tipo, concepto, monto, fecha, hora: hora || horaAhora(), foto: foto || null, metodoPago }, ...ledger]);
    showToast(tipo === "ingreso" ? "Ingreso registrado" : "Gasto registrado");
    setMovModal(null);
  };
  const guardarLedgerEdit = (data) => { persist.ledger(ledger.map((l) => l.id === data.id ? data : l)); showToast("Movimiento actualizado"); setLedgerEdit(null); };
  const eliminarLedgerEdit = (id) => {
    withUndo("Movimiento eliminado", ["ledger"], () => persist.ledger(ledger.filter((l) => l.id !== id)));
    setLedgerEdit(null);
  };

  /* ---------- Productos ---------- */
  const saveProduct = (data) => {
    if (data.categoria && !categorias.includes(data.categoria)) persist.categorias([...categorias, data.categoria]);
    if (data.id && products.find((p) => p.id === data.id)) persist.products(products.map((p) => p.id === data.id ? { ...p, ...data } : p));
    else persist.products([...products, { ...data, id: uid(), receta: [] }]);
    setProductModal(null); setNewCat(null); setNewTipo(null);
  };
  /* ---------- Combos y sabores ---------- */
  const saveCombo = (data) => {
    if (data.id && combos.find((c) => c.id === data.id)) persist.combos(combos.map((c) => c.id === data.id ? { ...c, ...data } : c));
    else persist.combos([...combos, { ...data, id: uid() }]);
    setComboModal(null);
    showToast(data.id ? "Combo actualizado" : "Combo creado 🎁");
  };
  const deleteCombo = (id) => {
    withUndo("Combo eliminado", ["combos"], () => persist.combos(combos.filter((c) => c.id !== id)));
    setCart((prev) => prev.filter((c) => c.comboId !== id));
    setComboModal(null);
  };
  const deleteSabor = (id) => {
    withUndo("Sabor eliminado", ["sabores"], () => persist.sabores(sabores.filter((s) => s.id !== id)));
  };
  // Elegir una bebida desde la sugerencia "¿Algo para tomar?"
  const elegirBebidaSugerida = (p) => {
    setSugerenciaBebida(false);
    if (sabores.some((s) => !s.agotado)) setSaborModal({ productId: p.id, adds: [] });
    else agregarLinea({ productId: p.id });
  };
  const deleteProduct = (id) => {
    withUndo("Producto eliminado", ["products"], () => persist.products(products.filter((p) => p.id !== id)));
    setCart((prev) => prev.filter((c) => c.productId !== id).map((c) => (c.adds && c.adds.length ? { ...c, adds: c.adds.filter((a) => a.productId !== id) } : c)));
    setProductModal(null);
  };
  const saveReceta = (productId, receta) => { persist.products(products.map((p) => p.id === productId ? { ...p, receta } : p)); showToast("Receta actualizada"); };

  /* ---------- Pestañas del menú ---------- */
  const catDe = (p) => p.categoria || "Salchipapas";
  const existeCat = (n, excepto) => categorias.some((c) => c !== excepto && c.toLowerCase() === n.toLowerCase());
  const crearCategoria = (nombre) => {
    const n = nombre.trim();
    if (!n) return false;
    if (existeCat(n)) { showToast("Ya existe una pestaña con ese nombre"); return false; }
    persist.categorias([...categorias, n]); showToast(`Pestaña "${n}" creada`); return true;
  };
  const renombrarCategoria = (viejo, nuevo) => {
    const n = nuevo.trim();
    if (!n) return false;
    if (existeCat(n, viejo)) { showToast("Ya existe una pestaña con ese nombre"); return false; }
    persist.categorias(categorias.map((c) => c === viejo ? n : c));
    persist.products(products.map((p) => catDe(p) === viejo ? { ...p, categoria: n } : p));
    showToast("Pestaña actualizada"); return true;
  };
  const eliminarCategoria = (nombre) => {
    const hay = products.some((p) => catDe(p) === nombre);
    if (hay && nombre === "Otros") { showToast("Mueve primero los productos de \"Otros\" a otra pestaña"); return false; }
    withUndo(`Pestaña "${nombre}" eliminada`, ["products", "categorias"], () => {
      let next = categorias.filter((c) => c !== nombre);
      if (hay) {
        if (!next.includes("Otros")) next = [...next, "Otros"];
        persist.products(products.map((p) => catDe(p) === nombre ? { ...p, categoria: "Otros" } : p));
      }
      persist.categorias(next);
    });
    return true;
  };

  /* ---------- Insumos ---------- */
  const saveInsumo = (data) => {
    if (data.id && insumos.find((i) => i.id === data.id)) persist.insumos(insumos.map((i) => i.id === data.id ? data : i));
    else persist.insumos([...insumos, { ...data, id: uid() }]);
    setInsumoModal(null);
  };
  const deleteInsumo = (id) => {
    withUndo("Insumo eliminado", ["insumos"], () => persist.insumos(insumos.filter((i) => i.id !== id)));
    setInsumoModal(null);
  };

  /* ---------- Totales ---------- */
  const totalIngresos = ledger.filter((l) => l.tipo === "ingreso").reduce((s, l) => s + l.monto, 0);
  const totalGastos = ledger.filter((l) => l.tipo === "gasto").reduce((s, l) => s + l.monto, 0);
  const saldo = totalIngresos - totalGastos;
  const totalFiado = fiado.reduce((s, f) => s + f.monto, 0);
  const pedidosActivos = ventas.filter((v) => estadoDe(v) !== "entregado").length;
  const insumosBajos = insumos.filter((i) => ["bajo", "agotado"].includes(estadoStock(i)));
  const limiteFiado = Number(cfg.diasFiado) || 7;
  const fiadosAtrasados = fiado.filter((f) => f.monto > 0 && diasDesdeFecha(f.fecha) >= limiteFiado);
  const totalAtrasado = fiadosAtrasados.reduce((s, f) => s + f.monto, 0);
  const domiciliarios = [...new Set(ventas.map((v) => v.domicilio && v.domicilio.domiciliario).filter(Boolean))];
  const puedePedirCalificacion = esModoTienda && !!PLAY_PACKAGE && !rating.nunca && !rating.calificado && Date.now() >= (rating.hasta || 0)
    && pruebaActivada && (Date.now() - Date.parse(prueba.inicio)) >= 3 * MS_DIA && ventas.length >= 10 && !cartOpen && !ventaResumen;
  const diasDesdeRespaldo = lastBackup ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / (24 * 60 * 60 * 1000)) : null;
  const hayDatos = ventas.length > 0 || ledger.length > 0 || fiado.length > 0;
  const mostrarRecordatorioRespaldo = esPremium && hayDatos && (diasDesdeRespaldo === null || diasDesdeRespaldo >= 3);

  return (
    <ConfigCtx.Provider value={{ combos, sabores, ventas, cfg, qrPago, setCfg: persist.cfg, esPremium, esPremiumPago, enPrueba, diasPrueba, pruebaActivada, activarPrueba, premium, gate, abrirPremium, canales, setCanales: persist.canales }}>
    <div style={{ background: BRAND.bg, fontFamily: "Inter, sans-serif" }} className="w-full min-h-[700px] max-w-md mx-auto relative flex flex-col" id="app-root">
      <GlobalStyle />
      {necesitaConsent && <ConsentModal onAceptar={aceptarConsent} />}
      <Header cartCount={cartCount} onCart={() => setCartOpen(true)} tab={tab} nombre={cfg.nombre} onEditNombre={() => setNombreModal(true)} />
      {hayVersionNueva && (
        <div className="no-print px-4 pt-3">
          <button onClick={() => window.location.reload()} className="w-full rounded-xl py-2.5 px-3 flex items-center justify-between" style={{ background: BRAND.green }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "white" }}>🔄 Hay una versión nueva de la app</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "white", textDecoration: "underline" }}>Actualizar (no pierdes tu pedido)</span>
          </button>
        </div>
      )}
      {installPrompt && (
        <div className="no-print px-4 pt-3">
          <button onClick={handleInstall} className="w-full rounded-xl py-2.5 px-3 flex items-center justify-between" style={{ background: BRAND.gold }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.ink }}>📲 Instala esta app en tu celular</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: BRAND.ink, textDecoration: "underline" }}>Instalar</span>
          </button>
        </div>
      )}
      {enPrueba && avisoPruebaVisible && (
        <div className="no-print px-4 pt-2">
          <button onClick={() => abrirPremium("")} className="w-full rounded-lg py-1 px-2.5 flex items-center justify-between gap-2" style={{ background: "#FBF3E1", border: `1px solid ${BRAND.gold2}` }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: BRAND.ink, textAlign: "left" }}>🎁 Prueba gratis: te {diasPrueba === 1 ? "queda 1 día" : `quedan ${diasPrueba} días`} de Premium</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: BRAND.gold2, textDecoration: "underline", flexShrink: 0 }}>Ver</span>
          </button>
        </div>
      )}
      {insumosBajos.length > 0 && tab !== "insumos" && (
        <div className="no-print px-4 pt-3">
          <button onClick={() => setTab("insumos")} className="w-full rounded-xl py-1.5 px-3 flex items-center justify-between gap-2" style={{ background: "#FBF3E1", border: `1px solid ${BRAND.gold2}` }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: BRAND.ink, textAlign: "left" }}>⚠️ Se acaba: {insumosBajos.slice(0, 3).map((i) => i.nombre).join(", ")}{insumosBajos.length > 3 ? ` y ${insumosBajos.length - 3} más` : ""}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: BRAND.gold2, textDecoration: "underline", flexShrink: 0 }}>Ver</span>
          </button>
        </div>
      )}
      {puedePedirCalificacion && (
        <div className="no-print px-4 pt-3">
          <div className="rounded-xl p-3" style={{ background: "#EAF3E9", border: `1px solid ${BRAND.green}` }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.ink, marginBottom: 8 }}>⭐ ¿Te está sirviendo la app? Tu calificación en Google Play nos ayuda muchísimo.</div>
            <div className="flex gap-2">
              <button onClick={calificar} className="flex-1 rounded-full py-2 font-bold text-white text-sm" style={{ background: BRAND.green }}>Calificar</button>
              <button onClick={despuesCalificar} className="flex-1 rounded-full py-2 font-bold text-sm" style={{ background: "white", color: BRAND.ink }}>Después</button>
              <button onClick={nuncaCalificar} className="rounded-full px-3 py-2 text-sm" style={{ color: BRAND.muted }}>No</button>
            </div>
          </div>
        </div>
      )}


      <main className="flex-1 overflow-y-auto pb-24 px-4 pt-4">
        {!esPremium && <AdBanner />}
        {tab === "catalogo" && (
          <Catalogo products={products} categorias={categorias} combos={combos} ventas={ventas} necesitaOpciones={necesitaOpciones}
            qtyInCart={qtyInCart} qtyCombo={(id) => cartLines.filter((l) => l.comboId === id).reduce((s, l) => s + l.qty, 0)}
            onTocarAgregar={tocarAgregar} onQty={changeQtyProducto} onTocarCombo={tocarCombo}
            onEdit={(p) => setProductModal(p)} onNew={(c) => { setNewCat(c || null); setNewTipo(null); setProductModal("new"); }}
            onNewCombo={() => setComboModal("new")} onEditCombo={(c) => setComboModal(c)} onComplementos={() => setComplementosModal(true)}
            onCrearCat={crearCategoria} onRenombrarCat={renombrarCategoria} onEliminarCat={eliminarCategoria} />
        )}
        {tab === "pedidos" && <Pedidos ventas={ventas} onCambiar={cambiarEstado} onEdit={(v) => setVentaEdit(v)} />}
        {tab === "caja" && (
          <Caja ingresos={totalIngresos} gastos={totalGastos} saldo={saldo} ledger={ledger}
            onNuevoMovimiento={(tipo) => setMovModal({ tipo })} onEditEntry={(l) => setLedgerEdit(l)} onCierre={() => setCierreModal(true)} />
        )}
        {tab === "fiado" && <Fiado total={totalFiado} clientes={fiado} ventas={ventas} onSelect={(f) => setClienteModal(f)} />}
        {tab === "ventas" && (
          <VentasEInforme products={products} insumosMap={insumosMap} pctItems={pctItems} ventas={ventas} ledger={ledger} fiado={fiado}
            totalFiado={totalFiado} onEditVenta={(v) => setVentaEdit(v)} />
        )}
        {tab === "insumos" && (
          <Insumos products={products} insumos={insumos} insumosMap={insumosMap} pctItems={pctItems}
            onEditPctItems={persist.pctItems} onEditInsumo={(i) => setInsumoModal(i)} onNewInsumo={() => setInsumoModal("new")}
            onEditReceta={(p) => setRecetaModal(p)} onExportBackup={exportarBackup}
            onImportBackup={gate("Restaurar copia de seguridad", () => fileInputRef.current?.click())} onRespaldarAhora={respaldarAhora} lastBackup={lastBackup} onDrive={respaldarDrive} onRestaurarDrive={restaurarDrive} lastDrive={lastDrive}
            trash={trash} onRestaurarTrash={deshacer} onVaciarPapelera={vaciarPapelera}
            qrPago={qrPago} onChangeQrPago={persist.qrPago} />
        )}
      </main>

      <input ref={fileInputRef} type="file" accept="application/json" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; restaurarBackup(f); e.target.value = ""; }} />

      <BottomNav tab={tab} setTab={setTab} pedidosActivos={pedidosActivos} />

      {cartOpen && (
        <CartDrawer lines={cartLines} total={cartTotal} clientesConocidos={fiado.map((f) => f.nombre)} domiciliarios={domiciliarios}
          onClose={() => setCartOpen(false)} onQty={changeQtyLinea} onConfirm={confirmOrder} />
      )}
      {complementosModal && (
        <ComplementosModal products={products} sabores={sabores} onClose={() => setComplementosModal(false)}
          onEditProduct={(p) => setProductModal(p)} onNewProduct={(tipo) => { setNewCat(null); setNewTipo(tipo); setProductModal("new"); }}
          onSabores={persist.sabores} onDeleteSabor={deleteSabor} />
      )}
      {comboModal && (
        <ComboModal combo={comboModal === "new" ? null : comboModal} products={products} insumosMap={insumosMap}
          onClose={() => setComboModal(null)} onSave={saveCombo} onDelete={deleteCombo} />
      )}
      {opcionesModal && (() => {
        const prod = products.find((p) => p.id === opcionesModal.productId);
        if (!prod) return null;
        return (
          <OpcionesModal producto={prod} adiciones={products.filter((p) => tipoDe(p) === "adicion" && p.precio > 0).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))}
            onClose={() => setOpcionesModal(null)}
            onConfirm={(adds) => { setOpcionesModal(null); agregarLinea({ productId: prod.id, adds }); setSugerenciaBebida(true); }} />
        );
      })()}
      {saborModal && (() => {
        const prod = saborModal.productId ? products.find((p) => p.id === saborModal.productId) : null;
        const combo = saborModal.comboId ? combos.find((c) => c.id === saborModal.comboId) : null;
        if (!prod && !combo) return null;
        return (
          <SaborModal titulo={prod ? `${prod.emoji || "🥤"} ${prod.nombre}` : `${combo.emoji || "🎁"} ${combo.nombre}`} sabores={sabores}
            onClose={() => setSaborModal(null)}
            onConfirm={(sabor) => { setSaborModal(null); agregarLinea({ productId: prod?.id, comboId: combo?.id, adds: saborModal.adds || [], sabor }); }} />
        );
      })()}
      {productModal && (
        <ProductModal product={productModal === "new" ? null : productModal} categorias={categorias} defaultCat={newCat} defaultTipo={newTipo} insumosMap={insumosMap}
          onClose={() => { setProductModal(null); setNewCat(null); setNewTipo(null); }} onSave={saveProduct} onDelete={deleteProduct}
          onEditReceta={(p) => { setProductModal(null); setRecetaModal(p); }} />
      )}
      {mostrarSugerencia && (
        <SugerenciaBebida bebidas={products.filter((p) => tipoDe(p) === "bebida" && p.precio > 0).sort((a, b) => a.precio - b.precio)}
          onElegir={elegirBebidaSugerida} onCerrar={() => setSugerenciaBebida(false)} />
      )}
      {recetaModal && (
        <RecetaModal product={recetaModal} insumos={insumos} insumosMap={insumosMap}
          onClose={() => setRecetaModal(null)} onSave={(receta) => { saveReceta(recetaModal.id, receta); setRecetaModal(null); }} />
      )}
      {insumoModal && (
        <InsumoModal insumo={insumoModal === "new" ? null : insumoModal}
          onClose={() => setInsumoModal(null)} onSave={saveInsumo} onDelete={deleteInsumo} />
      )}
      {movModal && <MovimientoModal tipoInicial={movModal.tipo} onClose={() => setMovModal(null)} onSave={registrarMovimiento} />}
      {cierreModal && <CierreModal ledger={ledger} ventas={ventas} cierres={cierres} onClose={() => setCierreModal(false)} onSave={guardarCierre} onSaveLimpiar={guardarCierreYLimpiar} onDelete={eliminarCierre} />}
      {ledgerEdit && <LedgerEditModal entry={ledgerEdit} onClose={() => setLedgerEdit(null)} onSave={guardarLedgerEdit} onDelete={eliminarLedgerEdit} />}
      {ventaEdit && <VentaEditModal venta={ventaEdit} onClose={() => setVentaEdit(null)} onSave={editarVenta} onDelete={eliminarVenta} />}
      {ventaResumen && <VentaResumenModal venta={ventaResumen} qrPago={qrPago} onClose={() => setVentaResumen(null)} />}
      {clienteModal && (
        <ClienteModal cliente={clienteModal} ventas={ventas} ledger={ledger} onClose={() => setClienteModal(null)}
          onAbono={registrarAbono} onAgregarFiado={agregarFiado} onEditar={editarFiado} onEliminar={eliminarFiado}
          onEditVenta={(v) => { setClienteModal(null); setVentaEdit(v); }}
          onEditAbono={(a) => { setClienteModal(null); setAbonoEdit(a); }} />
      )}
      {abonoEdit && <AbonoEditModal entry={abonoEdit} onClose={() => setAbonoEdit(null)} onSave={editarAbono} onDelete={eliminarAbono} />}
      {premiumModal !== null && <PremiumModal motivo={premiumModal} onClose={() => setPremiumModal(null)} onActivarTienda={activarPremiumTienda} onActivarPrueba={activarPrueba} pruebaActivada={pruebaActivada} />}
      {nombreModal && <NombreModal nombre={cfg.nombre} onClose={() => setNombreModal(false)} onSave={(n) => { persist.cfg({ ...cfg, nombre: n }); setNombreModal(false); showToast("Nombre actualizado"); }} />}
      {toast && <Toast msg={toast.msg} actionLabel={toast.actionLabel} onAction={toast.onAction} />}
    </div>
    </ConfigCtx.Provider>
  );
}

/* ============================= NOMBRE Y MENSAJES DEL NEGOCIO ============================= */
function NombreModal({ nombre, onClose, onSave }) {
  const [n, setN] = useState(nombre);
  return (
    <ModalShell onClose={onClose} title="Nombre del negocio">
      <Field label="Nombre">
        <input autoFocus value={n} onChange={(e) => setN(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} placeholder="Ej: Negocio Comida" />
      </Field>
      <p style={{ fontSize: 11, color: BRAND.muted, marginBottom: 12 }}>Aparece arriba en la app, en la factura y en los mensajes de WhatsApp.</p>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-full py-3 font-bold" style={{ background: "#F0E9D8", color: BRAND.ink }}>Cancelar</button>
        <button disabled={!n.trim()} onClick={() => onSave(n.trim())} className="flex-1 rounded-full py-3 font-bold text-white disabled:opacity-40" style={{ background: BRAND.ink }}>Guardar</button>
      </div>
    </ModalShell>
  );
}

function NegocioConfig() {
  const { cfg, setCfg } = useCfg();
  const [nombre, setNombre] = useState(cfg.nombre);
  const [msgPago, setMsgPago] = useState(cfg.msgPago);
  const [msgFiado, setMsgFiado] = useState(cfg.msgFiado);
  const [diasFiado, setDiasFiado] = useState(String(cfg.diasFiado ?? 7));
  const [pieTicket, setPieTicket] = useState(cfg.pieTicket ?? DEFAULT_CONFIG.pieTicket);
  const guardar = () => setCfg({
    ...cfg, nombre: nombre.trim() || DEFAULT_CONFIG.nombre, msgPago: msgPago.trim(), msgFiado: msgFiado.trim(),
    diasFiado: Math.max(1, Math.min(90, Number(diasFiado) || 7)), pieTicket: pieTicket.trim(),
  });
  const area = "w-full rounded-lg px-3 py-2 border text-sm";
  return (
    <div className="rounded-xl p-4 mb-4" style={{ background: BRAND.card }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.ink, marginBottom: 4 }}>Mi negocio y mensajes de WhatsApp</div>
      <p style={{ fontSize: 11, color: BRAND.muted, marginBottom: 10 }}>Escribe aquí lo que quieres que reciban tus clientes. Déjalo en blanco si no quieres que salga.</p>
      <Field label="Nombre del negocio">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={guardar} className={area} style={{ borderColor: "#EAE0CC" }} />
      </Field>
      <Field label="Mensaje para pedir el pago (se envía junto al pedido cuando pagan por transferencia)">
        <textarea rows={3} value={msgPago} onChange={(e) => setMsgPago(e.target.value)} onBlur={guardar} className={area} style={{ borderColor: "#EAE0CC" }} placeholder="Ej: Puedes pagar escaneando el QR o al número:" />
      </Field>
      <Field label="Recordatorio para quienes deben fiado">
        <textarea rows={3} value={msgFiado} onChange={(e) => setMsgFiado(e.target.value)} onBlur={guardar} className={area} style={{ borderColor: "#EAE0CC" }} placeholder="Ej: Te recuerdo que tienes un saldo pendiente. ¡Gracias!" />
      </Field>
      <Field label="Avisar de un fiado como atrasado después de (días)">
        <input type="number" inputMode="numeric" value={diasFiado} onChange={(e) => setDiasFiado(e.target.value)} onBlur={guardar} className={area} style={{ borderColor: "#EAE0CC", width: 90 }} />
      </Field>
      <Field label="Mensaje al pie del ticket de 58 mm">
        <input value={pieTicket} onChange={(e) => setPieTicket(e.target.value)} onBlur={guardar} className={area} style={{ borderColor: "#EAE0CC" }} placeholder="Ej: ¡Gracias por tu compra!" />
      </Field>
      <p style={{ fontSize: 10.5, color: BRAND.muted }}>Si guardaste tu número de pago, se agrega solo al final del mensaje.</p>
    </div>
  );
}

/* ============================= BRAND / ESTILOS ============================= */
const BRAND = { bg: "#241812", card: "#FFFBF2", ink: "#241812", gold: "#F2A93B", gold2: "#D98C1F", salsa: "#E85D3D", green: "#5B8C5A", muted: "#8A7A6C", line: "#3A2A1E" };

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Inter:wght@400;500;600;700&display=swap');
      #app-root h1, #app-root h2, #app-root .display { font-family: 'Fraunces', serif; }
      #app-root::-webkit-scrollbar { width: 0px; }
      @media print { #app-root .no-print { display: none !important; } #app-root { background: white !important; color: black !important; max-width: 100% !important; } body.factura-open #app-root > *:not(.factura-print) { display: none !important; } body.factura-open .factura-print { position: static !important; } body.factura-open .factura-print-card { max-height: none !important; overflow: visible !important; } }
    `}</style>
  );
}

/* ============================= HEADER / NAV ============================= */
const TAB_TITLES = { catalogo: "Catálogo", pedidos: "Pedidos", caja: "Libro de Caja", fiado: "Libreta de Fiado", ventas: "Ventas e Informe", insumos: "Insumos y Recetas" };
function Header({ cartCount, onCart, tab, nombre, onEditNombre }) {
  return (
    <header className="no-print sticky top-0 z-20 px-4 pt-4 pb-3" style={{ background: BRAND.bg, borderBottom: `1px solid ${BRAND.line}` }}>
      <div className="flex items-center justify-between">
        <div>
          <button onClick={onEditNombre} className="display flex items-center gap-1.5 text-left" title="Cambiar el nombre del negocio" style={{ color: BRAND.gold, fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{nombre}<Pencil size={12} color={BRAND.muted} /></button>
          <div style={{ color: BRAND.muted, fontSize: 12.5, marginTop: 2 }}>{TAB_TITLES[tab]}</div>
        </div>
        <button onClick={onCart} className="relative rounded-full p-2.5" style={{ background: BRAND.card }}>
          <ShoppingCart size={20} color={BRAND.ink} />
          {cartCount > 0 && <span className="absolute -top-1 -right-1 rounded-full text-white text-[10px] font-semibold flex items-center justify-center" style={{ background: BRAND.salsa, width: 18, height: 18 }}>{cartCount}</span>}
        </button>
      </div>
    </header>
  );
}
function BottomNav({ tab, setTab, pedidosActivos = 0 }) {
  const items = [
    { id: "catalogo", label: "Menú", icon: Receipt },
    { id: "pedidos", label: "Pedidos", icon: ClipboardList, badge: pedidosActivos },
    { id: "caja", label: "Caja", icon: Wallet },
    { id: "fiado", label: "Fiado", icon: HandCoins },
    { id: "ventas", label: "Ventas", icon: BarChart3 },
    { id: "insumos", label: "Insumos", icon: Beaker },
  ];
  return (
    <nav className="no-print fixed bottom-0 left-0 right-0 z-20 max-w-md mx-auto flex" style={{ background: BRAND.card, borderTop: `1px solid ${BRAND.line}` }}>
      {items.map(({ id, label, icon: Icon, badge }) => (
        <button key={id} onClick={() => setTab(id)} className="flex-1 flex flex-col items-center gap-1 py-2.5">
          <span className="relative">
            <Icon size={19} color={tab === id ? BRAND.salsa : BRAND.muted} />
            {badge > 0 && <span className="absolute -top-1.5 -right-2.5 rounded-full text-white font-bold flex items-center justify-center" style={{ background: BRAND.salsa, fontSize: 9.5, minWidth: 16, height: 16, padding: "0 3px" }}>{badge}</span>}
          </span>
          <span style={{ fontSize: 10.5, fontWeight: tab === id ? 700 : 500, color: tab === id ? BRAND.salsa : BRAND.muted }}>{label}</span>
        </button>
      ))}
    </nav>
  );
}

/* ============================= CATÁLOGO ============================= */
const TAB_TOP = "__top";
const TAB_COMBOS = "__combos";
function Catalogo({ products, categorias, combos, ventas, necesitaOpciones, qtyInCart, qtyCombo, onTocarAgregar, onQty, onTocarCombo, onEdit, onNew, onNewCombo, onEditCombo, onComplementos, onCrearCat, onRenombrarCat, onEliminarCat }) {
  const [cat, setCat] = useState(TAB_TOP);
  const [catModal, setCatModal] = useState(null); // "new" | nombre de la pestaña a editar
  const catDe = (p) => p.categoria || "Salchipapas";
  // Las adiciones no salen en el menú: se ofrecen al agregar cada producto. Una pestaña que solo tenga adiciones se oculta.
  const tabsCat = categorias.filter((c) => { const ps = products.filter((p) => catDe(p) === c); return ps.length === 0 || ps.some((p) => tipoDe(p) !== "adicion"); });
  const catActual = cat === TAB_TOP || cat === TAB_COMBOS || tabsCat.includes(cat) ? cat : TAB_TOP;
  const lista = products.filter((p) => catDe(p) === catActual && tipoDe(p) !== "adicion").sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  // Más vendidos: todo el menú (productos y combos) ordenado por lo que más se ha vendido
  const top = useMemo(() => {
    const vendidos = {};
    (ventas || []).forEach((v) => (v.items || []).forEach((it) => { if (it.productId) vendidos[it.productId] = (vendidos[it.productId] || 0) + it.qty; }));
    const filas = [
      ...products.filter((p) => tipoDe(p) !== "adicion").map((p) => ({ clave: p.id, tipo: "producto", p, n: vendidos[p.id] || 0, nombre: p.nombre })),
      ...combos.map((c) => ({ clave: `combo:${c.id}`, tipo: "combo", c, n: vendidos[`combo:${c.id}`] || 0, nombre: c.nombre })),
    ];
    return filas.sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, "es"));
  }, [products, combos, ventas]);
  const guardarCat = (valor) => {
    const ok = catModal === "new" ? onCrearCat(valor) : onRenombrarCat(catModal, valor);
    if (ok) { setCat(valor.trim()); setCatModal(null); }
  };
  const chip = (id, texto, icono) => (
    <button key={id} onClick={() => setCat(id)} className="rounded-full px-3.5 py-1.5 flex-shrink-0 flex items-center gap-1" style={{ background: catActual === id ? BRAND.salsa : BRAND.card, color: catActual === id ? "white" : BRAND.ink, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>{icono}{texto}</button>
  );
  const tarjetaP = (p, insignia) => (
    <TarjetaProducto key={p.id} p={p} qty={qtyInCart(p.id)} conOpciones={necesitaOpciones(p)} insignia={insignia}
      onAdd={() => onTocarAgregar(p)} onQty={(d) => onQty(p.id, d)} onEdit={onEdit} />
  );
  const tarjetaC = (c, insignia) => <TarjetaCombo key={c.id} combo={c} qty={qtyCombo(c.id)} products={products} insignia={insignia} onAdd={() => onTocarCombo(c)} onEdit={onEditCombo} />;
  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-2">
        <h1 className="display" style={{ color: BRAND.card, fontSize: 19 }}>Nuestro menú</h1>
        <button onClick={onComplementos} className="rounded-full px-3 py-1.5 flex items-center gap-1 flex-shrink-0" style={{ background: BRAND.line, color: BRAND.gold, fontSize: 11, fontWeight: 700 }}><Pencil size={11} /> Adiciones y sabores</button>
      </div>
      <div className="flex gap-1.5 mb-2 overflow-x-auto" style={{ paddingBottom: 2 }}>
        {chip(TAB_TOP, "Más vendidos", <Flame size={12} />)}
        {chip(TAB_COMBOS, "Combos", <Gift size={12} />)}
        {tabsCat.map((c) => chip(c, c))}
        <button onClick={() => setCatModal("new")} className="rounded-full px-3 py-1.5 flex-shrink-0 flex items-center gap-1 border-2 border-dashed" style={{ borderColor: BRAND.muted, color: BRAND.gold, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}><Plus size={12} /> Pestaña</button>
      </div>
      {catActual !== TAB_TOP && catActual !== TAB_COMBOS ? (
        <button onClick={() => setCatModal(catActual)} className="mb-3 flex items-center gap-1.5" style={{ color: BRAND.gold, fontSize: 11.5, fontWeight: 700 }}><Pencil size={11} /> Editar o eliminar la pestaña "{catActual}"</button>
      ) : <div style={{ height: 10 }} />}

      {catActual === TAB_TOP && (
        <>
          {top.length === 0 && <p style={{ color: BRAND.muted, fontSize: 12.5, marginBottom: 12 }}>Aún no hay productos. Toca "Nuevo producto" para agregar el primero.</p>}
          <div className="grid grid-cols-3 gap-2">
            {top.map((f, idx) => {
              const insignia = f.n > 0 && idx < 3 ? "Top" : null;
              return f.tipo === "combo" ? tarjetaC(f.c, insignia) : tarjetaP(f.p, insignia);
            })}
            <button onClick={() => onNew(null)} className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 py-4" style={{ borderColor: BRAND.muted }}>
              <Plus size={18} color={BRAND.gold} />
              <span style={{ color: BRAND.gold, fontSize: 10, fontWeight: 700, textAlign: "center" }}>Nuevo<br />producto</span>
            </button>
          </div>
        </>
      )}

      {catActual === TAB_COMBOS && (
        <>
          {combos.length === 0 && <p style={{ color: BRAND.muted, fontSize: 12.5, marginBottom: 12 }}>Aún no tienes combos. Arma el primero juntando productos a un mejor precio: por ejemplo salchipapa + bebida.</p>}
          <div className="grid grid-cols-3 gap-2">
            {combos.map((c) => tarjetaC(c, null))}
            <button onClick={onNewCombo} className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 py-4" style={{ borderColor: BRAND.muted }}>
              <Plus size={18} color={BRAND.gold} />
              <span style={{ color: BRAND.gold, fontSize: 10, fontWeight: 700, textAlign: "center" }}>Nuevo<br />combo</span>
            </button>
          </div>
        </>
      )}

      {catActual !== TAB_TOP && catActual !== TAB_COMBOS && (
        <>
          {lista.length === 0 && <p style={{ color: BRAND.muted, fontSize: 12.5, marginBottom: 12 }}>Esta pestaña está vacía. Toca "Nuevo producto" para agregar el primero.</p>}
          <div className="grid grid-cols-3 gap-2">
            {lista.map((p) => tarjetaP(p, null))}
            <button onClick={() => onNew(catActual)} className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 py-4" style={{ borderColor: BRAND.muted }}>
              <Plus size={18} color={BRAND.gold} />
              <span style={{ color: BRAND.gold, fontSize: 10, fontWeight: 700, textAlign: "center" }}>Nuevo<br />producto</span>
            </button>
          </div>
        </>
      )}
      {catModal && (
        <CategoriaModal nombre={catModal === "new" ? null : catModal} cantidad={products.filter((p) => catDe(p) === catModal).length}
          onClose={() => setCatModal(null)} onSave={guardarCat}
          onDelete={() => { if (onEliminarCat(catModal)) { setCat(TAB_TOP); setCatModal(null); } }} />
      )}
    </div>
  );
}

// Tarjeta de un producto del menú. Si pregunta opciones (adiciones o sabor), el botón siempre es "Agregar" y muestra cuántos hay en el pedido.
function TarjetaProducto({ p, qty, conOpciones, insignia, onAdd, onQty, onEdit }) {
  return (
    <div className="rounded-xl p-1.5 relative flex flex-col" style={{ background: BRAND.card }}>
      {insignia && <span className="absolute top-1 left-1 z-10 rounded-full flex items-center gap-0.5 px-1.5 py-0.5" style={{ background: BRAND.salsa, color: "white", fontSize: 8.5, fontWeight: 800 }}><Flame size={9} /> {insignia}</span>}
      <button onClick={() => onEdit(p)} aria-label={`Editar ${p.nombre}`} className="absolute top-1 right-1 rounded-full p-0.5 z-10" style={{ background: "rgba(36,24,18,0.85)" }}>
        <Pencil size={10} color={BRAND.gold} />
      </button>
      <div className="w-full rounded-lg flex items-center justify-center text-xl mb-1" style={{ background: "#F4E3C1", height: 40 }}>
        {p.foto ? <img src={p.foto} alt={p.nombre} style={{ width: 32, height: 32, objectFit: "contain" }} /> : p.emoji}
      </div>
      <div style={{ color: BRAND.ink, fontWeight: 700, fontSize: 10.5, lineHeight: 1.15 }}>{p.nombre.replace("Salchipapa ", "")}</div>
      <div style={{ color: BRAND.gold2, fontWeight: 700, fontSize: 12, marginTop: 1 }}>{cop(p.precio)}</div>
      {conOpciones || qty === 0 ? (
        <button onClick={onAdd} className="mt-1.5 rounded-full py-1 flex items-center justify-center gap-1" style={{ background: BRAND.salsa, color: "white", fontSize: 10.5, fontWeight: 700 }}>
          <Plus size={12} /> Agregar{qty > 0 ? ` · ${qty}` : ""}
        </button>
      ) : (
        <div className="mt-1.5 rounded-full flex items-center justify-between px-1 py-0.5" style={{ background: BRAND.bg }}>
          <button onClick={() => onQty(-1)} aria-label="Quitar uno" className="rounded-full p-1"><Minus size={12} color="white" /></button>
          <span style={{ color: "white", fontWeight: 700, fontSize: 12 }}>{qty}</span>
          <button onClick={() => onQty(1)} aria-label="Agregar uno" className="rounded-full p-1"><Plus size={12} color="white" /></button>
        </div>
      )}
    </div>
  );
}

// Tarjeta de un combo: muestra qué trae y cuánto se ahorra frente a comprar todo por separado
function TarjetaCombo({ combo, qty, products, insignia, onAdd, onEdit }) {
  const partes = (combo.items || []).map((i) => ({ p: products.find((x) => x.id === i.productId), qty: i.qty })).filter((x) => x.p);
  const normal = partes.reduce((s, x) => s + x.p.precio * x.qty, 0);
  const ahorro = partes.length === (combo.items || []).length ? normal - combo.precio : 0;
  return (
    <div className="rounded-xl p-1.5 relative flex flex-col" style={{ background: BRAND.card }}>
      {insignia && <span className="absolute top-1 left-1 z-10 rounded-full flex items-center gap-0.5 px-1.5 py-0.5" style={{ background: BRAND.salsa, color: "white", fontSize: 8.5, fontWeight: 800 }}><Flame size={9} /> {insignia}</span>}
      <button onClick={() => onEdit(combo)} aria-label={`Editar ${combo.nombre}`} className="absolute top-1 right-1 rounded-full p-0.5 z-10" style={{ background: "rgba(36,24,18,0.85)" }}>
        <Pencil size={10} color={BRAND.gold} />
      </button>
      <div className="w-full rounded-lg flex items-center justify-center text-xl mb-1" style={{ background: "#F4E3C1", height: 40 }}>{combo.emoji || "🎁"}</div>
      <div style={{ color: BRAND.ink, fontWeight: 700, fontSize: 10.5, lineHeight: 1.15 }}>{combo.nombre}</div>
      <div style={{ color: BRAND.muted, fontSize: 9, lineHeight: 1.2, marginTop: 1, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{partes.map((x) => `${x.qty > 1 ? `${x.qty}x ` : ""}${x.p.nombre.replace("Salchipapa ", "")}`).join(" + ")}</div>
      <div style={{ color: BRAND.gold2, fontWeight: 700, fontSize: 12, marginTop: 1 }}>{cop(combo.precio)}</div>
      {ahorro > 0 && <div style={{ color: BRAND.green, fontWeight: 700, fontSize: 9.5 }}>Ahorras {cop(ahorro)}</div>}
      <button onClick={onAdd} className="mt-1.5 rounded-full py-1 flex items-center justify-center gap-1" style={{ background: BRAND.salsa, color: "white", fontSize: 10.5, fontWeight: 700 }}>
        <Plus size={12} /> Agregar{qty > 0 ? ` · ${qty}` : ""}
      </button>
    </div>
  );
}

/* ============================= COMBOS: crear, editar y eliminar ============================= */
function ComboModal({ combo, products, insumosMap, onClose, onSave, onDelete }) {
  const isNew = !combo;
  const elegibles = products.filter((p) => tipoDe(p) !== "adicion" && p.precio > 0).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const [nombre, setNombre] = useState(combo?.nombre || "");
  const [emoji, setEmoji] = useState(combo?.emoji || "🎁");
  const [precio, setPrecio] = useState(combo?.precio || "");
  const [cant, setCant] = useState(() => { const m = {}; (combo?.items || []).forEach((i) => { m[i.productId] = i.qty; }); return m; });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const mover = (id, d) => setCant((prev) => { const n = Math.max(0, (prev[id] || 0) + d); const c = { ...prev }; if (n) c[id] = n; else delete c[id]; return c; });
  const items = elegibles.filter((p) => cant[p.id]).map((p) => ({ productId: p.id, qty: cant[p.id] }));
  const normal = items.reduce((s, i) => s + elegibles.find((p) => p.id === i.productId).precio * i.qty, 0);
  const costo = items.reduce((s, i) => s + costoReceta(elegibles.find((p) => p.id === i.productId), insumosMap) * i.qty, 0);
  const pr = Number(precio) || 0;
  const ahorro = normal - pr;
  const sugerido = Math.round((normal * 0.9) / 500) * 500;
  const faltan = (combo?.items || []).filter((i) => !elegibles.some((p) => p.id === i.productId)).length;
  const canSave = nombre.trim().length > 0 && pr > 0 && items.length > 0;
  return (
    <ModalShell onClose={onClose} title={isNew ? "Nuevo combo" : "Editar combo"}>
      <Field label="Nombre del combo"><input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} placeholder="Ej: Combo Sencilla + Bebida" /></Field>
      <Field label="Ícono">
        <div className="flex flex-wrap gap-1.5">
          {["🎁", ...EMOJIS].map((e) => (
            <button key={e} type="button" onClick={() => setEmoji(e)} className="rounded-lg flex items-center justify-center" style={{ width: 34, height: 34, fontSize: 18, border: `2px solid ${emoji === e ? BRAND.salsa : "#EAE0CC"}`, background: emoji === e ? "#FBEAE4" : "white" }}>{e}</button>
          ))}
        </div>
      </Field>
      <Field label="¿Qué trae? Toca + para agregar productos">
        <div className="space-y-1.5" style={{ maxHeight: 220, overflowY: "auto" }}>
          {elegibles.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg px-2.5 py-1.5" style={{ background: cant[p.id] ? "#FBF3E1" : "#FAF6EC" }}>
              <div className="min-w-0">
                <div style={{ fontSize: 12.5, fontWeight: 600, color: BRAND.ink }}>{p.emoji} {p.nombre}</div>
                <div style={{ fontSize: 11, color: BRAND.muted }}>{cop(p.precio)}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {cant[p.id] ? <>
                  <button onClick={() => mover(p.id, -1)} aria-label="Quitar uno" className="rounded-full p-1" style={{ background: BRAND.bg }}><Minus size={12} color="white" /></button>
                  <span style={{ minWidth: 16, textAlign: "center", fontWeight: 700, color: BRAND.ink }}>{cant[p.id]}</span>
                </> : null}
                <button onClick={() => mover(p.id, 1)} aria-label="Agregar uno" className="rounded-full p-1" style={{ background: BRAND.bg }}><Plus size={12} color="white" /></button>
              </div>
            </div>
          ))}
          {elegibles.length === 0 && <p style={{ fontSize: 12, color: BRAND.salsa }}>Primero crea productos con precio en el menú.</p>}
        </div>
        {faltan > 0 && <p style={{ fontSize: 11, color: BRAND.salsa, marginTop: 6 }}>Un producto de este combo ya no existe; se quitará al guardar.</p>}
      </Field>
      <Field label="Precio del combo">
        <input type="number" inputMode="numeric" value={precio} onChange={(e) => setPrecio(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} placeholder="0" />
        {items.length > 0 && normal > 0 && (
          <button type="button" onClick={() => setPrecio(String(sugerido))} style={{ fontSize: 11.5, color: BRAND.gold2, fontWeight: 700, marginTop: 6, textDecoration: "underline" }}>Sugerencia: {cop(sugerido)} (10% menos que por separado)</button>
        )}
      </Field>
      {items.length > 0 && (
        <div className="rounded-lg p-2.5 mb-3 space-y-1" style={{ background: "#F4E3C1", fontSize: 12, color: BRAND.ink }}>
          <div className="flex justify-between"><span>Por separado</span><b>{cop(normal)}</b></div>
          {pr > 0 && <div className="flex justify-between"><span>{ahorro >= 0 ? "El cliente ahorra" : "Cuesta más que por separado"}</span><b style={{ color: ahorro >= 0 ? BRAND.green : BRAND.salsa }}>{cop(Math.abs(ahorro))}</b></div>}
          {costo > 0 && pr > 0 && <div className="flex justify-between"><span>Costo de insumos (recetas)</span><b>{cop(costo)}</b></div>}
          {costo > 0 && pr > 0 && <div className="flex justify-between"><span>Te queda (antes de otros costos)</span><b style={{ color: pr - costo >= 0 ? BRAND.green : BRAND.salsa }}>{cop(pr - costo)}</b></div>}
        </div>
      )}
      <div className="flex gap-2 mb-2">
        <button onClick={onClose} className="flex-1 rounded-full py-3 font-bold" style={{ background: "#F0E9D8", color: BRAND.ink }}>Cancelar</button>
        <button disabled={!canSave} onClick={() => onSave({ id: combo?.id, nombre: nombre.trim(), emoji, precio: pr, items })} className="flex-1 rounded-full py-3 font-bold text-white disabled:opacity-40" style={{ background: BRAND.ink }}>{isNew ? "Crear combo" : "Guardar cambios"}</button>
      </div>
      {!isNew && (confirmDelete ? (
        <div className="rounded-xl p-3 mt-1" style={{ background: "#FBEAE4" }}>
          <p style={{ fontSize: 12.5, color: BRAND.ink, marginBottom: 8 }}>¿Eliminar el combo "{combo.nombre}"? Las ventas que ya hiciste no cambian. Podrás deshacerlo justo después.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-full py-2 font-bold text-sm" style={{ background: "white", color: BRAND.ink }}>No</button>
            <button onClick={() => onDelete(combo.id)} className="flex-1 rounded-full py-2 font-bold text-sm text-white" style={{ background: BRAND.salsa }}>Sí, eliminar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete(true)} className="w-full rounded-full py-2.5 font-bold flex items-center justify-center gap-2 mt-1" style={{ color: BRAND.salsa }}><Trash2 size={14} /> Eliminar combo</button>
      ))}
    </ModalShell>
  );
}

function CategoriaModal({ nombre, cantidad, onClose, onSave, onDelete }) {
  const isNew = !nombre;
  const [valor, setValor] = useState(nombre || "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <ModalShell onClose={onClose} title={isNew ? "Nueva pestaña" : "Editar pestaña"}>
      <Field label="Nombre de la pestaña"><input value={valor} onChange={(e) => setValor(e.target.value)} autoFocus className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} placeholder="Ej: Gaseosas, Patacones, Adicionales..." /></Field>
      <div className="flex gap-2 mb-2">
        <button onClick={onClose} className="flex-1 rounded-full py-3 font-bold" style={{ background: "#F0E9D8", color: BRAND.ink }}>Cancelar</button>
        <button disabled={!valor.trim()} onClick={() => onSave(valor)} className="flex-1 rounded-full py-3 font-bold text-white disabled:opacity-40" style={{ background: BRAND.ink }}>{isNew ? "Crear pestaña" : "Guardar cambios"}</button>
      </div>
      {!isNew && (confirmDelete ? (
        <div className="rounded-xl p-3 mt-1" style={{ background: "#FBEAE4" }}>
          <p style={{ fontSize: 12.5, color: BRAND.ink, marginBottom: 8 }}>{cantidad > 0 ? `¿Eliminar la pestaña "${nombre}"? Sus ${cantidad} productos no se borran: pasan a la pestaña "Otros".` : `¿Eliminar la pestaña "${nombre}"?`}</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-full py-2 font-bold text-sm" style={{ background: "white", color: BRAND.ink }}>No</button>
            <button onClick={onDelete} className="flex-1 rounded-full py-2 font-bold text-sm text-white" style={{ background: BRAND.salsa }}>Sí, eliminar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete(true)} className="w-full rounded-full py-2.5 font-bold flex items-center justify-center gap-2 mt-1" style={{ color: BRAND.salsa }}><Trash2 size={14} /> Eliminar pestaña</button>
      ))}
    </ModalShell>
  );
}

/* ============================= EFECTIVO O TRANSFERENCIA: toggle reutilizable ============================= */
function MetodoPagoToggle({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={() => onChange("efectivo")} className="rounded-lg py-2 border-2 text-sm font-semibold flex items-center justify-center gap-1.5" style={{ borderColor: value === "efectivo" ? BRAND.green : "#EAE0CC", background: value === "efectivo" ? "#EDF4EC" : "white", color: BRAND.ink }}>
        <Wallet size={14} color={BRAND.green} /> Efectivo
      </button>
      <button type="button" onClick={() => onChange("transferencia")} className="rounded-lg py-2 border-2 text-sm font-semibold flex items-center justify-center gap-1.5" style={{ borderColor: value === "transferencia" ? BRAND.gold2 : "#EAE0CC", background: value === "transferencia" ? "#FBF3E1" : "white", color: BRAND.ink }}>
        <CircleDollarSign size={14} color={BRAND.gold2} /> Transferencia
      </button>
    </div>
  );
}

/* ============================= CARRITO + CIERRE DE PEDIDO ============================= */
function CartDrawer({ lines, total, clientesConocidos, domiciliarios = [], onClose, onQty, onConfirm }) {
  const [pago, setPago] = useState(null);
  const [metodoPago, setMetodoPago] = useState(null);
  const [cliente, setCliente] = useState("");
  const [fecha, setFecha] = useState(todayISO());
  const [domOn, setDomOn] = useState(false);
  const [dir, setDir] = useState("");
  const [domCosto, setDomCosto] = useState("");
  const [domiciliario, setDomiciliario] = useState("");
  const costoDom = domOn ? Math.max(0, Number(domCosto) || 0) : 0;
  const totalFinal = total + costoDom;
  const canConfirm = lines.length > 0 && pago !== null && (pago !== "fiado" || cliente.trim().length > 0) && (pago !== "pago" || metodoPago !== null) && (!domOn || dir.trim().length > 0);
  const { canales, esPremium, abrirPremium } = useCfg();
  const [canalId, setCanalId] = useState("directo");
  const [entregado, setEntregado] = useState(false);
  const canalSel = canales.find((c) => c.id === canalId) || canales[0];
  const comisionSel = comisionDe(total, esPremium ? canalSel.comision : 0);
  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative max-w-md mx-auto w-full rounded-t-3xl p-4 max-h-[88vh] flex flex-col overflow-y-auto" style={{ background: BRAND.card }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="display" style={{ fontSize: 18, color: BRAND.ink }}>Tu pedido</h2>
          <button onClick={onClose} className="flex items-center gap-1">
            <span style={{ fontSize: 12.5, color: BRAND.muted, fontWeight: 600 }}>Cerrar</span>
            <X size={20} color={BRAND.ink} />
          </button>
        </div>
        {lines.length === 0 ? (
          <p style={{ color: BRAND.muted, fontSize: 13.5, padding: "20px 0" }}>Aún no has agregado productos. Vuelve al menú para armar tu pedido.</p>
        ) : (
          <div className="space-y-3 mb-2">
            {lines.map((l) => (
              <div key={l.lid} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: BRAND.ink, display: "flex", alignItems: "flex-start", gap: 5, lineHeight: 1.25 }}>
                    <span style={{ flexShrink: 0 }}>{l.prod.foto ? <img src={l.prod.foto} alt="" style={{ width: 16, height: 16, objectFit: "contain" }} /> : l.prod.emoji}</span>
                    <span>{l.base || l.prod.nombre}{l.sabor ? <span style={{ fontWeight: 500, color: BRAND.muted }}> · {l.sabor}</span> : null}</span>
                  </div>
                  {(l.adds || []).map((a) => (
                    <div key={a.productId} style={{ fontSize: 11.5, color: BRAND.salsa, fontWeight: 700, marginLeft: 21 }}>+ {a.qty > 1 ? `${a.qty}x ` : ""}{a.nombre} <span style={{ color: BRAND.muted, fontWeight: 500 }}>({cop(a.precio * a.qty)})</span></div>
                  ))}
                  <div style={{ fontSize: 12, color: BRAND.muted, marginLeft: 21 }}>{cop(l.unit)} c/u</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => onQty(l.lid, -1)} className="rounded-full p-1" style={{ background: BRAND.bg }}><Minus size={12} color="white" /></button>
                  <span style={{ minWidth: 16, textAlign: "center", fontWeight: 700, color: BRAND.ink }}>{l.qty}</span>
                  <button onClick={() => onQty(l.lid, 1)} className="rounded-full p-1" style={{ background: BRAND.bg }}><Plus size={12} color="white" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        {lines.length > 0 && (
          <div className="border-t pt-3 mt-1" style={{ borderColor: "#EAE0CC" }}>
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontWeight: 700, color: BRAND.ink }}>Total</span>
              <span style={{ fontWeight: 700, color: BRAND.gold2, fontSize: 18 }}>{cop(totalFinal)}</span>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.ink, marginBottom: 8 }}>Forma de pago (obligatorio)</div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button onClick={() => setPago("pago")} className="rounded-xl py-2.5 flex flex-col items-center gap-1 border-2" style={{ borderColor: pago === "pago" ? BRAND.green : "#EAE0CC", background: pago === "pago" ? "#EDF4EC" : "white" }}>
                <CircleDollarSign size={18} color={BRAND.green} />
                <span style={{ fontSize: 12, fontWeight: 700, color: BRAND.ink }}>Pago</span>
                <span style={{ fontSize: 9.5, color: BRAND.muted }}>Va a Libro de Caja</span>
              </button>
              <button onClick={() => setPago("fiado")} className="rounded-xl py-2.5 flex flex-col items-center gap-1 border-2" style={{ borderColor: pago === "fiado" ? BRAND.salsa : "#EAE0CC", background: pago === "fiado" ? "#FBEAE4" : "white" }}>
                <HandCoins size={18} color={BRAND.salsa} />
                <span style={{ fontSize: 12, fontWeight: 700, color: BRAND.ink }}>Fiado</span>
                <span style={{ fontSize: 9.5, color: BRAND.muted }}>Va a Libreta de Fiado</span>
              </button>
            </div>
            {pago === "pago" && (
              <div className="mb-3">
                <div style={{ fontSize: 11.5, fontWeight: 600, color: BRAND.muted, marginBottom: 4 }}>¿Efectivo o transferencia? (obligatorio)</div>
                <MetodoPagoToggle value={metodoPago} onChange={setMetodoPago} />
              </div>
            )}
            {pago && (
              <div className="mb-3">
                <div style={{ fontSize: 11.5, fontWeight: 600, color: BRAND.muted, marginBottom: 4 }}>
                  {pago === "fiado" ? "Cliente (obligatorio)" : "Cliente / Nombre de quien pagó (opcional)"}
                </div>
                <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre del cliente" list="clientes-list" className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC", fontSize: 13.5 }} />
                <datalist id="clientes-list">{clientesConocidos.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
            )}
            <div className="mb-3">
              <button type="button" onClick={() => setDomOn(!domOn)} className="w-full rounded-lg py-2 border-2 flex items-center justify-center gap-2" style={{ borderColor: domOn ? BRAND.gold2 : "#EAE0CC", background: domOn ? "#FBF3E1" : "white", color: BRAND.ink, fontSize: 12.5, fontWeight: 700 }}>🛵 {domOn ? "Es domicilio" : "¿Es un domicilio?"}</button>
              {domOn && (
                <div className="mt-2 space-y-2">
                  <input value={dir} onChange={(e) => setDir(e.target.value)} placeholder="Dirección de entrega (obligatorio)" className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC", fontSize: 13.5 }} />
                  <div className="flex gap-2">
                    <input type="number" inputMode="numeric" value={domCosto} onChange={(e) => setDomCosto(e.target.value)} placeholder="Costo del domicilio" className="w-1/2 rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC", fontSize: 13.5 }} />
                    <input value={domiciliario} onChange={(e) => setDomiciliario(e.target.value)} list="domiciliarios-list" placeholder="Domiciliario" className="w-1/2 rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC", fontSize: 13.5 }} />
                  </div>
                  <datalist id="domiciliarios-list">{domiciliarios.map((d) => <option key={d} value={d} />)}</datalist>
                  {costoDom > 0 && <div style={{ fontSize: 11, color: BRAND.muted }}>Productos {cop(total)} + domicilio {cop(costoDom)}</div>}
                </div>
              )}
            </div>
            <div className="mb-3">
              <div style={{ fontSize: 11.5, fontWeight: 600, color: BRAND.muted, marginBottom: 4 }}>¿Por dónde llegó el pedido?</div>
              <div className="flex flex-wrap gap-1.5">
                {canales.map((c) => {
                  const bloqueado = c.custom && !esPremium;
                  const sel = canalId === c.id && !bloqueado;
                  return (
                    <button key={c.id} type="button" onClick={() => (bloqueado ? abrirPremium("Canales con comisión (Rappi, DiDi…)") : setCanalId(c.id))} className="rounded-full px-3 py-1.5 border-2" style={{ borderColor: sel ? BRAND.gold2 : "#EAE0CC", background: sel ? "#FBF3E1" : "white", color: BRAND.ink, fontSize: 12, fontWeight: 700 }}>
                      {c.nombre}{c.comision > 0 ? ` · ${c.comision}%` : ""}{bloqueado ? " 👑" : ""}
                    </button>
                  );
                })}
              </div>
              {comisionSel > 0 && <div style={{ fontSize: 11, color: BRAND.salsa, fontWeight: 600, marginTop: 6 }}>Comisión de {canalSel.nombre}: −{cop(comisionSel)} · Te quedan {cop(total - comisionSel)}</div>}
            </div>
            <div className="mb-3">
              <div style={{ fontSize: 11.5, fontWeight: 600, color: BRAND.muted, marginBottom: 4 }}>¿Cómo queda el pedido?</div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setEntregado(false)} className="rounded-lg py-2 border-2 flex flex-col items-center" style={{ borderColor: !entregado ? BRAND.salsa : "#EAE0CC", background: !entregado ? "#FBEAE4" : "white" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.ink }}>🕒 Pendiente</span>
                  <span style={{ fontSize: 9.5, color: BRAND.muted }}>Va a la cola de Pedidos</span>
                </button>
                <button type="button" onClick={() => setEntregado(true)} className="rounded-lg py-2 border-2 flex flex-col items-center" style={{ borderColor: entregado ? BRAND.green : "#EAE0CC", background: entregado ? "#EDF4EC" : "white" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.ink }}>✅ Ya entregado</span>
                  <span style={{ fontSize: 9.5, color: BRAND.muted }}>Venta en el mostrador</span>
                </button>
              </div>
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: BRAND.muted, marginBottom: 4 }}>Fecha del pedido</div>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full rounded-lg px-3 py-2 border mb-3" style={{ borderColor: "#EAE0CC", fontSize: 13.5 }} />
            <button disabled={!canConfirm} onClick={() => onConfirm({ pago, metodoPago: pago === "pago" ? metodoPago : null, cliente: cliente.trim(), fecha, canalId, entregado, domicilio: domOn ? { direccion: dir, costo: costoDom, domiciliario } : null })} className="w-full rounded-full py-3 font-bold text-white disabled:opacity-40" style={{ background: BRAND.ink }}>Cerrar pedido</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================= RESUMEN DEL PEDIDO (FACTURA) ============================= */
function VentaResumenModal({ venta, qrPago, onClose }) {
  const { cfg, gate } = useCfg();
  const enviarWhatsApp = async () => {
    const lineas = venta.items.map((i) => `• ${i.qty}x ${i.nombre.replace("Salchipapa ", "")} — ${cop(i.qty * i.precio)}`).join("\n");
    const pagar = venta.pago === "fiado" || venta.metodoPago === "transferencia";
    const texto = `*${cfg.nombre}* 🌭\n${fmtDateLong(venta.fecha)}${venta.cliente ? `\nCliente: ${venta.cliente}` : ""}\n\n${lineas}${venta.domicilio ? `\n🛵 Domicilio: ${cop(venta.domicilio.costo)} — ${venta.domicilio.direccion}` : ""}\n\n*Total: ${cop(venta.total)}*\n${venta.pago === "fiado" ? "Estado: fiado (pendiente de pago)" : venta.metodoPago === "efectivo" ? "Pagado en efectivo ✅" : "Pago por transferencia"}${pagar && (qrPago.telefono || qrPago.foto || (cfg.msgPago || "").trim()) ? `\n\n${(cfg.msgPago || "").trim()}${qrPago.telefono ? ` *${qrPago.telefono}*` : ""}` : ""}\n\n¡Gracias! 🙌`;
    try {
      if (pagar && qrPago.foto && navigator.canShare) {
        const blob = await (await fetch(qrPago.foto)).blob();
        const file = new File([blob], "qr-pago.jpg", { type: blob.type || "image/jpeg" });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: texto }); return; }
      }
    } catch (e) { if (e && e.name === "AbortError") return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  };
  useEffect(() => {
    document.body.classList.add("factura-open");
    return () => document.body.classList.remove("factura-open");
  }, []);
  const esTransferencia = venta.pago === "pago" && venta.metodoPago === "transferencia";
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center factura-print">
      <div className="absolute inset-0 bg-black/50 no-print" onClick={onClose} />
      <div className="relative max-w-md mx-auto w-full rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto factura-print-card" style={{ background: BRAND.card }}>
        <div className="flex items-center justify-between mb-2 no-print">
          <span style={{ fontSize: 11.5, color: BRAND.green, fontWeight: 700 }}>✅ Pedido confirmado</span>
          <button onClick={onClose}><X size={20} color={BRAND.ink} /></button>
        </div>
        <div className="text-center mb-3">
          <div className="display" style={{ fontSize: 19, color: BRAND.ink }}>{cfg.nombre}</div>
          <div style={{ fontSize: 11, color: BRAND.muted }}>{fmtDateLong(venta.fecha)}{venta.num ? ` · Pedido #${venta.num}` : ""}</div>
        </div>
        <div className="space-y-1.5 mb-3" style={{ borderTop: "1px dashed #C9B98F", borderBottom: "1px dashed #C9B98F", padding: "10px 0" }}>
          {venta.items.map((i) => (
            <div key={i.lid || i.productId || i.nombre} className="flex items-center justify-between" style={{ fontSize: 12.5 }}>
              <span style={{ color: BRAND.ink }}>{i.qty}x {i.nombre.replace("Salchipapa ", "")}</span>
              <span style={{ color: BRAND.ink, fontWeight: 600 }}>{cop(i.qty * i.precio)}</span>
            </div>
          ))}
          {venta.domicilio && (
            <div className="flex items-center justify-between" style={{ fontSize: 12.5 }}>
              <span style={{ color: BRAND.ink }}>🛵 Domicilio{venta.domicilio.direccion ? ` — ${venta.domicilio.direccion}` : ""}</span>
              <span style={{ color: BRAND.ink, fontWeight: 600 }}>{cop(venta.domicilio.costo)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mb-1">
          <span style={{ fontWeight: 700, color: BRAND.ink }}>Total</span>
          <span style={{ fontWeight: 700, color: BRAND.gold2, fontSize: 19 }}>{cop(venta.total)}</span>
        </div>
        <div style={{ fontSize: 11.5, color: BRAND.muted, marginBottom: 12 }}>
          {venta.pago === "fiado" ? `Fiado${venta.cliente ? " — " + venta.cliente : ""}` : `Pagado · ${venta.metodoPago === "efectivo" ? "💵 Efectivo" : "🏦 Transferencia"}${venta.cliente ? " — " + venta.cliente : ""}`}
        </div>

        {esTransferencia && (qrPago.foto || qrPago.telefono) && (
          <div className="rounded-xl p-3 mb-3 text-center" style={{ background: "#F4E3C1" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.ink, marginBottom: 8 }}>Datos para pagar</div>
            {qrPago.foto && <img src={qrPago.foto} alt="QR de pago" style={{ width: "100%", maxWidth: 260, aspectRatio: "1 / 1", objectFit: "contain", margin: "0 auto 8px", background: "white", borderRadius: 8 }} />}
            {qrPago.telefono && <div style={{ fontSize: 16, fontWeight: 700, color: BRAND.ink }}>{qrPago.telefono}</div>}
          </div>
        )}

        <button onClick={gate("Enviar mensajes por WhatsApp", enviarWhatsApp)} className="no-print w-full rounded-full py-3 mb-2 font-bold text-white flex items-center justify-center gap-2" style={{ background: "#25A244" }}><MessageCircle size={16} /> Enviar por WhatsApp{venta.pago === "fiado" || venta.metodoPago === "transferencia" ? " (con QR)" : ""}</button>
        <div className="no-print mb-2">
          <button onClick={gate("Ticket para impresora 58 mm", () => imprimirTicket(venta, cfg))} className="w-full rounded-full py-3 font-bold flex items-center justify-center gap-2" style={{ background: "#F4E3C1", color: BRAND.ink }}>🧾 Ticket 58 mm 👑</button>
          <button onClick={gate("Ticket para impresora 58 mm", () => compartirTicketTexto(venta, cfg))} className="w-full text-center mt-1" style={{ fontSize: 11, color: BRAND.muted, textDecoration: "underline" }}>o enviarlo como texto a una app de impresora Bluetooth</button>
        </div>
        <div className="flex gap-2 no-print">
          <button onClick={onClose} className="flex-1 rounded-full py-3 font-bold" style={{ background: "#F0E9D8", color: BRAND.ink }}>Cerrar</button>
          <button onClick={gate("Factura en PDF", () => window.print())} className="flex-1 rounded-full py-3 font-bold text-white flex items-center justify-center gap-2" style={{ background: BRAND.ink }}><Printer size={16} /> Factura PDF 👑</button>
        </div>
      </div>
    </div>
  );
}

/* ============================= LIBRO DE CAJA ============================= */
function Caja({ ingresos, gastos, saldo, ledger, onNuevoMovimiento, onEditEntry, onCierre }) {
  // Por defecto muestra los movimientos de HOY; con el filtro puedes ver otros días o todo el historial.
  const [desde, setDesde] = useState(todayISO());
  const [hasta, setHasta] = useState(todayISO());
  const sorted = useMemo(
    () => ledger.filter((l) => l.fecha >= desde && l.fecha <= hasta).sort(porRecienteLedger),
    [ledger, desde, hasta]
  );
  const ingresosP = sorted.filter((l) => l.tipo === "ingreso").reduce((s, l) => s + l.monto, 0);
  const gastosP = sorted.filter((l) => l.tipo === "gasto").reduce((s, l) => s + l.monto, 0);
  // "efectivo" es el valor por defecto para movimientos viejos que no tenían este campo.
  // Efectivo y transferencias son lo que TIENES en total: no dependen del filtro de fechas.
  const netoPor = (m) => ledger.filter((l) => (l.metodoPago || "efectivo") === m).reduce((s, l) => s + (l.tipo === "ingreso" ? l.monto : -l.monto), 0);
  const totalEfectivo = netoPor("efectivo");
  const totalTransferencia = netoPor("transferencia");
  const esHoy = desde === todayISO() && hasta === todayISO();
  const etiquetaPeriodo = desde === hasta ? (esHoy ? "de hoy" : `del ${fmtDate(desde)}`) : `del ${fmtDate(desde)} al ${fmtDate(hasta)}`;
  const chip = (activo) => ({ background: activo ? BRAND.gold : BRAND.card, color: BRAND.ink, fontSize: 11.5, fontWeight: 700 });
  const irTodo = () => {
    const fechas = ledger.map((l) => l.fecha).sort();
    setDesde(fechas[0] || todayISO()); setHasta(todayISO());
  };
  return (
    <div>
      <div className="rounded-2xl p-4 mb-3" style={{ background: BRAND.card }}>
        <div style={{ fontSize: 12.5, color: BRAND.muted, fontWeight: 600 }}>Saldo actual (total)</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: saldo >= 0 ? BRAND.green : BRAND.salsa }}>{cop(saldo)}</div>
      </div>

      <div className="flex gap-2 mb-2">
        <button onClick={() => { setDesde(diaRelativo(0)); setHasta(diaRelativo(0)); }} className="rounded-full px-3.5 py-1.5" style={chip(esHoy)}>Hoy</button>
        <button onClick={() => { setDesde(diaRelativo(-1)); setHasta(diaRelativo(-1)); }} className="rounded-full px-3.5 py-1.5" style={chip(desde === diaRelativo(-1) && hasta === diaRelativo(-1))}>Ayer</button>
        <button onClick={irTodo} className="rounded-full px-3.5 py-1.5" style={chip(false)}>Todo</button>
      </div>
      <div className="flex gap-2 mb-3">
        <Field label="Desde"><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-full rounded-lg px-2 py-1.5 border text-xs" style={{ borderColor: "#EAE0CC" }} /></Field>
        <Field label="Hasta"><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-full rounded-lg px-2 py-1.5 border text-xs" style={{ borderColor: "#EAE0CC" }} /></Field>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-xl p-3" style={{ background: BRAND.card }}><div style={{ fontSize: 11.5, color: BRAND.muted, fontWeight: 600 }}>Ingresos {etiquetaPeriodo}</div><div style={{ fontSize: 16, fontWeight: 700, color: BRAND.green }}>{cop(ingresosP)}</div></div>
        <div className="rounded-xl p-3" style={{ background: BRAND.card }}><div style={{ fontSize: 11.5, color: BRAND.muted, fontWeight: 600 }}>Gastos {etiquetaPeriodo}</div><div style={{ fontSize: 16, fontWeight: 700, color: BRAND.salsa }}>{cop(gastosP)}</div></div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: BRAND.card }}>
          <Wallet size={16} color={BRAND.green} />
          <div><div style={{ fontSize: 10.5, color: BRAND.muted, fontWeight: 600 }}>Efectivo (total)</div><div style={{ fontSize: 14.5, fontWeight: 700, color: BRAND.ink }}>{cop(totalEfectivo)}</div></div>
        </div>
        <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: BRAND.card }}>
          <CircleDollarSign size={16} color={BRAND.gold2} />
          <div><div style={{ fontSize: 10.5, color: BRAND.muted, fontWeight: 600 }}>Transferencias (total)</div><div style={{ fontSize: 14.5, fontWeight: 700, color: BRAND.ink }}>{cop(totalTransferencia)}</div></div>
        </div>
      </div>
      <button onClick={onCierre} className="w-full rounded-full py-2.5 font-bold mb-3 flex items-center justify-center gap-2" style={{ background: BRAND.gold, color: BRAND.ink }}>🔒 Cierre de caja del día</button>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button onClick={() => onNuevoMovimiento("ingreso")} className="rounded-full py-2.5 font-bold flex items-center justify-center gap-2" style={{ background: "#EAF3E9", color: BRAND.green }}><Plus size={16} /> Ingreso</button>
        <button onClick={() => onNuevoMovimiento("gasto")} className="rounded-full py-2.5 font-bold flex items-center justify-center gap-2" style={{ background: "#FBEAE4", color: BRAND.salsa }}><Plus size={16} /> Gasto</button>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.card }}>Movimientos ({sorted.length})</span>
        <span style={{ fontSize: 11, color: BRAND.muted }}>Toca uno para editar o eliminar</span>
      </div>
      <div className="space-y-2">
        {sorted.length === 0 && <p style={{ fontSize: 12.5, color: BRAND.muted }}>{ledger.length === 0 ? "Aún no hay movimientos registrados." : "No hay movimientos en estas fechas. Prueba con otro rango o toca “Todo”."}</p>}
        {sorted.map((l) => (
          <button key={l.id} onClick={() => onEditEntry(l)} className="w-full rounded-xl p-3 flex items-center gap-2.5 text-left" style={{ background: BRAND.card, borderLeft: `4px solid ${l.tipo === "ingreso" ? BRAND.green : BRAND.salsa}` }}>
            <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 30, height: 30, background: l.tipo === "ingreso" ? "#EAF3E9" : "#FBEAE4" }}>
              {l.tipo === "ingreso" ? <ArrowUpRight size={15} color={BRAND.green} /> : <ArrowDownRight size={15} color={BRAND.salsa} />}
            </div>
            <div className="pr-2 flex-1 min-w-0">
              <div style={{ fontSize: 12.5, fontWeight: 600, color: BRAND.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.concepto}</div>
              <div className="flex items-center gap-1 flex-wrap" style={{ fontSize: 11, color: BRAND.muted }}>
                <span>{fmtDateLong(l.fecha)}{l.hora ? ` · ${fmtHora(l.hora)}` : ""}</span>
                <span>· {(l.metodoPago || "efectivo") === "efectivo" ? "💵 Efectivo" : "🏦 Transferencia"}</span>
                {l.foto && <Paperclip size={11} color={BRAND.muted} />}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span style={{ fontSize: 13.5, fontWeight: 700, color: l.tipo === "ingreso" ? BRAND.green : BRAND.salsa, whiteSpace: "nowrap" }}>{l.tipo === "ingreso" ? "+" : "−"}{cop(l.monto)}</span>
              <Pencil size={13} color={BRAND.muted} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Botones para adjuntar una foto (cámara o galería) y previsualizarla/quitarla.
// Se usa tanto al registrar un movimiento nuevo como al editar uno existente.
function FotoAdjunta({ foto, loading, error, onRemove, onCamera, onGaleria }) {
  return (
    <div>
      {foto && (
        <div className="relative rounded-lg overflow-hidden mb-2" style={{ border: "1px solid #EAE0CC", background: "#F4E3C1" }}>
          <img src={foto} alt="Foto adjunta" style={{ width: "100%", maxHeight: 220, objectFit: "contain", display: "block" }} />
          <button type="button" onClick={onRemove} className="absolute top-1.5 right-1.5 rounded-full p-1.5" style={{ background: "rgba(36,24,18,0.75)" }}><X size={14} color="white" /></button>
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onCamera} className="flex-1 rounded-lg py-2 flex items-center justify-center gap-1.5" style={{ background: "#F4E3C1" }}>
          <Camera size={14} color={BRAND.ink} /><span style={{ fontSize: 11.5, fontWeight: 600, color: BRAND.ink }}>Tomar foto</span>
        </button>
        <button type="button" onClick={onGaleria} className="flex-1 rounded-lg py-2 flex items-center justify-center gap-1.5" style={{ background: "#F4E3C1" }}>
          <ImagePlus size={14} color={BRAND.ink} /><span style={{ fontSize: 11.5, fontWeight: 600, color: BRAND.ink }}>{foto ? "Cambiar imagen" : "Elegir imagen"}</span>
        </button>
      </div>
      {loading && <div style={{ fontSize: 11, color: BRAND.muted, marginTop: 4 }}>Procesando imagen…</div>}
      {error && !loading && <div style={{ fontSize: 11, color: BRAND.salsa, marginTop: 4 }}>{error}</div>}
    </div>
  );
}

function MovimientoModal({ tipoInicial, onClose, onSave }) {
  const tipo = tipoInicial || "gasto";
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(todayISO());
  const [hora, setHora] = useState(horaAhora());
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [foto, setFoto] = useState(null);
  const [fotoLoading, setFotoLoading] = useState(false);
  const [fotoError, setFotoError] = useState("");
  const camInputRef = useRef(null);
  const galInputRef = useRef(null);

  const handleFotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFotoLoading(true); setFotoError("");
    try {
      const dataUrl = await resizeImageFile(file);
      setFoto(dataUrl);
    } catch {
      setFotoError("No se pudo procesar la imagen. Intenta con otra.");
    } finally {
      setFotoLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title={tipo === "ingreso" ? "Registrar ingreso" : "Registrar gasto"}>
      <Field label="Concepto"><input value={concepto} onChange={(e) => setConcepto(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} placeholder={tipo === "ingreso" ? "Ej: Consignación, abono, transferencia..." : "Ej: Gas, moto, insumos..."} /></Field>
      <Field label="Monto"><input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} placeholder="0" /></Field>
      <Field label="Fecha"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} /></Field>
      <Field label="Hora"><input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} /></Field>
      <Field label="Efectivo o transferencia"><MetodoPagoToggle value={metodoPago} onChange={setMetodoPago} /></Field>
      <Field label={tipo === "ingreso" ? "Foto del comprobante (opcional)" : "Foto de la factura (opcional)"}>
        <FotoAdjunta foto={foto} loading={fotoLoading} error={fotoError} onRemove={() => setFoto(null)} onCamera={() => camInputRef.current?.click()} onGaleria={() => galInputRef.current?.click()} />
        <input ref={camInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoChange} />
        <input ref={galInputRef} type="file" accept="image/*" className="hidden" onChange={handleFotoChange} />
      </Field>
      <div className="flex gap-2 mt-2">
        <button onClick={onClose} className="flex-1 rounded-full py-3 font-bold" style={{ background: "#F0E9D8", color: BRAND.ink }}>Cancelar</button>
        <button disabled={!concepto || !monto} onClick={() => onSave(tipo, concepto, Number(monto), fecha, foto, metodoPago, hora)} className="flex-1 rounded-full py-3 font-bold text-white disabled:opacity-40" style={{ background: BRAND.ink }}>Guardar</button>
      </div>
    </ModalShell>
  );
}

function LedgerEditModal({ entry, onClose, onSave, onDelete }) {
  const [tipo, setTipo] = useState(entry.tipo);
  const [concepto, setConcepto] = useState(entry.concepto);
  const [monto, setMonto] = useState(String(entry.monto));
  const [fecha, setFecha] = useState(entry.fecha);
  const [hora, setHora] = useState(entry.hora || "");
  const [metodoPago, setMetodoPago] = useState(entry.metodoPago || "efectivo");
  const [foto, setFoto] = useState(entry.foto || null);
  const [fotoLoading, setFotoLoading] = useState(false);
  const [fotoError, setFotoError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const camInputRef = useRef(null);
  const galInputRef = useRef(null);

  const handleFotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFotoLoading(true); setFotoError("");
    try {
      const dataUrl = await resizeImageFile(file);
      setFoto(dataUrl);
    } catch {
      setFotoError("No se pudo procesar la imagen. Intenta con otra.");
    } finally {
      setFotoLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title="Editar movimiento">
      <Field label="Tipo">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setTipo("ingreso")} className="rounded-lg py-2 border-2 text-sm font-semibold" style={{ borderColor: tipo === "ingreso" ? BRAND.green : "#EAE0CC", color: BRAND.ink }}>Ingreso</button>
          <button onClick={() => setTipo("gasto")} className="rounded-lg py-2 border-2 text-sm font-semibold" style={{ borderColor: tipo === "gasto" ? BRAND.salsa : "#EAE0CC", color: BRAND.ink }}>Gasto</button>
        </div>
      </Field>
      <Field label="Concepto"><input value={concepto} onChange={(e) => setConcepto(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} /></Field>
      <Field label="Monto"><input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} /></Field>
      <Field label="Fecha"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} /></Field>
      <Field label="Hora"><input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} /></Field>
      <Field label="Efectivo o transferencia"><MetodoPagoToggle value={metodoPago} onChange={setMetodoPago} /></Field>
      <Field label="Foto adjunta (opcional)">
        <FotoAdjunta foto={foto} loading={fotoLoading} error={fotoError} onRemove={() => setFoto(null)} onCamera={() => camInputRef.current?.click()} onGaleria={() => galInputRef.current?.click()} />
        <input ref={camInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoChange} />
        <input ref={galInputRef} type="file" accept="image/*" className="hidden" onChange={handleFotoChange} />
      </Field>
      <div className="flex gap-2 mt-2 mb-2">
        <button onClick={onClose} className="flex-1 rounded-full py-3 font-bold" style={{ background: "#F0E9D8", color: BRAND.ink }}>Cancelar</button>
        <button disabled={!concepto || !monto} onClick={() => onSave({ id: entry.id, tipo, concepto, monto: Number(monto), fecha, hora: hora || undefined, foto, metodoPago, ventaId: entry.ventaId })} className="flex-1 rounded-full py-3 font-bold text-white disabled:opacity-40" style={{ background: BRAND.ink }}>Guardar</button>
      </div>
      {!confirmDelete ? (
        <button onClick={() => setConfirmDelete(true)} className="w-full rounded-full py-2.5 font-bold flex items-center justify-center gap-2" style={{ color: BRAND.salsa }}><Trash2 size={14} /> Eliminar movimiento</button>
      ) : (
        <div className="rounded-xl p-3" style={{ background: "#FBEAE4" }}>
          <p style={{ fontSize: 12.5, color: BRAND.ink, marginBottom: 8 }}>¿Eliminar este movimiento? Podrás deshacerlo justo después, o restaurarlo luego desde la Papelera en Insumos.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-full py-2 font-bold text-sm" style={{ background: "white", color: BRAND.ink }}>No</button>
            <button onClick={() => onDelete(entry.id)} className="flex-1 rounded-full py-2 font-bold text-sm text-white" style={{ background: BRAND.salsa }}>Sí, eliminar</button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

/* ============================= LIBRETA DE FIADO ============================= */
function Fiado({ total, clientes, ventas, onSelect }) {
  const { cfg, qrPago, gate } = useCfg();
  const limite = Number(cfg.diasFiado) || 7;
  const lista = [...clientes].filter((f) => f.monto > 0).map((f) => ({ f, dias: diasDesdeFecha(f.fecha) }))
    .sort((a, b) => a.f.nombre.localeCompare(b.f.nombre, "es", { sensitivity: "base" }));
  const pedidosDe = (f) => pedidosPendientesDe(ventas, f);
  // Buscador: filtra por nombre mientras escribes (sin importar mayúsculas ni tildes)
  const [busca, setBusca] = useState("");
  const qBusca = sinTildes(busca);
  const filtrada = qBusca ? lista.filter(({ f }) => sinTildes(f.nombre).includes(qBusca)) : lista;
  const totalFiltrado = filtrada.reduce((s, { f }) => s + f.monto, 0);
  return (
    <div>
      <div className="rounded-2xl p-4 mb-3" style={{ background: BRAND.card }}>
        <div style={{ fontSize: 12.5, color: BRAND.muted, fontWeight: 600 }}>Total fiado</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: BRAND.salsa }}>{cop(total)}</div>
      </div>
      {lista.length > 0 && (
        <div className="relative mb-3">
          <Search size={15} color={BRAND.muted} style={{ position: "absolute", left: 12, top: 12 }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente por nombre…" aria-label="Buscar cliente" className="w-full rounded-full py-2.5 pl-9 pr-9" style={{ background: BRAND.card, color: BRAND.ink, fontSize: 13.5, border: "none", outline: "none" }} />
          {busca && <button onClick={() => setBusca("")} aria-label="Borrar búsqueda" className="absolute rounded-full p-1" style={{ right: 8, top: 7, background: "#F0E9D8" }}><X size={13} color={BRAND.ink} /></button>}
        </div>
      )}
      <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.card, marginBottom: 8 }}>
        {qBusca ? `${filtrada.length} ${filtrada.length === 1 ? "cliente encontrado" : "clientes encontrados"} · ${cop(totalFiltrado)}` : "Clientes — toca uno para ver, editar o abonar"}
      </div>
      <div className="space-y-2">
        {filtrada.map(({ f, dias }) => {
          const tarde = dias >= limite;
          return (
            <div key={f.id} className="w-full rounded-xl px-3 flex items-center justify-between" style={{ height: 58, background: BRAND.card, borderLeft: `4px solid ${tarde ? BRAND.salsa : "#EAE0CC"}` }}>
              <button onClick={() => onSelect(f)} className="flex-1 text-left min-w-0">
                <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.nombre}</div>
                <div style={{ fontSize: 11, whiteSpace: "nowrap", color: tarde ? BRAND.salsa : BRAND.muted, fontWeight: tarde ? 700 : 400 }}>
                  {tarde ? "⏰ " : ""}{fmtDate(f.fecha)} · {textoHace(dias)}
                </div>
              </button>
              <div className="flex items-center gap-2">
                <button onClick={gate("Recordar pagos por WhatsApp", () => window.open(whatsappUrl(f, pedidosDe(f), cfg, qrPago), "_blank"))} title="Enviarle el saldo por WhatsApp" className="rounded-full flex items-center justify-center" style={{ background: "#25D366", width: 30, height: 30 }}>
                  <MessageCircle size={15} color="white" />
                </button>
                <button onClick={() => onSelect(f)} className="flex items-center gap-1">
                  <span style={{ fontSize: 14, fontWeight: 700, color: BRAND.salsa }}>{cop(f.monto)}</span>
                  <ChevronRight size={16} color={BRAND.muted} />
                </button>
              </div>
            </div>
          );
        })}
        {lista.length === 0 && <p style={{ color: BRAND.muted, fontSize: 13 }}>No hay clientes fiados por ahora.</p>}
        {lista.length > 0 && filtrada.length === 0 && <p style={{ color: BRAND.muted, fontSize: 13 }}>Ningún cliente se llama así. Revisa cómo lo escribiste.</p>}
      </div>
    </div>
  );
}

function ClienteModal({ cliente, ventas, ledger, onClose, onAbono, onAgregarFiado, onEditar, onEliminar, onEditVenta, onEditAbono }) {
  const { cfg, qrPago, gate } = useCfg();
  const [monto, setMonto] = useState("");
  const [metodoPagoAbono, setMetodoPagoAbono] = useState("efectivo");
  const [montoNuevoFiado, setMontoNuevoFiado] = useState("");
  const [conceptoNuevoFiado, setConceptoNuevoFiado] = useState("");
  const [fechaNuevoFiado, setFechaNuevoFiado] = useState(todayISO());
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(cliente.nombre);
  const [montoEdit, setMontoEdit] = useState(String(cliente.monto));
  const [fechaEdit, setFechaEdit] = useState(cliente.fecha);
  const [telefonoEdit, setTelefonoEdit] = useState(cliente.telefono || "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const m = Number(monto) || 0;
  const mNuevo = Number(montoNuevoFiado) || 0;
  const pedidos = pedidosPendientesDe(ventas, cliente);
  const abonos = abonosActualesDe(ledger, cliente);

  if (editando) {
    return (
      <ModalShell onClose={() => setEditando(false)} title="Editar cliente">
        <Field label="Nombre"><input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} /></Field>
        <Field label="Monto que debe"><input type="number" value={montoEdit} onChange={(e) => setMontoEdit(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} /></Field>
        <Field label="Fecha"><input type="date" value={fechaEdit} onChange={(e) => setFechaEdit(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} /></Field>
        <Field label="Teléfono (opcional, para WhatsApp)"><input value={telefonoEdit} onChange={(e) => setTelefonoEdit(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} placeholder="Ej: 3001234567" /></Field>
        <div className="flex gap-2 mt-2 mb-2">
          <button onClick={() => setEditando(false)} className="flex-1 rounded-full py-3 font-bold" style={{ background: "#F0E9D8", color: BRAND.ink }}>Cancelar</button>
          <button disabled={!nombre.trim()} onClick={() => onEditar({ id: cliente.id, nombre: nombre.trim(), monto: Number(montoEdit) || 0, fecha: fechaEdit, telefono: telefonoEdit.trim() })} className="flex-1 rounded-full py-3 font-bold text-white disabled:opacity-40" style={{ background: BRAND.ink }}>Guardar</button>
        </div>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} className="w-full rounded-full py-2.5 font-bold flex items-center justify-center gap-2" style={{ color: BRAND.salsa }}><Trash2 size={14} /> Eliminar cliente</button>
        ) : (
          <div className="rounded-xl p-3" style={{ background: "#FBEAE4" }}>
            <p style={{ fontSize: 12.5, color: BRAND.ink, marginBottom: 8 }}>¿Eliminar a "{cliente.nombre}" de la libreta?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-full py-2 font-bold text-sm" style={{ background: "white", color: BRAND.ink }}>No</button>
              <button onClick={() => onEliminar(cliente.id)} className="flex-1 rounded-full py-2 font-bold text-sm text-white" style={{ background: BRAND.salsa }}>Sí, eliminar</button>
            </div>
          </div>
        )}
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose} title={cliente.nombre} action={
      <div className="flex items-center gap-3">
        <button onClick={gate("Recordar pagos por WhatsApp", () => window.open(whatsappUrl(cliente, pedidos, cfg, qrPago), "_blank"))} title="Enviarle el saldo por WhatsApp" className="rounded-full p-1.5" style={{ background: "#25D366" }}>
          <MessageCircle size={14} color="white" />
        </button>
        <button onClick={() => setEditando(true)}><Pencil size={16} color={BRAND.ink} /></button>
      </div>
    }>
      <div style={{ fontSize: 12.5, color: BRAND.muted, marginBottom: 2 }}>Debe actualmente</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: BRAND.salsa, marginBottom: 14 }}>{cop(cliente.monto)}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.ink, marginBottom: 2 }}>Lo que debe (pedidos pendientes)</div>
      <p style={{ fontSize: 10.5, color: BRAND.muted, marginBottom: 6 }}>Toca un pedido para corregirlo o eliminarlo</p>
      {pedidos.length === 0 ? (
        <p style={{ fontSize: 12, color: BRAND.muted, marginBottom: 14 }}>No hay pedidos registrados desde el catálogo para este cliente (su saldo puede venir de un registro inicial). Toca ✏️ arriba para corregir el monto si es un error.</p>
      ) : (
        <div className="space-y-1.5 mb-4 max-h-32 overflow-y-auto">
          {pedidos.map((v) => (
            <button key={v.id} onClick={() => onEditVenta(v)} className="w-full text-left rounded-lg p-2" style={{ background: "#F4E3C1" }}>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 11.5, color: BRAND.ink, fontWeight: 600 }}>{v.items.map((i) => `${i.qty}x ${i.nombre.replace("Salchipapa ", "")}`).join(", ")}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: BRAND.ink }}>{cop(v.total)}</span>
              </div>
              <div style={{ fontSize: 10, color: BRAND.muted }}>{fmtDate(v.fecha)}</div>
            </button>
          ))}
        </div>
      )}
      <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.ink, marginBottom: 2 }}>Abonos de esta deuda</div>
      {abonos.length === 0 ? (
        <p style={{ fontSize: 12, color: BRAND.muted, marginBottom: 14 }}>Todavía no ha hecho ningún abono.</p>
      ) : (
        <>
          <p style={{ fontSize: 10.5, color: BRAND.muted, marginBottom: 6 }}>Toca un abono para corregirlo o eliminarlo</p>
          <div className="space-y-1.5 mb-4 max-h-28 overflow-y-auto">
            {abonos.map((a) => (
              <button key={a.id} onClick={() => onEditAbono(a)} className="w-full rounded-lg p-2 flex items-center justify-between" style={{ background: "#EAF3E8" }}>
                <span style={{ fontSize: 11, color: BRAND.muted }}>{fmtDate(a.fecha)}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: BRAND.green }}>{cop(a.monto)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <Field label="Registrar abono (pago parcial o total)"><input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} placeholder="0" /></Field>
      <Field label="¿Efectivo o transferencia?"><MetodoPagoToggle value={metodoPagoAbono} onChange={setMetodoPagoAbono} /></Field>
      <p style={{ fontSize: 11, color: BRAND.muted, marginBottom: 12 }}>El abono se suma automáticamente al Libro de Caja como ingreso.</p>
      <div className="flex gap-2 mb-4">
        <button onClick={onClose} className="flex-1 rounded-full py-3 font-bold" style={{ background: "#F0E9D8", color: BRAND.ink }}>Cerrar</button>
        <button disabled={m <= 0 || m > cliente.monto} onClick={() => onAbono(cliente.id, m, metodoPagoAbono)} className="flex-1 rounded-full py-3 font-bold text-white disabled:opacity-40" style={{ background: BRAND.green }}>Registrar abono</button>
      </div>

      <div className="rounded-xl p-3" style={{ background: "#FBEAE4" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: BRAND.ink, marginBottom: 6 }}>¿Sigue fiando? Agrégale más aquí</div>
        <Field label="Monto nuevo que fía"><input type="number" value={montoNuevoFiado} onChange={(e) => setMontoNuevoFiado(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} placeholder="0" /></Field>
        <Field label="¿Qué llevó? (opcional)"><input value={conceptoNuevoFiado} onChange={(e) => setConceptoNuevoFiado(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} placeholder="Ej: 2 salchipapas tradicionales" /></Field>
        <Field label="Fecha"><input type="date" value={fechaNuevoFiado} onChange={(e) => setFechaNuevoFiado(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} /></Field>
        <button disabled={mNuevo <= 0} onClick={() => { onAgregarFiado(cliente.id, mNuevo, conceptoNuevoFiado.trim(), fechaNuevoFiado); setMontoNuevoFiado(""); setConceptoNuevoFiado(""); }} className="w-full rounded-full py-2.5 font-bold text-white disabled:opacity-40" style={{ background: BRAND.salsa }}>Agregar al saldo fiado</button>
      </div>
    </ModalShell>
  );
}

/* ============================= VENTAS + INFORME (fusionados) ============================= */
function computeRange(products, insumosMap, pctItems, ventas, desde, hasta) {
  const rangeVentas = ventas.filter((v) => v.fecha >= desde && v.fecha <= hasta);
  const qtyByProduct = {};
  products.forEach((p) => (qtyByProduct[p.id] = 0));
  // Los combos tienen precio propio (menor que la suma): esa diferencia se resta de lo vendido y de la utilidad
  let ajusteCombos = 0;
  rangeVentas.forEach((v) => v.items.forEach((it) => {
    expandirItem(it).forEach((x) => { qtyByProduct[x.productId] = (qtyByProduct[x.productId] || 0) + x.qty; });
    if (it.comp && it.comp.length && it.comp.every((c) => products.some((p) => p.id === c.productId))) {
      const normal = it.comp.reduce((s, c) => s + products.find((p) => p.id === c.productId).precio * c.qty, 0);
      ajusteCombos += (normal - it.precio) * it.qty;
    }
  }));
  const rows = ["insumos", ...pctItems.map((pi) => pi.id)];
  const rowLabels = { insumos: "Insumos y materia prima", ...Object.fromEntries(pctItems.map((pi) => [pi.id, pi.label])) };
  const perProduct = products.map((p) => {
    const s = structureFor(p, insumosMap, pctItems);
    const qty = qtyByProduct[p.id] || 0;
    const cols = { insumos: s.insumos * qty };
    s.items.forEach((it) => (cols[it.id] = it.monto * qty));
    return { product: p, qty, cols, utilidad: s.utilidad * qty, vendido: p.precio * qty };
  });
  const totalVendido = perProduct.reduce((s, p) => s + p.vendido, 0) - ajusteCombos;
  const totalCostos = perProduct.reduce((s, p) => s + rows.reduce((a, r) => a + p.cols[r], 0), 0);
  const comisiones = rangeVentas.reduce((s, v) => s + (v.comision || 0), 0);
  const utilidadNeta = perProduct.reduce((s, p) => s + p.utilidad, 0) - comisiones - ajusteCombos; // las comisiones de los canales restan de la utilidad
  return { rangeVentas, perProduct, rows, rowLabels, totalVendido, totalCostos, comisiones, utilidadNeta, pctUtilidad: totalVendido ? (utilidadNeta / totalVendido) * 100 : 0 };
}

function VentasEInforme({ products, insumosMap, pctItems, ventas, ledger, fiado, totalFiado, onEditVenta }) {
  const [desde, setDesde] = useState(todayISO());
  const [hasta, setHasta] = useState(todayISO());
  const data = useMemo(() => computeRange(products, insumosMap, pctItems, ventas, desde, hasta), [products, insumosMap, pctItems, ventas, desde, hasta]);
  // El Libro de Caja de esta pestaña ahora sí respeta el rango Desde/Hasta elegido arriba
  // (antes mostraba siempre el total histórico, sin importar las fechas).
  const ledgerPeriodo = useMemo(() => ledger.filter((l) => l.fecha >= desde && l.fecha <= hasta), [ledger, desde, hasta]);
  const ingresosPeriodo = ledgerPeriodo.filter((l) => l.tipo === "ingreso").reduce((s, l) => s + l.monto, 0);
  const gastosPeriodo = ledgerPeriodo.filter((l) => l.tipo === "gasto").reduce((s, l) => s + l.monto, 0);
  const saldoPeriodo = ingresosPeriodo - gastosPeriodo;
  const netoPorMetodo = (m) => ledgerPeriodo.filter((l) => (l.metodoPago || "efectivo") === m).reduce((s, l) => s + (l.tipo === "ingreso" ? l.monto : -l.monto), 0);
  const efectivoPeriodo = netoPorMetodo("efectivo");
  const transferenciaPeriodo = netoPorMetodo("transferencia");
  const fiadoNuevoPeriodo = data.rangeVentas.filter((v) => v.pago === "fiado").reduce((s, v) => s + v.total, 0);
  const vendidoPeriodo = data.rangeVentas.reduce((s, v) => s + v.total, 0);
  const vendidoPor = (m) => data.rangeVentas.filter((v) => v.pago === "pago" && (v.metodoPago || "efectivo") === m).reduce((s, v) => s + v.total, 0);
  const abonosPeriodo = ledgerPeriodo.filter((l) => l.tipo === "ingreso" && !l.ventaId).reduce((s, l) => s + l.monto, 0);
  const esUnDia = desde === hasta;
  const porCanal = useMemo(() => {
    const m = {};
    data.rangeVentas.forEach((v) => {
      const k = v.canalNombre || "Directo";
      m[k] = m[k] || { n: 0, total: 0, comision: 0 };
      m[k].n += 1; m[k].total += v.total; m[k].comision += v.comision || 0;
    });
    return Object.entries(m);
  }, [data.rangeVentas]);
  const masVendidos = useMemo(() => {
    const m = {};
    data.rangeVentas.forEach((v) => v.items.forEach((it) => {
      if (!it.productId) return; // se ignoran los fiados directos que no son un producto
      const k = it.base || it.nombre; // "Salchipapa + Queso" cuenta como Salchipapa
      m[k] = m[k] || { nombre: k, qty: 0, total: 0 };
      m[k].qty += it.qty; m[k].total += it.qty * it.precio;
    }));
    return Object.values(m).sort((a, b) => b.qty - a.qty || b.total - a.total).slice(0, 5);
  }, [data.rangeVentas]);
  const domiciliosPeriodo = data.rangeVentas.reduce((sum, v) => sum + (v.domicilio ? v.domicilio.costo : 0), 0);
  const porDomiciliario = useMemo(() => {
    const m = {};
    data.rangeVentas.forEach((v) => {
      if (!v.domicilio) return;
      const k = v.domicilio.domiciliario || "Sin asignar";
      m[k] = m[k] || { n: 0, costo: 0 };
      m[k].n += 1; m[k].costo += v.domicilio.costo || 0;
    });
    return Object.entries(m);
  }, [data.rangeVentas]);

  const { gate } = useCfg();
  const { cfg: cfgNeg } = useCfg();
  const descargarExcelLibre = async () => {
    const datos = {
      negocio: cfgNeg.nombre, desde, hasta,
      totalVendido: data.totalVendido, totalCostos: data.totalCostos, utilidadNeta: data.utilidadNeta, pctUtilidad: data.pctUtilidad,
      ingresos: ingresosPeriodo, gastos: gastosPeriodo, saldo: saldoPeriodo, efectivo: efectivoPeriodo, transferencia: transferenciaPeriodo,
      fiadoNuevo: fiadoNuevoPeriodo, totalFiado, comisiones: data.comisiones,
      ventas: [...data.rangeVentas].sort((x, y) => (`${x.fecha} ${x.hora || ""}` < `${y.fecha} ${y.hora || ""}` ? 1 : -1)),
      caja: [...ledgerPeriodo].sort(porRecienteLedger),
      fiado: fiado.filter((f) => f.monto > 0),
      pctLabels: pctItems.map((pi) => pi.label),
      productos: products.map((p) => { const st = structureFor(p, insumosMap, pctItems); return { nombre: p.nombre, precio: st.precio, insumos: st.insumos, items: st.items.map((it) => it.monto), utilidad: st.utilidad }; }),
    };
    try {
      await generarExcelBonito(datos);
    } catch (e) {
      console.error(e);
      alert("Para armar el Excel con colores la app necesita internet la primera vez. Revisa tu conexión e intenta de nuevo.");
    }
  };
  const descargarExcel = gate("Excel con colores", descargarExcelLibre);

  return (
    <div>
      <div className="flex items-center justify-between mb-3 no-print">
        <h1 className="display" style={{ color: BRAND.card, fontSize: 18 }}>Ventas e Informe</h1>
      </div>
      <div className="no-print flex gap-2 mb-2">
        {[["Hoy", 0], ["Ayer", -1]].map(([t, o]) => (
          <button key={t} onClick={() => { setDesde(diaRelativo(o)); setHasta(diaRelativo(o)); }} className="rounded-full px-3.5 py-1.5" style={{ background: BRAND.card, color: BRAND.ink, fontSize: 11.5, fontWeight: 700 }}>{t}</button>
        ))}
      </div>
      <div className="no-print flex gap-2 mb-4">
        <Field label="Desde"><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-full rounded-lg px-2 py-1.5 border text-xs" style={{ borderColor: "#EAE0CC" }} /></Field>
        <Field label="Hasta"><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-full rounded-lg px-2 py-1.5 border text-xs" style={{ borderColor: "#EAE0CC" }} /></Field>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-2">
        <StatCard label="Total vendido" value={cop(data.totalVendido)} color={BRAND.gold} />
        <StatCard label="Total costos" value={cop(data.totalCostos)} color={BRAND.salsa} />
        <StatCard label="Utilidad neta" value={cop(data.utilidadNeta)} color={BRAND.green} />
        <StatCard label="% Utilidad" value={`${data.pctUtilidad.toFixed(1)}%`} color={BRAND.ink} />
      </div>
      {data.comisiones > 0 && <p style={{ fontSize: 10.5, color: BRAND.salsa, fontWeight: 600, marginBottom: 6 }}>Incluye {cop(data.comisiones)} de comisiones de canales (Rappi, DiDi…), ya descontadas de la utilidad.</p>}
      <p className="no-print" style={{ fontSize: 10.5, color: BRAND.muted, marginBottom: 14 }}>Estos 4 datos son solo del rango de fechas de arriba (Desde/Hasta). Si no hay ventas registradas en esas fechas, van a aparecer en 0.</p>

      <div className="rounded-xl mb-4" style={{ background: BRAND.card }}>
        <p style={{ fontSize: 10.5, color: BRAND.muted, padding: "6px 8px 0" }}>👉 Desliza la tabla hacia los lados para ver todos los productos</p>
        <div style={{ overflowX: "auto" }}>
        <table className="w-full text-left" style={{ fontSize: 11, minWidth: 480 }}>
          <thead>
            <tr style={{ background: "#F4E3C1" }}>
              <th className="p-2">Rubro</th>
              {data.perProduct.map((p) => <th key={p.product.id} className="p-2 text-right">{p.product.nombre.replace("Salchipapa ", "")}</th>)}
              <th className="p-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r} style={{ borderTop: "1px solid #EFE6D4" }}>
                <td className="p-2" style={{ color: BRAND.ink }}>{data.rowLabels[r]}</td>
                {data.perProduct.map((p) => <td key={p.product.id} className="p-2 text-right" style={{ color: BRAND.muted }}>{cop(p.cols[r])}</td>)}
                <td className="p-2 text-right font-semibold" style={{ color: BRAND.ink }}>{cop(data.perProduct.reduce((s, p) => s + p.cols[r], 0))}</td>
              </tr>
            ))}
            <tr style={{ borderTop: "2px solid #E0D2AE" }}>
              <td className="p-2 font-bold" style={{ color: BRAND.ink }}>Cantidad vendida</td>
              {data.perProduct.map((p) => <td key={p.product.id} className="p-2 text-right font-bold" style={{ color: BRAND.ink }}>{p.qty}</td>)}
              <td className="p-2 text-right font-bold" style={{ color: BRAND.ink }}>{data.perProduct.reduce((s, p) => s + p.qty, 0)}</td>
            </tr>
          </tbody>
        </table>
        </div>
      </div>

      {masVendidos.length > 0 && (
        <div className="rounded-xl p-4 mb-4" style={{ background: BRAND.card }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.ink, marginBottom: 6 }}>🏆 Productos más vendidos</div>
          {masVendidos.map((p, idx) => (
            <div key={p.nombre} className="flex items-center gap-2" style={{ padding: "4px 0", borderTop: idx ? "1px solid #EFE6D4" : "none" }}>
              <span style={{ width: 22, fontSize: 14, textAlign: "center" }}>{["🥇", "🥈", "🥉"][idx] || `${idx + 1}.`}</span>
              <span className="flex-1 min-w-0" style={{ fontSize: 12.5, color: BRAND.ink, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre.replace("Salchipapa ", "")}</span>
              <span style={{ fontSize: 12, color: BRAND.muted }}>{p.qty} {p.qty === 1 ? "vendido" : "vendidos"}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.gold2, minWidth: 74, textAlign: "right" }}>{cop(p.total)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.card }}>Ventas del periodo</span>
        <span style={{ fontSize: 11, color: BRAND.muted }} className="no-print">Toca una para editar o eliminar</span>
      </div>
      <div className="space-y-2 mb-4">
        {data.rangeVentas.length === 0 && <p style={{ fontSize: 12.5, color: BRAND.muted }}>No hay ventas en este periodo.</p>}
        {data.rangeVentas.map((v) => (
          <button key={v.id} onClick={() => onEditVenta(v)} className="w-full rounded-xl p-3 flex items-center gap-2.5 text-left" style={{ background: BRAND.card, borderLeft: `4px solid ${v.pago === "fiado" ? BRAND.salsa : BRAND.green}` }}>
            <div className="flex-1 min-w-0 pr-2">
              <div style={{ fontSize: 12.5, fontWeight: 600, color: BRAND.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {v.items.map((i) => `${i.qty}x ${i.nombre.replace("Salchipapa ", "")}`).join(", ")}
              </div>
              <div style={{ fontSize: 11, color: BRAND.muted }}>{fmtDateLong(v.fecha)} · {v.pago === "fiado" ? `Fiado${v.cliente ? " — " + v.cliente : ""}` : `Pagada · ${(v.metodoPago || "efectivo") === "efectivo" ? "💵 Efectivo" : "🏦 Transferencia"}`}{v.canalNombre && v.canalNombre !== "Directo" ? ` · 📦 ${v.canalNombre}` : ""}{estadoDe(v) !== "entregado" ? ` · ${estadoInfo(estadoDe(v)).emoji} ${estadoInfo(estadoDe(v)).label}` : ""}</div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span style={{ fontSize: 13.5, fontWeight: 700, color: BRAND.gold2, whiteSpace: "nowrap" }}>{cop(v.total)}</span>
              <Pencil size={13} color={BRAND.muted} />
            </div>
          </button>
        ))}
      </div>

      <div className="rounded-xl p-4 mb-4" style={{ background: BRAND.card }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.ink, marginBottom: 2 }}>{esUnDia ? "Resumen del día" : "Resumen del periodo"}</div>
        <p style={{ fontSize: 10, color: BRAND.muted, marginBottom: 8 }}>{esUnDia ? fmtDateLong(desde) : `Del ${fmtDate(desde)} al ${fmtDate(hasta)}`}</p>
        <RowKV k="Vendido" v={cop(vendidoPeriodo)} bold />
        <RowKV k="💵 En efectivo" v={cop(vendidoPor("efectivo"))} />
        <RowKV k="🏦 Por transferencia" v={cop(vendidoPor("transferencia"))} />
        <RowKV k="📒 A fiado (sin cobrar)" v={cop(fiadoNuevoPeriodo)} />
        {domiciliosPeriodo > 0 && <RowKV k="🛵 Domicilios cobrados (ya incluidos)" v={cop(domiciliosPeriodo)} />}
        {porDomiciliario.length > 0 && (
          <div style={{ margin: "6px 0 2px", paddingTop: 6, borderTop: "1px dashed #E0D2AE" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: BRAND.muted, marginBottom: 2 }}>Por domiciliario</div>
            {porDomiciliario.map(([nombre, c]) => <RowKV key={nombre} k={`${nombre} · ${c.n} ${c.n === 1 ? "domicilio" : "domicilios"}`} v={cop(c.costo)} />)}
          </div>
        )}
        {data.comisiones > 0 && <RowKV k="📦 Comisiones de canales" v={`−${cop(data.comisiones)}`} />}
        {(porCanal.length > 1 || data.comisiones > 0) && (
          <div style={{ margin: "6px 0 2px", paddingTop: 6, borderTop: "1px dashed #E0D2AE" }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: BRAND.muted, marginBottom: 2 }}>Por canal</div>
            {porCanal.map(([nombre, c]) => <RowKV key={nombre} k={`${nombre} · ${c.n} ${c.n === 1 ? "pedido" : "pedidos"}`} v={cop(c.total)} />)}
          </div>
        )}
        <div style={{ height: 1, background: "#EFE6D4", margin: "8px 0" }} />
        <RowKV k="Gastado" v={cop(gastosPeriodo)} bold />
        <RowKV k="Abonos de fiado y otros ingresos" v={cop(abonosPeriodo)} />
        <div style={{ height: 1, background: "#EFE6D4", margin: "8px 0" }} />
        <RowKV k="Saldo (entró − salió)" v={cop(saldoPeriodo)} bold />
        <p style={{ fontSize: 10, color: BRAND.muted, marginTop: 6 }}>Fiado pendiente en la libreta hoy: {cop(totalFiado)}</p>
      </div>

      <div className="no-print flex gap-2">
        <button onClick={descargarExcel} className="flex-1 rounded-full py-3 font-bold text-white flex items-center justify-center gap-2" style={{ background: BRAND.green }}><Download size={16} /> Excel 👑</button>
        <button onClick={gate("Reporte en PDF", () => window.print())} className="flex-1 rounded-full py-3 font-bold text-white flex items-center justify-center gap-2" style={{ background: BRAND.ink }}><Printer size={16} /> PDF 👑</button>
      </div>
    </div>
  );
}
function StatCard({ label, value, color }) {
  return <div className="rounded-xl p-3" style={{ background: BRAND.card }}><div style={{ fontSize: 11, color: BRAND.muted, fontWeight: 600 }}>{label}</div><div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div></div>;
}
function RowKV({ k, v, bold }) {
  return <div className="flex items-center justify-between" style={{ padding: "3px 0" }}><span style={{ fontSize: 12.5, color: BRAND.muted }}>{k}</span><span style={{ fontSize: 13, fontWeight: bold ? 700 : 600, color: BRAND.ink }}>{v}</span></div>;
}

function VentaEditModal({ venta, onClose, onSave, onDelete }) {
  const [items, setItems] = useState(() => venta.items.map((i) => ({ ...i })));
  const [pago, setPago] = useState(venta.pago);
  const [metodoPago, setMetodoPago] = useState(venta.metodoPago || "efectivo");
  const [cliente, setCliente] = useState(venta.cliente || "");
  const [fecha, setFecha] = useState(venta.fecha);
  const { canales, esPremium, abrirPremium } = useCfg();
  const idCanalOriginal = venta.canal || "directo";
  const [canalId, setCanalId] = useState(idCanalOriginal);
  const [estado, setEstado] = useState(estadoDe(venta));
  const opcionesCanal = canales.some((c) => c.id === idCanalOriginal) ? canales : [...canales, { id: idCanalOriginal, nombre: venta.canalNombre || idCanalOriginal, comision: venta.comisionPct || 0, custom: true }];
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [domOn, setDomOn] = useState(!!venta.domicilio);
  const [dir, setDir] = useState(venta.domicilio?.direccion || "");
  const [domCosto, setDomCosto] = useState(String(venta.domicilio?.costo ?? ""));
  const [domiciliario, setDomiciliario] = useState(venta.domicilio?.domiciliario || "");
  const subtotal = items.reduce((s, i) => s + i.qty * i.precio, 0);
  const costoDom = domOn ? Math.max(0, Number(domCosto) || 0) : 0;
  const total = subtotal + costoDom;
  // Cada renglón se identifica por su "lid" (las ventas viejas, por su producto)
  const cambiarQty = (clave, delta) => {
    setItems((prev) => prev.map((i) => (i.lid || i.productId) === clave ? { ...i, qty: i.qty + delta } : i).filter((i) => i.qty > 0));
  };
  const canSave = items.length > 0 && (pago !== "fiado" || cliente.trim().length > 0) && (!domOn || dir.trim().length > 0);

  return (
    <ModalShell onClose={onClose} title="Editar venta">
      <Field label="Productos">
        <div className="space-y-2 mb-1">
          {items.map((i) => (
            <div key={i.lid || i.productId} className="flex items-center justify-between">
              <span style={{ fontSize: 12.5, color: BRAND.ink }}>{i.nombre.replace("Salchipapa ", "")}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => cambiarQty(i.lid || i.productId, -1)} className="rounded-full p-1" style={{ background: BRAND.bg }}><Minus size={12} color="white" /></button>
                <span style={{ minWidth: 16, textAlign: "center", fontWeight: 700, color: BRAND.ink }}>{i.qty}</span>
                <button onClick={() => cambiarQty(i.lid || i.productId, 1)} className="rounded-full p-1" style={{ background: BRAND.bg }}><Plus size={12} color="white" /></button>
              </div>
            </div>
          ))}
          {items.length === 0 && <p style={{ fontSize: 12, color: BRAND.salsa }}>Sin productos — usa "Eliminar venta" si ya no aplica.</p>}
        </div>
      </Field>
      <Field label="Forma de pago">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setPago("pago")} className="rounded-lg py-2 border-2 text-sm font-semibold" style={{ borderColor: pago === "pago" ? BRAND.green : "#EAE0CC", color: BRAND.ink }}>Pago</button>
          <button onClick={() => setPago("fiado")} className="rounded-lg py-2 border-2 text-sm font-semibold" style={{ borderColor: pago === "fiado" ? BRAND.salsa : "#EAE0CC", color: BRAND.ink }}>Fiado</button>
        </div>
      </Field>
      {pago === "pago" && (
        <Field label="Efectivo o transferencia">
          <MetodoPagoToggle value={metodoPago} onChange={setMetodoPago} />
        </Field>
      )}
      <Field label={pago === "fiado" ? "Cliente (obligatorio)" : "Cliente (opcional)"}>
        <input value={cliente} onChange={(e) => setCliente(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} placeholder="Nombre del cliente" />
      </Field>
      <Field label="Fecha"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} /></Field>
      <Field label="Domicilio">
        <button type="button" onClick={() => setDomOn(!domOn)} className="w-full rounded-lg py-2 border-2 text-sm font-semibold" style={{ borderColor: domOn ? BRAND.gold2 : "#EAE0CC", background: domOn ? "#FBF3E1" : "white", color: BRAND.ink }}>🛵 {domOn ? "Es domicilio" : "No es domicilio"}</button>
        {domOn && (
          <div className="mt-2 space-y-2">
            <input value={dir} onChange={(e) => setDir(e.target.value)} placeholder="Dirección de entrega" className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} />
            <div className="flex gap-2">
              <input type="number" inputMode="numeric" value={domCosto} onChange={(e) => setDomCosto(e.target.value)} placeholder="Costo" className="w-1/2 rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} />
              <input value={domiciliario} onChange={(e) => setDomiciliario(e.target.value)} placeholder="Domiciliario" className="w-1/2 rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} />
            </div>
          </div>
        )}
      </Field>
      <Field label="Canal del pedido">
        <div className="flex flex-wrap gap-1.5">
          {opcionesCanal.map((c) => {
            const bloqueado = c.custom && !esPremium && c.id !== idCanalOriginal;
            const sel = canalId === c.id;
            return (
              <button key={c.id} type="button" onClick={() => (bloqueado ? abrirPremium("Canales con comisión (Rappi, DiDi…)") : setCanalId(c.id))} className="rounded-full px-3 py-1.5 border-2" style={{ borderColor: sel ? BRAND.gold2 : "#EAE0CC", background: sel ? "#FBF3E1" : "white", color: BRAND.ink, fontSize: 12, fontWeight: 700 }}>
                {c.nombre}{bloqueado ? " 👑" : ""}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Estado del pedido">
        <div className="grid grid-cols-2 gap-2">
          {ESTADOS.map((e) => (
            <button key={e.id} type="button" onClick={() => setEstado(e.id)} className="rounded-lg py-2 border-2 text-sm font-semibold" style={{ borderColor: estado === e.id ? e.color : "#EAE0CC", background: estado === e.id ? e.bg : "white", color: BRAND.ink }}>{e.emoji} {e.label}</button>
          ))}
        </div>
      </Field>
      <div className="rounded-lg p-2.5 mb-3 flex items-center justify-between" style={{ background: "#F4E3C1" }}>
        <span style={{ fontSize: 12, color: BRAND.ink }}>Total</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: BRAND.ink }}>{cop(total)}</span>
      </div>
      <div className="flex gap-2 mt-1 mb-2">
        <button onClick={onClose} className="flex-1 rounded-full py-3 font-bold" style={{ background: "#F0E9D8", color: BRAND.ink }}>Cancelar</button>
        <button disabled={!canSave} onClick={() => onSave(venta, { items, pago, metodoPago, cliente: cliente.trim(), fecha, total, subtotal, canalId, estado, domicilio: domOn ? { direccion: dir.trim(), costo: costoDom, domiciliario: domiciliario.trim() } : null })} className="flex-1 rounded-full py-3 font-bold text-white disabled:opacity-40" style={{ background: BRAND.ink }}>Guardar</button>
      </div>
      {!confirmDelete ? (
        <button onClick={() => setConfirmDelete(true)} className="w-full rounded-full py-2.5 font-bold flex items-center justify-center gap-2" style={{ color: BRAND.salsa }}><Trash2 size={14} /> Eliminar venta</button>
      ) : (
        <div className="rounded-xl p-3" style={{ background: "#FBEAE4" }}>
          <p style={{ fontSize: 12.5, color: BRAND.ink, marginBottom: 8 }}>¿Eliminar esta venta? {venta.pago === "fiado" ? "Se descontará del saldo fiado del cliente." : "Se quitará del Libro de Caja."} Podrás deshacerlo justo después, o restaurarlo luego desde la Papelera.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-full py-2 font-bold text-sm" style={{ background: "white", color: BRAND.ink }}>No</button>
            <button onClick={() => onDelete(venta)} className="flex-1 rounded-full py-2 font-bold text-sm text-white" style={{ background: BRAND.salsa }}>Sí, eliminar</button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

function AbonoEditModal({ entry, onClose, onSave, onDelete }) {
  const [monto, setMonto] = useState(String(entry.monto));
  const [fecha, setFecha] = useState(entry.fecha);
  const [metodoPago, setMetodoPago] = useState(entry.metodoPago || "efectivo");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const nombreCliente = entry.concepto.replace("Abono fiado — ", "");
  const canSave = Number(monto) > 0;

  return (
    <ModalShell onClose={onClose} title={`Abono de ${nombreCliente}`}>
      <Field label="Monto del abono"><input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} /></Field>
      <Field label="Fecha"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} /></Field>
      <Field label="Efectivo o transferencia"><MetodoPagoToggle value={metodoPago} onChange={setMetodoPago} /></Field>
      <p style={{ fontSize: 11, color: BRAND.muted, marginBottom: 12 }}>Si cambias el monto, el saldo que debe el cliente se ajusta solo, y también se corrige en el Libro de Caja.</p>
      <div className="flex gap-2 mt-1 mb-2">
        <button onClick={onClose} className="flex-1 rounded-full py-3 font-bold" style={{ background: "#F0E9D8", color: BRAND.ink }}>Cancelar</button>
        <button disabled={!canSave} onClick={() => onSave(entry, Number(monto), fecha, metodoPago)} className="flex-1 rounded-full py-3 font-bold text-white disabled:opacity-40" style={{ background: BRAND.ink }}>Guardar</button>
      </div>
      {!confirmDelete ? (
        <button onClick={() => setConfirmDelete(true)} className="w-full rounded-full py-2.5 font-bold flex items-center justify-center gap-2" style={{ color: BRAND.salsa }}><Trash2 size={14} /> Eliminar abono</button>
      ) : (
        <div className="rounded-xl p-3" style={{ background: "#FBEAE4" }}>
          <p style={{ fontSize: 12.5, color: BRAND.ink, marginBottom: 8 }}>¿Eliminar este abono? Se le vuelve a sumar el monto a la deuda de {nombreCliente}. Podrás deshacerlo justo después, o restaurarlo luego desde la Papelera.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-full py-2 font-bold text-sm" style={{ background: "white", color: BRAND.ink }}>No</button>
            <button onClick={() => onDelete(entry)} className="flex-1 rounded-full py-2 font-bold text-sm text-white" style={{ background: BRAND.salsa }}>Sí, eliminar</button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}

/* ============================= INSUMOS Y RECETAS ============================= */
function Insumos({ products, insumos, insumosMap, pctItems, onEditPctItems, onEditInsumo, onNewInsumo, onEditReceta, onExportBackup, onImportBackup, onRespaldarAhora, lastBackup, onDrive, onRestaurarDrive, lastDrive, trash, onRestaurarTrash, onVaciarPapelera, qrPago, onChangeQrPago }) {
  const [pctLocal, setPctLocal] = useState(pctItems);
  useEffect(() => setPctLocal(pctItems), [pctItems]);

  const cambiarPct = (id, campo, valor) => setPctLocal((prev) => prev.map((pi) => pi.id === id ? { ...pi, [campo]: valor } : pi));
  const agregarPct = () => setPctLocal((prev) => [...prev, { id: uid(), label: "Nueva categoría", valor: 0 }]);
  const quitarPct = (id) => setPctLocal((prev) => prev.filter((pi) => pi.id !== id));
  const guardarPct = () => onEditPctItems(pctLocal.map((pi) => ({ ...pi, valor: Number(pi.valor) || 0 })));
  const totalPct = pctLocal.reduce((s, pi) => s + (Number(pi.valor) || 0), 0);

  return (
    <div>
      <h1 className="display" style={{ color: BRAND.card, fontSize: 18, marginBottom: 4 }}>Insumos y recetas</h1>
      <p style={{ color: BRAND.muted, fontSize: 11.5, marginBottom: 14 }}>Aquí puedes ajustar cuánto te vale cada insumo, los % de tu estructura de costos (agregar o quitar categorías), y la receta de cada producto.</p>

      <div className="rounded-xl p-4 mb-4" style={{ background: BRAND.card }}>
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.ink }}>Estructura de costos (% sobre el precio)</span>
          <span style={{ fontSize: 11, color: BRAND.muted }}>Suma: {totalPct}%</span>
        </div>
        <div className="space-y-2 mb-3">
          {pctLocal.map((pi) => (
            <div key={pi.id} className="flex items-center gap-2">
              <input value={pi.label} onChange={(e) => cambiarPct(pi.id, "label", e.target.value)} className="flex-1 rounded-lg px-2 py-1.5 border text-xs" style={{ borderColor: "#EAE0CC" }} placeholder="Nombre de la categoría" />
              <input type="number" value={pi.valor} onChange={(e) => cambiarPct(pi.id, "valor", e.target.value)} className="rounded-lg px-2 py-1.5 border text-xs text-right" style={{ borderColor: "#EAE0CC", width: 60 }} />
              <span style={{ fontSize: 11, color: BRAND.muted }}>%</span>
              <button onClick={() => quitarPct(pi.id)}><X size={16} color={BRAND.salsa} /></button>
            </div>
          ))}
          {pctLocal.length === 0 && <p style={{ fontSize: 12, color: BRAND.muted }}>No tienes categorías de costo. Agrega al menos una.</p>}
        </div>
        <button onClick={agregarPct} className="w-full rounded-full py-2 font-bold mb-2 flex items-center justify-center gap-2 text-sm" style={{ background: "#F4E3C1", color: BRAND.ink }}>
          <Plus size={14} /> Agregar categoría
        </button>
        <button onClick={guardarPct} className="w-full rounded-full py-2.5 font-bold text-white" style={{ background: BRAND.ink }}>Guardar porcentajes</button>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.card }}>Insumos y su costo</span>
        <button onClick={onNewInsumo} className="rounded-full px-3 py-1 flex items-center gap-1" style={{ background: BRAND.card }}>
          <Plus size={13} color={BRAND.ink} /><span style={{ fontSize: 11, fontWeight: 700, color: BRAND.ink }}>Nuevo</span>
        </button>
      </div>
      <div className="rounded-xl overflow-hidden mb-4" style={{ background: BRAND.card }}>
        {insumos.length === 0 && <p style={{ fontSize: 12, color: BRAND.muted, padding: 12 }}>Aún no tienes insumos. Toca "Nuevo" para agregar el primero (lo que compras: papa, aceite, empaques…).</p>}
        {insumos.map((i, idx) => (
          <button key={i.id} onClick={() => onEditInsumo(i)} className="w-full flex items-center justify-between px-3 py-2.5 text-left" style={{ borderTop: idx > 0 ? "1px solid #EFE6D4" : "none" }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: BRAND.ink }}>{i.nombre}</div>
              <div style={{ fontSize: 10.5, color: BRAND.muted }}>
                {i.cantidadCompra ? `${i.cantidadCompra} ${i.unidadCompra || i.unidad} · ${cop(i.valorCompra)}` : `por ${i.unidad}`}
              </div>
              {rastreaStock(i) && (
                <div style={{ fontSize: 10.5, fontWeight: 700, color: estadoStock(i) === "ok" ? BRAND.green : BRAND.salsa }}>
                  {estadoStock(i) === "agotado" ? "⛔ Agotado" : estadoStock(i) === "bajo" ? `⚠️ Por agotarse · quedan ${fmtNum(i.stock)} ${i.unidad}` : `📦 Quedan ${fmtNum(i.stock)} ${i.unidad}`}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="text-right">
                <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold2 }}>{cop(i.costoUnitario)}</div>
                <div style={{ fontSize: 9.5, color: BRAND.muted }}>por {i.unidad}</div>
              </div>
              <Pencil size={12} color={BRAND.muted} />
            </div>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.card, marginBottom: 8 }}>Receta por producto</div>
      <div className="space-y-2 mb-4">
        {products.length === 0 && <p style={{ fontSize: 12, color: BRAND.muted }}>Aún no tienes productos. Agrégalos en la pestaña Menú y luego arma su receta aquí.</p>}
        {products.map((p) => {
          const costo = costoReceta(p, insumosMap);
          return (
            <button key={p.id} onClick={() => onEditReceta(p)} className="w-full rounded-xl p-3 flex items-center justify-between text-left" style={{ background: BRAND.card }}>
              <div className="flex items-center gap-2">
                {p.foto ? <img src={p.foto} alt="" style={{ width: 22, height: 22, objectFit: "contain" }} /> : <span style={{ fontSize: 20 }}>{p.emoji}</span>}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.ink }}>{p.nombre}</div>
                  <div style={{ fontSize: 11, color: BRAND.muted }}>{(p.receta || []).length} ingredientes · costo {cop(costo)}</div>
                </div>
              </div>
              <ChevronRight size={16} color={BRAND.muted} />
            </button>
          );
        })}
      </div>

      <PlanCard />
      <CompartirCard />
      <CatalogoCard products={products} />
      <NegocioConfig />
      <QrPagoConfig qrPago={qrPago} onChange={onChangeQrPago} />

      <div className="rounded-xl p-4 mb-4" style={{ background: BRAND.card }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.ink, marginBottom: 4 }}>Copia de seguridad</div>
        <p style={{ fontSize: 11, color: lastBackup ? BRAND.muted : BRAND.salsa, fontWeight: lastBackup ? 400 : 700, marginBottom: 6 }}>
          {lastBackup ? `Último respaldo: ${fmtDateLong(lastBackup.slice(0, 10))}` : "Todavía no has hecho ningún respaldo"}
        </p>
        <p style={{ fontSize: 11, color: BRAND.muted, marginBottom: 10 }}>Envía tus datos por WhatsApp, Drive o correo para que no vivan solo en este celular.</p>
        <button onClick={onDrive} className="w-full rounded-full py-2.5 font-bold text-white flex items-center justify-center gap-2 text-sm mb-1" style={{ background: "#4285F4" }}>☁️ Guardar en Google Drive 👑</button>
        {lastDrive && <p style={{ fontSize: 10.5, color: BRAND.muted, marginBottom: 6 }}>Último en Drive: {fmtDateLong(lastDrive.slice(0, 10))}</p>}
        <div style={{ height: 6 }} />
        <div className="flex gap-2">
          <button onClick={onExportBackup} className="flex-1 rounded-full py-2.5 font-bold text-white flex items-center justify-center gap-2 text-sm" style={{ background: BRAND.green }}>
            <Download size={14} /> Descargar
          </button>
          <button onClick={onImportBackup} className="flex-1 rounded-full py-2.5 font-bold flex items-center justify-center gap-2 text-sm" style={{ background: "#F4E3C1", color: BRAND.ink }}>
            <Upload size={14} /> Restaurar
          </button>
        </div>
        <button onClick={onRestaurarDrive} className="w-full mt-2 text-center" style={{ fontSize: 11.5, color: BRAND.muted, textDecoration: "underline" }}>☁️ Restaurar desde Google Drive</button>
      </div>

      <Papelera trash={trash} onRestaurar={onRestaurarTrash} onVaciar={onVaciarPapelera} />
      <BorrarDatosCard />
      <AcercaCard />
    </div>
  );
}

/* ============================= DATOS DE PAGO (NÚMERO Y QR) ============================= */
function QrPagoConfig({ qrPago, onChange }) {
  const [telefono, setTelefono] = useState(qrPago.telefono || "");
  const [fotoLoading, setFotoLoading] = useState(false);
  const [fotoError, setFotoError] = useState("");
  const camInputRef = useRef(null);
  const galInputRef = useRef(null);

  const guardarTelefono = () => onChange({ ...qrPago, telefono: telefono.trim() });
  const handleFotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFotoLoading(true); setFotoError("");
    try {
      const dataUrl = await resizeImageFile(file);
      onChange({ ...qrPago, foto: dataUrl });
    } catch {
      setFotoError("No se pudo procesar la imagen. Intenta con otra.");
    } finally {
      setFotoLoading(false);
    }
  };

  return (
    <div className="rounded-xl p-4 mb-4" style={{ background: BRAND.card }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.ink, marginBottom: 4 }}>Datos de pago (número y QR)</div>
      <p style={{ fontSize: 11, color: BRAND.muted, marginBottom: 10 }}>Esto aparece en el resumen y en el mensaje cuando un pedido se paga por transferencia o queda fiado. Si lo dejas vacío, no sale nada.</p>
      <Field label="Número donde te deben consignar (opcional)">
        <input value={telefono} onChange={(e) => setTelefono(e.target.value)} onBlur={guardarTelefono} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} placeholder="Déjalo en blanco si no quieres mostrar número" />
      </Field>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: BRAND.muted, marginBottom: 4 }}>Foto de tu código QR (opcional)</div>
      <FotoAdjunta foto={qrPago.foto} loading={fotoLoading} error={fotoError} onRemove={() => onChange({ ...qrPago, foto: null })} onCamera={() => camInputRef.current?.click()} onGaleria={() => galInputRef.current?.click()} />
      <input ref={camInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoChange} />
      <input ref={galInputRef} type="file" accept="image/*" className="hidden" onChange={handleFotoChange} />
      <p style={{ fontSize: 10.5, color: BRAND.muted, marginTop: 6 }}>Tip: abre tu app de pagos, busca tu código QR para cobrar, tómale una captura de pantalla y súbela aquí.</p>
    </div>
  );
}

/* ============================= PAPELERA: recuperar lo eliminado por error (30 días) ============================= */
function Papelera({ trash, onRestaurar, onVaciar }) {
  const [open, setOpen] = useState(false);
  if (!trash || trash.length === 0) return null;
  const haceTiempo = (iso) => {
    const dias = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
    if (dias <= 0) return "hoy";
    if (dias === 1) return "hace 1 día";
    return `hace ${dias} días`;
  };
  return (
    <div className="rounded-xl p-4 mb-4" style={{ background: BRAND.card }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between">
        <span style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.ink }}>🗑️ Papelera ({trash.length})</span>
        <ChevronRight size={16} color={BRAND.muted} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
      </button>
      {open && (
        <div className="mt-3 space-y-2">
          <p style={{ fontSize: 10.5, color: BRAND.muted, marginBottom: 2 }}>Lo que eliminas queda aquí 30 días por si lo necesitas de vuelta.</p>
          {trash.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "#F4E3C1" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: BRAND.ink }}>{t.label}</div>
                <div style={{ fontSize: 10, color: BRAND.muted }}>{haceTiempo(t.deletedAt)}</div>
              </div>
              <button onClick={() => onRestaurar(t.id)} className="rounded-full px-3 py-1.5 font-bold text-xs text-white flex-shrink-0" style={{ background: BRAND.ink }}>Restaurar</button>
            </div>
          ))}
          <button onClick={onVaciar} className="w-full rounded-full py-2 font-bold text-xs mt-1" style={{ color: BRAND.salsa }}>Vaciar papelera</button>
        </div>
      )}
    </div>
  );
}

function InsumoModal({ insumo, onClose, onSave, onDelete }) {
  const isNew = !insumo;
  const [nombre, setNombre] = useState(insumo?.nombre || "");
  const [unidad, setUnidad] = useState(insumo?.unidad || "g");
  const [unidadCompra, setUnidadCompra] = useState(insumo?.unidadCompra || insumo?.unidad || "g");
  const [cantidadCompra, setCantidadCompra] = useState(insumo?.cantidadCompra ?? "");
  const [valorCompra, setValorCompra] = useState(insumo?.valorCompra ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [stock, setStock] = useState(insumo && rastreaStock(insumo) ? String(insumo.stock) : "");
  const [minimo, setMinimo] = useState(insumo && insumo.minimo != null ? String(insumo.minimo) : "");
  const costoCalculado = calcCostoUnitario(valorCompra, cantidadCompra, unidadCompra, unidad);
  // Cuánto trae una compra normal, expresado en la unidad de la receta (para el botón "Llegó una compra")
  const cantCompraEnUnidad = (() => {
    const uc = (unidadCompra || "").toLowerCase(), ur = (unidad || "").toLowerCase();
    const fc = UNIT_FAMILY[uc] || "cant", fr = UNIT_FAMILY[ur] || "cant";
    const c = Number(cantidadCompra) || 0;
    return fc === fr && fc !== "cant" ? c * ((UNIT_FACTORS[uc] || 1) / (UNIT_FACTORS[ur] || 1)) : c;
  })();
  const canSave = nombre.trim() && Number(valorCompra) > 0 && Number(cantidadCompra) > 0;

  return (
    <ModalShell onClose={onClose} title={isNew ? "Nuevo insumo" : "Editar insumo"}>
      <Field label="Nombre"><input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} placeholder="Ej: Papa" /></Field>
      <Field label="Unidad usada en la receta">
        <div className="grid grid-cols-4 gap-2">
          {UNIDADES.map((u) => <button key={u} onClick={() => setUnidad(u)} className="rounded-lg py-2 border-2 text-xs font-semibold" style={{ borderColor: unidad === u ? BRAND.gold2 : "#EAE0CC", color: BRAND.ink }}>{u}</button>)}
        </div>
      </Field>
      <div className="rounded-lg p-2.5 mb-3" style={{ background: "#F4E3C1" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.ink, marginBottom: 8 }}>Cómo lo compras</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Field label="Valor de compra ($)"><input type="number" value={valorCompra} onChange={(e) => setValorCompra(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} placeholder="Ej: 29000" /></Field>
          <Field label="Cantidad comprada"><input type="number" value={cantidadCompra} onChange={(e) => setCantidadCompra(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} placeholder="Ej: 25" /></Field>
        </div>
        <Field label="Unidad de compra (ej: libras, kg, sobres, unidades...)">
          <input value={unidadCompra} onChange={(e) => setUnidadCompra(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} placeholder="Ej: libras" />
        </Field>
        <p style={{ fontSize: 10.5, color: BRAND.muted, marginBottom: 0 }}>Si compras en libras y usas la receta en gramos, la app convierte solo automáticamente (1 libra = 453,6 g). Lo mismo con litros/ml.</p>
      </div>
      <div className="rounded-lg p-2.5 mb-3" style={{ background: "#FBF3E1" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.ink, marginBottom: 8 }}>📦 Inventario (opcional)</div>
        <div className="grid grid-cols-2 gap-2 mb-1">
          <Field label={`Cantidad en bodega (${unidad})`}><input type="number" inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} placeholder="Ej: 5000" /></Field>
          <Field label={`Avisar si baja de (${unidad})`}><input type="number" inputMode="decimal" value={minimo} onChange={(e) => setMinimo(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} placeholder="Ej: 1000" /></Field>
        </div>
        {cantCompraEnUnidad > 0 && (
          <button type="button" onClick={() => setStock(String(Math.round(((Number(stock) || 0) + cantCompraEnUnidad) * 100) / 100))} className="w-full rounded-full py-2 font-bold text-sm mb-1" style={{ background: "white", color: BRAND.ink }}>➕ Llegó una compra (+{fmtNum(cantCompraEnUnidad)} {unidad})</button>
        )}
        <p style={{ fontSize: 10.5, color: BRAND.muted, marginBottom: 0 }}>Si llenas la cantidad, la app la va descontando sola con cada venta (según la receta) y te avisa cuando se acabe. Déjala vacía si no quieres llevar inventario de este insumo.</p>
      </div>
      <div className="rounded-lg p-2.5 mb-4" style={{ background: "#EDF4EC" }}>
        <span style={{ fontSize: 12, color: BRAND.ink }}>Costo resultante por {unidad}: </span>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: BRAND.green }}>{cop(costoCalculado)}</span>
      </div>
      <div className="flex gap-2 mt-2 mb-2">
        <button onClick={onClose} className="flex-1 rounded-full py-3 font-bold" style={{ background: "#F0E9D8", color: BRAND.ink }}>Cancelar</button>
        <button disabled={!canSave} onClick={() => onSave({
          id: insumo?.id, nombre: nombre.trim(), unidad, unidadCompra: unidadCompra.trim() || unidad,
          cantidadCompra: Number(cantidadCompra), valorCompra: Number(valorCompra), costoUnitario: costoCalculado,
          stock: stock.trim() === "" ? null : Number(stock), minimo: minimo.trim() === "" ? null : Number(minimo),
        })} className="flex-1 rounded-full py-3 font-bold text-white disabled:opacity-40" style={{ background: BRAND.ink }}>{isNew ? "Crear insumo" : "Guardar"}</button>
      </div>
      {!isNew && (
        confirmDelete ? (
          <div className="rounded-xl p-3" style={{ background: "#FBEAE4" }}>
            <p style={{ fontSize: 12.5, color: BRAND.ink, marginBottom: 8 }}>¿Eliminar "{insumo.nombre}"? Si está usado en alguna receta, esa línea quedará en $0.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-full py-2 font-bold text-sm" style={{ background: "white", color: BRAND.ink }}>No</button>
              <button onClick={() => onDelete(insumo.id)} className="flex-1 rounded-full py-2 font-bold text-sm text-white" style={{ background: BRAND.salsa }}>Sí, eliminar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="w-full rounded-full py-2.5 font-bold flex items-center justify-center gap-2" style={{ color: BRAND.salsa }}><Trash2 size={14} /> Eliminar insumo</button>
        )
      )}
    </ModalShell>
  );
}

function RecetaModal({ product, insumos, insumosMap, onClose, onSave }) {
  const [receta, setReceta] = useState(product.receta || []);
  const [nuevoInsumo, setNuevoInsumo] = useState(insumos[0]?.id || "");
  const [nuevaCantidad, setNuevaCantidad] = useState("");
  const total = receta.reduce((s, r) => s + r.cantidad * (insumosMap[r.insumoId]?.costoUnitario || 0), 0);

  const agregar = () => {
    if (!nuevoInsumo || !nuevaCantidad) return;
    setReceta((prev) => {
      const existe = prev.find((r) => r.insumoId === nuevoInsumo);
      if (existe) return prev.map((r) => r.insumoId === nuevoInsumo ? { ...r, cantidad: r.cantidad + Number(nuevaCantidad) } : r);
      return [...prev, { insumoId: nuevoInsumo, cantidad: Number(nuevaCantidad) }];
    });
    setNuevaCantidad("");
  };
  const quitar = (insumoId) => setReceta((prev) => prev.filter((r) => r.insumoId !== insumoId));
  const cambiarCantidad = (insumoId, cantidad) => setReceta((prev) => prev.map((r) => r.insumoId === insumoId ? { ...r, cantidad: Number(cantidad) || 0 } : r));

  return (
    <ModalShell onClose={onClose} title={`Receta: ${product.nombre}`}>
      <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
        {receta.map((r) => {
          const ins = insumosMap[r.insumoId];
          if (!ins) return null;
          return (
            <div key={r.insumoId} className="flex items-center gap-2">
              <span style={{ fontSize: 12, color: BRAND.ink, flex: 1 }}>{ins.nombre}</span>
              <input type="number" value={r.cantidad} onChange={(e) => cambiarCantidad(r.insumoId, e.target.value)} className="rounded-lg px-2 py-1 border text-xs text-right" style={{ borderColor: "#EAE0CC", width: 64 }} />
              <span style={{ fontSize: 10.5, color: BRAND.muted, width: 24 }}>{ins.unidad}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: BRAND.gold2, width: 64, textAlign: "right" }}>{cop(r.cantidad * ins.costoUnitario)}</span>
              <button onClick={() => quitar(r.insumoId)}><X size={14} color={BRAND.salsa} /></button>
            </div>
          );
        })}
        {receta.length === 0 && <p style={{ fontSize: 12, color: BRAND.muted }}>Esta receta aún no tiene ingredientes.</p>}
        {insumos.length === 0 && <p style={{ fontSize: 12, color: BRAND.salsa, fontWeight: 600 }}>Primero crea tus insumos en la pestaña Insumos (botón "Nuevo").</p>}
      </div>
      <div className="rounded-lg p-2.5 mb-3" style={{ background: "#F4E3C1" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.ink, marginBottom: 6 }}>+ Agregar ingrediente</div>
        <div className="flex gap-2">
          <select value={nuevoInsumo} onChange={(e) => setNuevoInsumo(e.target.value)} className="flex-1 rounded-lg px-2 py-1.5 border text-xs" style={{ borderColor: "#EAE0CC" }}>
            {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          </select>
          <input type="number" value={nuevaCantidad} onChange={(e) => setNuevaCantidad(e.target.value)} placeholder="Cant." className="rounded-lg px-2 py-1.5 border text-xs" style={{ borderColor: "#EAE0CC", width: 64 }} />
          <button onClick={agregar} className="rounded-lg px-2.5" style={{ background: BRAND.ink }}><Plus size={14} color="white" /></button>
        </div>
      </div>
      <div className="rounded-lg p-2.5 mb-4" style={{ background: "#F4E3C1" }}>
        <span style={{ fontSize: 12, color: BRAND.ink }}>Costo total de la receta: </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: BRAND.ink }}>{cop(total)}</span>
      </div>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-full py-3 font-bold" style={{ background: "#F0E9D8", color: BRAND.ink }}>Cancelar</button>
        <button onClick={() => onSave(receta)} className="flex-1 rounded-full py-3 font-bold text-white" style={{ background: BRAND.ink }}>Guardar receta</button>
      </div>
    </ModalShell>
  );
}

/* ============================= ¿LLEVA ADICIÓN? (las adiciones quedan pegadas a ESE producto) ============================= */
function OpcionesModal({ producto, adiciones, onClose, onConfirm }) {
  const [cant, setCant] = useState({});
  const mover = (id, d) => setCant((prev) => { const n = Math.max(0, Math.min(9, (prev[id] || 0) + d)); const c = { ...prev }; if (n) c[id] = n; else delete c[id]; return c; });
  const elegidas = adiciones.filter((a) => cant[a.id]).map((a) => ({ productId: a.id, qty: cant[a.id] }));
  const extra = adiciones.reduce((s, a) => s + (cant[a.id] || 0) * a.precio, 0);
  return (
    <ModalShell onClose={onClose} title="¿Lleva alguna adición?">
      <div className="rounded-xl px-3 py-2.5 mb-3 flex items-center justify-between" style={{ background: "#FBF3E1" }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: BRAND.ink }}>{producto.emoji} {producto.nombre}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold2 }}>{cop(producto.precio)}</div>
      </div>
      <div className="space-y-1.5 mb-4">
        {adiciones.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: cant[a.id] ? "#FBEAE4" : "#FAF6EC", border: `1.5px solid ${cant[a.id] ? BRAND.salsa : "transparent"}` }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.ink }}>{a.emoji} {a.nombre}</div>
              <div style={{ fontSize: 11.5, color: BRAND.muted }}>+ {cop(a.precio)}</div>
            </div>
            <div className="flex items-center gap-2.5">
              {cant[a.id] ? <>
                <button onClick={() => mover(a.id, -1)} aria-label={`Quitar ${a.nombre}`} className="rounded-full p-1.5" style={{ background: BRAND.bg }}><Minus size={13} color="white" /></button>
                <span style={{ minWidth: 16, textAlign: "center", fontWeight: 700, color: BRAND.ink }}>{cant[a.id]}</span>
              </> : null}
              <button onClick={() => mover(a.id, 1)} aria-label={`Agregar ${a.nombre}`} className="rounded-full p-1.5" style={{ background: BRAND.bg }}><Plus size={13} color="white" /></button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => onConfirm(elegidas)} className="w-full rounded-full py-3 font-bold text-white mb-1" style={{ background: BRAND.salsa }}>
        {elegidas.length === 0 ? "Agregar sin adición" : `Agregar con adición · ${cop(producto.precio + extra)}`}
      </button>
    </ModalShell>
  );
}

/* ============================= SABOR DE LA BEBIDA (un toque) ============================= */
function SaborModal({ titulo, sabores, onClose, onConfirm }) {
  const disponibles = sabores.filter((s) => !s.agotado && s.nombre.trim());
  return (
    <ModalShell onClose={onClose} title="¿De qué sabor?">
      <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.ink, marginBottom: 10 }}>{titulo}</div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {disponibles.map((s) => (
          <button key={s.id} onClick={() => onConfirm(s.nombre.trim())} className="rounded-xl py-3 border-2 font-bold" style={{ borderColor: "#EAE0CC", background: "white", color: BRAND.ink, fontSize: 13.5 }}>{s.nombre}</button>
        ))}
      </div>
      {disponibles.length === 0 && <p style={{ fontSize: 12.5, color: BRAND.salsa, marginBottom: 10 }}>No hay sabores disponibles hoy.</p>}
      <button onClick={() => onConfirm("")} className="w-full text-center" style={{ fontSize: 12, color: BRAND.muted, textDecoration: "underline" }}>Agregar sin elegir sabor</button>
    </ModalShell>
  );
}

/* ============================= SUGERENCIA: "¿ALGO PARA TOMAR?" ============================= */
function SugerenciaBebida({ bebidas, onElegir, onCerrar, abajo = 66 }) {
  return (
    <div className="no-print fixed left-0 right-0 z-30 max-w-md mx-auto px-3" style={{ bottom: abajo }}>
      <div className="rounded-2xl px-3 py-2 flex items-center gap-2 shadow-lg" style={{ background: BRAND.card, border: `1.5px solid ${BRAND.gold}` }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: BRAND.ink, flexShrink: 0 }}>¿Algo para tomar? 🥤</span>
        <div className="flex gap-1.5 overflow-x-auto flex-1">
          {bebidas.map((b) => (
            <button key={b.id} onClick={() => onElegir(b)} className="rounded-full px-3 py-1.5 flex-shrink-0" style={{ background: BRAND.salsa, color: "white", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>
              {b.nombre.replace(/^(gaseosas?|bebidas?)\s*/i, "").trim() || b.nombre} · {cop(b.precio)}
            </button>
          ))}
        </div>
        <button onClick={onCerrar} aria-label="Cerrar sugerencia" className="flex-shrink-0 rounded-full p-1" style={{ background: "#F0E9D8" }}><X size={13} color={BRAND.ink} /></button>
      </div>
    </div>
  );
}

/* ============================= ADICIONES, BEBIDAS Y SABORES (todo editable) ============================= */
function ComplementosModal({ products, sabores, onClose, onEditProduct, onNewProduct, onSabores, onDeleteSabor }) {
  const [nuevo, setNuevo] = useState("");
  const adiciones = products.filter((p) => tipoDe(p) === "adicion").sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const bebidas = products.filter((p) => tipoDe(p) === "bebida").sort((a, b) => a.precio - b.precio);
  const existe = (n) => sabores.some((s) => sinTildes(s.nombre) === sinTildes(n));
  const agregar = () => {
    const n = nuevo.trim();
    if (!n || existe(n) || sabores.length >= MAX_SABORES) return;
    onSabores([...sabores, { id: uid(), nombre: n, agotado: false }]);
    setNuevo("");
  };
  const cambiar = (id, cambios) => onSabores(sabores.map((s) => s.id === id ? { ...s, ...cambios } : s));
  const cerrar = () => { if (sabores.some((s) => !s.nombre.trim())) onSabores(sabores.filter((s) => s.nombre.trim())); onClose(); };
  const fila = (p) => (
    <div key={p.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: "#FAF6EC" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.ink }}>{p.emoji} {p.nombre} <span style={{ color: BRAND.gold2, fontWeight: 700 }}>· {cop(p.precio)}</span></div>
      <button onClick={() => onEditProduct(p)} aria-label={`Editar ${p.nombre}`} className="rounded-full p-1.5" style={{ background: BRAND.bg }}><Pencil size={12} color={BRAND.gold} /></button>
    </div>
  );
  return (
    <ModalShell onClose={cerrar} title="Adiciones y sabores">
      <div style={{ fontSize: 12.5, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>➕ Adiciones</div>
      <p style={{ fontSize: 11, color: BRAND.muted, marginBottom: 8 }}>Salen en la pregunta "¿Lleva adición?" al agregar una comida, y quedan pegadas a ese producto.</p>
      <div className="space-y-1.5 mb-2">
        {adiciones.map(fila)}
        {adiciones.length === 0 && <p style={{ fontSize: 12, color: BRAND.muted }}>Aún no tienes adiciones.</p>}
      </div>
      <button onClick={() => onNewProduct("adicion")} className="w-full rounded-lg py-2 border-2 border-dashed mb-5 flex items-center justify-center gap-1" style={{ borderColor: BRAND.muted, color: BRAND.gold2, fontSize: 12, fontWeight: 700 }}><Plus size={13} /> Nueva adición</button>

      <div style={{ fontSize: 12.5, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>🥤 Bebidas (tamaños)</div>
      <p style={{ fontSize: 11, color: BRAND.muted, marginBottom: 8 }}>Cada tamaño es un producto con su precio. Salen en la sugerencia "¿Algo para tomar?".</p>
      <div className="space-y-1.5 mb-2">
        {bebidas.map(fila)}
        {bebidas.length === 0 && <p style={{ fontSize: 12, color: BRAND.muted }}>Aún no tienes bebidas.</p>}
      </div>
      <button onClick={() => onNewProduct("bebida")} className="w-full rounded-lg py-2 border-2 border-dashed mb-5 flex items-center justify-center gap-1" style={{ borderColor: BRAND.muted, color: BRAND.gold2, fontSize: 12, fontWeight: 700 }}><Plus size={13} /> Nuevo tamaño de bebida</button>

      <div style={{ fontSize: 12.5, fontWeight: 800, color: BRAND.ink, marginBottom: 6 }}>🍹 Sabores de la bebida (máximo {MAX_SABORES})</div>
      <p style={{ fontSize: 11, color: BRAND.muted, marginBottom: 8 }}>Se elige al pedir la bebida. Si se acaba uno, apágalo con "Hay": deja de salir hasta que lo vuelvas a prender.</p>
      <div className="space-y-1.5 mb-2">
        {sabores.map((s) => (
          <div key={s.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: s.agotado ? "#FBEAE4" : "#FAF6EC" }}>
            <input value={s.nombre} onChange={(e) => cambiar(s.id, { nombre: e.target.value })} aria-label="Nombre del sabor" className="flex-1 min-w-0 rounded-md px-2 py-1.5 border" style={{ borderColor: "#EAE0CC", fontSize: 13, background: "white" }} />
            <button onClick={() => cambiar(s.id, { agotado: !s.agotado })} aria-pressed={!s.agotado} className="rounded-full px-3 py-1.5 flex-shrink-0" style={{ background: s.agotado ? BRAND.salsa : BRAND.green, color: "white", fontSize: 11, fontWeight: 700 }}>{s.agotado ? "Agotado" : "Hay"}</button>
            <button onClick={() => onDeleteSabor(s.id)} aria-label={`Eliminar ${s.nombre}`} className="rounded-full p-1.5 flex-shrink-0" style={{ background: "#F0E9D8" }}><Trash2 size={13} color={BRAND.salsa} /></button>
          </div>
        ))}
        {sabores.length === 0 && <p style={{ fontSize: 12, color: BRAND.muted }}>Sin sabores: las bebidas se agregan directo, sin preguntar.</p>}
      </div>
      {sabores.length < MAX_SABORES ? (
        <div className="flex gap-2 mb-2">
          <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") agregar(); }} placeholder="Ej: Colombiana" className="flex-1 rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC", fontSize: 13 }} />
          <button disabled={!nuevo.trim() || existe(nuevo)} onClick={agregar} className="rounded-full px-4 font-bold text-white disabled:opacity-40" style={{ background: BRAND.ink, fontSize: 12.5 }}>Agregar</button>
        </div>
      ) : <p style={{ fontSize: 11.5, color: BRAND.muted, marginBottom: 8 }}>Llegaste al máximo de {MAX_SABORES} sabores. Elimina uno para agregar otro.</p>}
      {nuevo.trim() && existe(nuevo) && <p style={{ fontSize: 11.5, color: BRAND.salsa, marginBottom: 8 }}>Ese sabor ya está en la lista.</p>}
      <button onClick={cerrar} className="w-full rounded-full py-3 font-bold text-white mt-2" style={{ background: BRAND.ink }}>Listo</button>
    </ModalShell>
  );
}

/* ============================= PRODUCT MODAL ============================= */
function ProductModal({ product, categorias, defaultCat, defaultTipo, insumosMap, onClose, onSave, onDelete, onEditReceta }) {
  const isNew = !product;
  const [nombre, setNombre] = useState(product?.nombre || "");
  const [emoji, setEmoji] = useState(product?.emoji || (defaultTipo === "bebida" ? "🥤" : EMOJIS[0]));
  const [foto, setFoto] = useState(product?.foto || "");
  const [precio, setPrecio] = useState(product?.precio || "");
  const [tipo, setTipo] = useState(product ? tipoDe(product) : (defaultTipo || "comida"));
  const [permiteAdic, setPermiteAdic] = useState(!product?.sinAdiciones);
  const catSugerida = defaultCat
    || (defaultTipo === "adicion" && categorias.find((c) => /^adicion/i.test(sinTildes(c))))
    || (defaultTipo === "bebida" && categorias.find((c) => /^(gaseosa|bebida)/i.test(sinTildes(c))));
  const [categoria, setCategoria] = useState(product?.categoria || catSugerida || categorias[0] || "General");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fotoLoading, setFotoLoading] = useState(false);
  const [fotoError, setFotoError] = useState("");
  const camInputRef = useRef(null);
  const galInputRef = useRef(null);
  const canSave = nombre.trim() && Number(precio) > 0;
  const costoActual = product ? costoReceta(product, insumosMap) : 0;
  const opcionesCat = categorias.includes(categoria) ? categorias : [...categorias, categoria];

  const handleFotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFotoLoading(true); setFotoError("");
    try {
      const dataUrl = await resizeImageFile(file);
      setFoto(dataUrl);
    } catch {
      setFotoError("No se pudo procesar la imagen. Intenta con otra.");
    } finally {
      setFotoLoading(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title={isNew ? "Nuevo producto" : "Editar producto"}>
      <Field label="Nombre"><input value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} placeholder="Ej: Salchipapa Mixta" /></Field>
      <Field label="Foto del producto">
        <FotoAdjunta foto={foto} loading={fotoLoading} error={fotoError} onRemove={() => setFoto("")} onCamera={() => camInputRef.current?.click()} onGaleria={() => galInputRef.current?.click()} />
        <input ref={camInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoChange} />
        <input ref={galInputRef} type="file" accept="image/*" className="hidden" onChange={handleFotoChange} />
      </Field>
      <Field label="Precio de venta"><input type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} className="w-full rounded-lg px-3 py-2 border" style={{ borderColor: "#EAE0CC" }} placeholder="0" /></Field>
      <Field label="Tipo de producto">
        <div className="grid grid-cols-3 gap-2">
          {[["comida", "🍟 Comida"], ["adicion", "➕ Adición"], ["bebida", "🥤 Bebida"]].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTipo(id)} className="rounded-lg py-2 border-2 text-xs font-bold" style={{ borderColor: tipo === id ? BRAND.salsa : "#EAE0CC", background: tipo === id ? "#FBEAE4" : "white", color: BRAND.ink }}>{label}</button>
          ))}
        </div>
        <p style={{ fontSize: 11, color: BRAND.muted, marginTop: 6 }}>
          {tipo === "adicion" ? "Las adiciones (queso, chorizo…) no salen en el menú: se ofrecen al agregar una comida." : tipo === "bebida" ? "Las bebidas se sugieren con \"¿Algo para tomar?\" y preguntan el sabor." : "Las comidas preguntan \"¿Lleva adición?\" al agregarlas."}
        </p>
        {tipo === "comida" && (
          <label className="flex items-center gap-2 mt-2" style={{ fontSize: 12.5, color: BRAND.ink }}>
            <input type="checkbox" checked={permiteAdic} onChange={(e) => setPermiteAdic(e.target.checked)} /> Preguntar si lleva adición al agregarlo
          </label>
        )}
      </Field>
      <Field label="Pestaña del menú">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full rounded-lg px-3 py-2 border bg-white" style={{ borderColor: "#EAE0CC" }}>
          {opcionesCat.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      {!isNew ? (
        <button onClick={() => onEditReceta(product)} className="w-full rounded-lg p-3 mb-4 flex items-center justify-between" style={{ background: "#F4E3C1" }}>
          <span style={{ fontSize: 12, color: BRAND.ink }}>Receta actual: costo {cop(costoActual)}</span>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: BRAND.gold2 }}>Editar receta →</span>
        </button>
      ) : (
        <p style={{ fontSize: 11, color: BRAND.muted, marginBottom: 12 }}>Podrás agregar la receta (insumos, cantidades y empaque) después, desde la pestaña Insumos.</p>
      )}
      <div className="flex gap-2 mb-2">
        <button onClick={onClose} className="flex-1 rounded-full py-3 font-bold" style={{ background: "#F0E9D8", color: BRAND.ink }}>Cancelar</button>
        <button disabled={!canSave} onClick={() => onSave({ id: product?.id, nombre: nombre.trim(), emoji, foto, precio: Number(precio), categoria: categoria.trim() || "General", tipo, sinAdiciones: tipo === "comida" ? !permiteAdic : false })} className="flex-1 rounded-full py-3 font-bold text-white disabled:opacity-40" style={{ background: BRAND.ink }}>{isNew ? "Crear producto" : "Guardar cambios"}</button>
      </div>
      {!isNew && (
        confirmDelete ? (
          <div className="rounded-xl p-3 mt-1" style={{ background: "#FBEAE4" }}>
            <p style={{ fontSize: 12.5, color: BRAND.ink, marginBottom: 8 }}>¿Eliminar "{product.nombre}" del catálogo?</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-full py-2 font-bold text-sm" style={{ background: "white", color: BRAND.ink }}>No</button>
              <button onClick={() => onDelete(product.id)} className="flex-1 rounded-full py-2 font-bold text-sm text-white" style={{ background: BRAND.salsa }}>Sí, eliminar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="w-full rounded-full py-2.5 font-bold flex items-center justify-center gap-2 mt-1" style={{ color: BRAND.salsa }}><Trash2 size={14} /> Eliminar producto</button>
        )
      )}
    </ModalShell>
  );
}

/* ============================= UI GENÉRICOS ============================= */
function ModalShell({ title, onClose, children, action }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative max-w-md w-full rounded-t-3xl p-4 max-h-[85vh] overflow-y-auto" style={{ background: "white" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-full p-1" style={{ background: "#F0E9D8" }}><ArrowLeft size={16} color={BRAND.ink} /></button>
            <h2 className="display" style={{ fontSize: 17, color: BRAND.ink }}>{title}</h2>
          </div>
          <div className="flex items-center gap-3">
            {action}
            <button onClick={onClose}><X size={20} color={BRAND.ink} /></button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children }) {
  return <div className="mb-3 flex-1"><div style={{ fontSize: 11.5, fontWeight: 600, color: BRAND.muted, marginBottom: 4 }}>{label}</div>{children}</div>;
}
function Toast({ msg, actionLabel, onAction }) {
  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-full pl-4 pr-2 py-2 flex items-center gap-2 max-w-[92vw]" style={{ background: BRAND.ink, color: "white", fontSize: 12.5, fontWeight: 600 }}>
      <Check size={14} color={BRAND.gold} style={{ flexShrink: 0 }} /> <span style={{ whiteSpace: "nowrap" }}>{msg}</span>
      {actionLabel && (
        <button onClick={onAction} className="rounded-full px-3 py-1.5 font-bold flex-shrink-0" style={{ background: BRAND.gold, color: BRAND.ink, fontSize: 11.5 }}>{actionLabel}</button>
      )}
    </div>
  );
}


/* ============================= PEDIDOS (estado: pendiente → en preparación → listo → entregado) ============================= */
function useTick(ms) {
  const [, setT] = useState(0);
  useEffect(() => { const i = setInterval(() => setT((t) => t + 1), ms); return () => clearInterval(i); }, [ms]);
}
const tsVenta = (v) => v.creadoAt || new Date(`${v.fecha}T${v.hora || "00:00"}`).getTime() || 0;
const hace = (ts) => {
  const m = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (m < 1) return "ahora mismo";
  if (m < 60) return `hace ${m} min`;
  return `hace ${Math.floor(m / 60)} h ${m % 60} min`;
};

function Pedidos({ ventas, onCambiar, onEdit }) {
  useTick(30000);
  const [vista, setVista] = useState("activos");
  const hoy = todayISO();
  const activos = useMemo(() => ventas.filter((v) => estadoDe(v) !== "entregado").sort((a, b) => tsVenta(a) - tsVenta(b)), [ventas]);
  const entregadosHoy = useMemo(() => ventas.filter((v) => estadoDe(v) === "entregado" && v.fecha === hoy).sort((a, b) => tsVenta(b) - tsVenta(a)), [ventas, hoy]);
  const cuenta = (id) => activos.filter((v) => estadoDe(v) === id).length;
  const lista = vista === "entregados" ? entregadosHoy : vista === "activos" ? activos : activos.filter((v) => estadoDe(v) === vista);
  const chips = [
    ["activos", `Todos (${activos.length})`],
    ["pendiente", `🕒 ${cuenta("pendiente")}`],
    ["preparacion", `👨‍🍳 ${cuenta("preparacion")}`],
    ["listo", `🛎️ ${cuenta("listo")}`],
    ["entregados", `✅ Hoy (${entregadosHoy.length})`],
  ];
  return (
    <div>
      <h1 className="display" style={{ color: BRAND.card, fontSize: 18, marginBottom: 4 }}>Pedidos</h1>
      <p style={{ color: BRAND.muted, fontSize: 11.5, marginBottom: 12 }}>Sigue cada pedido de la cocina: 🕒 pendiente → 👨‍🍳 en preparación → 🛎️ listo → ✅ entregado.</p>
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {chips.map(([id, label]) => (
          <button key={id} onClick={() => setVista(id)} className="rounded-full px-3.5 py-1.5 flex-shrink-0" style={{ background: vista === id ? BRAND.gold : BRAND.card, color: BRAND.ink, fontSize: 11.5, fontWeight: 700 }}>{label}</button>
        ))}
      </div>
      {lista.length === 0 && (
        <p style={{ fontSize: 12.5, color: BRAND.muted }}>
          {vista === "entregados" ? "Aún no has entregado pedidos hoy." : activos.length === 0 ? "No hay pedidos en cola. Cuando cierres un pedido en el Menú aparecerá aquí." : "No hay pedidos en este estado."}
        </p>
      )}
      <div className="space-y-3">
        {lista.map((v) => <PedidoCard key={v.id} v={v} onCambiar={onCambiar} onEdit={onEdit} />)}
      </div>
    </div>
  );
}

function PedidoCard({ v, onCambiar, onEdit }) {
  const id = estadoDe(v);
  const e = estadoInfo(id);
  const activo = id !== "entregado";
  const ant = estadoInfo(estadoAnterior(id));
  const canal = v.canalNombre && v.canalNombre !== "Directo" ? v.canalNombre : null;
  return (
    <div className="rounded-xl p-3" style={{ background: BRAND.card, borderLeft: `5px solid ${e.color}` }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontSize: 14, fontWeight: 700, color: BRAND.ink }}>{v.num ? `#${v.num}` : "Pedido"} · {fmtHora(v.hora)}</span>
            <span className="rounded-full px-2 py-0.5" style={{ background: e.bg, color: e.color, fontSize: 10.5, fontWeight: 700 }}>{e.emoji} {e.label}</span>
          </div>
          {activo && <div style={{ fontSize: 10.5, color: BRAND.muted, marginTop: 1 }}>{v.fecha === todayISO() ? hace(tsVenta(v)) : `Del ${fmtDate(v.fecha)}`}</div>}
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: BRAND.gold2, whiteSpace: "nowrap" }}>{cop(v.total)}</span>
      </div>
      <div style={{ fontSize: 13, color: BRAND.ink, margin: "8px 0 6px", lineHeight: 1.35 }}>
        {v.items.map((i) => `${i.qty}x ${i.nombre.replace("Salchipapa ", "")}`).join(" · ")}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap mb-3" style={{ fontSize: 11, color: BRAND.muted }}>
        {v.cliente && <span>👤 {v.cliente}</span>}
        {canal && <span>· 📦 {canal}</span>}
        <span>· {v.pago === "fiado" ? "📒 Fiado" : (v.metodoPago || "efectivo") === "efectivo" ? "💵 Efectivo" : "🏦 Transferencia"}</span>
      </div>
      {v.domicilio && <div className="rounded-lg px-2.5 py-1.5 mb-3" style={{ background: "#F4E3C1", fontSize: 11.5, color: BRAND.ink }}>🛵 <b>{v.domicilio.direccion}</b>{v.domicilio.domiciliario ? ` · ${v.domicilio.domiciliario}` : ""}{v.domicilio.costo ? ` · ${cop(v.domicilio.costo)}` : ""}</div>}
      {activo && (
        <button onClick={() => onCambiar(v.id, estadoSiguiente(id))} className="w-full rounded-full py-2.5 font-bold" style={{ background: e.color, color: "white", fontSize: 13.5 }}>{e.accion}</button>
      )}
      <div className="flex items-center justify-between mt-2">
        {id !== "pendiente" ? (
          <button onClick={() => onCambiar(v.id, activo ? ant.id : "listo")} style={{ fontSize: 11.5, color: BRAND.muted, textDecoration: "underline" }}>↩ {activo ? `Regresar a ${ant.label}` : "Reabrir (volver a Listo)"}</button>
        ) : <span />}
        <button onClick={() => onEdit(v)} className="flex items-center gap-1" style={{ fontSize: 11.5, color: BRAND.muted }}><Pencil size={12} /> Editar</button>
      </div>
    </div>
  );
}

/* ============================= CIERRE DE CAJA DEL DÍA ============================= */
function CierreModal({ ledger, ventas, cierres, onClose, onSave, onSaveLimpiar, onDelete }) {
  const { cfg } = useCfg();
  const [fecha, setFecha] = useState(todayISO());
  const existente = cierres.find((c) => c.fecha === fecha);
  const baseSugerida = useMemo(() => {
    const previos = cierres.filter((c) => c.fecha < fecha).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    const ult = previos[0];
    return ult ? (ult.efectivoContado != null ? ult.efectivoContado : ult.efectivoEsperado) : 0;
  }, [cierres, fecha]);
  const [base, setBase] = useState("");
  const [contado, setContado] = useState("");
  const [nota, setNota] = useState("");
  useEffect(() => {
    setBase(existente ? String(existente.base || 0) : baseSugerida ? String(baseSugerida) : "");
    setContado(existente && existente.efectivoContado != null ? String(existente.efectivoContado) : "");
    setNota(existente?.nota || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  const movs = ledger.filter((l) => l.fecha === fecha);
  const vts = ventas.filter((v) => v.fecha === fecha);
  const suma = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  const vendido = suma(vts, (v) => v.total);
  const metodo = (x) => x.metodoPago || "efectivo";
  const vendidoEfectivo = suma(vts.filter((v) => v.pago === "pago" && metodo(v) === "efectivo"), (v) => v.total);
  const vendidoTransf = suma(vts.filter((v) => v.pago === "pago" && metodo(v) === "transferencia"), (v) => v.total);
  const aFiado = suma(vts.filter((v) => v.pago === "fiado"), (v) => v.total);
  const comisiones = suma(vts, (v) => v.comision || 0);
  const domicilios = suma(vts, (v) => (v.domicilio ? v.domicilio.costo : 0));
  const abonos = suma(movs.filter((l) => l.tipo === "ingreso" && !l.ventaId), (l) => l.monto);
  const gastado = suma(movs.filter((l) => l.tipo === "gasto"), (l) => l.monto);
  const entroEfectivo = suma(movs.filter((l) => l.tipo === "ingreso" && metodo(l) === "efectivo"), (l) => l.monto);
  const salioEfectivo = suma(movs.filter((l) => l.tipo === "gasto" && metodo(l) === "efectivo"), (l) => l.monto);
  const baseNum = Number(base) || 0;
  const esperado = baseNum + entroEfectivo - salioEfectivo;
  const hayContado = contado.trim() !== "";
  const dif = hayContado ? (Number(contado) || 0) - esperado : null;
  const sinEntregar = ventas.filter((v) => estadoDe(v) !== "entregado").length;
  const textoDif = dif === null ? "" : dif === 0 ? "Cuadra ✅" : dif > 0 ? `Sobran ${cop(dif)}` : `Faltan ${cop(-dif)}`;

  const guardar = (limpiar) => (limpiar === true ? onSaveLimpiar : onSave)({
    id: existente?.id || uid(), fecha, hora: horaAhora(), base: baseNum, vendido, vendidoEfectivo, vendidoTransf, aFiado, comisiones, abonos, gastado,
    entroEfectivo, salioEfectivo, efectivoEsperado: esperado, efectivoContado: hayContado ? Number(contado) || 0 : null, diferencia: dif, nota: nota.trim(),
  });
  const compartir = async () => {
    const texto = `*Cierre de caja — ${cfg.nombre}*\n${fmtDateLong(fecha)}\n\n🧾 Pedidos: ${vts.length}\n💰 Vendido: *${cop(vendido)}*\n   💵 Efectivo: ${cop(vendidoEfectivo)}\n   🏦 Transferencia: ${cop(vendidoTransf)}\n   📒 Fiado: ${cop(aFiado)}${comisiones > 0 ? `\n📦 Comisiones de canales: −${cop(comisiones)}` : ""}\n🛒 Gastado: *${cop(gastado)}*\n\n💵 Efectivo que debe haber: *${cop(esperado)}*${hayContado ? `\n💵 Efectivo contado: ${cop(Number(contado) || 0)}\n${textoDif}` : ""}${nota.trim() ? `\n\n📝 ${nota.trim()}` : ""}`;
    try {
      if (navigator.share) { await navigator.share({ text: texto }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  };
  const inp = "w-full rounded-lg px-3 py-2 border";
  return (
    <ModalShell onClose={onClose} title="Cierre de caja">
      <Field label="Día a cerrar">
        <input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} className={inp} style={{ borderColor: "#EAE0CC" }} />
      </Field>
      {existente && <p style={{ fontSize: 11.5, color: BRAND.green, fontWeight: 700, marginBottom: 10 }}>🔒 Este día ya se cerró a las {fmtHora(existente.hora)}. Si guardas de nuevo, se actualiza.</p>}
      {sinEntregar > 0 && <p style={{ fontSize: 11.5, color: BRAND.salsa, fontWeight: 700, marginBottom: 10 }}>⚠️ Tienes {sinEntregar} {sinEntregar === 1 ? "pedido" : "pedidos"} sin entregar en la pestaña Pedidos.</p>}

      <div className="rounded-xl p-3 mb-3" style={{ background: BRAND.card }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.ink, marginBottom: 4 }}>Lo vendido</div>
        <RowKV k={`Pedidos del día`} v={String(vts.length)} />
        <RowKV k="Vendido" v={cop(vendido)} bold />
        <RowKV k="💵 En efectivo" v={cop(vendidoEfectivo)} />
        <RowKV k="🏦 Por transferencia" v={cop(vendidoTransf)} />
        <RowKV k="📒 A fiado (sin cobrar)" v={cop(aFiado)} />
        {domicilios > 0 && <RowKV k="🛵 Domicilios cobrados (incluidos)" v={cop(domicilios)} />}
        {comisiones > 0 && <RowKV k="📦 Comisiones de canales" v={`−${cop(comisiones)}`} />}
      </div>
      <div className="rounded-xl p-3 mb-3" style={{ background: BRAND.card }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.ink, marginBottom: 4 }}>Lo gastado y otros ingresos</div>
        <RowKV k="Gastado" v={cop(gastado)} bold />
        <RowKV k="Abonos de fiado y otros ingresos" v={cop(abonos)} />
      </div>

      <div className="rounded-xl p-3 mb-3" style={{ background: "#FBF3E1", border: `1px solid ${BRAND.gold2}` }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.ink, marginBottom: 6 }}>💵 Efectivo que debe haber</div>
        <Field label="Efectivo con el que empezaste el día (base)">
          <input type="number" inputMode="numeric" value={base} onChange={(e) => setBase(e.target.value)} className={inp} style={{ borderColor: "#EAE0CC" }} placeholder="0" />
        </Field>
        <RowKV k="+ Efectivo que entró" v={cop(entroEfectivo)} />
        <RowKV k="− Efectivo que salió (gastos)" v={cop(salioEfectivo)} />
        <div style={{ height: 1, background: "#E0D2AE", margin: "6px 0" }} />
        <div className="flex items-center justify-between mb-3">
          <span style={{ fontSize: 13, fontWeight: 700, color: BRAND.ink }}>Debe haber en caja</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: BRAND.gold2 }}>{cop(esperado)}</span>
        </div>
        <Field label="Efectivo que contaste (opcional)">
          <input type="number" inputMode="numeric" value={contado} onChange={(e) => setContado(e.target.value)} className={inp} style={{ borderColor: "#EAE0CC" }} placeholder="Cuenta la plata y escríbela aquí" />
        </Field>
        {dif !== null && <div style={{ fontSize: 14, fontWeight: 700, color: dif === 0 ? BRAND.green : BRAND.salsa }}>{textoDif}</div>}
      </div>

      <Field label="Nota del día (opcional)">
        <input value={nota} onChange={(e) => setNota(e.target.value)} className={inp} style={{ borderColor: "#EAE0CC" }} placeholder="Ej: faltaron $2.000 por un vuelto" />
      </Field>
      <div className="flex gap-2 mb-2">
        <button onClick={compartir} className="flex-1 rounded-full py-3 font-bold text-white flex items-center justify-center gap-2" style={{ background: "#25A244" }}><MessageCircle size={16} /> Compartir</button>
        <button onClick={() => guardar(false)} className="flex-1 rounded-full py-3 font-bold text-white" style={{ background: BRAND.ink }}>{existente ? "Actualizar cierre" : "Guardar cierre"}</button>
      </div>
      <button onClick={() => {
        const nMov = ledger.filter((l) => l.fecha <= fecha).length;
        if (window.confirm(`Se guardará el cierre del ${fmtDateLong(fecha)} y se borrarán ${nMov} movimientos de Caja hasta esa fecha (y las ventas ya entregadas y pagadas). El resumen del cierre, el fiado pendiente y lo de días posteriores NO se tocan. Antes se descargará una copia de seguridad. ¿Continuar?`)) { guardar(true); onClose(); }
      }} className="w-full rounded-full py-2.5 font-bold mb-1 flex items-center justify-center gap-2" style={{ background: "#F4E3C1", color: BRAND.ink, fontSize: 12.5 }}>🧹 Guardar cierre y limpiar movimientos anteriores</button>
      {existente && <button onClick={() => onDelete(existente.id)} className="w-full py-2 font-bold flex items-center justify-center gap-2" style={{ color: BRAND.salsa, fontSize: 12.5 }}><Trash2 size={13} /> Eliminar este cierre</button>}

      {cierres.length > 0 && (
        <div className="mt-3">
          <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.ink, marginBottom: 6 }}>Cierres anteriores (toca uno para verlo)</div>
          <div className="space-y-1.5">
            {cierres.slice(0, 7).map((c) => (
              <button key={c.id} onClick={() => setFecha(c.fecha)} className="w-full rounded-lg px-3 py-2 flex items-center justify-between text-left" style={{ background: c.fecha === fecha ? "#F4E3C1" : "#F8F3E6" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: BRAND.ink }}>{fmtDateLong(c.fecha)}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: c.diferencia == null ? BRAND.muted : c.diferencia === 0 ? BRAND.green : BRAND.salsa }}>
                  {cop(c.efectivoEsperado)}{c.diferencia == null ? "" : c.diferencia === 0 ? " ✅" : c.diferencia > 0 ? ` (+${cop(c.diferencia)})` : ` (−${cop(-c.diferencia)})`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </ModalShell>
  );
}

/* ============================= COMPARTIR LA APP ============================= */
function CompartirCard() {
  const [copiado, setCopiado] = useState(false);
  const enlace = () => urlPlay || webBase();
  const mensaje = `📲 Te recomiendo esta app para llevar pedidos, caja, fiados e insumos de tu negocio de comida. Pruébala gratis ${DIAS_PRUEBA} días:`;
  const compartir = async () => {
    const url = enlace();
    try {
      if (navigator.share) { await navigator.share({ title: "App para negocios de comida", text: mensaje, url }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${mensaje}\n${url}`)}`, "_blank");
  };
  const copiar = async () => {
    try { await navigator.clipboard.writeText(enlace()); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch {}
  };
  return (
    <div className="rounded-xl p-4 mb-4" style={{ background: BRAND.card }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.ink, marginBottom: 4 }}>📤 Compartir esta app</div>
      <p style={{ fontSize: 11, color: BRAND.muted, marginBottom: 10 }}>Recomiéndala a otros dueños de negocios de comida. Quien la instale tiene {DIAS_PRUEBA} días de prueba gratis con todo Premium.</p>
      <div className="flex gap-2">
        <button onClick={compartir} className="flex-1 rounded-full py-2.5 font-bold text-white flex items-center justify-center gap-2 text-sm" style={{ background: "#25A244" }}><MessageCircle size={14} /> Compartir</button>
        <button onClick={copiar} className="flex-1 rounded-full py-2.5 font-bold text-sm" style={{ background: "#F4E3C1", color: BRAND.ink }}>{copiado ? "¡Copiado! ✅" : "Copiar enlace"}</button>
      </div>
    </div>
  );
}

/* ============================= CANALES DE VENTA (comisión opcional, Premium) ============================= */
function CanalesConfig() {
  const { canales, setCanales, esPremium, abrirPremium } = useCfg();
  const [nombre, setNombre] = useState("");
  const [pct, setPct] = useState("");
  const propios = canales.filter((c) => c.custom);
  const n = nombre.trim();
  const duplicado = n && canales.some((c) => c.nombre.toLowerCase() === n.toLowerCase());
  const agregar = () => {
    if (!esPremium) { abrirPremium("Canales con comisión (Rappi, DiDi…)"); return; }
    if (!n || duplicado) return;
    const p = Math.min(100, Math.max(0, Number(pct) || 0));
    setCanales([...canales, { id: uid(), nombre: n, comision: p, custom: true }]);
    setNombre(""); setPct("");
  };
  const cambiar = (id, campo, valor) => setCanales(canales.map((c) => c.id === id ? { ...c, [campo]: campo === "comision" ? Math.min(100, Math.max(0, Number(valor) || 0)) : valor } : c));
  const quitar = (id) => setCanales(canales.filter((c) => c.id !== id));
  return (
    <div className="rounded-xl p-4 mb-4" style={{ background: BRAND.card }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.ink, marginBottom: 4 }}>Canales de venta</div>
      <p style={{ fontSize: 11, color: BRAND.muted, marginBottom: 10 }}>Directo y WhatsApp ya vienen listos. Si vendes por Rappi, DiDi u otra plataforma, agrégala con su % de comisión y la app te muestra cuánto te queda.</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {canales.filter((c) => !c.custom).map((c) => (
          <span key={c.id} className="rounded-full px-3 py-1" style={{ background: "#F4E3C1", color: BRAND.ink, fontSize: 12, fontWeight: 700 }}>{c.nombre}</span>
        ))}
      </div>
      {propios.length > 0 && (
        <div className="space-y-2 mb-3">
          {propios.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <input value={c.nombre} onChange={(e) => cambiar(c.id, "nombre", e.target.value)} className="flex-1 rounded-lg px-2 py-1.5 border text-xs" style={{ borderColor: "#EAE0CC" }} />
              <input type="number" inputMode="decimal" value={c.comision} onChange={(e) => cambiar(c.id, "comision", e.target.value)} className="rounded-lg px-2 py-1.5 border text-xs text-right" style={{ borderColor: "#EAE0CC", width: 60 }} />
              <span style={{ fontSize: 11, color: BRAND.muted }}>%</span>
              <button onClick={() => quitar(c.id)}><X size={16} color={BRAND.salsa} /></button>
            </div>
          ))}
          <p style={{ fontSize: 10.5, color: BRAND.muted }}>Los cambios de % aplican a los pedidos nuevos; los ya vendidos conservan su comisión.</p>
        </div>
      )}
      <div className="flex items-center gap-2 mb-1">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Rappi" className="flex-1 rounded-lg px-2 py-1.5 border text-xs" style={{ borderColor: "#EAE0CC" }} />
        <input type="number" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="0" className="rounded-lg px-2 py-1.5 border text-xs text-right" style={{ borderColor: "#EAE0CC", width: 60 }} />
        <span style={{ fontSize: 11, color: BRAND.muted }}>%</span>
      </div>
      {duplicado && <p style={{ fontSize: 10.5, color: BRAND.salsa, marginBottom: 4 }}>Ya existe un canal con ese nombre.</p>}
      <button onClick={agregar} disabled={esPremium && (!n || duplicado)} className="w-full rounded-full py-2.5 font-bold mt-1 flex items-center justify-center gap-2 text-sm disabled:opacity-40" style={{ background: esPremium ? BRAND.ink : BRAND.gold, color: esPremium ? "white" : BRAND.ink }}>
        {esPremium ? <><Plus size={14} /> Agregar canal</> : "👑 Agregar canales con comisión"}
      </button>
    </div>
  );
}

/* ============================= CATÁLOGO PARA CLIENTES ============================= */
function CatalogoCard({ products }) {
  const { cfg, setCfg, combos, sabores, ventas } = useCfg();
  const [tel, setTel] = useState(cfg.telefonoPedidos || "");
  const [copiado, setCopiado] = useState(false);
  const telFinal = conPais(tel);
  const hayProductos = products.some((p) => p.precio > 0 && tipoDe(p) !== "adicion");
  const valido = telFinal.length >= 11 && hayProductos;
  const guardarTel = () => { if (conPais(tel) !== (cfg.telefonoPedidos || "")) setCfg({ ...cfg, telefonoPedidos: conPais(tel) }); };
  // El enlace lleva todo el menú dentro: productos, adiciones, sabores disponibles, combos y el orden de "más vendidos"
  const enlace = () => {
    const menu = products.filter((p) => p.precio > 0 && tipoDe(p) !== "adicion");
    const extras = products.filter((p) => p.precio > 0 && tipoDe(p) === "adicion");
    const vendidos = {};
    (ventas || []).forEach((v) => (v.items || []).forEach((it) => { if (it.productId) vendidos[it.productId] = (vendidos[it.productId] || 0) + it.qty; }));
    const combosOk = (combos || []).filter((c) => c.precio > 0 && (c.items || []).length > 0);
    const esBebida = (id) => { const x = products.find((q) => q.id === id); return !!x && tipoDe(x) === "bebida"; };
    const ranking = [
      ...menu.map((x, i) => ({ k: `p${i}`, n: vendidos[x.id] || 0, nombre: x.nombre })),
      ...combosOk.map((c, i) => ({ k: `c${i}`, n: vendidos[`combo:${c.id}`] || 0, nombre: c.nombre })),
    ].sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, "es"));
    return `${webBase()}#pedir=${codificarCatalogo({
      n: cfg.nombre, t: telFinal,
      p: menu.map((x) => [catProd(x), x.nombre, x.precio, x.emoji || "", tipoDe(x) === "bebida" ? 1 : 0, x.sinAdiciones ? 1 : 0]),
      a: extras.map((x) => [x.nombre, x.precio, x.emoji || ""]),
      s: (sabores || []).filter((x) => !x.agotado && x.nombre.trim()).map((x) => x.nombre.trim()),
      c: combosOk.map((c) => [c.nombre, c.precio, c.emoji || "🎁", (c.items || []).map((i) => { const x = products.find((q) => q.id === i.productId); return x ? `${i.qty > 1 ? `${i.qty}x ` : ""}${x.nombre.replace("Salchipapa ", "")}` : null; }).filter(Boolean).join(" + "), (c.items || []).some((i) => esBebida(i.productId)) ? 1 : 0]),
      o: ranking.map((r) => r.k),
      k: ranking.slice(0, 3).filter((r) => r.n > 0).length,
    })}`;
  };
  const compartir = async () => {
    guardarTel();
    const url = enlace();
    const msg = `🍟 Mira el menú de ${cfg.nombre} y haz tu pedido por WhatsApp:`;
    try { if (navigator.share) { await navigator.share({ title: cfg.nombre, text: msg, url }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${msg}\n${url}`)}`, "_blank");
  };
  const copiar = async () => { guardarTel(); try { await navigator.clipboard.writeText(enlace()); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch {} };
  const ver = () => { guardarTel(); window.open(enlace(), "_blank"); };
  return (
    <div className="rounded-xl p-4 mb-4" style={{ background: BRAND.card }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.ink, marginBottom: 4 }}>🛍️ Catálogo para tus clientes</div>
      <p style={{ fontSize: 11, color: BRAND.muted, marginBottom: 10 }}>Comparte un enlace con tu menú y precios. El cliente arma su pedido y te lo envía por WhatsApp ya escrito. Se actualiza cuando vuelvas a compartir el enlace.</p>
      {!hayProductos && <p style={{ fontSize: 11, color: BRAND.salsa, fontWeight: 700, marginBottom: 8 }}>Primero agrega productos con precio en la pestaña Menú.</p>}
      <Field label="Tu WhatsApp para recibir pedidos (con o sin 57)">
        <input type="tel" inputMode="numeric" value={tel} onChange={(e) => setTel(e.target.value)} onBlur={guardarTel} className="w-full rounded-lg px-3 py-2 border text-sm" style={{ borderColor: "#EAE0CC" }} placeholder="Ej: 3001234567" />
      </Field>
      <div className="flex gap-2 mb-2">
        <button disabled={!valido} onClick={compartir} className="flex-1 rounded-full py-2.5 font-bold text-white flex items-center justify-center gap-2 text-sm disabled:opacity-40" style={{ background: "#25A244" }}><MessageCircle size={14} /> Compartir</button>
        <button disabled={!valido} onClick={copiar} className="flex-1 rounded-full py-2.5 font-bold text-sm disabled:opacity-40" style={{ background: "#F4E3C1", color: BRAND.ink }}>{copiado ? "¡Copiado! ✅" : "Copiar enlace"}</button>
      </div>
      <button disabled={!valido} onClick={ver} className="w-full text-center disabled:opacity-40" style={{ fontSize: 11.5, color: BRAND.muted, textDecoration: "underline" }}>👀 Ver cómo lo ven mis clientes</button>
    </div>
  );
}

// Pantalla que ve el CLIENTE al abrir el enlace del catálogo (no usa ni toca los datos del negocio).
// El enlace trae: p = productos, a = adiciones, s = sabores disponibles, c = combos, o = orden de "más vendidos", k = cuántos llevan la insignia "Top".
// Los enlaces viejos (solo con p) siguen funcionando igual que antes.
function CatalogoCliente({ data }) {
  const productos = (data.p || []).map(([cat, nombre, precio, emoji, esBebida, sinAdic], i) => ({ i, cat, nombre, precio, emoji, bebida: !!esBebida, sinAdic: !!sinAdic }));
  const adiciones = (data.a || []).map(([nombre, precio, emoji], i) => ({ id: i, nombre, precio, emoji: emoji || "" }));
  const sabores = (data.s || []).map((nombre, i) => ({ id: i, nombre, agotado: false }));
  const combosC = (data.c || []).map(([nombre, precio, emoji, desc, bebida], i) => ({ i, nombre, precio, emoji: emoji || "🎁", desc: desc || "", bebida: !!bebida }));
  const cats = [...new Set(productos.map((p) => p.cat))];
  const orden = Array.isArray(data.o) ? data.o : [];
  const nTop = Number(data.k) || 0;
  const [cat, setCat] = useState(orden.length ? "__top" : "Todos");
  const [lineas, setLineas] = useState([]); // { lid, kind: "p" | "c", i, qty, adds: [{ id, qty }], sabor }
  const [opciones, setOpciones] = useState(null); // índice del producto que pregunta adiciones
  const [saborSel, setSaborSel] = useState(null); // { kind, i, adds }
  const [sugerir, setSugerir] = useState(false);
  const [nombre, setNombre] = useState("");
  const [entrega, setEntrega] = useState("recoger");
  const [dir, setDir] = useState("");
  const [nota, setNota] = useState("");
  useEffect(() => { document.title = data.n || "Pedidos"; }, [data.n]);
  useEffect(() => { if (!sugerir) return; const t = setTimeout(() => setSugerir(false), 9000); return () => clearTimeout(t); }, [sugerir, lineas]);

  const necesita = (p) => (!p.bebida && !p.sinAdic && adiciones.length > 0) || (p.bebida && sabores.length > 0);
  const clave = (l) => `${l.kind}|${l.i}|${(l.adds || []).map((a) => `${a.id}x${a.qty}`).sort().join(",")}|${l.sabor || ""}`;
  const agregar = ({ kind, i, adds = [], sabor = "" }) => {
    const nueva = { kind, i, adds: adds.filter((a) => a.qty > 0), sabor };
    setLineas((prev) => {
      const k = clave(nueva);
      const f = prev.find((l) => clave(l) === k);
      if (f) return prev.map((l) => l === f ? { ...l, qty: l.qty + 1 } : l);
      return [...prev, { ...nueva, lid: Math.random().toString(36).slice(2, 9), qty: 1 }];
    });
  };
  const mover = (lid, d) => setLineas((prev) => prev.map((l) => l.lid === lid ? { ...l, qty: l.qty + d } : l).filter((l) => l.qty > 0));
  const info = lineas.map((l) => {
    if (l.kind === "c") {
      const c = combosC[l.i]; if (!c) return null;
      return { ...l, nombre: c.nombre + (l.sabor ? ` (${l.sabor})` : ""), unit: c.precio, adds: [], base: c };
    }
    const p = productos[l.i]; if (!p) return null;
    const adds = (l.adds || []).map((a) => ({ ...adiciones[a.id], qty: a.qty })).filter((a) => a.nombre);
    const extra = adds.reduce((s, a) => s + a.precio * a.qty, 0);
    return { ...l, nombre: p.nombre + (l.sabor ? ` · ${l.sabor}` : "") + adds.map((a) => ` + ${a.qty > 1 ? `${a.qty}x ` : ""}${a.nombre}`).join(""), unit: p.precio + extra, adds, base: p };
  }).filter(Boolean);
  const total = info.reduce((s, l) => s + l.unit * l.qty, 0);
  const cuantos = (kind, i) => info.filter((l) => l.kind === kind && l.i === i).reduce((s, l) => s + l.qty, 0);
  const listo = info.length > 0 && nombre.trim() && (entrega === "recoger" || dir.trim());
  const bebidas = productos.filter((p) => p.bebida).sort((a, b) => a.precio - b.precio);
  const pedidoTieneBebida = info.some((l) => (l.kind === "p" && l.base.bebida) || (l.kind === "c" && l.base.bebida));
  const mostrarSugerencia = sugerir && bebidas.length > 0 && !pedidoTieneBebida && info.length > 0;

  const tocarMas = (kind, i) => {
    if (kind === "c") {
      if (combosC[i].bebida && sabores.length > 0) setSaborSel({ kind, i, adds: [] });
      else agregar({ kind, i });
      return;
    }
    const p = productos[i];
    if (!p.bebida && !p.sinAdic && adiciones.length > 0) { setOpciones(i); return; }
    if (p.bebida && sabores.length > 0) { setSaborSel({ kind, i, adds: [] }); return; }
    agregar({ kind, i });
    if (!p.bebida) setSugerir(true);
  };
  const quitarPlano = (i) => { const l = lineas.find((x) => x.kind === "p" && x.i === i && !(x.adds || []).length && !x.sabor); if (l) mover(l.lid, -1); };
  const elegirBebida = (b) => { setSugerir(false); if (sabores.length > 0) setSaborSel({ kind: "p", i: b.i, adds: [] }); else agregar({ kind: "p", i: b.i }); };

  const enviar = () => {
    const txt = `*Pedido para ${data.n}* 🛍️\n👤 ${nombre.trim()}\n\n${info.map((l) => `• ${l.qty}x ${l.nombre} — ${cop(l.unit * l.qty)}`).join("\n")}\n\n*Total productos: ${cop(total)}*\n${entrega === "domicilio" ? `🛵 Domicilio a: ${dir.trim()} (el costo del domicilio me lo confirmas)` : "🏪 Lo recojo en el local"}${nota.trim() ? `\n📝 ${nota.trim()}` : ""}`;
    window.open(`https://wa.me/${data.t || ""}?text=${encodeURIComponent(txt)}`, "_blank");
  };
  const inp = "w-full rounded-lg px-3 py-2 border";
  // Lo que se muestra en la pestaña elegida
  const filas = cat === "__top"
    ? orden.map((k, idx) => { const kind = k[0], i = Number(k.slice(1)); const it = kind === "c" ? combosC[i] : productos[i]; return it ? { kind, i, it, top: idx < nTop } : null; }).filter(Boolean)
    : cat === "__combos" ? combosC.map((c) => ({ kind: "c", i: c.i, it: c, top: false }))
    : productos.filter((p) => cat === "Todos" || p.cat === cat).map((p) => ({ kind: "p", i: p.i, it: p, top: false }));
  const hayTabs = orden.length > 0 || combosC.length > 0 || cats.length > 1;
  const chip = (id, texto) => (
    <button key={id} onClick={() => setCat(id)} className="rounded-full px-3.5 py-1.5 flex-shrink-0" style={{ background: cat === id ? BRAND.gold : BRAND.card, color: BRAND.ink, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>{texto}</button>
  );
  return (
    <div style={{ background: BRAND.bg, fontFamily: "Inter, sans-serif", minHeight: "100%" }} className="w-full max-w-md mx-auto" id="app-root">
      <div className="px-4 pt-5 pb-3" style={{ borderBottom: `1px solid ${BRAND.line}` }}>
        <h1 className="display" style={{ color: BRAND.gold, fontSize: 24, fontWeight: 700 }}>{data.n}</h1>
        <div style={{ color: BRAND.muted, fontSize: 12.5 }}>Arma tu pedido y envíalo por WhatsApp 📲</div>
      </div>
      <div className="px-4 pt-3 pb-24">
        {hayTabs && (
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {orden.length > 0 ? chip("__top", "🔥 Más vendidos") : chip("Todos", "Todos")}
            {combosC.length > 0 && chip("__combos", "🎁 Combos")}
            {cats.map((c) => chip(c, c))}
          </div>
        )}
        <div className="space-y-2 mb-4">
          {filas.map(({ kind, i, it, top }) => {
            const n = cuantos(kind, i);
            const conOpciones = kind === "c" ? (it.bebida && sabores.length > 0) : necesita(it);
            return (
              <div key={`${kind}${i}`} className="rounded-xl p-3 flex items-center gap-3" style={{ background: BRAND.card }}>
                <span style={{ fontSize: 24 }}>{it.emoji || "🍽️"}</span>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: BRAND.ink }}>{it.nombre}{top && <span className="rounded-full px-1.5 py-0.5 ml-1.5" style={{ background: BRAND.salsa, color: "white", fontSize: 9, fontWeight: 800, verticalAlign: "middle" }}>🔥 Top</span>}</div>
                  {kind === "c" && it.desc && <div style={{ fontSize: 11, color: BRAND.muted, lineHeight: 1.2 }}>{it.desc}</div>}
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.gold2 }}>{cop(it.precio)}</div>
                </div>
                <div className="flex items-center gap-2">
                  {n > 0 && !conOpciones && kind === "p" ? <>
                    <button onClick={() => quitarPlano(i)} aria-label="Quitar uno" className="rounded-full p-1.5" style={{ background: BRAND.bg }}><Minus size={13} color="white" /></button>
                    <span style={{ minWidth: 18, textAlign: "center", fontWeight: 700, color: BRAND.ink }}>{n}</span>
                  </> : n > 0 ? <span style={{ fontSize: 12, fontWeight: 700, color: BRAND.ink }}>x{n}</span> : null}
                  <button onClick={() => tocarMas(kind, i)} aria-label={`Agregar ${it.nombre}`} className="rounded-full p-1.5" style={{ background: BRAND.bg }}><Plus size={13} color="white" /></button>
                </div>
              </div>
            );
          })}
          {productos.length === 0 && combosC.length === 0 && <p style={{ color: BRAND.muted, fontSize: 13 }}>Este catálogo está vacío.</p>}
          {filas.length === 0 && (productos.length > 0 || combosC.length > 0) && <p style={{ color: BRAND.muted, fontSize: 13 }}>Aquí no hay nada por ahora.</p>}
        </div>
        {info.length > 0 && (
          <div className="rounded-2xl p-4" style={{ background: BRAND.card }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.ink, marginBottom: 6 }}>Tu pedido</div>
            {info.map((l) => (
              <div key={l.lid} className="flex items-center justify-between gap-2 mb-1.5" style={{ fontSize: 12.5, color: BRAND.ink }}>
                <span className="min-w-0">{l.qty}x {l.nombre}</span>
                <span className="flex items-center gap-1.5 flex-shrink-0">
                  <span style={{ fontWeight: 600 }}>{cop(l.unit * l.qty)}</span>
                  <button onClick={() => mover(l.lid, -1)} aria-label="Quitar uno" className="rounded-full p-1" style={{ background: BRAND.bg }}><Minus size={11} color="white" /></button>
                  <button onClick={() => mover(l.lid, 1)} aria-label="Agregar uno" className="rounded-full p-1" style={{ background: BRAND.bg }}><Plus size={11} color="white" /></button>
                </span>
              </div>
            ))}
            <div className="flex justify-between mt-2 mb-3" style={{ borderTop: "1px dashed #C9B98F", paddingTop: 8 }}><span style={{ fontWeight: 700, color: BRAND.ink }}>Total</span><span style={{ fontWeight: 700, color: BRAND.gold2, fontSize: 17 }}>{cop(total)}</span></div>
            <Field label="Tu nombre"><input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inp} style={{ borderColor: "#EAE0CC" }} placeholder="¿Cómo te llamas?" /></Field>
            <Field label="¿Cómo lo quieres?">
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setEntrega("recoger")} className="rounded-lg py-2 border-2 text-sm font-semibold" style={{ borderColor: entrega === "recoger" ? BRAND.gold2 : "#EAE0CC", background: entrega === "recoger" ? "#FBF3E1" : "white", color: BRAND.ink }}>🏪 Recoger</button>
                <button onClick={() => setEntrega("domicilio")} className="rounded-lg py-2 border-2 text-sm font-semibold" style={{ borderColor: entrega === "domicilio" ? BRAND.gold2 : "#EAE0CC", background: entrega === "domicilio" ? "#FBF3E1" : "white", color: BRAND.ink }}>🛵 Domicilio</button>
              </div>
            </Field>
            {entrega === "domicilio" && <Field label="Dirección de entrega"><input value={dir} onChange={(e) => setDir(e.target.value)} className={inp} style={{ borderColor: "#EAE0CC" }} placeholder="Barrio, calle, referencia" /></Field>}
            <Field label="Nota (opcional)"><input value={nota} onChange={(e) => setNota(e.target.value)} className={inp} style={{ borderColor: "#EAE0CC" }} placeholder="Ej: sin cebolla" /></Field>
            <button disabled={!listo} onClick={enviar} className="w-full rounded-full py-3 font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40" style={{ background: "#25A244" }}><MessageCircle size={16} /> Enviar pedido por WhatsApp</button>
          </div>
        )}
      </div>
      {opciones !== null && productos[opciones] && (
        <OpcionesModal producto={productos[opciones]} adiciones={adiciones} onClose={() => setOpciones(null)}
          onConfirm={(adds) => { const i = opciones; setOpciones(null); agregar({ kind: "p", i, adds: adds.map((a) => ({ id: a.productId, qty: a.qty })) }); setSugerir(true); }} />
      )}
      {saborSel && (
        <SaborModal titulo={saborSel.kind === "c" ? combosC[saborSel.i]?.nombre : productos[saborSel.i]?.nombre} sabores={sabores} onClose={() => setSaborSel(null)}
          onConfirm={(sabor) => { const s = saborSel; setSaborSel(null); agregar({ kind: s.kind, i: s.i, adds: s.adds || [], sabor }); }} />
      )}
      {mostrarSugerencia && <SugerenciaBebida abajo={12} bebidas={bebidas.map((b) => ({ id: b.i, nombre: b.nombre, precio: b.precio, i: b.i }))} onElegir={(b) => elegirBebida({ i: b.i })} onCerrar={() => setSugerir(false)} />}
    </div>
  );
}

function Root() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const f = () => setHash(window.location.hash);
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  const data = useMemo(() => {
    if (!hash.startsWith("#pedir=")) return null;
    try { return decodificarCatalogo(hash.slice(7)); } catch { return null; }
  }, [hash]);
  return data ? <CatalogoCliente data={data} /> : <App />;
}

/* ============================= ACERCA DE / PRIVACIDAD ============================= */
function AcercaCard() {
  const c = loadKey("skp-consent", null);
  const fechaAcepto = consentVigente(c) && c.tc.fecha ? String(c.tc.fecha).slice(0, 10).split("-").reverse().join("/") : "";
  const enlaceLegal = { fontSize: 12.5, color: BRAND.salsa, fontWeight: 700, textDecoration: "underline" };
  return (
    <div className="rounded-xl p-4 mb-4" style={{ background: BRAND.card }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.ink, marginBottom: 6 }}>Acerca de</div>
      <a href="./terminos.html" target="_blank" rel="noopener noreferrer" style={enlaceLegal}>Términos y condiciones</a>
      <br />
      <a href="./privacidad.html" target="_blank" rel="noopener noreferrer" style={enlaceLegal}>Política de privacidad</a>
      {fechaAcepto && <div style={{ fontSize: 10.5, color: BRAND.muted, marginTop: 6 }}>Los aceptaste el {fechaAcepto} ({TC_VERSION} · {PP_VERSION})</div>}
      <div style={{ fontSize: 10.5, color: BRAND.muted, marginTop: 6 }}>Versión {APP_VERSION}</div>
    </div>
  );
}

/* ============================= BORRAR DATOS Y CUENTA ============================= */
function BorrarDatosCard() {
  const [confirmando, setConfirmando] = React.useState(false);
  const [borrado, setBorrado] = React.useState(false);

  const borrarTodo = () => {
    try {
      // Borrar todas las claves de esta app en localStorage
      const keysToDelete = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(KEY_PREFIX)) keysToDelete.push(k);
      }
      keysToDelete.forEach((k) => localStorage.removeItem(k));
      setBorrado(true);
      setTimeout(() => window.location.reload(), 2000);
    } catch (e) {
      alert("No se pudo borrar. Intenta desinstalar la app desde Ajustes del celular.");
    }
  };

  if (borrado) {
    return (
      <div className="rounded-xl p-4 mb-4 text-center" style={{ background: "#FBF3E1", border: `1px solid ${BRAND.gold2}` }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.ink }}>✅ Datos borrados</div>
        <div style={{ fontSize: 11, color: BRAND.muted, marginTop: 4 }}>La app se reiniciará en un momento…</div>
      </div>
    );
  }

  if (confirmando) {
    return (
      <div className="rounded-xl p-4 mb-4" style={{ background: "#FBEAE4", border: `1px solid ${BRAND.salsa}` }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.ink, marginBottom: 6 }}>⚠️ ¿Borrar todos los datos?</div>
        <p style={{ fontSize: 11, color: BRAND.muted, marginBottom: 12 }}>
          Se eliminarán <b>todos</b> tus productos, ventas, insumos, fiados, cierres y configuración guardados en este celular. Esta acción <b>no se puede deshacer</b>. Si tienes copia de seguridad podrás restaurarla después.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirmando(false)}
            className="flex-1 rounded-full py-2 font-bold text-sm"
            style={{ background: "#EAE0CC", color: BRAND.ink }}
          >
            Cancelar
          </button>
          <button
            onClick={borrarTodo}
            className="flex-1 rounded-full py-2 font-bold text-sm text-white"
            style={{ background: BRAND.salsa }}
          >
            Sí, borrar todo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-4 mb-4" style={{ background: BRAND.card }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.ink, marginBottom: 4 }}>Mis datos y privacidad</div>
      <p style={{ fontSize: 11, color: BRAND.muted, marginBottom: 10 }}>
        Todos tus datos se guardan únicamente en este celular. Puedes eliminarlos en cualquier momento.
      </p>
      <button
        onClick={() => setConfirmando(true)}
        className="w-full rounded-full py-2.5 font-bold text-sm"
        style={{ background: "#FBEAE4", color: BRAND.salsa, border: `1px solid ${BRAND.salsa}` }}
      >
        🗑️ Borrar mis datos
      </button>
    </div>
  );
}

/* ============================= MODO DEMO (?demo=1): datos de ejemplo para las capturas de la tienda ============================= */
function prepararDemo() {
  if (!KEY_PREFIX) return;
  try {
    if (localStorage.getItem(`${KEY_PREFIX}skp-ventas`)) return;
    const set = (k, v) => localStorage.setItem(KEY_PREFIX + k, JSON.stringify(v));
    const P = { sencilla: ["Salchipapa Sencilla", 16000], tradicional: ["Salchipapa Tradicional", 22000], especial: ["Salchipapa Especial", 28000] };
    const CAN = { directo: ["Directo", 0], whatsapp: ["WhatsApp", 0], rappi: ["Rappi", 22], didi: ["DiDi Food", 18] };
    const dom1 = { direccion: "Cra 12 #34-56, Barrio Centro", costo: 3000, domiciliario: "Pedro" };
    const dom2 = { direccion: "Calle 8 #20-15, Los Almendros", costo: 4000, domiciliario: "Juan" };
    // [día, hora, [[producto, cantidad]], pago, método, cliente, canal, estado, domicilio]
    const filas = [
      [-3, "12:10", [["sencilla", 2]], "pago", "efectivo", "", "directo", "entregado", null],
      [-2, "19:20", [["especial", 2]], "pago", "transferencia", "", "rappi", "entregado", null],
      [-1, "13:05", [["tradicional", 2], ["sencilla", 1]], "pago", "efectivo", "Carlos", "whatsapp", "entregado", dom1],
      [-1, "20:15", [["especial", 1]], "pago", "transferencia", "Laura", "didi", "entregado", null],
      [0, "11:20", [["sencilla", 2]], "pago", "efectivo", "", "directo", "entregado", null],
      [0, "12:05", [["tradicional", 1], ["sencilla", 1]], "pago", "transferencia", "Laura", "whatsapp", "entregado", null],
      [0, "12:40", [["especial", 2]], "pago", "transferencia", "", "rappi", "entregado", null],
      [0, "13:10", [["tradicional", 2]], "pago", "efectivo", "Carlos", "directo", "entregado", dom1],
      [0, "13:25", [["especial", 1], ["sencilla", 1]], "pago", "transferencia", "Andrea", "didi", "preparacion", null],
      [0, "13:32", [["sencilla", 3]], "pago", "efectivo", "Mónica", "whatsapp", "pendiente", dom2],
      [0, "13:36", [["tradicional", 1]], "pago", "efectivo", "", "directo", "pendiente", null],
    ];
    const ventas = [], ledger = [];
    const numPorDia = {};
    filas.forEach(([off, hora, its, pago, metodo, cliente, canal, estado, dom], n) => {
      const fecha = diaRelativo(off);
      const items = its.map(([id, qty]) => ({ productId: id, nombre: P[id][0], qty, precio: P[id][1] }));
      const subtotal = items.reduce((sum, i) => sum + i.qty * i.precio, 0);
      const total = subtotal + (dom ? dom.costo : 0);
      const [canalNombre, pct] = CAN[canal];
      numPorDia[fecha] = (numPorDia[fecha] || 0) + 1;
      const id = `demo${n}`;
      ventas.unshift({ id, num: numPorDia[fecha], creadoAt: Date.now() - (filas.length - n) * 600000, fecha, hora, items, pago, metodoPago: metodo, cliente: cliente || null, total, subtotal, domicilio: dom, estado, canal, canalNombre, comisionPct: pct, comision: Math.round((subtotal * pct) / 100) });
      ledger.unshift({ id: `l${n}`, tipo: "ingreso", concepto: `Venta${cliente ? ` (${cliente})` : ""} — ${items.map((i) => `${i.qty}x ${i.nombre}`).join(", ")}`, monto: total, fecha, hora, ventaId: id, metodoPago: metodo });
    });
    // Fiados (uno muy atrasado, otro atrasado y uno reciente)
    const fiados = [["Doña Marta", -12, 54000, "573001112233"], ["Julián", -9, 38000, "573004445566"], ["Camila", -2, 22000, ""]];
    const fiado = fiados.map(([nombre, off, monto, telefono], k) => ({ id: `f${k}`, nombre, monto, fecha: diaRelativo(off), telefono }));
    fiados.forEach(([nombre, off, monto], k) => ventas.push({ id: `fv${k}`, num: 90 + k, fecha: diaRelativo(off), hora: "18:30", items: [{ productId: "tradicional", nombre: P.tradicional[0], qty: 1, precio: monto }], pago: "fiado", metodoPago: null, cliente: nombre, total: monto, subtotal: monto, domicilio: null, estado: "entregado", canal: "directo", canalNombre: "Directo", comisionPct: 0, comision: 0 }));
    ledger.unshift({ id: "g1", tipo: "gasto", concepto: "Compra de papa y salchicha", monto: 85000, fecha: diaRelativo(0), hora: "08:30", metodoPago: "efectivo" });
    ledger.unshift({ id: "g2", tipo: "gasto", concepto: "Gas y aceite", monto: 42000, fecha: diaRelativo(-1), hora: "09:10", metodoPago: "efectivo" });
    const stocks = { papa: [3500, 8000], salchicha: [2400, 1000], quesoCosteno: [350, 500], aceite: [2800, 1000], mostaza: [0, 40], salsaTomate: [4200, 1500] };
    const insumos = DEMO_INSUMOS.map((i) => (stocks[i.id] ? { ...i, stock: stocks[i.id][0], minimo: stocks[i.id][1] } : i));
    set("skp-ventas", ventas); set("skp-ledger", ledger); set("skp-fiado", fiado); set("skp-insumos", insumos);
    set("skp-products", DEMO_PRODUCTS); set("skp-pct-items", DEMO_PCT_ITEMS); set("skp-categorias", ["Salchipapas"]);
    set("skp-canales", [...CANALES_BASE, { id: "rappi", nombre: "Rappi", comision: 22, custom: true }, { id: "didi", nombre: "DiDi Food", comision: 18, custom: true }]);
    set("skp-config", { ...DEFAULT_CONFIG, nombre: "Salchi Costeño", telefonoPedidos: "573001234567" });
    set("skp-qr-pago", { telefono: "3001234567", foto: null });
    set("skp-last-backup", new Date().toISOString());
  } catch (e) { console.error(e); }
}

/* ============================= MONTAJE (reemplaza a main.jsx) ============================= */
prepararDemo();
const rootEl = document.getElementById("root");
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

/* ============================= PREMIUM: códigos de activación ============================= */
// WhatsApp (con 57) al que te escriben quienes quieren poner publicidad en la app (solo se usa en el anuncio "Tu publicidad aquí").
const CONTACTO_ANUNCIOS = "573104721041";

/* ============================= PUBLICIDAD (se quita con Premium) ============================= */
// Los anuncios se leen del archivo anuncios.json (lo editas y lo subes a Netlify sin tocar el código).
function AdBanner() {
  const { abrirPremium } = useCfg();
  const [anuncios, setAnuncios] = useState([]);
  const [i, setI] = useState(0);
  useEffect(() => {
    let vivo = true;
    fetch(`./anuncios.json?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { anuncios: [] }))
      .then((d) => { if (vivo && Array.isArray(d.anuncios)) setAnuncios(d.anuncios.filter((a) => a && a.titulo)); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);
  useEffect(() => {
    if (anuncios.length < 2) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % anuncios.length), 8000);
    return () => clearInterval(t);
  }, [anuncios.length]);
  const hayAnuncio = anuncios.length > 0;
  const a = hayAnuncio ? anuncios[i % anuncios.length] : { titulo: "Tu publicidad aquí", texto: "Anuncia tu negocio a todos los que usan esta app. Escríbenos.", enlace: `https://wa.me/${CONTACTO_ANUNCIOS}?text=${encodeURIComponent("Hola, quiero poner publicidad en la app")}` };
  return (
    <div className="no-print rounded-xl p-3 mb-3 flex items-center gap-3" style={{ background: "#F4E3C1", border: "1px dashed #C9B98F" }}>
      {a.imagen && <img src={a.imagen} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 10, flexShrink: 0 }} />}
      <a href={a.enlace || "#"} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0" style={{ textDecoration: "none" }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: BRAND.muted, letterSpacing: 0.6 }}>PUBLICIDAD</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.titulo}</div>
        {a.texto && <div style={{ fontSize: 11.5, color: BRAND.ink, opacity: 0.8, lineHeight: 1.25 }}>{a.texto}</div>}
      </a>
      <button onClick={() => abrirPremium("Quitar la publicidad")} className="flex-shrink-0 rounded-full px-2.5 py-1.5" style={{ background: BRAND.ink, color: BRAND.gold, fontSize: 10.5, fontWeight: 700 }}>👑 Quitar</button>
    </div>
  );
}

// Primera apertura: hay que aceptar términos y privacidad (dos casillas separadas) antes de usar la app o guardar datos.
function ConsentModal({ onAceptar }) {
  const [tc, setTc] = useState(false);
  const [pp, setPp] = useState(false);
  const enlace = { color: BRAND.salsa, fontWeight: 700, textDecoration: "underline" };
  return (
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: 80 }}>
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative max-w-md w-full rounded-t-3xl p-5 max-h-[92vh] overflow-y-auto" style={{ background: BRAND.card }}>
        <div className="display" style={{ fontSize: 19, color: BRAND.ink, marginBottom: 6 }}>Antes de empezar</div>
        <p style={{ fontSize: 12, color: BRAND.muted, marginBottom: 12 }}>Para usar Negocio Comida lee y acepta estos dos documentos. Tus datos se guardan en tu celular. La app es para mayores de 18 años.</p>
        <label className="flex items-start gap-2 mb-3" style={{ fontSize: 13, color: BRAND.ink }}>
          <input type="checkbox" checked={tc} onChange={(e) => setTc(e.target.checked)} style={{ width: 20, height: 20, marginTop: 1, flexShrink: 0 }} />
          <span>Acepto los <a href="./terminos.html" target="_blank" rel="noopener noreferrer" style={enlace}>Términos y condiciones</a></span>
        </label>
        <label className="flex items-start gap-2 mb-4" style={{ fontSize: 13, color: BRAND.ink }}>
          <input type="checkbox" checked={pp} onChange={(e) => setPp(e.target.checked)} style={{ width: 20, height: 20, marginTop: 1, flexShrink: 0 }} />
          <span>Acepto la <a href="./privacidad.html" target="_blank" rel="noopener noreferrer" style={enlace}>Política de privacidad</a></span>
        </label>
        <button disabled={!(tc && pp)} onClick={onAceptar} className="w-full rounded-full py-3 font-bold disabled:opacity-40" style={{ background: BRAND.gold, color: BRAND.ink }}>Continuar</button>
        {!(tc && pp) && <p style={{ fontSize: 10.5, color: BRAND.muted, marginTop: 8, textAlign: "center" }}>Marca las dos casillas para continuar.</p>}
      </div>
    </div>
  );
}

function PremiumModal({ motivo, onClose, onActivarTienda, onActivarPrueba, pruebaActivada }) {
  const [error, setError] = useState("");
  const [precioPlay, setPrecioPlay] = useState("");
  const [cargando, setCargando] = useState(false);
  useEffect(() => {
    playDetalles().then((d) => { if (d && d.price) setPrecioPlay(`${d.price.currency} ${Number(d.price.value).toLocaleString("es-CO")}`); }).catch(() => {});
  }, []);
  // Premium se paga únicamente con Google Play (suscripción mensual)
  const suscribir = async () => {
    setError(""); setCargando(true);
    try { const r = await playComprar(); onActivarTienda(r.token, r.confirmado); }
    catch (e) {
      if (e && e.name === "AbortError") setError("");
      else setError(e && e.message === "no-dg" ? "Premium se activa desde la app instalada desde Google Play." : "No se pudo completar la compra. Intenta de nuevo.");
    }
    setCargando(false);
  };
  const restaurar = async () => {
    setError(""); setCargando(true);
    try {
      const l = await playComprasActivas();
      if (l.length) onActivarTienda(l[0].purchaseToken); else setError("No encontré una suscripción activa en tu cuenta de Google Play.");
    } catch { setError("Para restaurar tu compra abre la app instalada desde Google Play."); }
    setCargando(false);
  };
  const beneficios = [
    "📊 Excel con colores y mejor organizado",
    "📦 Canales con comisión (Rappi, DiDi…) y su neto",
    "🧾 Factura, reporte en PDF y ticket de 58 mm",
    "💬 Mensajes de WhatsApp a clientes y a los que deben fiado",
    "🔒 Copia de seguridad, restaurar y copia en Google Drive",
    "🚫 Sin publicidad",
  ];
  return (
    <div className="fixed inset-0 flex items-end justify-center" style={{ zIndex: 60 }}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative max-w-md w-full rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto" style={{ background: BRAND.card }}>
        <div className="flex items-center justify-between mb-2">
          <span className="display" style={{ fontSize: 19, color: BRAND.ink }}>👑 Hazte Premium</span>
          <button onClick={onClose}><X size={20} color={BRAND.ink} /></button>
        </div>
        {motivo && <p style={{ fontSize: 12, color: BRAND.salsa, fontWeight: 700, marginBottom: 8 }}>“{motivo}” es una función Premium.</p>}
        <div className="space-y-1.5 mb-3">
          {beneficios.map((b) => <div key={b} style={{ fontSize: 12.5, color: BRAND.ink }}>{b}</div>)}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.gold2, marginBottom: 10 }}>{precioPlay ? `${precioPlay} por mes` : "Suscripción mensual en Google Play"}</div>
        {!pruebaActivada && (
          <>
            <button disabled={cargando} onClick={async () => { setError(""); setCargando(true); try { await onActivarPrueba(); } finally { setCargando(false); } }} className="w-full rounded-full py-3 mb-1 font-bold disabled:opacity-50" style={{ background: BRAND.gold, color: BRAND.ink }}>🎁 Activar mis 4 días gratis</button>
            <p style={{ fontSize: 10.5, color: BRAND.muted, marginBottom: 10, textAlign: "center" }}>Sin tarjeta. Inicias sesión con Google para recordar tus días si reinstalas.</p>
          </>
        )}
        <button disabled={cargando} onClick={suscribir} className="w-full rounded-full py-3 mb-2 font-bold text-white disabled:opacity-50" style={{ background: "#01875F" }}>{cargando ? "Un momento…" : "Suscribirme con Google Play"}</button>
        <button disabled={cargando} onClick={restaurar} className="w-full text-center mb-3" style={{ fontSize: 12, color: BRAND.muted, textDecoration: "underline" }}>Ya pagué: restaurar mi compra</button>
        {error && <p style={{ fontSize: 11.5, color: BRAND.salsa, marginBottom: 8 }}>{error}</p>}
        {error && urlPlay && <a href={urlPlay} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: BRAND.salsa, fontWeight: 700, textDecoration: "underline" }}>Abrir la app en Google Play</a>}
        <p style={{ fontSize: 10.5, color: BRAND.muted, marginTop: 6 }}>El pago y la cancelación se manejan desde tu cuenta de Google Play.</p>
      </div>
    </div>
  );
}

function PlanCard() {
  const { esPremiumPago, enPrueba, diasPrueba, abrirPremium, pruebaActivada, activarPrueba } = useCfg();
  if (esPremiumPago) {
    return (
      <div className="rounded-xl p-4 mb-4" style={{ background: "#EAF3E9", border: `1px solid ${BRAND.green}` }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.ink, marginBottom: 4 }}>👑 Premium activo</div>
        <p style={{ fontSize: 11, color: BRAND.muted, marginBottom: 10 }}>Sin publicidad y con todas las funciones.</p>
        <a href="https://play.google.com/store/account/subscriptions" target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: BRAND.muted, textDecoration: "underline" }}>Administrar mi suscripción en Google Play</a>
      </div>
    );
  }
  return (
    <div className="rounded-xl p-4 mb-4" style={{ background: enPrueba ? "#FBF3E1" : BRAND.card, border: enPrueba ? `1px solid ${BRAND.gold2}` : "none" }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: BRAND.ink, marginBottom: 4 }}>{enPrueba ? `🎁 Prueba gratis: te ${diasPrueba === 1 ? "queda 1 día" : `quedan ${diasPrueba} días`}` : "Plan gratis"}</div>
      <p style={{ fontSize: 11, color: BRAND.muted, marginBottom: 10 }}>
        {enPrueba ? "Tienes todas las funciones Premium y sin publicidad. Cuando termine la prueba sigues con el plan gratis." : (pruebaActivada ? "" : "Prueba todo Premium 4 días gratis, sin tarjeta. ") + "Con Premium desbloqueas Excel con colores, PDF, WhatsApp a clientes, comisiones por canal, copia de seguridad y quitas la publicidad."}
      </p>
      {!pruebaActivada && <button onClick={activarPrueba} className="w-full rounded-full py-2.5 font-bold mb-2" style={{ background: BRAND.gold, color: BRAND.ink }}>🎁 Activar mis 4 días gratis</button>}
      <button onClick={() => abrirPremium("")} className="w-full rounded-full py-2.5 font-bold" style={{ background: pruebaActivada ? BRAND.gold : "transparent", color: BRAND.ink, border: pruebaActivada ? "none" : `1px solid ${BRAND.gold2}` }}>👑 Ver Premium</button>
    </div>
  );
}

/* ============================= EXCEL BONITO (colores, formato de moneda, filtros) ============================= */
function cargarExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  const fuentes = ["https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js", "https://unpkg.com/exceljs@4.4.0/dist/exceljs.min.js"];
  const probar = (i) => new Promise((resolve, reject) => {
    if (i >= fuentes.length) { reject(new Error("sin conexión")); return; }
    const sc = document.createElement("script");
    sc.src = fuentes[i];
    sc.onload = () => (window.ExcelJS ? resolve(window.ExcelJS) : probar(i + 1).then(resolve, reject));
    sc.onerror = () => probar(i + 1).then(resolve, reject);
    document.head.appendChild(sc);
  });
  return probar(0);
}

async function generarExcelBonito(d) {
  const ExcelJS = await cargarExcelJS();
  const C = { oscuro: "FF241812", dorado: "FFF2A93B", crema: "FFFFFBF2", beige: "FFF4E3C1", verde: "FF5B8C5A", verdeClaro: "FFEAF3E9", rojo: "FFE85D3D", rojoClaro: "FFFBEAE4", gris: "FF8A7A6C", blanco: "FFFFFFFF", linea: "FFE3D5B5" };
  const MONEDA = '"$" #,##0';
  const borde = { top: { style: "thin", color: { argb: C.linea } }, left: { style: "thin", color: { argb: C.linea } }, bottom: { style: "thin", color: { argb: C.linea } }, right: { style: "thin", color: { argb: C.linea } } };
  const wb = new ExcelJS.Workbook();
  wb.creator = d.negocio; wb.created = new Date();
  const rango = d.desde === d.hasta ? fmtDate(d.desde) : `${fmtDate(d.desde)} al ${fmtDate(d.hasta)}`;

  const nuevaHoja = (nombre, anchos, colorTab) => {
    const ws = wb.addWorksheet(nombre, { properties: { tabColor: { argb: colorTab } }, views: [{ showGridLines: false }] });
    ws.columns = anchos.map((w) => ({ width: w }));
    return ws;
  };
  const titulo = (ws, texto, sub, nCols) => {
    ws.mergeCells(1, 1, 1, nCols);
    const t = ws.getCell(1, 1);
    t.value = texto; t.font = { name: "Calibri", size: 18, bold: true, color: { argb: C.dorado } };
    t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.oscuro } };
    t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(1).height = 34;
    ws.mergeCells(2, 1, 2, nCols);
    const s = ws.getCell(2, 1);
    s.value = sub; s.font = { name: "Calibri", size: 11, italic: true, color: { argb: C.gris } };
    s.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.beige } };
    s.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    ws.getRow(2).height = 20;
  };
  const encabezado = (ws, fila, textos) => {
    const r = ws.getRow(fila);
    textos.forEach((t, i) => {
      const c = r.getCell(i + 1);
      c.value = t; c.font = { name: "Calibri", bold: true, size: 11, color: { argb: C.blanco } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.oscuro } };
      c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      c.border = borde;
    });
    r.height = 24;
  };
  // Escribe una fila de datos con color alterno; `monedas` = índices (base 0) que son dinero
  const filaDatos = (ws, fila, valores, monedas = [], idx = 0) => {
    const r = ws.getRow(fila);
    valores.forEach((v, i) => {
      const c = r.getCell(i + 1);
      c.value = v;
      c.font = { name: "Calibri", size: 11, color: { argb: C.oscuro } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: idx % 2 === 0 ? C.crema : C.blanco } };
      c.border = borde;
      c.alignment = { vertical: "middle", wrapText: true, horizontal: monedas.includes(i) ? "right" : "left" };
      if (monedas.includes(i)) c.numFmt = MONEDA;
    });
    return r;
  };
  const filaTotal = (ws, fila, etiqueta, colEtiqueta, colMonto, formula, nCols) => {
    const r = ws.getRow(fila);
    for (let i = 1; i <= nCols; i++) {
      const c = r.getCell(i);
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.dorado } };
      c.font = { name: "Calibri", bold: true, size: 12, color: { argb: C.oscuro } };
      c.border = borde;
    }
    r.getCell(colEtiqueta).value = etiqueta; r.getCell(colEtiqueta).alignment = { horizontal: "right" };
    const m = r.getCell(colMonto); m.value = formula; m.numFmt = MONEDA; m.alignment = { horizontal: "right" };
    r.height = 22;
  };

  /* ----- Hoja 1: Resumen ----- */
  const wr = nuevaHoja("Resumen", [30, 22, 4, 30, 22], C.dorado);
  titulo(wr, `${d.negocio} — Informe`, `Periodo: ${rango}   ·   Generado: ${fmtDate(todayISO())} ${fmtHora(horaAhora())}`, 5);
  const tarjeta = (fila, col, etiqueta, valor, color, fondo) => {
    const e = wr.getCell(fila, col); e.value = etiqueta;
    e.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.gris } };
    e.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fondo } };
    e.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    const v = wr.getCell(fila, col + 1); v.value = valor; v.numFmt = typeof valor === "number" && !String(etiqueta).includes("%") ? MONEDA : undefined;
    v.font = { name: "Calibri", size: 14, bold: true, color: { argb: color } };
    v.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fondo } };
    v.alignment = { vertical: "middle", horizontal: "right" };
    [e, v].forEach((c) => { c.border = borde; });
    wr.getRow(fila).height = 26;
  };
  const sec = (fila, col, texto) => {
    wr.mergeCells(fila, col, fila, col + 1);
    const c = wr.getCell(fila, col); c.value = texto;
    c.font = { name: "Calibri", size: 12, bold: true, color: { argb: C.oscuro } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: C.beige } };
    c.alignment = { horizontal: "left", indent: 1 };
  };
  sec(4, 1, "🍽️ VENTAS"); sec(4, 4, "💰 CAJA");
  tarjeta(5, 1, "Total vendido", d.totalVendido, C.oscuro, C.crema);
  tarjeta(6, 1, "Total costos", d.totalCostos, C.rojo, C.rojoClaro);
  tarjeta(7, 1, "Utilidad neta", d.utilidadNeta, C.verde, C.verdeClaro);
  tarjeta(8, 1, "% Utilidad", `${d.pctUtilidad.toFixed(1)}%`, C.verde, C.verdeClaro);
  tarjeta(9, 1, "Comisiones de canales", d.comisiones || 0, C.rojo, C.rojoClaro);
  tarjeta(5, 4, "Ingresos", d.ingresos, C.verde, C.verdeClaro);
  tarjeta(6, 4, "Gastos", d.gastos, C.rojo, C.rojoClaro);
  tarjeta(7, 4, "Saldo del periodo", d.saldo, d.saldo >= 0 ? C.verde : C.rojo, C.crema);
  tarjeta(8, 4, "Efectivo", d.efectivo, C.oscuro, C.crema);
  tarjeta(9, 4, "Transferencias", d.transferencia, C.oscuro, C.crema);
  sec(10, 1, "🧾 FIADO");
  tarjeta(11, 1, "Fiado nuevo del periodo", d.fiadoNuevo, C.rojo, C.rojoClaro);
  tarjeta(12, 1, "Fiado pendiente (total)", d.totalFiado, C.rojo, C.rojoClaro);

  /* ----- Hoja 2: Ventas ----- */
  const wv = nuevaHoja("Ventas", [13, 10, 46, 14, 14, 16, 16, 22, 14, 14, 14, 30, 18], C.verde);
  titulo(wv, "Ventas del periodo", rango, 13);
  encabezado(wv, 4, ["Fecha", "Hora", "Productos", "Forma de pago", "Método", "Canal", "Estado", "Cliente", "Total", "Comisión", "Domicilio", "Dirección", "Domiciliario"]);
  d.ventas.forEach((v, i) => {
    const r = filaDatos(wv, 5 + i, [fmtDate(v.fecha), v.hora ? fmtHora(v.hora) : "", v.items.map((it) => `${it.qty}x ${it.nombre}`).join(", "), v.pago === "fiado" ? "Fiado" : "Pagado", v.metodoPago ? (v.metodoPago === "efectivo" ? "Efectivo" : "Transferencia") : "", v.canalNombre || "Directo", estadoInfo(estadoDe(v)).label, v.cliente || "", v.total, v.comision || 0, v.domicilio ? v.domicilio.costo : 0, v.domicilio ? v.domicilio.direccion : "", v.domicilio ? (v.domicilio.domiciliario || "") : ""], [8, 9, 10], i);
    r.getCell(4).font = { name: "Calibri", size: 11, bold: true, color: { argb: v.pago === "fiado" ? C.rojo : C.verde } };
  });
  const finV = 5 + d.ventas.length;
  if (d.ventas.length) {
    filaTotal(wv, finV, "TOTAL", 8, 9, { formula: `SUM(I5:I${finV - 1})`, result: d.ventas.reduce((s, v) => s + v.total, 0) }, 10);
    const cc = wv.getCell(finV, 10); cc.value = { formula: `SUM(J5:J${finV - 1})`, result: d.ventas.reduce((s, v) => s + (v.comision || 0), 0) }; cc.numFmt = MONEDA; cc.alignment = { horizontal: "right" };
    wv.autoFilter = { from: { row: 4, column: 1 }, to: { row: finV - 1, column: 13 } };
  }
  else wv.getCell(5, 1).value = "No hay ventas en estas fechas.";
  wv.views = [{ state: "frozen", ySplit: 4, showGridLines: false }];

  /* ----- Hoja 3: Libro de Caja ----- */
  const wc = nuevaHoja("Libro de Caja", [13, 10, 12, 44, 15, 16], C.dorado);
  titulo(wc, "Libro de Caja", rango, 6);
  encabezado(wc, 4, ["Fecha", "Hora", "Tipo", "Concepto", "Método", "Monto"]);
  d.caja.forEach((l, i) => {
    const r = filaDatos(wc, 5 + i, [fmtDate(l.fecha), l.hora ? fmtHora(l.hora) : "", l.tipo === "ingreso" ? "Ingreso" : "Gasto", l.concepto, (l.metodoPago || "efectivo") === "efectivo" ? "Efectivo" : "Transferencia", l.tipo === "ingreso" ? l.monto : -l.monto], [5], i);
    const col = l.tipo === "ingreso" ? C.verde : C.rojo;
    r.getCell(3).font = { name: "Calibri", size: 11, bold: true, color: { argb: col } };
    r.getCell(6).font = { name: "Calibri", size: 11, bold: true, color: { argb: col } };
  });
  const finC = 5 + d.caja.length;
  if (d.caja.length) { filaTotal(wc, finC, "SALDO", 5, 6, { formula: `SUM(F5:F${finC - 1})`, result: d.saldo }, 6); wc.autoFilter = { from: { row: 4, column: 1 }, to: { row: finC - 1, column: 6 } }; }
  else wc.getCell(5, 1).value = "No hay movimientos en estas fechas.";
  wc.views = [{ state: "frozen", ySplit: 4, showGridLines: false }];

  /* ----- Hoja 4: Fiado ----- */
  const wf = nuevaHoja("Fiado", [30, 16, 14, 20], C.rojo);
  titulo(wf, "Libreta de Fiado", `Saldo pendiente al ${fmtDate(todayISO())}`, 4);
  encabezado(wf, 4, ["Cliente", "Debe", "Desde", "Teléfono"]);
  d.fiado.forEach((f, i) => filaDatos(wf, 5 + i, [f.nombre, f.monto, f.fecha ? fmtDate(f.fecha) : "", f.telefono || ""], [1], i));
  const finF = 5 + d.fiado.length;
  if (d.fiado.length) filaTotal(wf, finF, "TOTAL QUE LE DEBEN", 1, 2, { formula: `SUM(B5:B${finF - 1})`, result: d.totalFiado }, 4);
  else wf.getCell(5, 1).value = "Nadie debe fiado.";
  wf.views = [{ state: "frozen", ySplit: 4, showGridLines: false }];

  /* ----- Hoja 5: Productos ----- */
  const nP = 3 + d.pctLabels.length + 1;
  const wp = nuevaHoja("Productos", [26, 13, 14, ...d.pctLabels.map(() => 14), 14], C.oscuro);
  titulo(wp, "Costos y utilidad por producto", "Precio, costo de insumos y estructura de costos", nP);
  encabezado(wp, 4, ["Producto", "Precio", "Costo insumos", ...d.pctLabels, "Utilidad"]);
  d.productos.forEach((p, i) => {
    const r = filaDatos(wp, 5 + i, [p.nombre, p.precio, p.insumos, ...p.items, p.utilidad], Array.from({ length: nP - 1 }, (_, k) => k + 1), i);
    r.getCell(nP).font = { name: "Calibri", size: 11, bold: true, color: { argb: p.utilidad >= 0 ? C.verde : C.rojo } };
  });
  wp.views = [{ state: "frozen", ySplit: 4, xSplit: 1, showGridLines: false }];

  // Impresión cómoda
  wb.worksheets.forEach((ws) => { ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }; });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `informe-${d.negocio.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${d.desde}-a-${d.hasta}.xlsx`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
