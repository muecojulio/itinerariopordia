"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { filterOptions, normalizeText } from "../lib/gestures";

/**
 * Selector con búsqueda (combobox + listbox, patrón ARIA APG).
 *
 * - Filtra mientras se escribe ignorando mayúsculas y diacríticos.
 * - Teclado: ↑/↓ para recorrer, Inicio/Fin, Enter para confirmar, Escape para
 *   cerrar, Tab para salir.
 * - Cierra al hacer clic fuera y mantiene el foco predecible.
 * - El desplazamiento de la lista no arrastra la página (overscroll-behavior).
 */
export default function SearchSelect({
  id,
  label,
  value,
  onChangeText,
  options = [],
  onSelect,
  placeholder,
  hint,
  loading = false,
  emptyMessage = "Sin coincidencias. Prueba con otras palabras.",
  autoComplete = "off",
  inputMode,
  describedBy
}) {
  const uid = useId();
  const fieldId = id || `combo-${uid}`;
  const listId = `${fieldId}-list`;
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const optionRefs = useRef([]);
  const restoreRef = useRef("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const items = useMemo(
    () => options.map((o) => ({ ...o, _text: normalizeText(o.label) })),
    [options]
  );
  const filtered = useMemo(() => filterOptions(items, value, (o) => o.label), [items, value]);
  const showList = open && (loading || filtered.length > 0 || (value || "").trim().length >= 2);

  useEffect(() => {
    if (!open) setActive(-1);
  }, [open]);

  useEffect(() => {
    if (active < 0) return;
    const node = optionRefs.current[active];
    node?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  useEffect(() => {
    function onPointerDown(event) {
      // La raíz incluye la lista: pulsar una opción no la cierra antes de tiempo.
      const root = rootRef.current;
      if (root && !root.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const choose = useCallback(
    (item) => {
      if (!item) return;
      restoreRef.current = item.label;
      onSelect?.(item);
      setOpen(false);
      setActive(-1);
      inputRef.current?.focus();
    },
    [onSelect]
  );

  const onKeyDown = useCallback(
    (event) => {
      const last = filtered.length - 1;
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          if (!open) {
            setOpen(true);
            setActive(0);
          } else {
            setActive((i) => (i >= last ? 0 : i + 1));
          }
          break;
        case "ArrowUp":
          event.preventDefault();
          if (!open) {
            setOpen(true);
            setActive(last);
          } else {
            setActive((i) => (i <= 0 ? last : i - 1));
          }
          break;
        case "Home":
          if (open) {
            event.preventDefault();
            setActive(0);
          }
          break;
        case "End":
          if (open) {
            event.preventDefault();
            setActive(last);
          }
          break;
        case "Enter":
          if (open && active >= 0 && filtered[active]) {
            event.preventDefault();
            choose(filtered[active]);
          }
          break;
        case "Escape":
          if (open) {
            event.preventDefault();
            setOpen(false);
            if (restoreRef.current) onChangeText?.(restoreRef.current);
          }
          break;
        case "Tab":
          setOpen(false);
          break;
        default:
          break;
      }
    },
    [active, choose, filtered, onChangeText, open]
  );

  const activeOptionId = active >= 0 && filtered[active] ? `${listId}-opt-${active}` : undefined;

  return (
    <div className="combo" ref={rootRef}>
      <div className="combo-anchor">
        <label className="combo-field" htmlFor={fieldId}>
          <span className="combo-label">{label}</span>
          <input
            ref={inputRef}
            id={fieldId}
            className="combo-input"
            type="text"
            role="combobox"
            aria-expanded={open ? "true" : "false"}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeOptionId}
            aria-busy={loading ? "true" : undefined}
            aria-describedby={describedBy}
            autoComplete={autoComplete}
            inputMode={inputMode}
            placeholder={placeholder}
            value={value || ""}
            onChange={(event) => {
              onChangeText?.(event.target.value);
              setOpen(true);
              setActive(-1);
            }}
            onFocus={() => {
              restoreRef.current = value || "";
              if ((value || "").trim().length >= 2) setOpen(true);
            }}
            onKeyDown={onKeyDown}
            onMouseDown={() => setOpen(true)}
          />
        </label>
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          aria-label={typeof label === "string" ? label : "Opciones"}
          className="combo-list"
          hidden={!showList}
        >
          {loading ? (
            <li className="combo-empty" role="presentation">
              Buscando…
            </li>
          ) : filtered.length === 0 ? (
            <li className="combo-empty" role="presentation">
              {emptyMessage}
            </li>
          ) : (
            filtered.map((item, i) => (
              <li
                key={item.id ?? item.label}
                id={`${listId}-opt-${i}`}
                ref={(node) => {
                  optionRefs.current[i] = node;
                }}
                role="option"
                aria-selected={active === i}
                className={active === i ? "combo-option on" : "combo-option"}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(item)}
              >
                {item.label}
              </li>
            ))
          )}
        </ul>
      </div>
      {hint ? <p className="muted tiny combo-hint">{hint}</p> : null}
    </div>
  );
}
