/**
 * Comprobaciones del sistema de interacciones (sin navegador).
 *
 *   node scripts/check-interactions.mjs     (o: npm run check)
 *
 * 1) Ejecuta la lógica pura de gestos, filtrado y navegación por teclado.
 * 2) Revisa que la interfaz conserve las piezas de accesibilidad y de
 *    movimiento que pide el sistema (semántica, estados, reduced motion).
 */
import { readFileSync } from "node:fs";
import {
  HORIZONTAL_RATIO,
  filterOptions,
  isHorizontalGesture,
  isInteractiveTarget,
  normalizeText,
  revealOffset,
  scrollTargetFor,
  stepIndex
} from "../lib/gestures.js";

let failures = 0;
let checks = 0;

function ok(name, condition, detail = "") {
  checks += 1;
  if (condition) {
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.log(`  ✗ ${name}${detail ? ` → ${detail}` : ""}`);
  }
}

function group(title) {
  console.log(`\n${title}`);
}

/* ------------------------------------------------------------------ *
 * 1. Bloqueo de eje: horizontal vs vertical
 * ------------------------------------------------------------------ */
group("Bloqueo de eje (gestos)");
ok("horizontal claro (dx 80, dy 10) es gesto horizontal", isHorizontalGesture({ dx: 80, dy: 10 }));
ok("vertical claro (dx 10, dy 80) NO es gesto horizontal", !isHorizontalGesture({ dx: 10, dy: 80 }));
ok("diagonal (dx 50, dy 45) NO es horizontal", !isHorizontalGesture({ dx: 50, dy: 45 }));
ok("gesto corto y lento (dx 20, dy 0, 400 ms) NO cuenta", !isHorizontalGesture({ dx: 20, dy: 0, ms: 400 }));
ok("gesto corto pero rápido (dx 20 en 20 ms) SÍ cuenta", isHorizontalGesture({ dx: 20, dy: 0, ms: 20 }));
ok("proporción usada es >= 1.2", HORIZONTAL_RATIO >= 1.2, String(HORIZONTAL_RATIO));

group("Controles excluidos del swipe");
class FakeNode {
  constructor(selector) {
    this.selector = selector;
  }
  closest() {
    return this.selector ? { tag: this.selector } : null;
  }
}
const mustIgnore = [
  "button",
  "a",
  "input",
  "select",
  'label',
  '[role="tab"]',
  "[role=tablist]",
  'textarea',
  '[role="switch"]',
  ".leaflet-container",
  ".no-swipe",
  ".rail"
];
ok(
  "botones, enlaces, campos, pestañas, mapas, carriles y tarjetas con swipe quedan excluidos",
  mustIgnore.every((sel) => isInteractiveTarget(new FakeNode(sel))),
  mustIgnore.filter((sel) => !isInteractiveTarget(new FakeNode(sel))).join(", ")
);
ok("un contenedor normal sí permite el gesture", !isInteractiveTarget(new FakeNode("")));

/* ------------------------------------------------------------------ *
 * 2. Búsqueda sin mayúsculas ni diacríticos
 * ------------------------------------------------------------------ */
group("Búsqueda del combobox");
const options = [
  { id: 1, label: "Ciudad de México" },
  { id: 2, label: "Bogotá" },
  { id: 3, label: "Medellín" }
];
ok("ignora mayúsculas", filterOptions(options, "BOGOTA").length === 1, String(filterOptions(options, "BOGOTA").length));
ok("ignora diacríticos (medellin → Medellín)", filterOptions(options, "medellin")[0]?.id === 3);
ok("ignora diacríticos (méxico → Mexico)", filterOptions(options, "méxico")[0]?.id === 1);
ok("sin texto devuelve todas", filterOptions(options, "").length === 3);
ok("sin coincidencias devuelve lista vacía", filterOptions(options, "zzz").length === 0);
ok("normaliza espacios repetidos", normalizeText("  San   Juan ") === "san juan");

