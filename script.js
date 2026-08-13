const CONFIG = {
  // Replace this once with your own Cloudflare Worker URL.
  // Example: https://market-dashboard-proxy.yourname.workers.dev
  dataProxyBase: "https://market-dashboard-proxy.m-atmanspacher1.workers.dev/",

  chartRange: "3mo",
  chartInterval: "1h",
  chartDisplayDays: 12,
  emaLengths: [21, 55, 89, 144],
  emaColors: ["#ff3b30", "#ff9f0a", "#19d3d1", "#356ae6"],
  assets: {
    btc: { container: "btcChart", symbol: "BTC-USD", label: "Bitcoin" },
    ndx: { container: "ndxChart", symbol: "%5ENDX", label: "Nasdaq 100" }
  },
  thresholds: { btcElevated: 2, btcHigh: 4, ndxElevated: 1, ndxHigh: 2 },
  refreshQuoteMs: 60 * 1000,
  refreshChartsMs: 5 * 60 * 1000,
  pageReloadMs: 4 * 60 * 60 * 1000
};

const charts = new Map();
const marketState = { btcChangePct: null, ndxChangePct: null };

function fmtPct(n) {
  return typeof n !== "number" || Number.isNaN(n) ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(2).replace(".", ",")} %`;
}

function updateDateTime() {
  const now = new Date();
  const d = document.getElementById("date");
  const c = document.getElementById("clock");
  if (d) d.textContent = now.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  if (c) c.textContent = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function proxyUrl(symbol, range, interval) {
  const base = CONFIG.dataProxyBase.replace(/\/$/, "");
  return `${base}/yahoo/chart?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;
}

async function fetchYahooChart(symbol, range, interval) {
  if (!CONFIG.dataProxyBase || CONFIG.dataProxyBase.includes("YOUR-WORKER-URL")) {
    throw new Error("Cloudflare Worker URL fehlt");
  }
  const response = await fetch(proxyUrl(symbol, range, interval), { cache: "no-store" });
  if (!response.ok) throw new Error(`Datenquelle HTTP ${response.status}`);
  const json = await response.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("Keine Kursdaten erhalten");
  const quote = result.indicators?.quote?.[0];
  const timestamps = result.timestamp || [];
  const candles = [];
  for (let i = 0; i < timestamps.length; i++) {
    const values = [quote?.open?.[i], quote?.high?.[i], quote?.low?.[i], quote?.close?.[i]];
    if (values.some(v => typeof v !== "number" || !Number.isFinite(v))) continue;
    candles.push({
      time: timestamps[i],
      open: values[0],
      high: values[1],
      low: values[2],
      close: values[3]
    });
  }
  return candles;
}

function calculateEMA(data, length) {
  if (!Array.isArray(data) || data.length < length) return [];

  const result = [];
  let sum = 0;
  for (let i = 0; i < length; i++) sum += data[i].value;
  let ema = sum / length;
  result.push({ time: data[length - 1].time, value: ema });

  const multiplier = 2 / (length + 1);
  for (let i = length; i < data.length; i++) {
    ema = (data[i].value - ema) * multiplier + ema;
    result.push({ time: data[i].time, value: ema });
  }
  return result;
}

function addLoading(el) {
  el.innerHTML = '<div class="chart-loading">CHART WIRD GELADEN…</div>';
}

function addError(el, message) {
  el.innerHTML = `<div class="chart-error">${message}</div>`;
}

function createChart(containerId, data) {
  const el = document.getElementById(containerId);
  if (!el || !window.LightweightCharts) return null;

  const previous = charts.get(containerId);
  if (previous?.chart) {
    try { previous.chart.remove(); } catch (_) {}
  }

  el.innerHTML = "";
  const L = window.LightweightCharts;
  const chart = L.createChart(el, {
    width: el.clientWidth,
    height: el.clientHeight,
    layout: {
      background: { type: L.ColorType.Solid, color: "#0e141b" },
      textColor: "#a8b2bf",
      fontFamily: "JetBrains Mono, monospace",
      fontSize: 12
    },
    grid: {
      vertLines: { color: "#18212b" },
      horzLines: { color: "#18212b" }
    },
    rightPriceScale: {
      borderColor: "#2a3440",
      scaleMargins: { top: 0.08, bottom: 0.08 }
    },
    timeScale: {
      borderColor: "#2a3440",
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 3,
      barSpacing: 7
    },
    crosshair: { mode: L.CrosshairMode.Normal },
    handleScroll: false,
    handleScale: false,
    localization: { locale: "de-DE" },
    attributionLogo: true
  });

  const candles = chart.addCandlestickSeries({
    upColor: "#26a69a",
    downColor: "#ef5350",
    borderUpColor: "#26a69a",
    borderDownColor: "#ef5350",
    wickUpColor: "#26a69a",
    wickDownColor: "#ef5350",
    priceLineVisible: true,
    lastValueVisible: true
  });
  candles.setData(data);

  const closeData = data.map(x => ({ time: x.time, value: x.close }));
  const emaSeries = [];
  CONFIG.emaLengths.forEach((length, index) => {
    const series = chart.addLineSeries({
      color: CONFIG.emaColors[index],
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: `EMA ${length}`
    });
    series.setData(calculateEMA(closeData, length));
    emaSeries.push(series);
  });

  const barsToShow = Math.round((CONFIG.chartDisplayDays * 24));
  const from = Math.max(0, data.length - barsToShow);
  chart.timeScale().setVisibleLogicalRange({ from, to: data.length - 1 });

  const resizeObserver = new ResizeObserver(() => {
    chart.applyOptions({ width: el.clientWidth, height: el.clientHeight });
  });
  resizeObserver.observe(el);

  charts.set(containerId, { chart, candles, emaSeries, resizeObserver });
  return chart;
}

