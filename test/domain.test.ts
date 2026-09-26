import { describe, expect, it } from 'vitest';
import { colorForCode } from '../src/domain/colors';
import { formatDatum, formatHa } from '../src/domain/format';
import { summarize } from '../src/domain/summary';
import type { Schlag } from '../src/domain/types';

describe('formatHa', () => {
  it('uses two decimals and a decimal comma', () => {
    expect(formatHa(3.8)).toBe('3,80 ha');
    expect(formatHa(0.955)).toMatch(/^0,9[56] ha$/);
  });
});

describe('formatDatum', () => {
  it('formats ISO dates Austrian style', () => {
    expect(formatDatum('2026-04-15')).toBe('15.04.2026');
    expect(formatDatum('15.04.2026')).toBe('15.04.2026');
  });
});

describe('colorForCode', () => {
  it('is stable and differs between codes', () => {
    expect(colorForCode('WR')).toBe(colorForCode('WR'));
    expect(colorForCode('WR')).not.toBe(colorForCode('SG'));
  });
});

describe('summarize', () => {
  const schlag = (code: string, brutto: number, netto: number) =>
    ({ nutzungsart: { code, bezeichnung: code }, flaecheBruttoHa: brutto, flaecheNettoHa: netto }) as Schlag;

  it('sums area per Kultur and overall', () => {
    const result = summarize([schlag('WR', 1, 1), schlag('SG', 1, 0.95), schlag('WR', 3.84, 3.8)]);
    expect(result.kulturen.map((k) => [k.nutzungsart.code, k.anzahl])).toEqual([['WR', 2], ['SG', 1]]);
    expect(result.kulturen[0]!.nettoHa).toBeCloseTo(4.8);
    expect(result.gesamt.anzahl).toBe(3);
    expect(result.gesamt.bruttoHa).toBeCloseTo(5.84);
    expect(result.gesamt.nettoHa).toBeCloseTo(5.75);
  });
});