/* ------------------------------------------------------------------ *
 * 3. Navegación de listas y pestañas
 * ------------------------------------------------------------------ */
group("Navegación (teclado) y carriles");
ok("arrow derecha avanza", stepIndex(0, 1, 4) === 1);
ok("arrow derecha en el final vuelve al inicio", stepIndex(3, 1, 4) === 0);
ok("arrow izquierda en el inicio salta al final", stepIndex(0, -1, 4) === 3);
ok("lista vacía no rompe el índice", stepIndex(2, 1, 0) === 0);

const rail = { scrollLeft: 0, clientWidth: 300, scrollWidth: 900, offsetLeft: 0 };
const first = { offsetLeft: 0, offsetWidth: 140 };
const fourth = { offsetLeft: 480, offsetWidth: 140 };
ok("centrar la opción activa dentro del carril", scrollTargetFor(rail, fourth, { center: true }) === 400, String(scrollTargetFor(rail, fourth, { center: true })));
ok("la opción ya visible no provoca desplazamiento", scrollTargetFor(rail, first, { center: false }) === 0);
ok("el desplazamiento nunca pasa del final del carril", scrollTargetFor(rail, fourth, { center: true }) <= rail.scrollWidth - rail.clientWidth);

group("Swipe para revelar acciones");
ok("arrastre corto sin velocidad: se queda cerrado", revealOffset(-30, 240, { open: false, velocity: 0 }) === 0);
ok("arrastre largo: abre", revealOffset(-160, 240, { open: false, velocity: 0 }) === -240);
ok("gesto rápido hacia la izquierda: abre aunque sea corto", revealOffset(-40, 240, { open: false, velocity: -0.9 }) === -240);
ok("gesto rápido hacia la derecha: cierra", revealOffset(40, 240, { open: true, velocity: 0.9 }) === 0);
ok("estando abierto, un arrastre insuficiente lo deja abierto", revealOffset(-40, 240, { open: true, velocity: 0 }) === -240);

/* ------------------------------------------------------------------ *
 * 4. Revisión de la interfaz (semántica, estados, reduced motion)
 * ------------------------------------------------------------------ */
