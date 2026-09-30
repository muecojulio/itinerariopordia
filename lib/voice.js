export const TONES = [
  {
    id: "tranquilo",
    label: "Tranquilo",
    hint: "Despacio y suave",
    rate: 0.82,
    pitch: 0.88
  },
  {
    id: "natural",
    label: "Natural",
    hint: "Tono de conversación",
    rate: 0.96,
    pitch: 1
  },
  {
    id: "guia",
    label: "Guía",
    hint: "Claro, como audioguía",
    rate: 0.9,
    pitch: 0.95
  },
  {
    id: "formal",
    label: "Formal",
    hint: "Usted, pausado",
    rate: 0.88,
    pitch: 0.9
  },
  {
    id: "energico",
    label: "Enérgico",
    hint: "Ágil y cercano",
    rate: 1.12,
    pitch: 1.12
  }
];

export function spanishVoices() {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  const all = window.speechSynthesis.getVoices() || [];
  const es = all.filter((v) => (v.lang || "").toLowerCase().startsWith("es"));
  const list = es.length ? es : all;
  return list.map((v) => ({
    uri: v.voiceURI,
    name: v.name,
    lang: v.lang,
    label: voiceLabel(v)
  }));
}

function voiceLabel(v) {
  const lang = (v.lang || "").toLowerCase();
  const region =
    lang.includes("mx")
      ? "México"
      : lang.includes("es")
        ? "España"
        : lang.includes("us")
          ? "EE. UU."
          : lang.includes("ar")
            ? "Argentina"
            : lang.includes("co")
              ? "Colombia"
              : lang.includes("cl")
                ? "Chile"
                : lang.startsWith("es")
                  ? "español"
                  : v.lang;
  const gender = guessGender(v.name);
  return `${v.name} · ${region}${gender ? ` · ${gender}` : ""}`;
}

function guessGender(name) {
  const n = (name || "").toLowerCase();
  if (/(female|mujer|woman|samantha|monica|paulina|sabina|penelope|lucia|elena|carmen|soledad|paloma)/.test(n))
    return "femenina";
  if (/(male|hombre|man|jorge|juan|diego|carlos|miguel|enrique)/.test(n))
    return "masculina";
  return "";
}

export function stopTalking() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

export function speakText(text, { voiceUri, toneId } = {}) {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return { ok: false, error: "Este dispositivo no lee en voz alta." };
  }
  const tone = TONES.find((t) => t.id === toneId) || TONES[1];
  stopTalking();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "es-MX";
  utter.rate = tone.rate;
  utter.pitch = tone.pitch;
  const voices = window.speechSynthesis.getVoices() || [];
  const chosen =
    voices.find((v) => v.voiceURI === voiceUri) ||
    voices.find((v) => (v.lang || "").toLowerCase().startsWith("es")) ||
    null;
  if (chosen) {
    utter.voice = chosen;
    utter.lang = chosen.lang || "es-MX";
  }
  window.speechSynthesis.speak(utter);
  return { ok: true };
}

export function scriptForPlaces(places, { toneId, city, startLabel } = {}) {
  const tone = toneId || "natural";
  const open = opener(tone, city, startLabel, places.length);
  const parts = places.map((p, i) => placeLine(p, i, tone));
  return [open, ...parts, closer(tone)].filter(Boolean).join(". ");
}

function opener(tone, city, startLabel, count) {
  const donde = city ? ` en ${city}` : "";
  const desde = startLabel ? ` El punto de partida es ${startLabel}.` : "";
  if (tone === "formal") {
    return `Buenos días. Este es el itinerario${donde}.${desde} Hay ${count} paradas.`;
  }
  if (tone === "guia") {
    return `Atención. Recorrido del día${donde}.${desde} ${count} visitas en orden.`;
  }
  if (tone === "energico") {
    return `¡Vamos! Hoy${donde} tienes ${count} paradas.${desde}`;
  }
  if (tone === "tranquilo") {
    return `Con calma. Este es el plan${donde}.${desde}`;
  }
  return `Itinerario${donde}.${desde} ${count} paradas.`;
}

function placeLine(p, i, tone) {
  const n = i + 1;
  const hora = p.time ? ` a las ${p.time}` : "";
  const tipo = p.type || "lugar";
  const dist =
    p.distanceKm != null ? `, a ${p.distanceKm < 1 ? Math.round(p.distanceKm * 1000) + " metros" : p.distanceKm.toFixed(1) + " kilómetros"}` : "";
  const walk = p.walkMin ? `, unos ${p.walkMin} minutos a pie` : "";
  let extra = "";
  if ((tipo === "restaurante" || tipo === "cafe") && p.order) {
    extra =
      tone === "formal"
        ? ` Se recomienda pedir: ${p.order}`
        : ` Para pedir: ${p.order}`;
  } else if (p.what) {
    extra = ` ${p.what}`;
  }
  if (tone === "guia") {
    return `Parada ${n}${hora}: ${p.name}, ${tipo}${dist}${walk}.${extra}`;
  }
  return `Número ${n}${hora}: ${p.name}${dist}${walk}.${extra}`;
}

function closer(tone) {
  if (tone === "formal") return "Que tenga un buen recorrido.";
  if (tone === "energico") return "¡Buen viaje!";
  if (tone === "tranquilo") return "Sin prisa. Disfruta el camino.";
  if (tone === "guia") return "Fin del recorrido de audio.";
  return "Listo. Buen viaje.";
}
