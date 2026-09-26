import type { Polygon } from 'geojson';

export interface Nutzungsart {
  code: string;
  bezeichnung: string;
}

export interface SyncMeta {
  id: string; // UUID v4, am Client erzeugt
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
  rev: number;
}

export interface Grundstueck {
  katastralgemeindenummer: string;
  nummer: string;
  anteilsflaecheHa: number;
  rechtsverhaeltnis?: string;
}

/** A parsed import. Synced as a whole, including the original XML. */
export interface Import extends SyncMeta {
  datum: string;
  foerderart: string;
  betriebsnummer: string;
  importedAt: string;
  sourceXml: string;
}

/** Derived from an Import, never synced on its own. */
export interface Feldstueck {
  id: string;
  importId: string;
  nummer: number;
  bezeichnung: string;
  nutzungsart: Nutzungsart;
  flaecheHa: number;
  geometry: Polygon;
}

/** Derived from an Import, never synced on its own. */
export interface Schlag {
  id: string;
  importId: string;
  feldstueckId: string;
  nummer: number;
  nutzungsart: Nutzungsart;
  flaecheBruttoHa: number;
  flaecheNettoHa: number;
  codes?: string;
  begruenungsvariante?: string;
  geometry: Polygon;
  grundstuecke: Grundstueck[];
}

/** Output of the parser: plain data without IDs or sync fields. */
export interface ParsedSchlag extends Omit<Schlag, 'id' | 'importId' | 'feldstueckId'> {}

export interface ParsedFeldstueck extends Omit<Feldstueck, 'id' | 'importId'> {
  schlaege: ParsedSchlag[];
}

export interface ParsedImport {
  datum: string;
  foerderart: string;
  betriebsnummer: string;
  feldstuecke: ParsedFeldstueck[];
}
