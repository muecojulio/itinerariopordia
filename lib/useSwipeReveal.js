"use client";

import { useCallback, useRef, useState } from "react";
import useAxisDrag from "./useAxisDrag";
import useMediaQuery from "./useMediaQuery";
import { REVEAL_THRESHOLD, isInteractiveTarget, prefersReducedMotion } from "./gestures";

const DESKTOP = "(min-width: 1024px)";

/**
 * Swipe para revelar acciones en una tarjeta.
 *
 * - El panel de acciones existe siempre en el DOM: el swipe solo lo descubre.
 * - `open` controla semántica (aria-expanded / inert) y la posición del panel.
 * - El gesto vertical queda para el navegador; solo se arrastra en horizontal.
 * - En escritorio (>=1024px) el panel se muestra en línea y se desactiva el
 *   arrastre: no se depende del swipe.
 */
export default function useSwipeReveal({ panelRef, defaultWidth = 232 } = {}) {
  const [open, setOpen] = useState(false);
  const desktop = useMediaQuery(DESKTOP);
  const cardRef = useRef(null);
  const innerRef = useRef(null);
  const draggingRef = useRef(false);

  const canSwipe = useCallback(() => !desktop, [desktop]);

  const measure = useCallback(() => {
    const panel = panelRef?.current;
    const card = cardRef.current;
    if (!card) return defaultWidth;
    const width = panel?.offsetWidth || Math.min(defaultWidth, (card.offsetWidth || defaultWidth) * 0.72);
    return Math.round(width);
  }, [panelRef, defaultWidth]);

  const paint = useCallback((x) => {
    if (cardRef.current) {
      cardRef.current.style.setProperty("--reveal-x", `${Math.round(x)}px`);
    }
  }, []);

  const setOpenState = useCallback(
    (next) => {
      setOpen(next);
      paint(next ? -measure() : 0);
    },
    [paint, measure]
  );

  const toggle = useCallback(() => {
    if (!canSwipe()) return;
    setOpenState(!open);
  }, [canSwipe, open, setOpenState]);

  const close = useCallback(() => setOpenState(false), [setOpenState]);

  const { handlers } = useAxisDrag({
    enabled: true,
    lockRatio: 1.25,
    // El arrastre nunca empieza sobre botones, enlaces, campos ni selectores.
    shouldIgnore: (target) => !canSwipe() || isInteractiveTarget(target),
    onStart: () => {
      draggingRef.current = false;
      paint(open ? -measure() : 0);
    },
    onDrag: (_event, { dx }) => {
      if (!draggingRef.current) {
        draggingRef.current = true;
        cardRef.current?.classList.add("dragging");
      }
      const width = measure();
      const start = open ? -width : 0;
      paint(Math.max(-width, Math.min(0, start + dx)));
    },
    onEnd: (_event, { dx, vx, axis, cancelled }) => {
      draggingRef.current = false;
      cardRef.current?.classList.remove("dragging");
      const width = measure();
      if (axis !== "horizontal" || cancelled) {
        paint(open ? -width : 0);
        return;
      }
      const flick = Math.abs(vx) >= 0.45 && Math.abs(dx) > 24;
      const enough = Math.abs(dx) >= width * REVEAL_THRESHOLD;
      const next = flick ? vx < 0 : enough ? dx < 0 : open;
      setOpenState(next);
      if (prefersReducedMotion()) paint(next ? -width : 0);
    }
  });

  return {
    open,
    /** En escritorio el panel va en línea: está "abierto" a efectos de foco. */
    expanded: open || desktop,
    desktop,
    toggle,
    close,
    cardRef,
    innerRef,
    panelWidth: measure,
    dragHandlers: handlers,
    /** El swipe no sustituye al control visible: el botón siempre está. */
    showToggle: true
  };
}
