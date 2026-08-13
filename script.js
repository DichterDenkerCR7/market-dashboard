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
  // Was 4h; stretched to 24h because a full reload also restarts the
  // Spotify player below (browsers block autoplay-with-sound, so every
  // reload means tapping play again). Once a day is a reasonable
  // trade-off between staying fresh and not interrupting music.
  pageReloadMs: 24 * 60 * 60 * 1000
};

/* ---------------------------------------------------------------------
   1b) Events calendar config — ForexFactory (FX importance) + CryptoCraft
   (crypto importance), same underlying event set, independently rated
   per audience by FairEconomy (the company running both sites).
   ---------------------------------------------------------------------
   Only "Medium" (orange) and "High" (red) impact events are kept, only
   for USD/EUR/GBP on the FX side. An event is shown if EITHER side rates
   it Medium+ — e.g. "US Core CPI" is High on both sites -> 3 bitcoin +
   3 banknote emoji; something High for USD but only Medium on
   CryptoCraft still shows, just with fewer bitcoin emoji.
   Endpoints are FairEconomy's public weekly export files (used by
   thousands of trading tools for years) — free, keyless, no login.
   --------------------------------------------------------------------- */
const CALENDAR_CONFIG = {
  ffThisWeek: "https://nfs.faireconomy.media/ff_calendar_thisweek.json",
  ffNextWeek: "https://nfs.faireconomy.media/ff_calendar_nextweek.json",
  ccThisWeek: "https://nfs.faireconomy.media/cc_calendar_thisweek.xml",
  ccNextWeek: "https://nfs.faireconomy.media/cc_calendar_nextweek.xml",
  // Only fetch the "nextweek" file if "thisweek" doesn't leave us with at
  // least this many upcoming rows — nextweek 404s until FairEconomy
  // publishes it (usually from Friday on), so fetching it unconditionally
  // just burns proxy/rate-limit budget for nothing most of the week.
  minFutureBeforeTopUp: 4,
  fxCountries: ["USD", "EUR", "GBP"],
  refetchMs: 30 * 60 * 1000, // 30 min — well under FairEconomy's rate limit
  maxRows: 8
};

const EVENT_FLAGS = { USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧" };
const IMPACT_STARS = { Low: 1, Medium: 2, High: 3 };

// Offline fallback (only used if both live feeds fail): the previously
// hand-curated FOMC/ECB/CPI/NFP dates for the rest of 2026. fx/crypto
// star counts here are reasonable fixed approximations, not live data.
const FALLBACK_EVENTS = [
  { utc: Date.UTC(2026, 8, 4, 12, 30),  name: "US Arbeitsmarktbericht (NFP)", country: "USD", fx: 3, crypto: 2 },
  { utc: Date.UTC(2026, 8, 10, 12, 15), name: "EZB Zinsentscheid",            country: "EUR", fx: 3, crypto: 1 },
  { utc: Date.UTC(2026, 8, 11, 12, 30), name: "US CPI (Inflation)",           country: "USD", fx: 3, crypto: 3 },
  { utc: Date.UTC(2026, 8, 16, 18, 0),  name: "FOMC Zinsentscheid",           country: "USD", fx: 3, crypto: 3 },
  { utc: Date.UTC(2026, 9, 2, 12, 30),  name: "US Arbeitsmarktbericht (NFP)", country: "USD", fx: 3, crypto: 2 },
  { utc: Date.UTC(2026, 9, 14, 12, 30), name: "US CPI (Inflation)",           country: "USD", fx: 3, crypto: 3 },
  { utc: Date.UTC(2026, 9, 28, 18, 0),  name: "FOMC Zinsentscheid",           country: "USD", fx: 3, crypto: 3 },
  { utc: Date.UTC(2026, 9, 29, 13, 15), name: "EZB Zinsentscheid",            country: "EUR", fx: 3, crypto: 1 },
  { utc: Date.UTC(2026, 10, 6, 13, 30), name: "US Arbeitsmarktbericht (NFP)", country: "USD", fx: 3, crypto: 2 },
  { utc: Date.UTC(2026, 10, 10, 13, 30),name: "US CPI (Inflation)",           country: "USD", fx: 3, crypto: 3 },
  { utc: Date.UTC(2026, 11, 4, 13, 30), name: "US Arbeitsmarktbericht (NFP)", country: "USD", fx: 3, crypto: 2 },
  { utc: Date.UTC(2026, 11, 9, 19, 0),  name: "FOMC Zinsentscheid",           country: "USD", fx: 3, crypto: 3 },
  { utc: Date.UTC(2026, 11, 10, 13, 30),name: "US CPI (Inflation)",           country: "USD", fx: 3, crypto: 3 },
  { utc: Date.UTC(2026, 11, 17, 13, 15),name: "EZB Zinsentscheid",            country: "EUR", fx: 3, crypto: 1 }
];

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

  // Economic calendar: handled by refreshEventsCalendar() further down —
  // fetches live ForexFactory + CryptoCraft feeds, not a TradingView widget.
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
   1c) Shared CORS-proxy chain — used by News and by the Events calendar.
   Three free, keyless proxies tried in order; corsproxy.io explicitly
   whitelists *.github.io on its free tier, which is where this
   dashboard is hosted, so it goes first.
   --------------------------------------------------------------------- */
