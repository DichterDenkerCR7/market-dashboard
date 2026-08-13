/* =====================================================================
   MARKET AWARENESS TERMINAL — script.js
   No API keys. No backend. No login. Everything below is safe to keep
   in a public GitHub repository (required for free GitHub Pages).
   ===================================================================== */

/* ---------------------------------------------------------------------
   1) CONFIG — edit this block to change markets, wording or timing.
   --------------------------------------------------------------------- */
const CONFIG = {
  // Big charts (TradingView "Advanced Chart" symbols)
  chartBtc: "BINANCE:BTCUSDT",
  // NASDAQ:NDX needs a paid NASDAQ real-time data license and stays blank
  // in free widgets. FX:NAS100 (FXCM "US 100 Cash CFD") is license-free,
  // trades near round-the-clock and is the symbol requested by the user.
  chartNdx: "FX:NAS100",
  chartInterval: "60", // 60 = 1H candles

  // EMA overlay for both big charts. NOTE: the free/keyless TradingView
  // embed widget can only set ONE length for a given indicator type across
  // all its instances — adding "MAExp@tv-basicstudies" four times would
  // NOT give four independent lengths/colors, it would silently apply the
  // same length to all four (confirmed platform limitation, not a bug
  // here). So this dashboard shows one correctly-computed EMA per chart.
  // Change the length below if you'd rather watch e.g. 55 instead of 21.
  emaLength: 21,
  emaColor: "#4FD8C4",

  // Compact overview strip (TradingView "Ticker Tape" symbols)
  // NOTE: TVC:VIX / TVC:US10Y can fail to render (licensed Refinitiv/Cboe
  // feed). FRED:VIXCLS / FRED:DGS10 are official, fully free Fed data —
  // updates once daily instead of tick-by-tick, which is fine for a
  // glance-level context strip.
  tickerSymbols: [
    { proName: "FOREXCOM:SPXUSD", title: "S&P 500" },
    { proName: "FOREXCOM:NSXUSD", title: "NASDAQ 100" },
    { proName: "TVC:GOLD",        title: "GOLD" },
    { proName: "BITSTAMP:BTCUSD", title: "BITCOIN" },
    { proName: "FX:EURUSD",       title: "EUR/USD" },
    { proName: "FRED:DGS10",      title: "US 10Y" },
    { proName: "FRED:VIXCLS",     title: "VIX" }
  ],

  // Economic calendar filter: "-1,0,1" = low+med+high, "0,1" = med+high only
  calendarImportance: "0,1",
  calendarCountries: "us,eu",

  // Market-awareness thresholds (absolute % move, 24h)
  thresholds: {
    btcElevated: 2.0,   // |BTC 24h %| above this -> elevated
    btcHigh: 4.0,        // -> high
    ndxElevated: 1.0,   // |QQQ 24h %| above this -> elevated
    ndxHigh: 2.0
  },

  // Data refresh + housekeeping
  priceRefreshMs: 60 * 1000,        // 60s (CoinGecko free limit: ~10-30 req/min)
  pageReloadMs: 4 * 60 * 60 * 1000  // full reload every 4h to stay fresh & light
};

/* ---------------------------------------------------------------------
   1b) Known macro calendar — FOMC, ECB, US CPI, US NFP (rest of 2026)
   ---------------------------------------------------------------------
   Why hand-curated instead of a widget: the free TradingView Events
   widget always ships Actual/Forecast/Prior columns and full-size flag
   icons — there's no documented option to strip those, since it's a
   cross-origin iframe we can't restyle. FOMC/ECB meeting dates and US
   BLS release dates are published by the Fed/ECB/BLS *months in advance*
   on a fixed schedule, so hand-entering them is both accurate and low
   maintenance (a few new rows, twice a year).
   Sources (checked Aug 2026): federalreserve.gov meeting calendar,
   ecb.europa.eu Governing Council calendar, bls.gov/schedule.
   Dates below are stored as UTC instants (Date.UTC) computed from each
   institution's published local time + that date's correct DST offset,
   so the dashboard just renders them in the browser's local time —
   same pattern as the clock elsewhere on this page.
   To add next year's dates: append rows in the same format once the
   institutions publish their next calendar (typically ~August for the
   following year).
   --------------------------------------------------------------------- */
