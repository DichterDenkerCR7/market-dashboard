/* =====================================================================
   MARKET AWARENESS TERMINAL — script.js
   TV-optimierte Version
   ===================================================================== */

const CONFIG = {
  chartBtc: "BINANCE:BTCUSDT",
  chartNdx: "FX:NAS100",
  chartInterval: "60",

  // Vier EMAs entsprechend dem gewünschten Fib EMA 21/55/89/144.
  // Die Version 60 ist für die MAExp-Studie explizit angegeben.
  emaRibbon: [
    { length: 21, color: "#ff3b30" },
    { length: 55, color: "#ff9f0a" },
    { length: 89, color: "#19d3d1" },
    { length: 144, color: "#356ae6" }
  ],

  tickerSymbols: [
    { proName: "FOREXCOM:SPXUSD", title: "S&P 500" },
    { proName: "FOREXCOM:NSXUSD", title: "NASDAQ 100" },
    { proName: "TVC:GOLD",        title: "GOLD" },
    { proName: "BITSTAMP:BTCUSD", title: "BITCOIN" },
    { proName: "FX:EURUSD",       title: "EUR/USD" },
    { proName: "FRED:DGS10",      title: "US 10Y" },
    { proName: "FRED:VIXCLS",     title: "VIX" }
  ],

  calendarImportance: "0,1",
  calendarCountries: "us,eu",

  thresholds: {
    btcElevated: 2.0,
    btcHigh: 4.0,
    ndxElevated: 1.0,
    ndxHigh: 2.0
  },

  priceRefreshMs: 60 * 1000,
  pageReloadMs: 4 * 60 * 60 * 1000
};

/* ---------------------------------------------------------------------
   TradingView Widget Helper
   --------------------------------------------------------------------- */
function embedTVWidget(containerId, scriptSrc, config) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = scriptSrc;
  script.async = true;
  script.text = JSON.stringify(config);
  container.appendChild(script);
}

function createEmaStudies() {
  return CONFIG.emaRibbon.map((ema) => ({
    id: "MAExp@tv-basicstudies",
    version: 60,
    inputs: {
      length: ema.length,
      source: "close"
    }
  }));
}

function createEmaOverrides() {
  return {
    // Für mehrere Instanzen derselben Studie werden die einzelnen Plots
    // explizit angesprochen. Falls die Widget-Version diese Index-Overrides
    // nicht übernimmt, bleiben die EMAs trotzdem sichtbar.
    "moving average exponential.0.plot.color": CONFIG.emaRibbon[0].color,
    "moving average exponential.1.plot.color": CONFIG.emaRibbon[1].color,
    "moving average exponential.2.plot.color": CONFIG.emaRibbon[2].color,
    "moving average exponential.3.plot.color": CONFIG.emaRibbon[3].color,

    "moving average exponential.0.plot.linewidth": 2,
    "moving average exponential.1.plot.linewidth": 2,
    "moving average exponential.2.plot.linewidth": 2,
    "moving average exponential.3.plot.linewidth": 2,

    // Fallback für Widget-Versionen, die den gemeinsamen EMA-Stil verwenden.
    "moving average exponential.ma.linewidth": 2
  };
}

function baseChartConfig(symbol) {
  return {
    autosize: true,
    symbol,
    interval: CONFIG.chartInterval,
    timezone: "Europe/Berlin",
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
    backgroundColor: "#0e141b",
    gridColor: "#202a35",
    studies: createEmaStudies(),
    studies_overrides: createEmaOverrides(),

    // Erzwingt zusätzlich einen dunklen Chart-Hintergrund.
    overrides: {
      "paneProperties.background": "#0e141b",
      "paneProperties.backgroundType": "solid",
      "paneProperties.vertGridProperties.color": "#18212b",
      "paneProperties.horzGridProperties.color": "#18212b",
      "scalesProperties.textColor": "#8f9aaa",
      "scalesProperties.lineColor": "#2a3440",
      "mainSeriesProperties.candleStyle.upColor": "#26a69a",
      "mainSeriesProperties.candleStyle.downColor": "#ef5350",
      "mainSeriesProperties.candleStyle.borderUpColor": "#26a69a",
      "mainSeriesProperties.candleStyle.borderDownColor": "#ef5350",
      "mainSeriesProperties.candleStyle.wickUpColor": "#26a69a",
      "mainSeriesProperties.candleStyle.wickDownColor": "#ef5350"
    }
  };
}

function initWidgets() {
  // Bitcoin Chart + EMA 21/55/89/144
  embedTVWidget(
    "tv_btc_chart",
    "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js",
    baseChartConfig(CONFIG.chartBtc)
  );

  // Nasdaq 100 Chart + EMA 21/55/89/144
  embedTVWidget(
    "tv_ndx_chart",
    "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js",
    baseChartConfig(CONFIG.chartNdx)
  );

  // Kompakter Markt-Ticker
  embedTVWidget("tv_ticker_tape", "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js", {
    symbols: CONFIG.tickerSymbols,
    showSymbolLogo: false,
    isTransparent: false,
    displayMode: "compact",
    colorTheme: "dark",
    locale: "de_DE"
  });

  // News
  embedTVWidget("tv_news", "https://s3.tradingview.com/external-embedding/embed-widget-timeline.js", {
    feedMode: "all_symbols",
    isTransparent: true,
    displayMode: "regular",
    width: "100%",
    height: "100%",
    colorTheme: "dark",
    locale: "de_DE"
  });

  // Wirtschaftskalender
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
   Datum + Uhrzeit
   --------------------------------------------------------------------- */
function updateDateTime() {
  const now = new Date();

  const dateEl = document.getElementById("date");
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  const clockEl = document.getElementById("clock");
  if (clockEl) {
    clockEl.textContent = now.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }
}

/* ---------------------------------------------------------------------
   Market Awareness
   --------------------------------------------------------------------- */
const marketState = {
  btcChangePct: null,
  ndxChangePct: null,
  lastUpdate: null
};

async function fetchBtcChange() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true",
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("CoinGecko HTTP " + res.status);

    const data = await res.json();
    const pct = data?.bitcoin?.usd_24h_change;
    marketState.btcChangePct = typeof pct === "number" ? pct : null;
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

  let level = "normal";
  const reasons = [];

  if (btcChangePct !== null) {
    const abs = Math.abs(btcChangePct);
    if (abs >= t.btcHigh) {
      level = "high";
      reasons.push("BTC " + fmtPct(btcChangePct));
    } else if (abs >= t.btcElevated && level !== "high") {
      level = "elevated";
      reasons.push("BTC " + fmtPct(btcChangePct));
    }
  }

  if (ndxChangePct !== null) {
    const abs = Math.abs(ndxChangePct);
    if (abs >= t.ndxHigh) {
      level = "high";
      reasons.push("NASDAQ " + fmtPct(ndxChangePct));
    } else if (abs >= t.ndxElevated && level !== "high") {
      level = "elevated";
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
   Boot
   --------------------------------------------------------------------- */
function boot() {
  initWidgets();

  updateDateTime();
  setInterval(updateDateTime, 1000);

  refreshMarketAwareness();
  setInterval(refreshMarketAwareness, CONFIG.priceRefreshMs);

  setTimeout(() => window.location.reload(), CONFIG.pageReloadMs);
}

document.addEventListener("DOMContentLoaded", boot);
