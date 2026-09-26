import type { ImportData } from '../data/imports';
import { colorForCode } from '../domain/colors';
import { formatDatum, formatHa, formatNumber } from '../domain/format';
import { summarize } from '../domain/summary';
import { h, swatch } from './dom';

export function renderSummary(root: HTMLElement, data: ImportData): void {
  const { kulturen, gesamt } = summarize(data.schlaege);
  const feldstueckHa = data.feldstuecke.reduce((sum, fs) => sum + fs.flaecheHa, 0);

  root.replaceChildren(
    h(
      'dl',
      { class: 'kvs card' },
      h('div', { class: 'kv' }, h('dt', {}, 'Förderart'), h('dd', {}, data.import.foerderart)),
      h('div', { class: 'kv' }, h('dt', {}, 'Stand'), h('dd', {}, formatDatum(data.import.datum))),
      h('div', { class: 'kv' }, h('dt', {}, 'Feldstücke'), h('dd', {}, `${data.feldstuecke.length} · ${formatHa(feldstueckHa)}`)),
      h('div', { class: 'kv' }, h('dt', {}, 'Schläge'), h('dd', {}, String(gesamt.anzahl))),
    ),
    h(
      'table',
      { class: 'table card compact' },
      h('caption', {}, 'Fläche je Kultur'),
      h('thead', {}, h('tr', {},
        h('th', {}, 'Kultur'),
        h('th', { class: 'num' }, 'Schl.'),
        h('th', { class: 'num' }, 'Netto', h('br'), 'ha'),
        h('th', { class: 'num' }, 'Brutto', h('br'), 'ha'))),
      h(
        'tbody',
        {},
        ...kulturen.map((k) =>
          h('tr', {},
            h('td', {}, h('span', { class: 'kultur' }, swatch(colorForCode(k.nutzungsart.code)), k.nutzungsart.bezeichnung || k.nutzungsart.code)),
            h('td', { class: 'num' }, String(k.anzahl)),
            h('td', { class: 'num' }, formatNumber(k.nettoHa)),
            h('td', { class: 'num' }, formatNumber(k.bruttoHa))),
        ),
      ),
      h('tfoot', {}, h('tr', {},
        h('th', {}, 'Gesamt'),
        h('td', { class: 'num' }, String(gesamt.anzahl)),
        h('td', { class: 'num' }, formatNumber(gesamt.nettoHa)),
        h('td', { class: 'num' }, formatNumber(gesamt.bruttoHa)))),
    ),
  );
}
