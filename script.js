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
  chartBtc: "BITSTAMP:BTCUSD",
  chartNdx: "NASDAQ:NDX",
  chartInterval: "60", // 60 = 1H candles

  // Compact overview strip (TradingView "Ticker Tape" symbols)
  tickerSymbols: [
    { proName: "FOREXCOM:SPXUSD", title: "S&P 500" },
    { proName: "FOREXCOM:NSXUSD", title: "NASDAQ 100" },
    { proName: "TVC:GOLD",        title: "GOLD" },
    { proName: "BITSTAMP:BTCUSD", title: "BITCOIN" },
    { proName: "FX:EURUSD",       title: "EUR/USD" },
    { proName: "TVC:US10Y",       title: "US 10Y" },
    { proName: "TVC:VIX",         title: "VIX" }
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
    hide_legend: false,
    hide_volume: true,
    withdateranges: false,
    allow_symbol_change: false,
    save_image: false,
    calendar: false,
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
    hide_legend: false,
    hide_volume: true,
    withdateranges: false,
    allow_symbol_change: false,
    save_image: false,
    calendar: false,
    backgroundColor: "rgba(16,21,28,1)",
    gridColor: "rgba(33,41,52,0.5)"
  });

  // Compact overview strip
  embedTVWidget("tv_ticker_tape", "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js", {
    symbols: CONFIG.tickerSymbols,
    showSymbolLogo: false,
    isTransparent: false,
    displayMode: "adaptive",
    colorTheme: "dark",
    locale: "de_DE"
  });

  // News (TradingView "Top Stories")
  embedTVWidget("tv_news", "https://s3.tradingview.com/external-embedding/embed-widget-timeline.js", {
    feedMode: "all_symbols",
    isTransparent: true,
    displayMode: "regular",
    width: "100%",
    height: "100%",
    colorTheme: "dark",
    locale: "de_DE"
  });

  // Economic calendar
  embedTVWidget("tv_calendar", "https://s3.tradingview.com/external-embedding/embed-widget-events.js", {
    width: "100%",
    height: "100%",
    colorTheme: "dark",
    isTransparent: true,
    locale: "de_DE",
    importanceFilter: CONFIG.calendarImportance,
    countryFilter: CONFIG.calendarCountries
  });
}

/* ---------------------------------------------------------------------
   3) Clock
   --------------------------------------------------------------------- */
function updateClock() {
  const el = document.getElementById("clock");
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/* ---------------------------------------------------------------------
   4) Market Awareness — keyless, best-effort, never throws
   --------------------------------------------------------------------- */
const marketState = {
  btcChangePct: null,
  ndxChangePct: null, // stays null if the Yahoo best-effort call is blocked
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

async function fetchNdxChange() {
  // Best-effort only: Yahoo Finance has no official CORS support, so this
  // is allowed to fail silently. If it fails, awareness logic simply
  // falls back to BTC-only (see computeStatus()) — by design (Abschnitt 5).
  try {
    const res = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/QQQ?interval=1d&range=1d");
    if (!res.ok) throw new Error("Yahoo HTTP " + res.status);
    const data = await res.json();
    const meta = data && data.chart && data.chart.result && data.chart.result[0] && data.chart.result[0].meta;
    if (meta && typeof meta.regularMarketPrice === "number" && typeof meta.previousClose === "number" && meta.previousClose !== 0) {
      marketState.ndxChangePct = ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100;
    } else {
      marketState.ndxChangePct = null;
    }
  } catch (err) {
    marketState.ndxChangePct = null; // stays "vereinfacht" — no error shown to the user
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

  const ctxBtc = document.getElementById("ctxBtc");
  if (ctxBtc) {
    ctxBtc.textContent = fmtPct(marketState.btcChangePct);
    ctxBtc.className = "ctx-value " + (marketState.btcChangePct > 0 ? "up" : marketState.btcChangePct < 0 ? "down" : "");
  }

  const ctxNdx = document.getElementById("ctxNdx");
  if (ctxNdx) {
    ctxNdx.textContent = fmtPct(marketState.ndxChangePct);
    ctxNdx.className = "ctx-value " + (marketState.ndxChangePct > 0 ? "up" : marketState.ndxChangePct < 0 ? "down" : "");
  }

  const ctxNote = document.getElementById("ctxNote");
  if (ctxNote && marketState.ndxChangePct === null) {
    ctxNote.textContent = "Vereinfachter Modus: NASDAQ-Livedaten aktuell nicht erreichbar — Status basiert auf BTC. Events siehe Kalender rechts.";
  } else if (ctxNote) {
    ctxNote.textContent = "Quelle: CoinGecko · Yahoo Finance (Best-Effort, ohne Key)";
  }

  const ctxUpdated = document.getElementById("ctxUpdated");
  if (ctxUpdated) {
    ctxUpdated.textContent = marketState.lastUpdate
      ? marketState.lastUpdate.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : "--:--:--";
  }
}

async function refreshMarketAwareness() {
  await Promise.all([fetchBtcChange(), fetchNdxChange()]);
  marketState.lastUpdate = new Date();
  renderStatus();
}

/* ---------------------------------------------------------------------
   5) Boot
   --------------------------------------------------------------------- */
function boot() {
  initWidgets();

  updateClock();
  setInterval(updateClock, 1000);

  refreshMarketAwareness();
  setInterval(refreshMarketAwareness, CONFIG.priceRefreshMs);

  // Keep a TV kiosk session healthy over many hours.
  setTimeout(() => window.location.reload(), CONFIG.pageReloadMs);
}

document.addEventListener("DOMContentLoaded", boot);