group("Interfaz: semántica y estados accesibles");
const files = {
  client: "components/ClientApp.js",
  button: "components/ActionButton.js",
  combo: "components/SearchSelect.js",
  card: "components/PlaceCard.js",
  rail: "components/DayRail.js",
  collapse: "components/Collapsible.js",
  switch: "components/Switch.js",
  gestureHook: "lib/useAxisDrag.js",
  revealHook: "lib/useSwipeReveal.js",
  pressHook: "lib/usePressStates.js",
  motion: "app/ui-motion.css",
  globals: "app/globals.css",
  layout: "app/layout.js"
};
const src = {};
for (const [key, path] of Object.entries(files)) {
  src[key] = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const expectations = [
  ["botón: aria-busy durante la carga", src.button, /aria-busy/],
  ["botón: bloquea el doble envío (disabled + guarda)", src.button, /disabled=\{off\}/],
  ["botón: éxito y error con icono, no solo color", src.button, /ICONS/],
  ["botón: mensaje de estado anunciado (role=status)", src.button, /role="status"/],
  ["combobox: rol y estado expandido", src.combo, /role="combobox"[\s\S]*aria-expanded/],
  ["combobox: lista de opciones con opción activa", src.combo, /role="listbox"[\s\S]*aria-selected=\{active === i\}/],
  ["combobox: teclado ↑ ↓ Inicio Fin Enter Escape", src.combo, /"ArrowDown"[\s\S]*"ArrowUp"[\s\S]*"Home"[\s\S]*"End"[\s\S]*"Enter"[\s\S]*"Escape"/],
  ["combobox: mensaje cuando no hay coincidencias", src.combo, /emptyMessage/],
  ["combobox: cierra al hacer clic fuera", src.combo, /pointerdown/],
  ["tarjeta: panel de acciones fuera del foco cuando está oculto", src.card, /inert=/],
  ["tarjeta: control visible con aria-expanded", src.card, /aria-expanded[\s\S]*aria-controls/],
  ["tarjeta: acciones en línea en escritorio", src.revealHook, /expanded: open \|\| desktop/],
  ["tarjeta: clic posterior a un arrastre bloqueado", src.gestureHook, /onClickCapture[\s\S]*suppressClickUntil/],
  ["carrusel: pestañas con panel relacionado", src.rail, /role="tablist"[\s\S]*aria-controls="day-panel"/],
  ["carrusel: teclado ← → Inicio Fin", src.rail, /ArrowRight[\s\S]*ArrowLeft[\s\S]*Home[\s\S]*End/],
  ["carrusel: indicador animado de la opción activa", src.rail, /rail-indicator/],
  ["carrusel: aviso de desbordamiento y pista de deslizamiento", src.rail, /data-overflow[\s\S]*rail-hint/],
  ["acordeón: estado accesible y cuerpo inerte al cerrar", src.collapse, /aria-expanded[\s\S]*inert=\{!open\}/],
  ["switch: rol y estado", src.switch, /role="switch"[\s\S]*aria-checked/],
  ["pestañas inferiores: semántica y roving tabindex", src.client, /role="tablist"[\s\S]*tabIndex=\{on \? 0 : -1\}/],
  ["pestañas inferiores: paneles con rol y etiqueta", src.client, /role="tabpanel"[\s\S]*aria-labelledby="tab-plan"/],
  ["pestañas inferiores: flechas e Inicio/Fin", src.client, /onNavKeyDown[\s\S]*ArrowRight/],
  ["paneles: cambio con swipe sin quitar las pestañas", src.client, /useSwipePanels/],
  ["paneles: el swipe se desactiva en el mapa", src.client, /swipeEnabled = tab !== "mapa"/],
  ["carriles: el scroll es nativo (overflow-x auto)", src.globals, /overflow-x: auto/],
  ["carriles: snap moderado", src.globals, /scroll-snap-type: x proximity/],
  ["carril: la barra se oculta solo visualmente", src.globals, /scrollbar-width: none/],
  ["carril: overscroll contenido", src.globals, /overscroll-behavior-x: contain/],
  ["tarjeta: el navegador conserva el scroll vertical", src.globals, /touch-action: pan-y/],
  ["foco de teclado visible", src.motion, /:focus-visible/],
  ["objetivo táctil mínimo de 44 px", src.motion, /min-height: 44px/],
  ["movimiento reducido respetado", src.motion, /prefers-reduced-motion: reduce/],
  ["scroll suave solo si no hay movimiento reducido", src.motion, /prefers-reduced-motion: no-preference[\s\S]*scroll-behavior: smooth/],
  ["duración de panel dentro de 180-250 ms", src.motion, /--t-pane: 2[0-5][0-9]ms/],
  ["el zoom no está bloqueado", src.layout, /initialScale: 1/]
];
for (const [name, content, pattern] of expectations) {
  ok(name, pattern.test(content));
}
ok("layout: sin userScalable:false", !/userScalable/.test(src.layout));

const motionTokens = [...src.motion.matchAll(/--t-[\w-]+:\s*(\d+)ms/g)].map((m) => Number(m[1]));
ok(
  "todas las duraciones son breves (<= 320 ms)",
  motionTokens.every((ms) => ms <= 320),
  motionTokens.join(", ")
);

/* ------------------------------------------------------------------ *
 * Resumen
 * ------------------------------------------------------------------ */
console.log(`\n${checks - failures}/${checks} comprobaciones correctas.`);
if (failures) {
  console.error(`\n${failures} comprobación(es) fallaron.`);
  process.exit(1);
}
console.log("Sistema de interacciones: OK");