const KNOWN_EVENTS = [
  { utc: Date.UTC(2026, 8, 4, 12, 30),  name: "US Arbeitsmarktbericht (NFP)", country: "us", importance: 3 },
  { utc: Date.UTC(2026, 8, 10, 12, 15), name: "EZB Zinsentscheid",            country: "eu", importance: 3 },
  { utc: Date.UTC(2026, 8, 11, 12, 30), name: "US CPI (Inflation)",           country: "us", importance: 3 },
  { utc: Date.UTC(2026, 8, 16, 18, 0),  name: "FOMC Zinsentscheid",           country: "us", importance: 3 },
  { utc: Date.UTC(2026, 9, 2, 12, 30),  name: "US Arbeitsmarktbericht (NFP)", country: "us", importance: 3 },
  { utc: Date.UTC(2026, 9, 14, 12, 30), name: "US CPI (Inflation)",           country: "us", importance: 3 },
  { utc: Date.UTC(2026, 9, 28, 18, 0),  name: "FOMC Zinsentscheid",           country: "us", importance: 3 },
  { utc: Date.UTC(2026, 9, 29, 13, 15), name: "EZB Zinsentscheid",            country: "eu", importance: 3 },
  { utc: Date.UTC(2026, 10, 6, 13, 30), name: "US Arbeitsmarktbericht (NFP)", country: "us", importance: 3 },
  { utc: Date.UTC(2026, 10, 10, 13, 30),name: "US CPI (Inflation)",           country: "us", importance: 3 },
  { utc: Date.UTC(2026, 11, 4, 13, 30), name: "US Arbeitsmarktbericht (NFP)", country: "us", importance: 3 },
  { utc: Date.UTC(2026, 11, 9, 19, 0),  name: "FOMC Zinsentscheid",           country: "us", importance: 3 },
  { utc: Date.UTC(2026, 11, 10, 13, 30),name: "US CPI (Inflation)",           country: "us", importance: 3 },
  { utc: Date.UTC(2026, 11, 17, 13, 15),name: "EZB Zinsentscheid",            country: "eu", importance: 3 }
];

const EVENT_FLAGS = { us: "🇺🇸", eu: "🇪🇺" };

/* ---------------------------------------------------------------------
   2) TradingView widget embedding helper
   --------------------------------------------------------------------- */
function embedTVWidget(containerId, scriptSrc, config) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const target = container.querySelector(".tradingview-widget-container__widget") || container;
  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = scriptSrc;
  script.async = true;
  script.text = JSON.stringify(config);
  container.appendChild(script);
  void target; // container-level append matches TradingView's own embed pattern
}

function initWidgets() {
  // Big chart: Bitcoin
  embedTVWidget("tv_btc_chart", "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js", {
    autosize: true,
    symbol: CONFIG.chartBtc,
    interval: CONFIG.chartInterval,
    timezone: "Etc/UTC",
    theme: "dark",
    style: "1",
    locale: "de_DE",
    hide_top_toolbar: true,
    hide_legend: true,
    hide_volume: true,
    withdateranges: false,
    allow_symbol_change: false,
    save_image: false,
    calendar: false,
    studies: ["Moving Average Exponential"],
    studies_overrides: {
      "moving average exponential.length": CONFIG.emaLength,
      "moving average exponential.plot.color": CONFIG.emaColor,
      "moving average exponential.plot.linewidth": 2
    },
    backgroundColor: "rgba(16,21,28,1)",
    gridColor: "rgba(33,41,52,0.5)"
  });

  // Big chart: Nasdaq 100
  embedTVWidget("tv_ndx_chart", "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js", {
    autosize: true,
    symbol: CONFIG.chartNdx,
    interval: CONFIG.chartInterval,
    timezone: "Etc/UTC",
    theme: "dark",
    style: "1",
    locale: "de_DE",
    hide_top_toolbar: true,
    hide_legend: true,
    hide_volume: true,
    withdateranges: false,
    allow_symbol_change: false,
    save_image: false,
    calendar: false,
    studies: ["Moving Average Exponential"],
    studies_overrides: {
      "moving average exponential.length": CONFIG.emaLength,
      "moving average exponential.plot.color": CONFIG.emaColor,
      "moving average exponential.plot.linewidth": 2
    },
    backgroundColor: "rgba(16,21,28,1)",
    gridColor: "rgba(33,41,52,0.5)"
  });

  // Compact overview strip — "regular" gives fixed-width items with
  // consistent spacing; "adaptive" (previous setting) reflows item widths
  // based on container size, which is what caused the uneven gaps/cut-off
  // labels reported on the TV.
  embedTVWidget("tv_ticker_tape", "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js", {
    symbols: CONFIG.tickerSymbols,
    showSymbolLogo: false,
    isTransparent: false,
    displayMode: "regular",
    colorTheme: "dark",
    locale: "de_DE"
  });

  // News: handled separately by the custom headline rotator (see
  // initNewsRotator below) — not a TradingView widget, see explanation there.

  // Economic calendar: handled by the custom KNOWN_EVENTS list (see
  // renderEventsCalendar below) — not a TradingView widget, see comment
  // on KNOWN_EVENTS for why.
}

