# Feldblick

PWA zur Anzeige der eigenen Feldstücke und Schläge aus dem eAMA-Export (Feldstücksliste als XML)
als Karte, Liste und Flächensummen. Die Daten bleiben lokal im Browser; nach dem ersten Laden
funktioniert die App auch offline.

```bash
npm install
npm run dev       # Dev-Server
npm run build     # Produktions-Build nach dist/
npm run preview   # Build lokal testen (inkl. Service Worker)
npm test          # Vitest
```

Details zu Datenformat, Architektur und Roadmap: siehe [CLAUDE.md](CLAUDE.md).

## Deployment (Coolify)

Das Repo enthält ein `Dockerfile`: Node baut `dist/`, nginx liefert es auf Port 80 aus
(Cache-Header siehe `nginx.conf`).

1. In Coolify: *New Resource → Private Repository (with GitHub App)*, Repo `breichr/Feldblick`, Branch `main`.
2. Build Pack **Dockerfile**, Port **80**.
3. Domain mit `https://` eintragen. HTTPS ist Pflicht, sonst läuft der Service Worker nicht.
4. Deployen; mit *Auto Deploy* baut jeder Push auf `main` neu.

Lokal testen: `docker build -t feldblick . && docker run --rm -p 8080:80 feldblick`
