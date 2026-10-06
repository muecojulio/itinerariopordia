"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useHorizontalRail from "../lib/useHorizontalRail";
import { stepIndex } from "../lib/gestures";

/**
 * Carrusel de días con semántica de pestañas.
 *
 * - Pestañas + panel relacionado (aria-selected / aria-controls).
 * - Indicador que se desplaza suavemente hacia la opción activa.
 * - Teclado: ←/→ e Inicio/Fin con foco en la pestaña activa.
 * - Si no caben, scroll nativo con snap, centrado de la activa y señales de
 *   desbordamiento (bordes difuminados + pista "Desliza").
 * - La opción activa se marca con forma/tipografía además de color.
 */
export default function DayRail({ items, active, onChange, label = "Días del viaje" }) {
  const rail = useHorizontalRail({ deps: [items.length, active] });
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false });
  const rafRef = useRef(0);

  const measure = useCallback(() => {
    const el = rail.ref.current;
    const node = el?.querySelector('[role="tab"][aria-selected="true"]');
    if (!el || !node) return;
    setIndicator({ left: node.offsetLeft, width: node.offsetWidth, ready: true });
  }, [rail.ref]);

  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(measure);
    const el = rail.ref.current;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (el && ro) ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(rafRef.current);
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure, rail.ref, items, active]);

  useEffect(() => {
    rail.centerOn('[role="tab"][aria-selected="true"]');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  function focusIndex(index) {
    const nodes = rail.ref.current?.querySelectorAll('[role="tab"]');
    nodes?.[index]?.focus({ preventScroll: true });
  }

  function onKeyDown(event) {
    const current = Math.max(0, items.findIndex((item) => item.id === active));
    let next = null;
    if (event.key === "ArrowRight") next = stepIndex(current, 1, items.length);
    else if (event.key === "ArrowLeft") next = stepIndex(current, -1, items.length);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    if (next == null) return;
    event.preventDefault();
    const item = items[next];
    if (!item) return;
    if (item.id !== active) onChange(item.id);
    requestAnimationFrame(() => focusIndex(next));
  }

  return (
    <div
      className="rail-wrap"
      data-overflow={rail.edges.overflows ? "yes" : "no"}
      data-start={rail.edges.atStart ? "no" : "yes"}
      data-end={rail.edges.atEnd ? "no" : "yes"}
    >
      <div
        className="rail days"
        role="tablist"
        aria-label={label}
        ref={rail.ref}
        onKeyDown={onKeyDown}
      >
        <span
          className="rail-indicator"
          aria-hidden="true"
          data-ready={indicator.ready ? "yes" : "no"}
          style={{
            "--ind-left": `${Math.round(indicator.left)}px`,
            "--ind-width": `${Math.round(indicator.width)}px`
          }}
        />
        {items.map((item) => {
          const on = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`daytab-${item.id}`}
              className={on ? "day-card on" : "day-card"}
              aria-selected={on ? "true" : "false"}
              aria-controls="day-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(item.id)}
            >
              <span className="day-card-label">{item.label}</span>
              {item.sub ? <span className="day-card-sub">{item.sub}</span> : null}
              <span className="day-card-count">
                {item.count === 1 ? "1 parada" : `${item.count} paradas`}
              </span>
              {on ? (
                <span className="day-card-mark" aria-hidden="true">
                  ✓ En pantalla
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {rail.hint ? (
        <p className="rail-hint" aria-hidden="true">
          Desliza <span>→</span>
        </p>
      ) : null}
    </div>
  );
}
