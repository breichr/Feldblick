# Feldblick

PWA zur Anzeige der eigenen Feldstücke und Schläge als **Karte** oder **Liste**. Datenquelle ist die
Feldstücksliste als XML-Export aus **eAMA** (Mehrfachantrag, z. B. `954021MFA2026ERFFL_SLG_XML_*.xml`).

## Grundsätze

- **Local-first.** Import, Parsing, Umrechnung und Erfassung laufen im Browser. Maßgeblich ist der lokale Stand in IndexedDB. Ein Server ist nur für Backup und Synchronisation da und für die Bedienung nie Voraussetzung.
- **Offline-first.** Nach dem Import muss die App am Feld ohne Netz funktionieren (Daten in IndexedDB, App-Shell per Service Worker gecacht). Aufzeichnungen, die offline entstehen, werden später synchronisiert.
- **Sync-fähig von Anfang an.** Auch solange es keinen Server gibt, hält sich jeder Datensatz an die Regeln unter „Sync & Backup“. Dann muss beim späteren Einführen der Synchronisation nichts migriert werden.
- **Mobil zuerst.** Die Hauptnutzung ist am Handy draußen: große Touch-Ziele, lesbar bei Sonnenlicht.
- **Klein anfangen.** Zuerst Import, Karte und Liste; alles Weitere erst bei Bedarf.
- Die UI-Texte sind auf Deutsch (Österreich), Code und Bezeichner auf Englisch. Fachbegriffe aus der AMA bleiben deutsch (`feldstueck`, `schlag`, `nutzungsart`).

## Tech-Stack

- Vite + TypeScript (strict), ohne UI-Framework (Vanilla TS). Eines kommt nur dazu, wenn die UI es wirklich braucht.
- Karte: Leaflet
- Koordinatenumrechnung: proj4
- Speicher: IndexedDB über `idb`
- PWA: `vite-plugin-pwa` (Workbox)
- Tests: Vitest
- Hosting: Die PWA wird statisch auf Coolify ausgeliefert. Der Sync-Server (ab v3) läuft als eigener Dienst ebenfalls dort.

## Befehle

```bash
npm install
npm run dev       # Dev-Server
npm run build     # Produktions-Build nach dist/
npm run preview   # Build lokal testen (inkl. Service Worker)
npm test          # Vitest
```

## Das eAMA-XML

### Kodierung
Die Datei ist in **ISO-8859-1** kodiert, nicht in UTF-8. Deshalb immer so dekodieren:

```ts
const text = new TextDecoder('iso-8859-1').decode(await file.arrayBuffer());
const doc = new DOMParser().parseFromString(text, 'application/xml');
```

Mit `file.text()` kommen die Umlaute kaputt an („GR�NLAND“).

### Namespaces
- Standard: `http://feldstuecksliste.gsc.services.ama.at/2016/`
- GML: `http://www.opengis.net/gml`

Elemente über `getElementsByTagNameNS` holen, **nicht** über `querySelector` mit Präfixen.

### Struktur
```
feldstuecksliste[@datum]
├─ hauptbetriebsnummer, bbknummer, foerderart (z. B. MFA2026)
└─ feldstuecke/feldstueck[@lfdnr]
   ├─ nummer, betriebsnummer, bezeichnung (z. B. "VORWIESE")
   ├─ nutzungsart/{code, bezeichnung}   A = ACKERLAND, G = GRÜNLAND, …
   ├─ flaeche                           in ha, Dezimalpunkt
   ├─ geometrie/gml:Polygon
   └─ schlaege/schlag[@lfdnr]
      ├─ nummer
      ├─ nutzungsart/{code, bezeichnung}  Kultur, z. B. WINTERROGGEN
      ├─ flaeche_brutto, flaeche_netto    in ha
      ├─ codes?                           z. B. DIV, DIVSZ
      ├─ begruenungsvariante?
      ├─ geometrie/gml:Polygon
      └─ grundstuecksanteile/grundstueck[@lfdnr]
         ├─ katastralgemeindenummer, nummer
         ├─ anteilsflaeche                in ha
         └─ rechtsverhaeltnis?            E / P / N
```

Optionale Elemente (`?`) können fehlen, der Parser muss damit umgehen.

