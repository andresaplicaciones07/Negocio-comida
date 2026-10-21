import React, { useState, useEffect, useMemo, useRef } from "https://esm.sh/react@18.2.0";
import ReactDOM from "https://esm.sh/react-dom@18.2.0/client";
import {
  ShoppingCart, Plus, Minus, X, Trash2, Pencil, Wallet,
  BarChart3, Check, ChevronRight, Receipt,
  CircleDollarSign, HandCoins, Printer, Download, Upload, ArrowLeft, Beaker, MessageCircle,
  Camera, ImagePlus, Paperclip, ArrowUpRight, ArrowDownRight, ClipboardList,
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

// Prueba gratis: empieza la primera vez que se abre la app y dura DIAS_PRUEBA días con todo Premium.
const DIAS_PRUEBA = 4;
const MS_DIA = 24 * 60 * 60 * 1000;
function cargarInicioPrueba() {
  let t = loadKey("skp-trial-inicio", null);
  if (!t) { t = Date.now(); saveKey("skp-trial-inicio", t); }
  return t;
}

/* ============================= VERSIÓN, TIENDA Y MODO DEMO ============================= */
const APP_VERSION = "27";
// --- Play Store: rellena esto cuando publiques ---
const FORZAR_TIENDA = false;      // true = fuerza la "versión para la tienda" (solo para pruebas)
const PLAY_PACKAGE = "com.andresaroca.salchicosteno"; // Paquete real de PWA Builder / Play Console
const PLAY_SKU = "premium_mensual"; // ID del producto/suscripción que crees en Play Console
const GOOGLE_CLIENT_ID = "";      // ID de cliente OAuth (tipo Web) de Google Cloud para la copia en Drive. Vacío = Drive usa el menú de compartir.
const DRIVE_ARCHIVO = "negocio-comida-backup.json";
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
// Cuánto de cada insumo se gasta con estos productos vendidos (según las recetas)
function consumoDeItems(items, products) {
  const m = {};
  (items || []).forEach((it) => {
    const p = products.find((x) => x.id === it.productId);
    if (!p) return;
    (p.receta || []).forEach((r) => { m[r.insumoId] = (m[r.insumoId] || 0) + r.cantidad * it.qty; });
  });
  return m;
}
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
  await cargarGIS();
  return new Promise((resolve, reject) => {
    const tc = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (r) => (r && r.access_token ? resolve(r.access_token) : reject(new Error((r && r.error) || "sin permiso"))),
      error_callback: (e) => reject(new Error((e && e.type) || "cancelado")),
    });
    tc.requestAccessToken({ prompt: "" });
  });
}
async function driveBuscar(token, nombre) {
  const q = encodeURIComponent(`name='${nombre}' and trashed=false`);
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime%20desc&pageSize=1`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`drive ${r.status}`);
  const d = await r.json();
  return (d.files || [])[0] || null;
}
async function driveSubir(token, nombre, contenido) {
  const ex = await driveBuscar(token, nombre);
  const limite = `nc${uid()}${uid()}`;
  const meta = ex ? {} : { name: nombre, mimeType: "application/json" };
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
async function playComprar() {
  const sv = await playService();
  const req = new PaymentRequest([{ supportedMethods: "https://play.google.com/billing", data: { sku: PLAY_SKU } }]);
  const resp = await req.show();
  const token = resp.details && resp.details.purchaseToken;
  if (!token) { await resp.complete("fail"); throw new Error("sin-token"); }
  try { await sv.acknowledge(token, "subscription"); } catch (e) { /* se reintenta al abrir la app */ }
  await resp.complete("success");
  return token;
}
async function playComprasActivas() {
  const sv = await playService();
  const l = await sv.listPurchases();
  return (l || []).filter((x) => x.itemId === PLAY_SKU);
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
  const [lastBackup, setLastBackup] = useState(() => loadKey("skp-last-backup", null));
  const [tab, setTab] = useState("catalogo");
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
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
  const [trialInicio] = useState(() => cargarInicioPrueba());
  const [ahora, setAhora] = useState(() => Date.now());
  const esPremiumPago = !!premium;
  const diasPrueba = Math.max(0, Math.ceil((trialInicio + DIAS_PRUEBA * MS_DIA - ahora) / MS_DIA));
  const enPrueba = !esPremiumPago && diasPrueba > 0;
  const esPremium = esPremiumPago || enPrueba; // durante la prueba gratis todo Premium está abierto
  const abrirPremium = (motivo) => setPremiumModal(motivo || "");
  // Envuelve una acción: si no es Premium abre la ventana de Premium en vez de ejecutarla
  const gate = (motivo, fn) => (...args) => { if (esPremium) return fn(...args); abrirPremium(motivo); return undefined; };
  const activarPremiumTienda = (token) => { const pr = { tienda: true, sku: PLAY_SKU, token, activadoEn: new Date().toISOString() }; setPremium(pr); saveKey("skp-premium", pr); setPremiumModal(null); showToast("¡Premium activado! 👑"); };
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
    if (!esPremiumPago && diasPrueba === 0 && !loadKey("skp-trial-aviso", false)) {
      saveKey("skp-trial-aviso", true);
      showToast("Terminó tu prueba gratis de 4 días", {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esPremiumPago, diasPrueba]);
  // Restaurar compras al abrir: si Google Play ya tiene una suscripción activa y la app aún no está en Premium, la activa sola.
  useEffect(() => {
    if (premium || !("getDigitalGoodsService" in window)) return;
    (async () => {
      try {
        const l = await playComprasActivas();
        if (l.length) {
          try { const sv = await playService(); await sv.acknowledge(l[0].purchaseToken, "subscription"); } catch {}
          activarPremiumTienda(l[0].purchaseToken);
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // En la versión de la tienda, confirma con Google Play que la suscripción sigue activa (si se canceló, se quita Premium).
  useEffect(() => {
    if (!esModoTienda || !premium || !premium.tienda) return;
    playComprasActivas().then((l) => {
      if (Array.isArray(l) && l.length === 0) { setPremium(null); try { localStorage.removeItem(KEY_PREFIX + "skp-premium"); } catch {} }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Deshacer / Papelera: cada eliminación queda guardada 30 días por si te equivocas ---------- */
  const withUndo = (label, keys, accion) => {
    const antes = { products, insumos, pctItems, ledger, fiado, ventas, categorias, cierres };
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
  const armarBackup = () => ({ products, insumos, pctItems, ledger, fiado, ventas, categorias, cfg, qrPago, canales, cierres, exportedAt: new Date().toISOString() });
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
  const aplicarBackup = (data) => {
    if (Array.isArray(data.products)) persist.products(data.products);
    if (Array.isArray(data.categorias)) persist.categorias(data.categorias);
    if (Array.isArray(data.insumos)) persist.insumos(data.insumos);
    if (Array.isArray(data.pctItems)) persist.pctItems(data.pctItems);
    if (Array.isArray(data.ledger)) persist.ledger(data.ledger);
    if (Array.isArray(data.fiado)) persist.fiado(data.fiado);
    if (Array.isArray(data.ventas)) persist.ventas(data.ventas);
    if (Array.isArray(data.cierres)) persist.cierres(data.cierres);
    if (Array.isArray(data.canales)) persist.canales(mezclarCanales(data.canales));
    if (data.cfg && typeof data.cfg === "object") persist.cfg({ ...DEFAULT_CONFIG, ...data.cfg });
    if (data.qrPago && typeof data.qrPago === "object") persist.qrPago(data.qrPago);
    showToast("Copia de seguridad restaurada ✅");
  };
  const restaurarBackup = (file) => {
    if (!file) return;
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
    if (!window.confirm("Esto reemplaza los datos de este celular con la última copia de Google Drive. ¿Seguir?")) return;
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
  const cartLines = cart.map((c) => {
    const prod = products.find((p) => p.id === c.productId);
    return prod ? { ...c, prod } : null;
  }).filter(Boolean);
  const cartTotal = cartLines.reduce((s, l) => s + l.prod.precio * l.qty, 0);
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const qtyInCart = (productId) => cart.find((c) => c.productId === productId)?.qty || 0;
  const addToCart = (productId) => {
    setCart((prev) => {
      const found = prev.find((c) => c.productId === productId);
      if (found) return prev.map((c) => c.productId === productId ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { productId, qty: 1 }];
    });
  };
  const changeQty = (productId, delta) => {
    setCart((prev) => prev.map((c) => c.productId === productId ? { ...c, qty: c.qty + delta } : c).filter((c) => c.qty > 0));
  };

  /* ---------- Cerrar pedido ---------- */
  const confirmOrder = ({ pago, metodoPago, cliente, fecha: fechaElegida, canalId, entregado, domicilio }) => {
    const fecha = fechaElegida || todayISO();
    const items = cartLines.map((l) => ({ productId: l.prod.id, nombre: l.prod.nombre, qty: l.qty, precio: l.prod.precio }));
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
    setProductModal(null); setNewCat(null);
  };
  const deleteProduct = (id) => {
    withUndo("Producto eliminado", ["products"], () => persist.products(products.filter((p) => p.id !== id)));
    setCart((prev) => prev.filter((c) => c.productId !== id));
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
    && (Date.now() - trialInicio) >= 3 * MS_DIA && ventas.length >= 10 && !cartOpen && !ventaResumen;
  const diasDesdeRespaldo = lastBackup ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / (24 * 60 * 60 * 1000)) : null;
  const hayDatos = ventas.length > 0 || ledger.length > 0 || fiado.length > 0;
  const mostrarRecordatorioRespaldo = esPremium && hayDatos && (diasDesdeRespaldo === null || diasDesdeRespaldo >= 3);

  return (
    <ConfigCtx.Provider value={{ cfg, qrPago, setCfg: persist.cfg, esPremium, esPremiumPago, enPrueba, diasPrueba, premium, gate, abrirPremium, canales, setCanales: persist.canales }}>
    <div style={{ background: BRAND.bg, fontFamily: "Inter, sans-serif" }} className="w-full min-h-[700px] max-w-md mx-auto relative flex flex-col" id="app-root">
      <GlobalStyle />
      <Header cartCount={cartCount} onCart={() => setCartOpen(true)} tab={tab} nombre={cfg.nombre} onEditNombre={() => setNombreModal(true)} />
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
          <Catalogo products={products} categorias={categorias} insumosMap={insumosMap} qtyInCart={qtyInCart} onAdd={addToCart} onQty={changeQty}
            onEdit={(p) => setProductModal(p)} onNew={(c) => { setNewCat(c || null); setProductModal("new"); }}
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
          onClose={() => setCartOpen(false)} onQty={changeQty} onConfirm={confirmOrder} />
      )}
      {productModal && (
        <ProductModal product={productModal === "new" ? null : productModal} categorias={categorias} defaultCat={newCat} insumosMap={insumosMap}
          onClose={() => { setProductModal(null); setNewCat(null); }} onSave={saveProduct} onDelete={deleteProduct}
          onEditReceta={(p) => { setProductModal(null); setRecetaModal(p); }} />
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
      {premiumModal !== null && <PremiumModal motivo={premiumModal} onClose={() => setPremiumModal(null)} onActivarTienda={activarPremiumTienda} />}
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
function Catalogo({ products, categorias, insumosMap, qtyInCart, onAdd, onQty, onEdit, onNew, onCrearCat, onRenombrarCat, onEliminarCat }) {
  const [cat, setCat] = useState("Todos");
  const [catModal, setCatModal] = useState(null); // "new" | nombre de la pestaña a editar
  const catDe = (p) => p.categoria || "Salchipapas";
  const catActual = cat === "Todos" || categorias.includes(cat) ? cat : "Todos";
  const lista = products.filter((p) => catActual === "Todos" || catDe(p) === catActual).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const guardarCat = (valor) => {
    const ok = catModal === "new" ? onCrearCat(valor) : onRenombrarCat(catModal, valor);
    if (ok) { setCat(valor.trim()); setCatModal(null); }
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="display" style={{ color: BRAND.card, fontSize: 19 }}>Nuestro menú</h1>
      </div>
      <div className="flex gap-1.5 mb-2 overflow-x-auto" style={{ paddingBottom: 2 }}>
        {["Todos", ...categorias].map((c) => (
          <button key={c} onClick={() => setCat(c)} className="rounded-full px-3.5 py-1.5 flex-shrink-0" style={{ background: catActual === c ? BRAND.salsa : BRAND.card, color: catActual === c ? "white" : BRAND.ink, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>{c}</button>
        ))}
        <button onClick={() => setCatModal("new")} className="rounded-full px-3 py-1.5 flex-shrink-0 flex items-center gap-1 border-2 border-dashed" style={{ borderColor: BRAND.muted, color: BRAND.gold, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}><Plus size={12} /> Pestaña</button>
      </div>
      {catActual !== "Todos" && (
        <button onClick={() => setCatModal(catActual)} className="mb-3 flex items-center gap-1.5" style={{ color: BRAND.gold, fontSize: 11.5, fontWeight: 700 }}><Pencil size={11} /> Editar o eliminar la pestaña "{catActual}"</button>
      )}
      {catActual === "Todos" && <div style={{ height: 10 }} />}
      {lista.length === 0 && <p style={{ color: BRAND.muted, fontSize: 12.5, marginBottom: 12 }}>Esta pestaña está vacía. Toca "Nuevo producto" para agregar el primero.</p>}
      <div className="grid grid-cols-3 gap-2">
        {lista.map((p) => {
          const qty = qtyInCart(p.id);
          return (
            <div key={p.id} className="rounded-xl p-1.5 relative flex flex-col" style={{ background: BRAND.card }}>
              <button onClick={() => onEdit(p)} className="absolute top-1 right-1 rounded-full p-0.5 z-10" style={{ background: "rgba(36,24,18,0.85)" }}>
                <Pencil size={10} color={BRAND.gold} />
              </button>
              <div className="w-full rounded-lg flex items-center justify-center text-xl mb-1" style={{ background: "#F4E3C1", height: 40 }}>
                {p.foto ? <img src={p.foto} alt={p.nombre} style={{ width: 32, height: 32, objectFit: "contain" }} /> : p.emoji}
              </div>
              <div style={{ color: BRAND.ink, fontWeight: 700, fontSize: 10.5, lineHeight: 1.15 }}>{p.nombre.replace("Salchipapa ", "")}</div>
              <div style={{ color: BRAND.gold2, fontWeight: 700, fontSize: 12, marginTop: 1 }}>{cop(p.precio)}</div>
              {qty === 0 ? (
                <button onClick={() => onAdd(p.id)} className="mt-1.5 rounded-full py-1 flex items-center justify-center gap-1" style={{ background: BRAND.salsa, color: "white", fontSize: 10.5, fontWeight: 700 }}>
                  <Plus size={12} /> Agregar
                </button>
              ) : (
                <div className="mt-1.5 rounded-full flex items-center justify-between px-1 py-0.5" style={{ background: BRAND.bg }}>
                  <button onClick={() => onQty(p.id, -1)} className="rounded-full p-1"><Minus size={12} color="white" /></button>
                  <span style={{ color: "white", fontWeight: 700, fontSize: 12 }}>{qty}</span>
                  <button onClick={() => onQty(p.id, 1)} className="rounded-full p-1"><Plus size={12} color="white" /></button>
                </div>
              )}
            </div>
          );
        })}
        <button onClick={() => onNew(catActual === "Todos" ? null : catActual)} className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 py-4" style={{ borderColor: BRAND.muted }}>
          <Plus size={18} color={BRAND.gold} />
          <span style={{ color: BRAND.gold, fontSize: 10, fontWeight: 700, textAlign: "center" }}>Nuevo<br />producto</span>
        </button>
      </div>
      {catModal && (
        <CategoriaModal nombre={catModal === "new" ? null : catModal} cantidad={products.filter((p) => catDe(p) === catModal).length}
          onClose={() => setCatModal(null)} onSave={guardarCat}
          onDelete={() => { if (onEliminarCat(catModal)) { setCat("Todos"); setCatModal(null); } }} />
      )}
    </div>
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
              <div key={l.productId} className="flex items-center justify-between">
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: BRAND.ink, display: "flex", alignItems: "center", gap: 5 }}>
                    {l.prod.foto ? <img src={l.prod.foto} alt="" style={{ width: 16, height: 16, objectFit: "contain" }} /> : l.prod.emoji} {l.prod.nombre}
                  </div>
                  <div style={{ fontSize: 12, color: BRAND.muted }}>{cop(l.prod.precio)} c/u</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => onQty(l.productId, -1)} className="rounded-full p-1" style={{ background: BRAND.bg }}><Minus size={12} color="white" /></button>
                  <span style={{ minWidth: 16, textAlign: "center", fontWeight: 700, color: BRAND.ink }}>{l.qty}</span>
                  <button onClick={() => onQty(l.productId, 1)} className="rounded-full p-1" style={{ background: BRAND.bg }}><Plus size={12} color="white" /></button>
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
                  const sel = canalId === c.id && !bloq                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          