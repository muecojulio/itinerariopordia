"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "./gestures";

/** Aviso háptico breve y opcional al fallar (nunca si hay movimiento reducido). */
function pulse() {
  try {
    if (typeof navigator === "undefined" || !navigator.vibrate) return;
    if (prefersReducedMotion()) return;
    navigator.vibrate(12);
  } catch {}
}

/**
 * Máquina de estados reutilizable para acciones con feedback:
 * idle → busy → success | error → idle.
 *
 * - Evita envíos duplicados mientras `busy` está activo.
 * - `success` y `error` se anuncian a tecnologías de asistencia vía aria-live.
 * - Duración configurable (ms) y reset manual.
 */
export default function usePressStates({ successMs = 1800, errorMs = 3200 } = {}) {
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const timers = useRef([]);
  const busyRef = useRef(false);

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const run = useCallback(
    async (task, { success, error, duration } = {}) => {
      // Evita envíos duplicados: si ya está en curso, se ignora el nuevo toque.
      if (busyRef.current) return { skipped: true };
      busyRef.current = true;
      clearTimers();
      setState("busy");
      setMessage("");
      setRevision((r) => r + 1);
      try {
        const result = await task?.();
        if (result && result.ok === false) {
          busyRef.current = false;
          setState("error");
          setMessage(result.error || error || "");
          timers.current.push(
            setTimeout(() => setState("idle"), result.errorMs || errorMs)
          );
          return result;
        }
        busyRef.current = false;
        setState("success");
        setMessage(success || "");
        timers.current.push(
          setTimeout(() => setState("idle"), duration || successMs)
        );
        return result;
      } catch (err) {
        busyRef.current = false;
        pulse();
        setState("error");
        setMessage(error || "No se pudo completar la acción.");
        timers.current.push(setTimeout(() => setState("idle"), errorMs));
        return { ok: false, error: err };
      }
    },
    [clearTimers, successMs, errorMs]
  );

  const reset = useCallback(() => {
    busyRef.current = false;
    clearTimers();
    setState("idle");
    setMessage("");
  }, [clearTimers]);

  return { state, message, run, reset, revision };
}