/* ---------------------------------------------------------------------
   3) Clock
   --------------------------------------------------------------------- */
function updateClock() {
  const clockEl = document.getElementById("clock");
  const dateEl = document.getElementById("dateDisplay");
  const now = new Date();
  if (clockEl) {
    clockEl.textContent = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
  }
}

/* ---------------------------------------------------------------------
   3b) News Rotator — one full headline at a time, no TradingView widget
   ---------------------------------------------------------------------
   Why this exists: TradingView's News widget runs inside a cross-origin
   iframe, so we cannot read its headlines, resize its internal "Top
   Stories" header, or control its rotation from our own JS — that's a
   hard browser security boundary, not a setting we missed. To get an
   actual "one full headline for 15s, then the next" ticker with real
   data, we instead pull two CNBC RSS feeds directly (Markets + Investing)
   through a free, keyless CORS proxy (api.allorigins.win) and rotate
   through them ourselves.
   Trade-off to know about: api.allorigins.win is a free third-party
   proxy, not something TradingView or CNBC guarantees — if it's ever
   down, the panel shows a short "nicht verfügbar" message instead of
   breaking the page, and retries on the next refresh cycle.
   --------------------------------------------------------------------- */
const NEWS_CONFIG = {
  feeds: [
    "https://www.cnbc.com/id/15838459/device/rss/rss.html", // CNBC Markets
    "https://www.cnbc.com/id/19794221/device/rss/rss.html"  // CNBC Investing
  ],
  // Fallback chain: api.allorigins.win alone turned out to fail roughly
  // half the time (a known, documented issue with that free service) —
  // so we now try three free, keyless proxies in order and use whichever
  // answers first. corsproxy.io explicitly whitelists *.github.io on its
  // free tier, which is exactly where this dashboard is hosted.
  corsProxies: [
    (url) => "https://corsproxy.io/?url=" + encodeURIComponent(url),
    (url) => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(url),
    (url) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(url)
  ],
  rotateMs: 15 * 1000,      // one full headline visible for 15s
  refetchMs: 10 * 60 * 1000, // pull fresh headlines every 10 min
  maxItems: 25
};

const newsState = {
  items: [],      // { title, pubDate, source }
  index: 0
};

function parseRssItems(xmlText, fallbackSource) {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  if (doc.querySelector("parsererror")) return [];
  return Array.from(doc.querySelectorAll("item")).map((item) => {
    const title = (item.querySelector("title")?.textContent || "").trim();
    const pubDateRaw = item.querySelector("pubDate")?.textContent || "";
    const sourceEl = item.querySelector("source");
    const source = (sourceEl?.textContent || fallbackSource || "").trim();
    const pubDate = pubDateRaw ? new Date(pubDateRaw) : null;
    return { title, pubDate, source };
  }).filter((it) => it.title);
}

