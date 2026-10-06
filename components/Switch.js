"use client";

import { useState } from "react";

/**
 * Interruptor accesible.
 *
 * - Comunica nombre y estado con `role="switch"` y `aria-checked`.
 * - El cambio se anima con un movimiento breve y claro, pero el estado también
 *   se explica con texto (no depende del color ni de la animación).
 * - Bloquea dobles toques mientras la acción está en curso y anuncia errores.
 */
export default function Switch({ on, label, onToggle }) {
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");
  const busy = state === "busy";

  async function handle() {
    if (busy) return;
    setState("busy");
    setMessage("");
    try {
      const res = await onToggle?.();
      if (res && res.ok === false) {
        setState("error");
        setMessage(res.error || "No pude cambiar el estado.");
        setTimeout(() => setState("idle"), 3200);
        return;
      }
      setState("idle");
    } catch {
      setState("error");
      setMessage("No pude cambiar el estado.");
      setTimeout(() => setState("idle"), 3200);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`switch${on ? " on" : ""}${busy ? " is-busy" : ""}${state === "error" ? " is-error" : ""}`}
        role="switch"
        aria-checked={on ? "true" : "false"}
        aria-busy={busy ? "true" : undefined}
        onClick={handle}
      >
        <span className="switch-track" aria-hidden="true">
          <span className="switch-thumb" />
        </span>
        <span className="switch-label">{busy ? `${label}…` : label}</span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {busy ? `${label}: cambiando` : message}
      </span>
    </>
  );
}
