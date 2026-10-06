"use client";

import { useRef } from "react";
import ActionButton from "./ActionButton";
import Collapsible from "./Collapsible";
import useSwipeReveal from "../lib/useSwipeReveal";
import { formatKm, formatWalk, mapsUrl } from "../lib/geo";
import { etiquetaTipo, tipsPara } from "../lib/tips";

/**
 * Tarjeta de parada.
 *
 * - Swipe horizontal (solo gesto claramente horizontal) para revelar acciones;
 *   el control visible "Acciones" abre y cierra lo mismo con toque, ratón y
 *   teclado, así que el swipe nunca es la única vía.
 * - Los controles anidados y el deslizamiento vertical de la página no se
 *   interceptan (bloqueo de eje + exclusión de controles).
 * - Cerrado, el panel de acciones queda `inert`: no entra en el orden de foco ni
 *   se anuncia.
 * - En escritorio las acciones se muestran en línea (no se depende del swipe).
 */
export default function PlaceCard({
  place,
  position,
  legKm,
  origin,
  onListen,
  onMap,
  onRemove
}) {
  const panelRef = useRef(null);
  const reveal = useSwipeReveal({ panelRef });
  const id = place.id || `place-${position}`;
  const actionsId = `actions-${id}`;
  const expanded = reveal.expanded;
  const tips = tipsPara(place.type, place.cuisine);
  const details = [place.what, place.order].filter(Boolean).length;

  return (
    <article
      ref={reveal.cardRef}
      className={`place card reveal${reveal.open ? " is-open" : ""}`}
      data-desktop-actions={reveal.desktop ? "inline" : "overlay"}
      aria-labelledby={`title-${id}`}
    >
      <button
        type="button"
        className="reveal-toggle"
        aria-expanded={reveal.open ? "true" : "false"}
        aria-controls={actionsId}
        onClick={reveal.toggle}
      >
        <span className="reveal-toggle-dots" aria-hidden="true">
          ⋯
        </span>
        <span className="reveal-toggle-text">Acciones</span>
      </button>

      <div
        className="reveal-panel"
        id={actionsId}
        ref={panelRef}
        inert={expanded ? undefined : true}
        aria-hidden={expanded ? undefined : "true"}
      >
        <p className="reveal-panel-title">
          Acciones · {place.name}
        </p>
        <ActionButton
          block
          icon="🔊"
          onPress={() => onListen?.(place)}
          successMessage="Leyendo la parada"
          errorMessage="No pude leerla"
        >
          Escuchar
        </ActionButton>
        <ActionButton
          block
          icon="◎"
          busyLabel="Cargando…"
          onPress={() => onMap?.(place)}
          successMessage="Extras en el mapa"
          errorMessage="No pude cargar los extras"
        >
          Mapa y extras
        </ActionButton>
        <a className="btn block" href={mapsUrl(origin, place, "transit")} target="_blank" rel="noreferrer">
          Transporte
        </a>
        <a className="btn block" href={mapsUrl(origin, place, "walk")} target="_blank" rel="noreferrer">
          Caminando
        </a>
        <ActionButton
          block
          variant="danger"
          icon="✕"
          onPress={() => onRemove?.(place)}
          successMessage="Parada quitada"
          errorMessage="No pude quitarla"
        >
          Quitar
        </ActionButton>
      </div>

      <div className="reveal-inner no-swipe" {...reveal.dragHandlers}>
        {place.photo?.url ? (
          <img className="place-photo" src={place.photo.url} alt="" loading="lazy" />
        ) : null}
        <div className="place-top">
          <span className="tag">
            {position} · {etiquetaTipo(place.type)}
          </span>
          <span className="day">{place.time || `Día ${place.day || "?"}`}</span>
        </div>
        <h3 id={`title-${id}`}>{place.name}</h3>
        {place.cuisine ? <p className="cuisine">Cocina {place.cuisine}</p> : null}
        {place.address ? <p className="muted">{place.address}</p> : null}
        <div className="metrics">
          <span>{formatKm(place.distanceKm)}</span>
          <span>{formatWalk(place.walkMin)}</span>
        </div>
        {details > 0 || tips ? (
          <Collapsible
            id={`detail-${id}`}
            title="Qué hacer y qué pedir"
            summary={details > 1 ? "2 ideas" : undefined}
            defaultOpen
          >
            <p>
              <strong>Qué hacer:</strong> {place.what || tips.que}
            </p>
            <p>
              <strong>Qué pedir:</strong> {place.order || tips.pedir}
            </p>
          </Collapsible>
        ) : null}
        {place.wiki?.summary ? (
          <Collapsible id={`wiki-${id}`} title="Contexto" summary="Wikipedia">
            <p>{place.wiki.summary}</p>
          </Collapsible>
        ) : null}
        {place.stops?.length ? (
          <Collapsible id={`stops-${id}`} title="Transporte cercano" summary={`${place.stops.length} paradas`}>
            <ul className="steps">
              {place.stops.slice(0, 6).map((stop) => (
                <li key={`${stop.name}-${stop.distance}`}>
                  {stop.name} · {stop.distance} m
                </li>
              ))}
            </ul>
          </Collapsible>
        ) : null}
        {legKm != null ? (
          <p className="leg">
            Al siguiente: {formatKm(legKm)} · {legKm <= 1 ? "a pie" : "transporte"}
          </p>
        ) : null}
      </div>
    </article>
  );
}