async function fetchNewsFeed(url) {
  let lastError = null;
  for (const buildProxyUrl of NEWS_CONFIG.corsProxies) {
    try {
      const res = await fetch(buildProxyUrl(url));
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      const items = parseRssItems(text, "CNBC");
      if (items.length > 0) return items;
      throw new Error("leere Antwort");
    } catch (err) {
      lastError = err;
      // try the next proxy in the chain
    }
  }
  throw lastError || new Error("Alle Proxys fehlgeschlagen");
}

async function refreshNewsFeeds() {
  try {
    const results = await Promise.allSettled(NEWS_CONFIG.feeds.map(fetchNewsFeed));
    const merged = [];
    const seenTitles = new Set();
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      for (const item of r.value) {
        if (seenTitles.has(item.title)) continue;
        seenTitles.add(item.title);
        merged.push(item);
      }
    }
    if (merged.length === 0) {
      // Every feed failed (proxy down, network, etc.) — keep any
      // previously loaded items so the rotation doesn't go blank.
      if (newsState.items.length === 0) renderNewsUnavailable();
      return;
    }
    merged.sort((a, b) => (b.pubDate?.getTime() || 0) - (a.pubDate?.getTime() || 0));
    newsState.items = merged.slice(0, NEWS_CONFIG.maxItems);
    if (newsState.index >= newsState.items.length) newsState.index = 0;
    renderCurrentHeadline();
  } catch (err) {
    if (newsState.items.length === 0) renderNewsUnavailable();
    console.warn("News-Feeds aktuell nicht verfügbar:", err.message);
  }
}

function relativeTimeDe(date) {
  if (!date) return "";
  const diffMin = Math.round((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "gerade eben";
  if (diffMin < 60) return "vor " + diffMin + " Min";
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return "vor " + diffH + " Std";
  const diffD = Math.round(diffH / 24);
  return "vor " + diffD + " Tag" + (diffD > 1 ? "en" : "");
}

function renderCurrentHeadline() {
  const headlineEl = document.getElementById("newsHeadline");
  const timeEl = document.getElementById("newsTime");
  const sourceEl = document.getElementById("newsSource");
  if (!headlineEl || newsState.items.length === 0) return;
  const item = newsState.items[newsState.index];
  headlineEl.textContent = item.title;
  if (timeEl) timeEl.textContent = relativeTimeDe(item.pubDate);
  if (sourceEl) sourceEl.textContent = item.source || "";
}

function renderNewsUnavailable() {
  const headlineEl = document.getElementById("newsHeadline");
  const timeEl = document.getElementById("newsTime");
  const sourceEl = document.getElementById("newsSource");
  if (headlineEl) headlineEl.textContent = "News aktuell nicht verfügbar — nächster Versuch in Kürze.";
  if (timeEl) timeEl.textContent = "";
  if (sourceEl) sourceEl.textContent = "";
}

function advanceHeadline() {
  if (newsState.items.length === 0) return;
  newsState.index = (newsState.index + 1) % newsState.items.length;
  renderCurrentHeadline();
}

function initNewsRotator() {
  refreshNewsFeeds();
  setInterval(advanceHeadline, NEWS_CONFIG.rotateMs);
  setInterval(refreshNewsFeeds, NEWS_CONFIG.refetchMs);
}

/* ---------------------------------------------------------------------
   3c) Events Calendar — minimal list: time, event, flag, importance.
   No forecast/actual/prior, no oversized icons — see KNOWN_EVENTS above.
   --------------------------------------------------------------------- */
function relativeDayDe(date) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfEvent = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfEvent - startOfToday) / 86400000);
  if (diffDays === 0) return "heute";
  if (diffDays === 1) return "morgen";
  return "in " + diffDays + " Tagen";
}

function renderEventsCalendar() {
  const listEl = document.getElementById("eventsList");
  if (!listEl) return;
  const now = Date.now();
  const upcoming = KNOWN_EVENTS
    .filter((ev) => ev.utc > now)
    .sort((a, b) => a.utc - b.utc)
    .slice(0, 8);

  if (upcoming.length === 0) {
    listEl.innerHTML = '<div class="event-empty">Keine bevorstehenden Termine in der Liste.</div>';
    return;
  }

  listEl.innerHTML = upcoming.map((ev) => {
    const d = new Date(ev.utc);
    const time = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    const day = d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
    const stars = "★".repeat(ev.importance) + "☆".repeat(3 - ev.importance);
    const flag = EVENT_FLAGS[ev.country] || "";
    return `
      <div class="event-row">
        <div class="event-when">
          <span class="event-time">${time}</span>
          <span class="event-date">${day} · ${relativeDayDe(d)}</span>
        </div>
        <span class="event-flag">${flag}</span>
        <span class="event-name">${ev.name}</span>
        <span class="event-stars">${stars}</span>
      </div>`;
  }).join("");
}