const CORS_PROXIES = [
  (url) => "https://corsproxy.io/?url=" + encodeURIComponent(url),
  (url) => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(url),
  (url) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(url)
];

async function fetchTextViaProxies(url) {
  // Try a direct, proxy-free request first. Public "weekly export" data
  // files like FairEconomy's are often served with open CORS headers
  // specifically so third-party tools can read them directly — and a
  // direct request avoids a real problem with proxies here: ForexFactory
  // is known to actively block requests coming from VPS/cloud IP ranges
  // via Cloudflare, which is exactly what public CORS proxies run on.
  try {
    const res = await fetch(url);
    if (res.ok) {
      const text = await res.text();
      if (looksLikeRealData(text)) return text;
    }
  } catch (err) {
    // CORS-blocked or network error — fall through to the proxy chain.
  }

  let lastError = null;
  for (const buildProxyUrl of CORS_PROXIES) {
    try {
      const res = await fetch(buildProxyUrl(url));
      if (!res.ok) throw new Error("HTTP " + res.status);
      const text = await res.text();
      if (!looksLikeRealData(text)) throw new Error("Antwort sieht nicht nach Daten aus (evtl. Cloudflare-Block)");
      return text;
    } catch (err) {
      lastError = err;
      // try the next proxy in the chain
    }
  }
  throw lastError || new Error("Alle Proxys fehlgeschlagen");
}

function looksLikeRealData(text) {
  if (!text || text.length < 5) return false;
  const head = text.trim().slice(0, 100).toLowerCase();
  // Reject HTML error/challenge pages (Cloudflare blocks, proxy error
  // pages, "Request Denied" rate-limit pages) that come back as 200 OK
  // but aren't the JSON/XML/RSS we asked for.
  if (head.startsWith("<!doctype") || head.startsWith("<html")) return false;
  return true;
}

/* ---------------------------------------------------------------------
   3b) News Rotator — one full headline at a time, no TradingView widget
   ---------------------------------------------------------------------
   Why this exists: TradingView's News widget runs inside a cross-origin
   iframe, so we cannot read its headlines, resize its internal "Top
   Stories" header, or control its rotation from our own JS — that's a
   hard browser security boundary, not a setting we missed. To get an
   actual "one full headline for 15s, then the next" ticker with real
   data, we pull RSS feeds directly (finance + crypto) through the free
   CORS-proxy chain above and rotate through them ourselves.
   A simple keyword filter (CONFIG.newsKeywords) acts as the "internal
   scoring system" — a headline only makes it into the rotation if it
   contains at least one market-moving keyword. Fully controlled from
   this file, no external scoring service.
   --------------------------------------------------------------------- */
const NEWS_CONFIG = {
  feeds: [
    { url: "https://www.cnbc.com/id/15838459/device/rss/rss.html", source: "CNBC" }, // CNBC Markets
    { url: "https://www.cnbc.com/id/19794221/device/rss/rss.html", source: "CNBC" }, // CNBC Investing
    { url: "https://cointelegraph.com/rss", source: "CoinTelegraph" }                 // Crypto news
  ],
  // Headline must contain at least one of these (case-insensitive) to be
  // considered "important" — add/remove freely.
  keywords: [
    "fed", "fomc", "powell", "zins", "rate", "inflat", "cpi", "pce",
    "ecb", "ezb", "lagarde", "jobs", "payroll", "nfp", "unemployment",
    "gdp", "recession", "tariff", "zoll", "bitcoin", "btc", "crypto",
    "krypto", "ethereum", "eth", "etf", "sec", "regulat", "hack",
    "crash", "rally", "surge", "plunge", "selloff", "sell-off",
    "nasdaq", "s&p", "stocks", "aktien", "yield", "bond", "treasury",
    "dollar", "euro"
  ],
  rotateMs: 15 * 1000,      // one full headline visible for 15s
  refetchMs: 10 * 60 * 1000, // pull fresh headlines every 10 min
  maxItems: 30
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

async function fetchNewsFeed(feed) {
  const text = await fetchTextViaProxies(feed.url);
  return parseRssItems(text, feed.source);
}

function isImportantHeadline(title) {
  const t = title.toLowerCase();
  return NEWS_CONFIG.keywords.some((kw) => t.includes(kw));
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
        if (!isImportantHeadline(item.title)) continue; // keyword filter
        seenTitles.add(item.title);
        merged.push(item);
      }
    }
    if (merged.length === 0) {
      if (newsState.items.length === 0) renderNewsUnavailable();
      return;
    }
    merged.sort((a, b) => (b.pubDate?.getTime() || 0) - (a.pubDate?.getTime() || 0));
    newsState.items = merged.slice(0, NEWS_CONFIG.maxItems);
    if (newsState.index >= newsState.items.length) newsState.index = 0;
    renderCurrentHeadline();
    renderNewsCount();
  } catch (err) {
    if (newsState.items.length === 0) renderNewsUnavailable();
    console.warn("News-Feeds aktuell nicht verfügbar:", err.message);
  }
}

