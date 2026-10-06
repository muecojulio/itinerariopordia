/**
 * Utilidades puras para gestos y navegación de listas.
 * Sin dependencias: se pueden probar con node (scripts/check-interactions.mjs).
 */

/** Proporción mínima horizontal/vertical para considerar un gesto "horizontal". */
export const HORIZONTAL_RATIO = 1.25;
/** Desplazamiento mínimo (px) para aceptar un gesto horizontal lento. */
export const SWIPE_MIN_DISTANCE = 48;
/** Velocidad mínima (px/s) para aceptar un gesto corto pero rápido. */
export const SWIPE_MIN_VELOCITY = 0.45;
/** Umbral (fracción del ancho del panel) para abrir/cerrar acciones reveladas. */
export const REVEAL_THRESHOLD = 0.45;

export function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Decide si un arrastre debe tratarse como gesto horizontal (pestañas, swipe,
 * revelar acciones) sin robarle el gesto al navegador.
 * @param {{dx:number, dy:number, ms?:number}} gesture
 */
export function isHorizontalGesture({ dx, dy, ms = 250 }) {
  const x = Math.abs(dx);
  const y = Math.abs(dy);
  if (x < 10) return false;
  if (x < y * HORIZONTAL_RATIO) return false;
  const speed = x / Math.max(ms, 1);
  return x >= SWIPE_MIN_DISTANCE || speed >= SWIPE_MIN_VELOCITY;
}

/** El gesto debe ignorarse si empieza sobre un control interactivo. */
export function isInteractiveTarget(target) {
  if (!target || typeof target.closest !== "function") return false;
  return Boolean(
    target.closest(
      'button,a,input,select,textarea,label,[role="switch"],[role="slider"],[role="tab"],[role="tablist"],[contenteditable="true"],.leaflet-container,.no-swipe,.rail'
    )
  );
}

/** Normaliza texto: sin mayúsculas ni diacríticos (búsqueda en español). */
export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Filtra opciones por texto ignorando mayúsculas y diacríticos. */
export function filterOptions(options, query, toLabel = (o) => o.label) {
  const q = normalizeText(query);
  if (!q) return options;
  return options.filter((o) => normalizeText(toLabel(o)).includes(q));
}

/**
 * Calcula el desplazamiento (scrollLeft) que deja un elemento visible y
 * opcionalmente centrado dentro de un carril horizontal.
 */
export function scrollTargetFor(container, el, { center = false, margin = 12 } = {}) {
  if (!container || !el) return 0;
  const base = container.scrollLeft;
  const left = base + (el.offsetLeft - container.offsetLeft);
  const width = el.offsetWidth || 0;
  const max = Math.max(0, container.scrollWidth - container.clientWidth);
  if (center) {
    return Math.min(max, Math.max(0, left - (container.clientWidth - width) / 2));
  }
  if (left - margin < base) return Math.max(0, left - margin);
  const right = left + width;
  if (right + margin > base + container.clientWidth) {
    return Math.min(max, right + margin - container.clientWidth);
  }
  return base;
}

/** Índice anterior/siguiente con navegación circular. */
export function stepIndex(index, delta, length) {
  if (!length) return 0;
  return (index + delta + length) % length;
}

/** Posición final del arrastre de una tarjeta con acciones reveladas. */
export function revealOffset(dx, width, { open = false, velocity = 0 } = {}) {
  const start = open ? -width : 0;
  const next = start + dx;
  const flick = Math.abs(velocity) >= 0.5;
  if (flick) return velocity < 0 ? -width : 0;
  if (next < -width * REVEAL_THRESHOLD) return -width;
  return 0;
}
