import type { Polygon, Position } from 'geojson';
import { lambertToWgs84 } from './projection';
import type { Grundstueck, Nutzungsart, ParsedFeldstueck, ParsedImport, ParsedSchlag } from './types';

export const AMA_NS = 'http://feldstuecksliste.gsc.services.ama.at/2016/';
export const GML_NS = 'http://www.opengis.net/gml';

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

/** eAMA exports are ISO-8859-1; `file.text()` would garble the umlauts. */
export function decodeEamaXml(buffer: ArrayBuffer | ArrayBufferView): string {
  return new TextDecoder('iso-8859-1').decode(buffer);
}

/** Parses an eAMA Feldstücksliste. Pure: no storage, no DOM mutation. */
export function parseFeldstuecksliste(text: string): ParsedImport {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new ParseError('Die Datei ist kein gültiges XML.');
  }

  const root = doc.documentElement;
  if (root.namespaceURI !== AMA_NS || root.localName !== 'feldstuecksliste') {
    throw new ParseError('Die Datei ist keine eAMA-Feldstücksliste.');
  }

  const feldstueckEls = children(child(root, 'feldstuecke'), 'feldstueck');
  if (feldstueckEls.length === 0) {
    throw new ParseError('Die Feldstücksliste enthält keine Feldstücke.');
  }

  return {
    datum: root.getAttribute('datum') ?? '',
    foerderart: requiredText(root, 'foerderart', 'Feldstücksliste'),
    betriebsnummer: requiredText(root, 'hauptbetriebsnummer', 'Feldstücksliste'),
    feldstuecke: feldstueckEls.map(parseFeldstueck),
  };
}

function parseFeldstueck(el: Element): ParsedFeldstueck {
  const nummer = requiredNumber(el, 'nummer', 'Feldstück');
  const ctx = `Feldstück ${nummer}`;
  return {
    nummer,
    bezeichnung: optionalText(el, 'bezeichnung') ?? '',
    nutzungsart: parseNutzungsart(el, ctx),
    flaecheHa: requiredNumber(el, 'flaeche', ctx),
    geometry: parseGeometrie(el, ctx),
    schlaege: children(child(el, 'schlaege'), 'schlag').map((s) => parseSchlag(s, ctx)),
  };
}

function parseSchlag(el: Element, parentCtx: string): ParsedSchlag {
  const nummer = requiredNumber(el, 'nummer', `Schlag in ${parentCtx}`);
  const ctx = `${parentCtx}, Schlag ${nummer}`;
  const schlag: ParsedSchlag = {
    nummer,
    nutzungsart: parseNutzungsart(el, ctx),
    flaecheBruttoHa: requiredNumber(el, 'flaeche_brutto', ctx),
    flaecheNettoHa: requiredNumber(el, 'flaeche_netto', ctx),
    geometry: parseGeometrie(el, ctx),
    grundstuecke: children(child(el, 'grundstuecksanteile'), 'grundstueck').map((g) =>
      parseGrundstueck(g, ctx),
    ),
  };
  const codes = optionalText(el, 'codes');
  if (codes) schlag.codes = codes;
  const begruenung = optionalText(el, 'begruenungsvariante');
  if (begruenung) schlag.begruenungsvariante = begruenung;
  return schlag;
}

function parseGrundstueck(el: Element, ctx: string): Grundstueck {
  const g: Grundstueck = {
    katastralgemeindenummer: requiredText(el, 'katastralgemeindenummer', ctx),
    nummer: requiredText(el, 'nummer', ctx),
    anteilsflaecheHa: requiredNumber(el, 'anteilsflaeche', ctx),
  };
  const rv = optionalText(el, 'rechtsverhaeltnis');
  if (rv) g.rechtsverhaeltnis = rv;
  return g;
}

function parseNutzungsart(el: Element, ctx: string): Nutzungsart {
  const n = child(el, 'nutzungsart');
  if (!n) throw new ParseError(`${ctx}: Nutzungsart fehlt.`);
  return {
    code: requiredText(n, 'code', ctx),
    bezeichnung: optionalText(n, 'bezeichnung') ?? '',
  };
}

function parseGeometrie(el: Element, ctx: string): Polygon {
  const polygon = child(el, 'geometrie')?.getElementsByTagNameNS(GML_NS, 'Polygon')[0];
  if (!polygon) throw new ParseError(`${ctx}: Geometrie fehlt.`);

  const rings: Position[][] = [];
  for (const boundary of Array.from(polygon.children)) {
    if (boundary.namespaceURI !== GML_NS) continue;
    const isExterior = boundary.localName === 'exterior' || boundary.localName === 'outerBoundaryIs';
    const isInterior = boundary.localName === 'interior' || boundary.localName === 'innerBoundaryIs';
    if (!isExterior && !isInterior) continue;
    const ring = parseRing(boundary, ctx);
    if (isExterior) rings.unshift(ring);
    else rings.push(ring);
  }
  if (rings.length === 0) throw new ParseError(`${ctx}: Polygon ohne Ring.`);
  return { type: 'Polygon', coordinates: rings };
}

function parseRing(boundary: Element, ctx: string): Position[] {
  const posList = boundary.getElementsByTagNameNS(GML_NS, 'posList')[0];
  const raw = posList?.textContent?.trim();
  if (!raw) throw new ParseError(`${ctx}: Koordinatenliste fehlt.`);

  const values = raw.split(/\s+/).map(Number);
  if (values.length % 2 !== 0 || values.some((v) => !Number.isFinite(v))) {
    throw new ParseError(`${ctx}: Koordinatenliste ist fehlerhaft.`);
  }

  const ring: Position[] = [];
  for (let i = 0; i < values.length; i += 2) {
    ring.push(lambertToWgs84(values[i]!, values[i + 1]!));
  }
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
  if (ring.length < 4) throw new ParseError(`${ctx}: Ring hat zu wenige Punkte.`);
  return ring;
}

// --- DOM helpers (namespace-aware, direct children only) ---

function child(el: Element | undefined, name: string): Element | undefined {
  if (!el) return undefined;
  for (const c of Array.from(el.children)) {
    if (c.namespaceURI === AMA_NS && c.localName === name) return c;
  }
  return undefined;
}

function children(el: Element | undefined, name: string): Element[] {
  if (!el) return [];
  return Array.from(el.children).filter(
    (c) => c.namespaceURI === AMA_NS && c.localName === name,
  );
}

function optionalText(el: Element, name: string): string | undefined {
  const text = child(el, name)?.textContent?.trim();
  return text ? text : undefined;
}

function requiredText(el: Element, name: string, ctx: string): string {
  const text = optionalText(el, name);
  if (text === undefined) throw new ParseError(`${ctx}: Feld „${name}“ fehlt.`);
  return text;
}

function requiredNumber(el: Element, name: string, ctx: string): number {
  const text = requiredText(el, name, ctx);
  const value = Number(text.replace(',', '.'));
  if (!Number.isFinite(value)) {
    throw new ParseError(`${ctx}: „${name}“ ist keine Zahl („${text}“).`);
  }
  return value;
}
