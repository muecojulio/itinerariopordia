"use client";

import { useId, useState } from "react";

/**
 * Panel plegable (acordeón).
 *
 * - El botón comunica el estado con `aria-expanded` y `aria-controls`.
 * - Apertura y cierre animados con altura progresiva, sin saltos.
 * - Cerrado queda `inert`, así no entra en el orden de foco ni se anuncia.
 */
export default function Collapsible({
  id,
  title,
  summary,
  defaultOpen = false,
  children,
  className = ""
}) {
  const uid = useId();
  const bodyId = `${id || uid}-body`;
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`collapse${open ? " open" : ""} ${className}`.trim()}>
      <h4 className="collapse-head">
        <button
          type="button"
          className="collapse-toggle"
          aria-expanded={open ? "true" : "false"}
          aria-controls={bodyId}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="collapse-title">{title}</span>
          {summary ? <span className="collapse-summary">{summary}</span> : null}
          <span className="collapse-chevron" aria-hidden="true" />
        </button>
      </h4>
      <div className="collapse-body" id={bodyId} inert={!open}>
        <div className="collapse-inner">{children}</div>
      </div>
    </div>
  );
}
