"use client";

import { useCallback, useRef } from "react";

/** Movimiento mínimo (px) antes de decidir el eje del gesto. */
export const AXIS_MIN_MOVE = 8;

/**
 * Seguimiento de arrastre con bloqueo de eje, compartido por el swipe de
 * pestañas y el swipe para revelar acciones.
 *
 * - Usa Pointer Events (ratón, táctil y lápiz con el mismo código).
 * - No roba gestos verticales: si el primer movimiento es vertical, abandona y
 *   el navegador sigue con el scroll normal.
 * - Captura el puntero solo cuando el gesto ya es claramente horizontal, para
 *   que los controles anidados sigan recibiendo sus clics.
 * - Bloquea el clic posterior a un arrastre real (no se activan controles por
 *   accidente).
 */
export default function useAxisDrag({
  enabled = true,
  shouldIgnore,
  onStart,
  onDrag,
  onEnd,
  lockRatio = 1.25
} = {}) {
  const gesture = useRef(null);
  const suppressClickUntil = useRef(0);

  const onPointerDown = useCallback(
    (event) => {
      if (!enabled) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (shouldIgnore?.(event.target, event)) return;
      const now = event.timeStamp || Date.now();
      gesture.current = {
        id: event.pointerId,
        target: event.currentTarget,
        host: event.currentTarget,
        x: event.clientX,
        y: event.clientY,
        lastX: event.clientX,
        lastT: now,
        vx: 0,
        axis: null,
        captured: false
      };
      onStart?.(event);
    },
    [enabled, shouldIgnore, onStart]
  );

  const onPointerMove = useCallback(
    (event) => {
      const g = gesture.current;
      if (!g || event.pointerId !== g.id) return;
      const dx = event.clientX - g.x;
      const dy = event.clientY - g.y;

      if (!g.axis) {
        if (Math.abs(dx) < AXIS_MIN_MOVE && Math.abs(dy) < AXIS_MIN_MOVE) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          g.axis = "vertical";
          return;
        }
        if (Math.abs(dx) > Math.abs(dy) * lockRatio) {
          g.axis = "horizontal";
          // Ya sabemos que es horizontal: capturamos para no perder el gesto.
          try {
            g.host?.setPointerCapture?.(event.pointerId);
            g.captured = true;
          } catch {}
        } else {
          return;
        }
      }
      if (g.axis !== "horizontal") return;

      const now = event.timeStamp || Date.now();
      const dt = Math.max(now - g.lastT, 1);
      g.vx = (event.clientX - g.lastX) / dt; // px/ms
      g.lastX = event.clientX;
      g.lastT = now;
      onDrag?.(event, { dx, dy, vx: g.vx });
    },
    [lockRatio, onDrag]
  );

  const settle = useCallback(
    (event, cancelled) => {
      const g = gesture.current;
      if (!g) return;
      gesture.current = null;
      if (g.captured) {
        try {
          g.host?.releasePointerCapture?.(event.pointerId);
        } catch {}
      }
      const dx = event.clientX - g.x;
      const dy = event.clientY - g.y;
      const horizontal = g.axis === "horizontal";
      if (horizontal && !cancelled) suppressClickUntil.current = Date.now() + 450;
      onEnd?.(event, {
        dx,
        dy,
        vx: g.vx,
        axis: g.axis || "none",
        horizontal,
        cancelled: Boolean(cancelled)
      });
    },
    [onEnd]
  );

  const onPointerUp = useCallback((event) => settle(event, false), [settle]);
  const onPointerCancel = useCallback((event) => settle(event, true), [settle]);

  /** Impide el clic fantasma que sigue a un arrastre horizontal. */
  const onClickCapture = useCallback((event) => {
    if (Date.now() < suppressClickUntil.current) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, []);

  return {
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onClickCapture
    }
  };
}
