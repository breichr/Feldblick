import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decodeEamaXml, parseFeldstuecksliste, ParseError } from '../src/domain/parser';
import { lambertToWgs84 } from '../src/domain/projection';

function loadFixture(name: string): string {
  return decodeEamaXml(readFileSync(join(process.cwd(), 'test/fixtures', name)));
}

const NS = 'xmlns="http://feldstuecksliste.gsc.services.ama.at/2016/" xmlns:gml="http://www.opengis.net/gml"';
const POLY =
  '<gml:Polygon><gml:exterior><gml:LinearRing><gml:posList>527800 528900 527900 528900 527900 529000 527800 528900</gml:posList></gml:LinearRing></gml:exterior></gml:Polygon>';

function minimal(feldstueck: string): string {
  return `<feldstuecksliste ${NS} datum="2026-04-15"><hauptbetriebsnummer>1</hauptbetriebsnummer><foerderart>MFA2026</foerderart><feldstuecke>${feldstueck}</feldstuecke></feldstuecksliste>`;
}

describe('lambertToWgs84', () => {
  it('matches the reference point in the Waldviertel', () => {
    const [lon, lat] = lambertToWgs84(527869.44, 528945.97);
    expect(lon).toBeCloseTo(15.068, 2);
    expect(lat).toBeCloseTo(48.647, 2);
  });
});

describe('parseFeldstuecksliste', () => {
  const parsed = parseFeldstuecksliste(loadFixture('feldstuecksliste-anonym.xml'));

  it('reads the header', () => {
    expect(parsed.datum).toBe('2026-04-15');
    expect(parsed.foerderart).toBe('MFA2026');
    expect(parsed.betriebsnummer).toBe('9999999');
  });

  it('decodes ISO-8859-1 umlauts', () => {
    const vorwiese = parsed.feldstuecke.find((f) => f.bezeichnung === 'VORWIESE')!;
    expect(vorwiese.nutzungsart).toEqual({ code: 'G', bezeichnung: 'GRÜNLAND' });
    expect(vorwiese.schlaege[0]!.nutzungsart.bezeichnung).toBe('MÄHWIESE/-WEIDE ZWEI NUTZUNGEN');
  });

  it('reads feldstuecke and schlaege with areas', () => {
    expect(parsed.feldstuecke.map((f) => f.nummer)).toEqual([3, 1, 12]);
    const hausacker = parsed.feldstuecke.find((f) => f.nummer === 1)!;
    expect(hausacker.flaecheHa).toBe(2);
    expect(hausacker.schlaege).toHaveLength(2);
    const [roggen, gerste] = hausacker.schlaege;
    expect(roggen).toMatchObject({
      nummer: 1,
      nutzungsart: { code: 'WR', bezeichnung: 'WINTERROGGEN' },
      flaecheBruttoHa: 1,
      flaecheNettoHa: 1,
      codes: 'DIV',
      begruenungsvariante: '2',
    });
    expect(gerste!.flaecheNettoHa).toBe(0.95);
    expect(gerste!.codes).toBeUndefined();
  });

  it('handles optional grundstueck fields', () => {
    const gerste = parsed.feldstuecke.find((f) => f.nummer === 1)!.schlaege[1]!;
    expect(gerste.grundstuecke).toEqual([
      { katastralgemeindenummer: '99001', nummer: '201', anteilsflaecheHa: 0.6, rechtsverhaeltnis: 'E' },
      { katastralgemeindenummer: '99002', nummer: '15/1', anteilsflaecheHa: 0.4 },
    ]);
  });

  it('converts geometry to closed WGS84 rings in [lon, lat] order', () => {
    const ring = parsed.feldstuecke[0]!.geometry.coordinates[0]!;
    expect(ring).toHaveLength(5);
    expect(ring[0]).toEqual(ring[4]);
    const [lon, lat] = ring[0]!;
    expect(lon).toBeGreaterThan(15);
    expect(lon).toBeLessThan(15.2);
    expect(lat).toBeGreaterThan(48.6);
    expect(lat).toBeLessThan(48.7);
  });

  it('keeps interior rings as holes', () => {
    const leiten = parsed.feldstuecke.find((f) => f.nummer === 12)!;
    expect(leiten.geometry.coordinates).toHaveLength(2);
    expect(leiten.schlaege[0]!.geometry.coordinates).toHaveLength(2);
  });

  it('closes an unclosed ring', () => {
    const open = POLY.replace('527800 528900</gml:posList>', '527800 529000</gml:posList>');
    const result = parseFeldstuecksliste(
      minimal(`<feldstueck><nummer>1</nummer><nutzungsart><code>A</code></nutzungsart><flaeche>1</flaeche><geometrie>${open}</geometrie></feldstueck>`),
    );
    const ring = result.feldstuecke[0]!.geometry.coordinates[0]!;
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(result.feldstuecke[0]!.schlaege).toEqual([]);
    expect(result.feldstuecke[0]!.bezeichnung).toBe('');
  });
});

describe('parseFeldstuecksliste errors', () => {
  it('rejects malformed XML', () => {
    expect(() => parseFeldstuecksliste('<feldstuecksliste>')).toThrow(ParseError);
  });

  it('rejects other XML documents', () => {
    expect(() => parseFeldstuecksliste('<foo/>')).toThrow('keine eAMA-Feldstücksliste');
  });

  it('rejects an empty list', () => {
    expect(() => parseFeldstuecksliste(minimal(''))).toThrow('keine Feldstücke');
  });

  it('names the feldstueck when data is missing', () => {
    const xml = minimal(`<feldstueck><nummer>7</nummer><nutzungsart><code>A</code></nutzungsart><flaeche>abc</flaeche><geometrie>${POLY}</geometrie></feldstueck>`);
    expect(() => parseFeldstuecksliste(xml)).toThrow('Feldstück 7: „flaeche“ ist keine Zahl');
  });

  it('reports missing geometry', () => {
    const xml = minimal('<feldstueck><nummer>7</nummer><nutzungsart><code>A</code></nutzungsart><flaeche>1</flaeche></feldstueck>');
    expect(() => parseFeldstuecksliste(xml)).toThrow('Feldstück 7: Geometrie fehlt');
  });
});
