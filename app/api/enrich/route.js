import { tipsPara, cocinaEnEspanol, tipoEnEspanol } from "../../../lib/tips";
import { jsonNoStore } from "../../../lib/server-cache";
import { clampText, clientKey, rateLimit } from "../../../lib/security";

export async function POST(req) {
  if (!rateLimit(`enrich:${clientKey(req)}`, 20)) {
    return jsonNoStore({ what: "", order: "", usedAI: false }, 429);
  }
  const body = await req.json().catch(() => ({}));
  // Los campos van a un LLM: se recortan para evitar prompts desmedidos.
  const place = {
    name: clampText(body.place?.name || "", 160),
    type: clampText(body.place?.type || "", 40),
    cuisine: clampText(body.place?.cuisine || "", 80),
    address: clampText(body.place?.address || "", 260),
    what: clampText(body.place?.what || "", 400),
    order: clampText(body.place?.order || "", 400)
  };
  const city = clampText(body.city || "", 120);
  const tipo = tipoEnEspanol(place.type);
  const cocina = cocinaEnEspanol(place.cuisine);
  const fallback = tipsPara(tipo, cocina);

  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return Response.json({
      what: place.what || fallback.que,
      order: place.order || fallback.pedir,
      usedAI: false
    });
  }

  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "Eres un guía de viaje breve. Responde SOLO JSON válido con claves what y order. Español, 2 frases máximo por clave. Enfocado a ir a pie o en transporte público."
          },
          {
            role: "user",
            content: JSON.stringify({
              nombre: place.name,
              tipo,
              cocina,
              direccion: place.address,
              ciudad: city
            })
          }
        ]
      })
    });
    const data = await r.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    const json = extractJson(raw);
    return Response.json({
      what: place.what || json.what || fallback.que,
      order: place.order || json.order || fallback.pedir,
      usedAI: true
    });
  } catch {
    return Response.json({
      what: place.what || fallback.que,
      order: place.order || fallback.pedir,
      usedAI: false
    });
  }
}

function extractJson(raw) {
  try {
    const m = String(raw).match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : {};
  } catch {
    return {};
  }
}
