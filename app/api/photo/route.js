import { cacheGet, cacheSet, jsonCached, jsonNoStore } from "../../../lib/server-cache";
import { clampText, clientKey, rateLimit } from "../../../lib/security";

export async function GET(req) {
  if (!rateLimit(`photo:${clientKey(req)}`, 30)) {
    return jsonNoStore({ url: null, author: "", usedKey: false }, 429);
  }
  const q = clampText(new URL(req.url).searchParams.get("q") || "", 120);
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!q) return jsonCached({ url: null, author: "", usedKey: Boolean(key) }, 60);

  const ck = `photo:${q.toLowerCase()}:${key ? "u" : "w"}`;
  const cached = cacheGet(ck);
  if (cached) return jsonCached(cached, 86400);

  if (key) {
    try {
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
        q
      )}&per_page=1&orientation=landscape`;
      const r = await fetch(url, {
        headers: { Authorization: `Client-ID ${key}` },
        next: { revalidate: 86400 }
      });
      const data = await r.json();
      const hit = data?.results?.[0];
      if (hit?.urls) {
        const out = {
          url: hit.urls.small || hit.urls.regular || null,
          author: hit.user?.name || "",
          link: hit.links?.html || "",
          usedKey: true
        };
        return jsonCached(cacheSet(ck, out, 86400000), 86400);
      }
    } catch {
      /* fallback Wikimedia */
    }
  }

  try {
    const wiki = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        q
      )}&gsrlimit=1&prop=imageinfo&iiprop=url&iiurlwidth=640&format=json&origin=*`,
      { next: { revalidate: 86400 } }
    );
    const data = await wiki.json();
    const pages = data?.query?.pages || {};
    const first = Object.values(pages)[0];
    const info = first?.imageinfo?.[0];
    const out = {
      url: info?.thumburl || info?.url || null,
      author: "Wikimedia Commons",
      link: info?.descriptionurl || "",
      usedKey: Boolean(key)
    };
    return jsonCached(cacheSet(ck, out, 86400000), 86400);
  } catch {
    return jsonCached({ url: null, author: "", usedKey: Boolean(key) }, 300);
  }
}
