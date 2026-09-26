import type { Nutzungsart, Schlag } from './types';

export interface KulturSumme {
  nutzungsart: Nutzungsart;
  anzahl: number;
  bruttoHa: number;
  nettoHa: number;
}

export interface Summen {
  kulturen: KulturSumme[];
  gesamt: { anzahl: number; bruttoHa: number; nettoHa: number };
}

/** Area per Kultur (Schlag-Nutzungsart), largest net area first. */
export function summarize(schlaege: readonly Schlag[]): Summen {
  const byCode = new Map<string, KulturSumme>();
  for (const s of schlaege) {
    const entry = byCode.get(s.nutzungsart.code) ?? { nutzungsart: s.nutzungsart, anzahl: 0, bruttoHa: 0, nettoHa: 0 };
    entry.anzahl += 1;
    entry.bruttoHa += s.flaecheBruttoHa;
    entry.nettoHa += s.flaecheNettoHa;
    byCode.set(s.nutzungsart.code, entry);
  }
  const kulturen = [...byCode.values()].sort(
    (a, b) => b.nettoHa - a.nettoHa || a.nutzungsart.bezeichnung.localeCompare(b.nutzungsart.bezeichnung, 'de-AT'),
  );
  return {
    kulturen,
    gesamt: {
      anzahl: schlaege.length,
      bruttoHa: kulturen.reduce((sum, k) => sum + k.bruttoHa, 0),
      nettoHa: kulturen.reduce((sum, k) => sum + k.nettoHa, 0),
    },
  };
}
