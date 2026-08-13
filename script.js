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
    studies: ["MAExp@tv-basicstudies"],
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
    studies: ["MAExp@tv-basicstudies"],
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

  // News (TradingView "Top Stories") — "compact" is the dense text-list
  // mode (no big preview cards), so far more headlines fit in the panel.
  embedTVWidget("tv_news", "https://s3.tradingview.com/external-embedding/embed-widget-timeline.js", {
    feedMode: "all_symbols",
    isTransparent: true,
    displayMode: "compact",
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

  updateClock();
  setInterval(updateClock, 1000);

  refreshMarketAwareness();
  setInterval(refreshMarketAwareness, CONFIG.priceRefreshMs);

  // Keep a TV kiosk session healthy over many hours.
  setTimeout(() => window.location.reload(), CONFIG.pageReloadMs);
}

document.addEventListener("DOMContentLoaded", boot);
