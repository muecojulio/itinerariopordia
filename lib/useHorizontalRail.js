"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { prefersReducedMotion, scrollTargetFor } from "./gestures";

/**
 * Estado compartido de un carril horizontal (chips, carruseles, pestañas):
 * - Señales de desbordamiento solo cuando hay contenido fuera de vista.
 * - Pista "Desliza" que aparece una vez y desaparece sola.
 * - Centrado accesible del elemento seleccionado.
 */
export default function useHorizontalRail({ deps = [] } = {}) {
  const ref = useRef(null);
  const hintDismissed = useRef(false);
  const [edges, setEdges] = useState({ overflows: false, atStart: true, atEnd: true });
  const [hint, setHint] = useState(false);

  const dismissHint = useCallback(() => {
    hintDismissed.current = true;
    setHint(false);
  }, []);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const x = el.scrollLeft;
    const overflows = max > 4;
    setEdges({
      overflows,
      atStart: !overflows || x <= 4,
      atEnd: !overflows || x >= max - 4
    });
    if (overflows && !hintDismissed.current) setHint(true);
    if (x > 12) dismissHint();
  }, [dismissHint]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      el.removeEventListener("scroll", update);
      ro?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update, ...deps]);

  useEffect(() => {
    if (!hint) return undefined;
    const t = setTimeout(dismissHint, 3200);
    return () => clearTimeout(t);
  }, [hint, dismissHint]);

  /** Deja visible (y opcionalmente centrada) la opción activa. */
  const centerOn = useCallback((target, { center = true, margin = 12 } = {}) => {
    const el = ref.current;
    const node = typeof target === "string" ? el?.querySelector(target) : target;
    if (!el || !node) return;
    const left = scrollTargetFor(el, node, { center, margin });
    if (Math.abs(left - el.scrollLeft) < 2) return;
    el.scrollTo({
      left,
      behavior: prefersReducedMotion() ? "auto" : "smooth"
    });
  }, []);

  return { ref, edges, hint, update, dismissHint, centerOn };
}