async function loadOneChart(asset) {
  const el = document.getElementById(asset.container);
  if (!el) return;
  addLoading(el);
  try {
    const data = await fetchYahooChart(asset.symbol, CONFIG.chartRange, CONFIG.chartInterval);
    if (data.length < 180) throw new Error("Zu wenige Kursdaten für EMA 144");
    createChart(asset.container, data);
  } catch (error) {
    console.error(asset.label, error);
    addError(el, `${asset.label}<br><br>Chart-Daten momentan nicht verfügbar`);
  }
}

async function loadCharts() {
  await Promise.all(Object.values(CONFIG.assets).map(loadOneChart));
}

/* TradingView widgets: these are the parts that already work on the TV browser. */
function embedTVWidget(containerId, src, config) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '<div class="tradingview-widget-container__widget"></div>';
  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = src;
  script.async = true;
  script.text = JSON.stringify(config);
  container.appendChild(script);
}

function initTVWidgets() {
  embedTVWidget("tv_news", "https://s3.tradingview.com/external-embedding/embed-widget-timeline.js", {
    feedMode: "all_symbols",
    isTransparent: true,
    displayMode: "regular",
    width: "100%",
    height: "100%",
    colorTheme: "dark",
    locale: "de_DE"
  });

  embedTVWidget("tv_calendar", "https://s3.tradingview.com/external-embedding/embed-widget-events.js", {
    width: "100%",
    height: "100%",
    colorTheme: "dark",
    isTransparent: true,
    locale: "de_DE",
    importanceFilter: "0",
    countryFilter: "us,eu"
  });
}

async function fetchQuote(symbol) {
  const candles = await fetchYahooChart(symbol, "1d", "5m");
  if (!candles.length) throw new Error("Keine Quote-Daten");
  const last = candles[candles.length - 1];
  const previous = candles.length > 1 ? candles[candles.length - 2].close : null;
  return {
    price: last.close,
    pct: typeof previous === "number" && previous !== 0 ? ((last.close - previous) / previous) * 100 : null
  };
}

async function refreshAwareness() {
  try { marketState.btcChangePct = (await fetchQuote("BTC-USD")).pct; }
  catch (_) { marketState.btcChangePct = null; }

  try { marketState.ndxChangePct = (await fetchQuote("%5ENDX")).pct; }
  catch (_) { marketState.ndxChangePct = null; }

  renderStatus();
}

function computeStatus() {
  let level = "normal";
  const b = marketState.btcChangePct;
  const n = marketState.ndxChangePct;
  const t = CONFIG.thresholds;

  if (b !== null) {
    const abs = Math.abs(b);
    if (abs >= t.btcHigh) level = "high";
    else if (abs >= t.btcElevated) level = "elevated";
  }

  if (n !== null) {
    const abs = Math.abs(n);
    if (abs >= t.ndxHigh) level = "high";
    else if (abs >= t.ndxElevated && level !== "high") level = "elevated";
  }
  return level;
}

const STATUS_LABELS = {
  normal: "NORMAL",
  elevated: "ERHÖHTE AUFMERKSAMKEIT",
  high: "HOHE AUFMERKSAMKEIT"
};

function renderStatus() {
  const level = computeStatus();
  const dot = document.getElementById("statusDot");
  const label = document.getElementById("statusLabel");
  if (dot && label) {
    dot.className = `status-dot ${level}`;
    label.className = `status-label ${level}`;
    label.textContent = STATUS_LABELS[level];
  }
}

async function boot() {
  updateDateTime();
  setInterval(updateDateTime, 1000);

  initTVWidgets();
  await loadCharts();
  await refreshAwareness();

  setInterval(refreshAwareness, CONFIG.refreshQuoteMs);
  setInterval(loadCharts, CONFIG.refreshChartsMs);
  setTimeout(() => window.location.reload(), CONFIG.pageReloadMs);
}

document.addEventListener("DOMContentLoaded", boot);
