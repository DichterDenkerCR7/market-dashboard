/**
 * Market Awareness Dashboard - Cloudflare Worker
 *
 * Purpose: CORS-safe proxy for Yahoo Finance chart data.
 * Keep this Worker restricted to Yahoo Finance only.
 * No API key is required.
 */

const ALLOWED_HOSTS = new Set(["query1.finance.yahoo.com", "query2.finance.yahoo.com"]);

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function response(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      ...CORS_HEADERS,
      ...headers,
    },
  });
}

function json(data, status = 200) {
  return response(JSON.stringify(data), status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
}

function handleOptions() {
  return response(null, 204);
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return handleOptions();
    if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({ ok: true, service: "market-awareness-yahoo-proxy" });
    }

    if (url.pathname !== "/yahoo/chart") {
      return json({ error: "Not found" }, 404);
    }

    const symbol = url.searchParams.get("symbol");
    const range = url.searchParams.get("range") || "3mo";
    const interval = url.searchParams.get("interval") || "1h";

    if (!symbol) return json({ error: "Missing symbol" }, 400);
    if (!/^[-A-Za-z0-9.%_^=]+$/.test(symbol)) return json({ error: "Invalid symbol" }, 400);
    if (!/^(1d|5d|1mo|3mo|6mo|1y|2y|5y|10y|max)$/.test(range)) return json({ error: "Invalid range" }, 400);
    if (!/^(5m|15m|30m|60m|1h|1d)$/.test(interval)) return json({ error: "Invalid interval" }, 400);

    const target = new URL("https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol));
    target.searchParams.set("range", range);
    target.searchParams.set("interval", interval);
    target.searchParams.set("includePrePost", "false");
    target.searchParams.set("events", "div,splits");

    try {
      const upstream = await fetch(target.toString(), {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0 Market Awareness Dashboard",
        },
        cf: {
          cacheTtl: 30,
          cacheEverything: true,
        },
      });

      const body = await upstream.text();
      if (!upstream.ok) {
        return response(body || JSON.stringify({ error: `Yahoo HTTP ${upstream.status}` }), upstream.status, {
          "Content-Type": upstream.headers.get("content-type") || "application/json",
        });
      }

      return response(body, 200, {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
        "Cache-Control": "public, max-age=20",
      });
    } catch (error) {
      return json({ error: "Upstream request failed", detail: String(error) }, 502);
    }
  },
};
