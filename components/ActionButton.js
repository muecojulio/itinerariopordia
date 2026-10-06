"use client";

import { useCallback } from "react";
import usePressStates from "../lib/usePressStates";

const ICONS = { busy: null, success: "✓", error: "!" };

/**
 * Botón del sistema de interacciones.
 *
 * - Objetivo táctil >= 44px y `touch-action: manipulation` (ver ui-motion.css).
 * - Feedback al presionar (hundimiento + escala) sin depender del hover.
 * - Estados: inactivo, cargando (bloquea el segundo envío), éxito, error y
 *   deshabilitado.
 * - El estado se anuncia con `aria-busy` y una región `role="status"`
 *   (el error no depende solo del color: icono + texto + vibración discreta).
 */
export default function ActionButton({
  children,
  icon,
  variant = "plain",
  block = false,
  busyLabel,
  successMessage,
  errorMessage,
  status,
  statusMessage,
  announceBusy = true,
  onPress,
  disabled = false,
  className = "",
  type = "button",
  ...rest
}) {
  const press = usePressStates();
  const state = status || press.state;
  const busy = state === "busy";
  const off = disabled || busy;
  const message = statusMessage ?? press.message;

  const classes = [
    "btn",
    variant !== "plain" ? variant : "",
    block ? "block" : "",
    `is-${state}`,
    className
  ]
    .filter(Boolean)
    .join(" ");

  const label = busy ? busyLabel || "Un momento…" : children;

  const handleClick = useCallback(
    (event) => {
      if (off) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (!onPress) return;
      press.run(() => onPress(event), {
        success: successMessage,
        error: errorMessage
      });
    },
    [off, onPress, press, successMessage, errorMessage]
  );

  const announcement = busy
    ? announceBusy
      ? `${busyLabel || children}: en curso`
      : ""
    : state === "success"
      ? message || successMessage || "Hecho"
      : state === "error"
        ? message || errorMessage || "No se pudo completar"
        : "";

  return (
    <>
      <button
        {...rest}
        type={type}
        className={classes}
        onClick={handleClick}
        disabled={off}
        aria-busy={busy ? "true" : undefined}
        data-state={state}
      >
        {busy ? (
          <span className="btn-spinner" aria-hidden="true" />
        ) : (
          <span className="btn-icon" aria-hidden="true">
            {ICONS[state] || icon}
          </span>
        )}
        <span className="btn-label">{label}</span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </>
  );
}
