"use client";

import { useRef } from "react";
import useAxisDrag from "./useAxisDrag";
import { isHorizontalGesture, isInteractiveTarget, stepIndex } from "./gestures";

/**
 * Cambio de panel con swipe horizontal sobre el contenedor de paneles.
 * Se mantiene la navegación por pestañas: el gesto es un atajo opcional.
 *
 * - Bloqueo de eje: los gestos verticales siguen siendo del navegador.
 * - Los gestos que empiezan sobre controles (botones, campos, mapas, carriles,
 *   tarjetas con swipe propio) se ignoran.
 * - El panel acompaña al dedo con resistencia y vuelve a su sitio sin rebote.
 */
export default function useSwipePanels({ order, active, onChange, containerRef, enabled = true }) {
  const delta = useRef(0);
  const index = Math.max(0, order.indexOf(active));

  const resetTransform = () => {
    const el = containerRef.current;
    if (!el) return;
    el.classList.remove("dragging");
    el.style.transform = "";
  };

  const { handlers } = useAxisDrag({
    enabled,
    lockRatio: 1.25,
    shouldIgnore: (target) => isInteractiveTarget(target),
    onStart: () => {
      delta.current = 0;
      containerRef.current?.classList.add("dragging");
    },
    onDrag: (_event, { dx }) => {
      const el = containerRef.current;
      if (!el) return;
      delta.current = dx;
      const width = el.clientWidth || 320;
      const atEdge =
        (index === 0 && dx > 0) || (index === order.length - 1 && dx < 0);
      const resistance = atEdge ? 0.2 : 0.42;
      const limit = width * 0.32;
      const x = Math.max(-limit, Math.min(limit, dx * resistance));
      el.style.transform = `translate3d(${Math.round(x)}px, 0, 0)`;
    },
    onEnd: (_event, { dx, dy, vx, axis }) => {
      resetTransform();
      if (axis !== "horizontal" || !enabled) return;
      const fast = Math.abs(vx) >= 0.45 && Math.abs(dx) > 24;
      if (!fast && !isHorizontalGesture({ dx, dy })) return;
      const next = order[stepIndex(index, dx < 0 ? 1 : -1, order.length)];
      if (next && next !== active) onChange(next, dx < 0 ? 1 : -1);
    }
  });

  return handlers;
}