/* ---------------------------------------------------------------------
   4) Market Awareness — keyless, best-effort, never throws
   --------------------------------------------------------------------- */
const marketState = {
  btcChangePct: null,
  // Nasdaq live % is intentionally NOT fetched here: every free, keyless,
  // CORS-enabled equity API we could use (Yahoo Finance et al.) blocks
  // browser-side requests. Rather than call it and hide the console error,
  // we skip it entirely — the Nasdaq ticker-tape item and the big NQ1!
  // chart already give a live visual read. Per Abschnitt 5: vereinfachen
  // statt eine unzuverlässige Kennzahl vortäuschen.
  ndxChangePct: null,
  lastUpdate: null
};

async function fetchBtcChange() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true"
    );
    if (!res.ok) throw new Error("CoinGecko HTTP " + res.status);
    const data = await res.json();
    const pct = data && data.bitcoin && typeof data.bitcoin.usd_24h_change === "number"
      ? data.bitcoin.usd_24h_change
      : null;
    marketState.btcChangePct = pct;
  } catch (err) {
    marketState.btcChangePct = null;
    console.warn("BTC-Daten aktuell nicht verfügbar:", err.message);
  }
}

function fmtPct(pct) {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return "n/v";
  const sign = pct > 0 ? "+" : "";
  return sign + pct.toFixed(2).replace(".", ",") + " %";
}

function computeStatus() {
  const { btcChangePct, ndxChangePct } = marketState;
  const t = CONFIG.thresholds;

  let level = "normal"; // normal | elevated | high
  let reasons = [];

  if (btcChangePct !== null) {
    const abs = Math.abs(btcChangePct);
    if (abs >= t.btcHigh) { level = "high"; reasons.push("BTC " + fmtPct(btcChangePct)); }
    else if (abs >= t.btcElevated && level !== "high") { level = "elevated"; reasons.push("BTC " + fmtPct(btcChangePct)); }
  }

  if (ndxChangePct !== null) {
    const abs = Math.abs(ndxChangePct);
    if (abs >= t.ndxHigh) { level = "high"; reasons.push("NASDAQ " + fmtPct(ndxChangePct)); }
    else if (abs >= t.ndxElevated && level !== "high") {
      level = level === "high" ? "high" : "elevated";
      reasons.push("NASDAQ " + fmtPct(ndxChangePct));
    }
  }

  return { level, reasons };
}

const STATUS_LABELS = {
  normal: "NORMAL",
  elevated: "ERHÖHTE AUFMERKSAMKEIT",
  high: "HOHE AUFMERKSAMKEIT"
};

function renderStatus() {
  const { level } = computeStatus();

  const dot = document.getElementById("statusDot");
  const label = document.getElementById("statusLabel");
  if (dot && label) {
    dot.className = "status-dot " + level;
    label.className = "status-label " + level;
    label.textContent = STATUS_LABELS[level];
  }
}

async function refreshMarketAwareness() {
  await fetchBtcChange();
  marketState.lastUpdate = new Date();
  renderStatus();
}

/* ---------------------------------------------------------------------
   5) Boot
   --------------------------------------------------------------------- */
function boot() {
  initWidgets();
  initNewsRotator();
  renderEventsCalendar();
  setInterval(renderEventsCalendar, 5 * 60 * 1000);

  updateClock();
  setInterval(updateClock, 1000);

  refreshMarketAwareness();
  setInterval(refreshMarketAwareness, CONFIG.priceRefreshMs);

  // Keep a TV kiosk session healthy over many hours.
  setTimeout(() => window.location.reload(), CONFIG.pageReloadMs);
}

document.addEventListener("DOMContentLoaded", boot);
