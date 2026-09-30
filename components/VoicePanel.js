"use client";

import { useEffect, useState } from "react";
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
    speakText("Hola. Así se escucha esta voz en español, con el tono elegido.", {
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
      <label>
        Tipo de voz
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
      <div className="tone-grid">
        {TONES.map((t) => (
          <button
            key={t.id}
            className={toneId === t.id ? "tone on" : "tone"}
            onClick={() => onTone(t.id)}
            type="button"
          >
            <strong>{t.label}</strong>
            <span>{t.hint}</span>
          </button>
        ))}
      </div>
      <div className="row wrap">
        <button className="btn" onClick={preview} type="button">
          Probar voz
        </button>
        <button className="btn primary" onClick={onListen} type="button">
          {speaking ? "Leyendo…" : "Escuchar el día"}
        </button>
        <button className="btn" onClick={stopTalking} type="button">
          Callar
        </button>
      </div>
    </div>
  );
}
