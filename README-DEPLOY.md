# Market Awareness Dashboard – v9

## Warum ein Worker?

Die bisherige Version hat Yahoo Finance direkt aus dem Browser auf GitHub Pages angesprochen. Yahoo Finance liefert für diese Endpunkte keinen passenden CORS-Header, daher blockiert der Browser den Zugriff. Die neue Version verwendet deshalb einen kleinen Cloudflare Worker als CORS-sicheren Proxy.

Cloudflare dokumentiert dieses Muster ausdrücklich als CORS-Header-Proxy. Der Workers-Free-Plan enthält aktuell 100.000 Requests pro Tag. Für dieses persönliche Dashboard ist das mehr als ausreichend.

## 1. Cloudflare Worker erstellen

1. Öffne https://dash.cloudflare.com/
2. Erstelle ein kostenloses Cloudflare-Konto oder melde dich an.
3. Öffne **Workers & Pages**.
4. Erstelle einen neuen Worker.
5. Wähle **Create / Hello World** oder eine leere Worker-Vorlage.
6. Öffne den Editor.
7. Ersetze den gesamten Inhalt durch den Inhalt aus `worker.js`.
8. Deployen.
9. Kopiere die erzeugte Worker-URL, z. B.:

   `https://market-dashboard-proxy.xyz.workers.dev`

## 2. Worker testen

Öffne im Browser:

`https://DEIN-WORKER.workers.dev/health`

Es sollte ungefähr Folgendes erscheinen:

`{"ok":true,"service":"market-awareness-yahoo-proxy"}`

Danach testen:

`https://DEIN-WORKER.workers.dev/yahoo/chart?symbol=BTC-USD&range=1d&interval=5m`

Wenn JSON mit Yahoo-Kursdaten erscheint, ist der Proxy korrekt eingerichtet.

## 3. Dashboard konfigurieren

Öffne `script.js` und ändere:

`dataProxyBase: "https://YOUR-WORKER-URL.workers.dev"`

zu deiner echten Worker-URL.

Beispiel:

`dataProxyBase: "https://market-dashboard-proxy.xyz.workers.dev"`

Danach `script.js` wieder in dein GitHub-Pages-Repository hochladen.

## 4. GitHub Pages aktualisieren

Ersetze mindestens:

- `index.html`
- `style.css`
- `script.js`

Die `worker.js` muss **nicht** in GitHub Pages liegen. Sie läuft separat bei Cloudflare.

## 5. Erwartetes Ergebnis

Die beiden eigenen Lightweight-Charts laden dann die Yahoo-Daten über den Worker. Dadurch entfällt der bisherige CORS-Fehler auf `query1.finance.yahoo.com`.

Die Charts bleiben vollständig selbst gerendert und enthalten die EMA 21/55/89/144.

Die News und Events bleiben wie bisher als TradingView-Widgets eingebunden.
