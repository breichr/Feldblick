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