function renderNewsCount() {
  const el = document.getElementById("newsCount");
  if (!el) return;
  const weekAgo = Date.now() - 7 * 86400000;
  const count = newsState.items.filter((it) => it.pubDate && it.pubDate.getTime() >= weekAgo).length;
  el.textContent = count > 0 ? "📰 " + count + " diese Woche" : "";
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
   3c) Events Calendar — ForexFactory (FX) + CryptoCraft (crypto) merged.
   Only Medium/High impact, only USD/EUR/GBP on the FX side. Renders
   time, event name, currency flag, and two independent emoji-star
   ratings — no forecast/actual/prior, no oversized site icons.
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

function normalizeEventTitle(title) {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

function parseFfJson(text) {
  return JSON.parse(text)
    .filter((e) => CALENDAR_CONFIG.fxCountries.includes(e.country))
    .filter((e) => e.impact === "Medium" || e.impact === "High")
    .map((e) => ({
      key: normalizeEventTitle(e.title),
      utc: new Date(e.date).getTime(), // ISO string already carries the correct UTC offset
      name: e.title,
      country: e.country,
      fx: IMPACT_STARS[e.impact] || 0
    }))
    .filter((e) => Number.isFinite(e.utc));
}

async function fetchForexFactoryEvents() {
  let events = [];
  try {
    const text = await fetchTextViaProxies(CALENDAR_CONFIG.ffThisWeek);
    events = parseFfJson(text);
  } catch (err) {
    console.warn("FF thisweek nicht erreichbar:", err.message);
  }

  const futureCount = events.filter((e) => e.utc > Date.now()).length;
  if (futureCount < CALENDAR_CONFIG.minFutureBeforeTopUp) {
    try {
      const text = await fetchTextViaProxies(CALENDAR_CONFIG.ffNextWeek);
      events = events.concat(parseFfJson(text));
    } catch (err) {
      // nextweek not published yet (common mid-week) — not an error, just no top-up
    }
  }
  return events;
}

function parseCcDateTimeToUtc(dateStr, timeStr) {
  // dateStr: "MM-DD-YYYY", timeStr: "H:MMam"/"H:MMpm" — both already UTC
  // (verified against the ForexFactory feed's explicit-offset times).
  const [mm, dd, yyyy] = dateStr.split("-").map(Number);
  const match = /^(\d{1,2}):(\d{2})(am|pm)$/i.exec((timeStr || "").trim());
  if (!mm || !dd || !yyyy || !match) return null;
  let hour = parseInt(match[1], 10) % 12;
  if (match[3].toLowerCase() === "pm") hour += 12;
  const minute = parseInt(match[2], 10);
  return Date.UTC(yyyy, mm - 1, dd, hour, minute);
}

function parseCcXml(text) {
  const doc = new DOMParser().parseFromString(text, "text/xml");
  if (doc.querySelector("parsererror")) throw new Error("unerwartete Antwort (kein XML)");
  return Array.from(doc.querySelectorAll("event")).map((ev) => {
    const title = ev.querySelector("title")?.textContent || "";
    const country = ev.querySelector("country")?.textContent || "";
    const dateStr = ev.querySelector("date")?.textContent || "";
    const timeStr = ev.querySelector("time")?.textContent || "";
    const impact = ev.querySelector("impact")?.textContent || "";
    const utc = parseCcDateTimeToUtc(dateStr, timeStr);
    return { key: normalizeEventTitle(title), utc, name: title, country, crypto: IMPACT_STARS[impact] || 0 };
  }).filter((e) => e.utc !== null);
}

async function fetchCryptoCraftEvents() {
  let events = [];
  try {
    const text = await fetchTextViaProxies(CALENDAR_CONFIG.ccThisWeek);
    events = parseCcXml(text);
  } catch (err) {
    console.warn("CC thisweek nicht erreichbar:", err.message);
  }

  const futureCount = events.filter((e) => e.utc > Date.now()).length;
  if (futureCount < CALENDAR_CONFIG.minFutureBeforeTopUp) {
    try {
      const text = await fetchTextViaProxies(CALENDAR_CONFIG.ccNextWeek);
      events = events.concat(parseCcXml(text));
    } catch (err) {
      // nextweek not published yet (common mid-week) — not an error, just no top-up
    }
  }
  return events;
}

async function refreshEventsCalendar() {
  try {
    const [ffResult, ccResult] = await Promise.allSettled([fetchForexFactoryEvents(), fetchCryptoCraftEvents()]);
    const ffEvents = ffResult.status === "fulfilled" ? ffResult.value : [];
    const ccEvents = ccResult.status === "fulfilled" ? ccResult.value : [];

    if (ffEvents.length === 0 && ccEvents.length === 0) {
      throw new Error("Beide Kalender-Feeds nicht erreichbar");
    }
    console.info("Events: FF=" + ffEvents.length + " CC=" + ccEvents.length + " Rohtreffer");

    // Match by normalized title + same UTC calendar day.
    const dayKey = (utc) => new Date(utc).toISOString().slice(0, 10);
    const ccByKey = new Map();
    for (const ev of ccEvents) ccByKey.set(ev.key + "|" + dayKey(ev.utc), ev);

    const merged = [];
    const usedCcKeys = new Set();
    for (const ff of ffEvents) {
      const k = ff.key + "|" + dayKey(ff.utc);
      const cc = ccByKey.get(k);
      if (cc) usedCcKeys.add(k);
      merged.push({
        utc: ff.utc,
        name: ff.name,
        country: ff.country,
        fx: ff.fx,
        crypto: cc ? cc.crypto : 0
      });
    }
    // CryptoCraft-only events (crypto-native, e.g. ETF decisions) that
    // never appeared on the FX side at all.
    for (const cc of ccEvents) {
      const k = cc.key + "|" + dayKey(cc.utc);
      if (usedCcKeys.has(k)) continue;
      if (cc.crypto >= 2) {
        merged.push({ utc: cc.utc, name: cc.name, country: cc.country, fx: 0, crypto: cc.crypto });
      }
    }

    eventsState.items = merged.filter((e) => e.fx >= 2 || e.crypto >= 2);
    eventsState.usingFallback = false;
    console.info("Events: " + eventsState.items.length + " nach Filter, " +
      eventsState.items.filter((e) => e.utc > Date.now()).length + " davon in der Zukunft");
  } catch (err) {
    console.warn("Events-Kalender: Live-Feeds nicht verfügbar, nutze Fallback-Liste.", err.message);
    eventsState.items = FALLBACK_EVENTS;
    eventsState.usingFallback = true;
  }
  renderEventsCalendar();
}

const eventsState = { items: [], usingFallback: false };

function renderEventsCalendar() {
  const listEl = document.getElementById("eventsList");
  if (!listEl) return;
  const now = Date.now();
  const upcoming = eventsState.items
    .filter((ev) => ev.utc > now)
    .sort((a, b) => a.utc - b.utc)
    .slice(0, CALENDAR_CONFIG.maxRows);

  if (upcoming.length === 0) {
    const hint = eventsState.usingFallback
      ? "Keine bevorstehenden Termine in der Fallback-Liste."
      : "Keine passenden Termine gefunden — evtl. Feed-Limit erreicht, nächster Versuch automatisch.";
    listEl.innerHTML = '<div class="event-empty">' + hint + '</div>';
    return;
  }

  listEl.innerHTML = upcoming.map((ev) => {
    const d = new Date(ev.utc);
    const time = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    const day = d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
    const flag = EVENT_FLAGS[ev.country] || "";
    const fxEmoji = ev.fx > 0 ? "💵".repeat(ev.fx) : "";
    const cryptoEmoji = ev.crypto > 0 ? "₿".repeat(ev.crypto) : "";
    return `
      <div class="event-row">
        <div class="event-when">
          <span class="event-time">${time}</span>
          <span class="event-date">${day} · ${relativeDayDe(d)}</span>
        </div>
        <span class="event-flag">${flag}</span>
        <span class="event-name">${ev.name}</span>
        <span class="event-impact">
          <span class="event-fx">${fxEmoji}</span>
          <span class="event-crypto">${cryptoEmoji}</span>
        </span>
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
  refreshEventsCalendar();
  setInterval(refreshEventsCalendar, CALENDAR_CONFIG.refetchMs);
  setInterval(renderEventsCalendar, 5 * 60 * 1000); // keep "heute/morgen" labels fresh between refetches

  updateClock();
  setInterval(updateClock, 1000);

  refreshMarketAwareness();
  setInterval(refreshMarketAwareness, CONFIG.priceRefreshMs);

  // Keep a TV kiosk session healthy over many hours.
  setTimeout(() => window.location.reload(), CONFIG.pageReloadMs);
}

document.addEventListener("DOMContentLoaded", boot);
