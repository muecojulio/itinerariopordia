"use client";

import { useEffect, useId, useState } from "react";
import ActionButton from "./ActionButton";
import { TONES, spanishVoices, speakText, stopTalking } from "../lib/voice";

export default function VoicePanel({
  voiceUri,
  toneId,
  onVoice,
  onTone,
  onListen,
  speaking
}) {
  const [voices, setVoices] = useState([]);
  const toneGroupId = useId();

  useEffect(() => {
    function load() {
      setVoices(spanishVoices());
    }
    load();
    if (typeof window === "undefined") return undefined;
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () =>
      window.speechSynthesis?.removeEventListener("voiceschanged", load);
  }, []);

  function preview() {
    return speakText("Hola. Así se escucha esta voz en español, con el tono elegido.", {
      voiceUri,
      toneId
    });
  }

  return (
    <div className="card">
      <h2>Voz en español</h2>
      <p className="muted">
        Usa las voces del propio teléfono. Cambia el tipo y el tono, escucha
        una prueba y luego el día entero.
      </p>
      <label className="field">
        <span className="field-label">Tipo de voz</span>
        <select value={voiceUri} onChange={(e) => onVoice(e.target.value)}>
          <option value="">Automática (español)</option>
          {voices.map((v) => (
            <option key={v.uri} value={v.uri}>
              {v.label}
            </option>
          ))}
        </select>
      </label>
      <p className="muted tiny">
        Si no ves varias voces, el aparato solo tiene una. En iPhone se añaden
        en Ajustes → Accesibilidad → Contenido leído → Voces.
      </p>
      <div className="tone-grid" role="group" aria-labelledby={toneGroupId}>
        <p className="sr-only" id={toneGroupId}>
          Tono de lectura
        </p>
        {TONES.map((t) => (
          <button
            key={t.id}
            className={toneId === t.id ? "tone on" : "tone"}
            onClick={() => onTone(t.id)}
            type="button"
            aria-pressed={toneId === t.id ? "true" : "false"}
          >
            <strong>{t.label}</strong>
            <span>{t.hint}</span>
            {toneId === t.id ? <span className="tone-mark" aria-hidden="true">✓</span> : null}
          </button>
        ))}
      </div>
      <div className="row wrap">
        <ActionButton
          icon="🔊"
          onPress={preview}
          successMessage="Prueba de voz"
          errorMessage="No pude usar la voz del dispositivo"
        >
          Probar voz
        </ActionButton>
        <ActionButton
          variant="primary"
          icon="▶"
          status={speaking ? "busy" : "idle"}
          busyLabel="Leyendo…"
          onPress={onListen}
          successMessage="Lectura en curso"
          errorMessage="No pude leer el día"
        >
          {speaking ? "Leyendo…" : "Escuchar el día"}
        </ActionButton>
        <ActionButton icon="■" onPress={() => { stopTalking(); return { ok: true }; }} successMessage="Lectura detenida">
          Callar
        </ActionButton>
      </div>
    </div>
  );
}