### Geometrie
- Das Koordinatensystem ist **EPSG:31287** (MGI / Austria Lambert).
- `gml:posList` enthält paarweise `x y`, durch Leerzeichen getrennt, oft mit einem Leerzeichen am Ende. Der Ring ist geschlossen (erster Punkt = letzter Punkt).
- Außer `gml:exterior` können auch `gml:interior`-Ringe (Löcher) vorkommen. Die müssen mitverarbeitet werden.
- Beim Import wird nach WGS84 umgerechnet. Intern werden die Daten als GeoJSON gespeichert, in der Reihenfolge `[lon, lat]`.

```ts
proj4.defs('EPSG:31287',
  '+proj=lcc +lat_0=47.5 +lon_0=13.3333333333333 +lat_1=49 +lat_2=46 ' +
  '+x_0=400000 +y_0=400000 +ellps=bessel ' +
  '+towgs84=577.326,90.129,463.919,5.137,1.474,5.297,2.4232 +units=m +no_defs +type=crs');
// Plausibilitätscheck: 527869.44 528945.97 -> ca. 15.068 E, 48.647 N (Waldviertel)
```

## Datenmodell (intern)

```ts
interface Import { id: string; datum: string; foerderart: string; betriebsnummer: string; importedAt: string; }
interface Feldstueck { id: string; importId: string; nummer: number; bezeichnung: string;
  nutzungsart: { code: string; bezeichnung: string }; flaecheHa: number; geometry: GeoJSON.Polygon; }
interface Schlag { id: string; feldstueckId: string; nummer: number;
  nutzungsart: { code: string; bezeichnung: string }; flaecheBruttoHa: number; flaecheNettoHa: number;
  codes?: string; geometry: GeoJSON.Polygon; grundstuecke: Grundstueck[]; }
```

Dazu kommen später Aufzeichnungen:

```ts
interface Aufzeichnung extends SyncMeta {
  schlagId: string;                                // Schlag des jeweiligen Imports
  ref: { jahr: number; feldstueckNr: number; schlagNr: number; bezeichnung: string }; // lesbarer Snapshot
  datum: string;                                   // ISO-Datum der Maßnahme
  art: string;                                     // z. B. "Notiz", "Düngung", "Pflanzenschutz", "Ernte"
  text?: string;
  position?: [number, number];                     // [lon, lat], optional per GPS
}

interface SyncMeta {
  id: string;          // UUID v4, am Client erzeugt
  createdAt: string;   // ISO-Zeitstempel
  updatedAt: string;   // ISO-Zeitstempel, bei jeder Änderung setzen
  deleted: boolean;    // Tombstone statt echtem Löschen
  rev: number;         // lokal hochzählen bei jeder Änderung
}
```

Die Schlag-Nummern können sich von Jahr zu Jahr ändern. Deshalb verweist eine Aufzeichnung auf den Schlag *eines bestimmten Imports* und trägt zusätzlich einen lesbaren Snapshot (`ref`). Ein neuer Import verändert alte Aufzeichnungen nie.

Pro Förderart und Jahr gibt es einen Import. Wird dieselbe Förderart erneut importiert, ersetzt das nach Rückfrage den alten Stand. Mehrere Jahre bleiben erhalten, damit später ein Jahresvergleich möglich ist.

## Funktionen

### v1
1. Import über Dateiauswahl sowie Drag & Drop. Bei fehlerhaftem XML gibt es eine klare Fehlermeldung.
2. **Karte:** Feldstücke als Umriss, Schläge nach Kultur eingefärbt (Farbe stabil je Nutzungscode). Ein Tap öffnet die Details. Beim Öffnen wird auf alle Flächen gezoomt.
3. **Liste:** Feldstücke gruppiert, die Schläge lassen sich aufklappen. Sortierbar nach Nummer, Name und Fläche, filterbar nach Kultur.
4. **Summen:** Fläche je Kultur und gesamt.
5. **Offline:** Nach dem ersten Laden funktionieren App und Daten ohne Netz.

### v2 – Aufzeichnungen & Backup
1. Kurze Aufzeichnungen je Schlag erfassen (Datum, Art, Text), aufrufbar aus Karte und Liste.
2. **Backup ohne Server:** Export aller Daten als eine JSON-Datei (`feldblick-backup-YYYY-MM-DD.json`) und Wiederherstellung daraus mit Zusammenführung nach den Sync-Regeln. Freigabe über `navigator.share` am Handy, sonst als Download.
3. Hinweis in der App, wenn das letzte Backup länger als 30 Tage zurückliegt.

### v3 – Synchronisation
Ein kleiner, selbst gehosteter Sync-Server auf Coolify, siehe „Sync & Backup“.

