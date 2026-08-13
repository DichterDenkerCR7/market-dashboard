const CONFIG={
  chartIntervalSeconds:3600,
  chartRange:"3mo",
  chartDisplayDays:12,
  emaLengths:[21,55,89,144],
  emaColors:["#ff3b30","#ff9f0a","#19d3d1","#356ae6"],
  assets:{
    btc:{container:"btcChart",symbol:"BTC-USD",label:"Bitcoin"},
    ndx:{container:"ndxChart",symbol:"%5ENDX",label:"Nasdaq 100"}
  },
  thresholds:{btcElevated:2,btcHigh:4,ndxElevated:1,ndxHigh:2},
  refreshMs:60000,
  pageReloadMs:4*60*60*1000
};

function fmtNumber(n,d=2){return typeof n!=="number"||Number.isNaN(n)?"—":n.toLocaleString("de-DE",{minimumFractionDigits:d,maximumFractionDigits:d})}
function fmtPct(n){return typeof n!=="number"||Number.isNaN(n)?"—":`${n>0?"+":""}${n.toFixed(2).replace(".",",")}%`}

function updateDateTime(){
  const now=new Date();
  const d=document.getElementById("date"),c=document.getElementById("clock");
  if(d)d.textContent=now.toLocaleDateString("de-DE",{day:"2-digit",month:"2-digit",year:"numeric"});
  if(c)c.textContent=now.toLocaleTimeString("de-DE",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
}

/* ------------------------------------------------------------------
   Lightweight Charts: eigene Darstellung statt Advanced-Chart-iframe.
   Dadurch kontrollieren wir Hintergrund und EMA-Linien selbst.
------------------------------------------------------------------ */
function calculateEMA(data,length){
  const out=[]; if(!data.length)return out;
  const k=2/(length+1); let ema=data[0].value; out.push({time:data[0].time,value:ema});
  for(let i=1;i<data.length;i++){ema=data[i].value*k+ema*(1-k);out.push({time:data[i].time,value:ema});}
  return out;
}

function addLoading(el){el.innerHTML='<div class="chart-loading">CHART WIRD GELADEN…</div>'}
function addError(el,msg){el.innerHTML=`<div class="chart-error">${msg}</div>`}

async function fetchChartData(symbol){
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${CONFIG.chartRange}&interval=1h&includePrePost=false&events=div%2Csplits`;
  const r=await fetch(url,{cache:"no-store"}); if(!r.ok)throw new Error(`Datenquelle HTTP ${r.status}`);
  const j=await r.json(); const result=j?.chart?.result?.[0]; if(!result)throw new Error("Keine Kursdaten erhalten");
  const q=result.indicators?.quote?.[0]; const times=result.timestamp||[]; const candles=[];
  for(let i=0;i<times.length;i++){
    if([q.open?.[i],q.high?.[i],q.low?.[i],q.close?.[i]].some(v=>typeof v!=="number"))continue;
    candles.push({time:times[i],open:q.open[i],high:q.high[i],low:q.low[i],close:q.close[i]});
  }
  return candles;
}

function createChart(containerId,data,label){
  const el=document.getElementById(containerId); if(!el)return null; el.innerHTML="";
  if(!window.LightweightCharts)throw new Error("Chart-Bibliothek konnte nicht geladen werden");
  const L=window.LightweightCharts;
  const chart=L.createChart(el,{width:el.clientWidth,height:el.clientHeight,layout:{background:{type:L.ColorType.Solid,color:"#0e141b"},textColor:"#8f9aaa",fontFamily:"JetBrains Mono, monospace",fontSize:11},grid:{vertLines:{color:"#18212b"},horzLines:{color:"#18212b"}},rightPriceScale:{borderColor:"#2a3440",scaleMargins:{top:.08,bottom:.08}},timeScale:{borderColor:"#2a3440",timeVisible:true,secondsVisible:false,rightOffset:3,barSpacing:7},crosshair:{mode:L.CrosshairMode.Normal},handleScroll:false,handleScale:false});
  const candles=chart.addCandlestickSeries({upColor:"#26a69a",downColor:"#ef5350",borderUpColor:"#26a69a",borderDownColor:"#ef5350",wickUpColor:"#26a69a",wickDownColor:"#ef5350",priceLineVisible:true,lastValueVisible:true});
  candles.setData(data);
  const closeData=data.map(x=>({time:x.time,value:x.close}));
  CONFIG.emaLengths.forEach((len,i)=>{const s=chart.addLineSeries({color:CONFIG.emaColors[i],lineWidth:2,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});s.setData(calculateEMA(closeData,len));});
  const firstVisible=Math.max(0,data.length-Math.ceil((CONFIG.chartDisplayDays*24*3600)/CONFIG.chartIntervalSeconds));
  chart.timeScale().setVisibleLogicalRange({from:Math.max(0,firstVisible),to:data.length-1});
  const ro=new ResizeObserver(()=>chart.applyOptions({width:el.clientWidth,height:el.clientHeight})); ro.observe(el);
  el.dataset.ready="1";
  return chart;
}

async function loadOneChart(asset){
  const el=document.getElementById(asset.container); if(!el)return;
  addLoading(el);
  try{const data=await fetchChartData(asset.symbol);if(data.length<160)throw new Error("Zu wenige Kursdaten für die EMA 144");createChart(asset.container,data,asset.label);}
  catch(e){console.error(asset.label,e);addError(el,`${asset.label}<br><br>Chart-Daten momentan nicht verfügbar`)}
}

async function loadCharts(){await Promise.all(Object.values(CONFIG.assets).map(loadOneChart));}

/* ------------------------------------------------------------------
   TradingView News + Economic Calendar bleiben als Widgets erhalten.
   Für Events wird der gesamte iframe skaliert, damit mehr Zeilen sichtbar
   sind; die Daten bleiben von TradingView.
------------------------------------------------------------------ */
function embedTVWidget(containerId,src,config){
  const container=document.getElementById(containerId);if(!container)return;
  const script=document.createElement("script");script.type="text/javascript";script.src=src;script.async=true;script.text=JSON.stringify(config);container.appendChild(script);
}
function initTVWidgets(){
  embedTVWidget("tv_news","https://s3.tradingview.com/external-embedding/embed-widget-timeline.js",{feedMode:"all_symbols",isTransparent:true,displayMode:"regular",width:"100%",height:"100%",colorTheme:"dark",locale:"de_DE"});
  embedTVWidget("tv_calendar","https://s3.tradingview.com/external-embedding/embed-widget-events.js",{width:"100%",height:"100%",colorTheme:"dark",isTransparent:true,locale:"de_DE",importanceFilter:"0",countryFilter:"us,eu"});
}

const marketState={btcChangePct:null,ndxChangePct:null};
async function fetchQuote(symbol){
  const r=await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=5m&includePrePost=false`,{cache:"no-store"});if(!r.ok)throw new Error(r.status);const j=await r.json(),m=j?.chart?.result?.[0]?.meta||{};const p=typeof m.regularMarketPrice==="number"?m.regularMarketPrice:null;const prev=typeof m.chartPreviousClose==="number"?m.chartPreviousClose:m.previousClose;return {price:p,pct:typeof p==="number"&&typeof prev==="number"?((p-prev)/prev)*100:null};
}
async function refreshAwareness(){
  try{marketState.btcChangePct=(await fetchQuote("BTC-USD")).pct}catch(e){marketState.btcChangePct=null}
  try{marketState.ndxChangePct=(await fetchQuote("%5ENDX")).pct}catch(e){marketState.ndxChangePct=null}
  renderStatus();
}
function computeStatus(){let level="normal";const b=marketState.btcChangePct,n=marketState.ndxChangePct,t=CONFIG.thresholds;if(b!==null){const a=Math.abs(b);if(a>=t.btcHigh)level="high";else if(a>=t.btcElevated)level="elevated"}if(n!==null){const a=Math.abs(n);if(a>=t.ndxHigh)level="high";else if(a>=t.ndxElevated&&level!=="high")level="elevated"}return level}
const STATUS_LABELS={normal:"NORMAL",elevated:"ERHÖHTE AUFMERKSAMKEIT",high:"HOHE AUFMERKSAMKEIT"};
function renderStatus(){const level=computeStatus(),d=document.getElementById("statusDot"),l=document.getElementById("statusLabel");if(d&&l){d.className=`status-dot ${level}`;l.className=`status-label ${level}`;l.textContent=STATUS_LABELS[level]}}

function boot(){
  updateDateTime();setInterval(updateDateTime,1000);
  initTVWidgets();
  loadCharts();
  refreshAwareness();setInterval(refreshAwareness,CONFIG.refreshMs);
  setTimeout(()=>window.location.reload(),CONFIG.pageReloadMs);
}
document.addEventListener("DOMContentLoaded",boot);
