export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const texts = Array.isArray(body.texts) ? body.texts.slice(0, 20) : [];
  const out = [];

  for (const text of texts) {
    const t = String(text || "").trim();
    if (!t) {
      out.push("");
      continue;
    }
    if (pareceEspanol(t)) {
      out.push(t);
      continue;
    }
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
        t.slice(0, 400)
      )}&langpair=en|es`;
      const r = await fetch(url);
      const data = await r.json();
      const translated = data?.responseData?.translatedText || t;
      out.push(clean(translated));
    } catch {
      out.push(t);
    }
  }

  return Response.json({ texts: out });
}

function pareceEspanol(t) {
  return /[áéíóúñ¿¡]/i.test(t) || /\b(el|la|los|las|de|del|que|para|con|una|por)\b/i.test(t);
}

function clean(s) {
  return String(s || "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}