### Später (nicht vorab bauen)
- GPS-Position auf der Karte und „Auf welchem Schlag stehe ich?“
- Offline-Cache für Kartenkacheln im Bereich der eigenen Flächen
- Jahresvergleich / Fruchtfolge über mehrere Importe
- Export als GeoJSON oder KML

## Karte

Als Hintergrund dienen die Kacheln von basemap.at. Achtung: Die URL verwendet die Reihenfolge `{z}/{y}/{x}`.

- Grundkarte: `https://mapsneu.wien.gv.at/basemap/geolandbasemap/normal/google3857/{z}/{y}/{x}.png`
- Orthofoto: `https://mapsneu.wien.gv.at/basemap/bmaporthofoto30cm/normal/google3857/{z}/{y}/{x}.jpeg`
- Attribution: „Datenquelle: basemap.at“

Die URLs vor dem Einsatz gegen die aktuelle Doku auf basemap.at prüfen.

## Sync & Backup

### Regeln für alle Datensätze (ab sofort)
- Jeder Datensatz hat die Felder aus `SyncMeta`. IDs sind UUIDs vom Client und keine Auto-Increments.
- Gelöscht wird nur per Tombstone (`deleted: true`), nie hart. Tombstones bleiben erhalten, bis alle Geräte synchronisiert haben.
- Alle Schreibzugriffe laufen über eine Repository-Schicht (`src/data/`). Die setzt `updatedAt` und `rev` und schreibt einen Eintrag in die lokale `outbox` (Store mit geänderten IDs). Die UI greift nie direkt auf IndexedDB zu.
- Importierte eAMA-Daten (Feldstücke, Schläge) gelten als *abgeleitet*. Synchronisiert wird die Original-XML bzw. der geparste Import als Ganzes, nicht jedes Polygon einzeln.

### Konfliktauflösung
- Pro Datensatz gilt Last-Write-Wins über `updatedAt`, bei Gleichstand gewinnt der höhere `rev`, danach die größere `id`.
- Das reicht für Einzelnutzer mit mehreren Geräten. Echtes Merging (CRDT) kommt erst dazu, wenn mehrere Personen gleichzeitig dieselbe Aufzeichnung bearbeiten sollen.

### Sync-Server (v3)
- Ein eigener kleiner Dienst auf Coolify: Node + Hono + SQLite, als Docker-Image.
- Schnittstelle:
  - `POST /sync/push`: Der Client schickt die Änderungen aus der `outbox`, der Server wendet LWW an.
  - `GET /sync/pull?since=<serverSeq>`: Der Server liefert alles, was sich seit dieser Sequenznummer geändert hat. Die monoton steigende `seq` vergibt der Server, nicht die Uhr des Clients.
- Authentifizierung: ein Konto pro Betrieb, Login mit Passkey oder Passwort. Das Token liegt nur im Speicher bzw. in IndexedDB, nicht in `localStorage`.
- Synchronisiert wird beim Start, bei `online`-Events und manuell per Button. Background Sync ist optional.
- Der Server ist jederzeit verzichtbar: Ist er nicht erreichbar, läuft die App unverändert weiter und die `outbox` wächst.
- Alternativen, falls der eigene Dienst zu viel Aufwand ist: PocketBase oder CouchDB mit PouchDB. Die Entscheidung fällt erst bei v3.

## Datenschutz

- Echte eAMA-Exporte enthalten Betriebsnummer, Grundstücksnummern und die genaue Lage der Flächen. Sie werden **niemals committet**, dafür gibt es in `.gitignore` den Eintrag `*.xml` außerhalb von `test/fixtures/`.
- Die Test-Fixtures sind anonymisiert: Betriebsnummer und KG-Nummern sind ersetzt, die Koordinaten verschoben.
- Keine Analytics und keine Drittanbieter-Requests außer den Kartenkacheln und dem eigenen Sync-Server.
- Backups und Sync-Daten enthalten dieselben sensiblen Daten wie der eAMA-Export. Der Server läuft deshalb nur mit HTTPS und liegt auf eigener Infrastruktur.

## Konventionen

- Flächen werden intern in ha als `number` geführt und in der Anzeige mit 2 Nachkommastellen und deutschem Dezimalkomma ausgegeben (`Intl.NumberFormat('de-AT')`).
- Der Parser ist eine reine Funktion (`parseFeldstuecksliste(text): ParsedImport`) ohne DOM- oder IndexedDB-Seiteneffekte und ist mit Fixtures getestet.
- Commits sind klein und haben englische Commit-Messages.
