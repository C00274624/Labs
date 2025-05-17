/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

/**
 * Type bindings for the resources we configured in wrangler.jsonc
 *//**
 * Resources configured in wrangler.jsonc
 */
/**
 * Types for resources defined in wrangler.jsonc
 */
// src/index.ts
// ------------------------------------------------------------
// Type bindings for resources listed in wrangler.jsonc
// ------------------------------------------------------------
// src/index.ts
// src/index.ts
interface Env {
  COUNTER: KVNamespace;
  AI: Ai;
  ASSETS?: Fetcher;
}

/* ── Shared security headers ── */
const htmlHdr = {
  "content-type": "text/html;charset=utf-8",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "referrer-policy": "strict-origin-when-cross-origin",
  // allow inline scripts for the two button handlers
  "content-security-policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'"
} as const;

const jsonHdr = {
  "content-type": "application/json;charset=utf-8",
  "strict-transport-security": htmlHdr["strict-transport-security"],
  "referrer-policy": htmlHdr["referrer-policy"]
} as const;

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const isPreview = (import.meta as any).env?.MODE === "local";

    /* ---------- /uuid ---------- */
    if (url.pathname === "/uuid") {
      return new Response(
        JSON.stringify({ uuid: crypto.randomUUID() }),
        { headers: jsonHdr }
      );
    }

		/* ---------- /funfact ---------- */
		if (url.pathname === "/funfact") {
			if (isPreview) {
				return new Response(
					JSON.stringify({ fact: "Preview mode: static fun fact stub." }),
					{ headers: jsonHdr }
				);
			}

			const iso2 = (request as any).cf?.country ?? "the world";
			const apiURL = `https://restcountries.com/v3.1/alpha/${iso2.toLowerCase()}`;

			try {
				const apiRes = await fetch(apiURL, {
					cf: { cacheEverything: true, cacheTtl: 86400 }
				});
				if (!apiRes.ok) throw new Error("REST Countries API error");
				const [data] = await apiRes.json();

				const templates = [
					`The capital of ${data.name.common} is ${data.capital?.[0] ?? "unknown"}.`,
					`${data.name.common} covers an area of ${Math.round(data.area).toLocaleString()} km².`,
					`${data.name.common} has a population of about ${Math.round(data.population / 1_000_000)} million people.`
				];
				const fact = templates[Math.floor(Math.random() * templates.length)];

				return new Response(JSON.stringify({ fact }), { headers: jsonHdr });
			} catch {
				return new Response(
					JSON.stringify({ error: "Could not fetch country data." }),
					{ status: 503, headers: jsonHdr }
				);
			}
		}

    /* ---------- / (HTML) ---------- */
    if (url.pathname === "/") {
      const current  = Number(await env.COUNTER.get("views") ?? "0");
      const newViews = current + 1;
      ctx.waitUntil(env.COUNTER.put("views", newViews.toString()));

      const country = (request as any).cf?.country ?? "somewhere unknown";

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Cloudflare Worker Demo</title>
  <style>
    body { background:#111; color:#fff; font-family:sans-serif; padding:2rem; margin:0; }
    button { margin-top:1rem; padding:.5rem 1rem; font-size:1rem; border-radius:8px;
             border:1px solid #fff; background:transparent; color:#fff; cursor:pointer; }
  </style>
</head>
<body>
  <h1>Hello from ${country}!</h1>

  <p>Total page views: ${newViews}</p>

  <button onclick="fetchUUID()">Fetch a random UUID</button>
  <p id="output"></p>

  <button onclick="getFact()">Fun fact about my country</button>
  <p id="fact"></p>

  <script>
    async function fetchUUID() {
      try {
        const res = await fetch('/uuid');
        const { uuid } = await res.json();
        document.getElementById('output').textContent = uuid;
      } catch (e) {
        document.getElementById('output').textContent = 'Error: ' + e;
      }
    }

    async function getFact() {
      document.getElementById('fact').textContent = 'Thinking…';
      try {
        const res = await fetch('/funfact');
        const data = await res.json();
        document.getElementById('fact').textContent = data.fact ?? data.error;
      } catch (e) {
        document.getElementById('fact').textContent = 'Error: ' + e;
      }
    }
  </script>
</body>
</html>`;

      return new Response(html, { headers: htmlHdr });
    }

    /* ---------- static assets or 404 ---------- */
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404, headers: htmlHdr });
  },

  /* ---------- daily counter reset ---------- */
  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    await env.COUNTER.put("views", "0");
  }
};





