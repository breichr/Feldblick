import { colorForCode } from '../domain/colors';
import { formatHa } from '../domain/format';
import type { Feldstueck, Schlag } from '../domain/types';
import { h, swatch } from './dom';

export interface DetailsSheet {
  open(schlag: Schlag, feldstueck: Feldstueck | undefined, onShowOnMap?: () => void): void;
  close(): void;
}

export function createDetailsSheet(root: HTMLElement): DetailsSheet {
  const close = () => {
    root.hidden = true;
    root.replaceChildren();
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !root.hidden) close();
  });

  return {
    close,
    open(schlag, feldstueck, onShowOnMap) {
      const row = (label: string, value: Node | string | undefined) =>
        value ? h('div', { class: 'kv' }, h('dt', {}, label), h('dd', {}, value)) : null;

      const title = feldstueck
        ? `FS ${feldstueck.nummer}${feldstueck.bezeichnung ? ` · ${feldstueck.bezeichnung}` : ''}`
        : 'Schlag';

      const parts = [
        h(
          'div',
          { class: 'sheet-head' },
          h('div', {}, h('p', { class: 'sheet-kicker' }, title), h('h2', {}, `Schlag ${schlag.nummer}`)),
          h('button', { class: 'btn btn-icon', 'aria-label': 'Schließen', onclick: close }, '✕'),
        ),
        h(
          'dl',
          { class: 'kvs' },
          row(
            'Kultur',
            h('span', { class: 'kultur' }, swatch(colorForCode(schlag.nutzungsart.code)),
              `${schlag.nutzungsart.bezeichnung} (${schlag.nutzungsart.code})`),
          ),
          row('Fläche netto', formatHa(schlag.flaecheNettoHa)),
          row('Fläche brutto', formatHa(schlag.flaecheBruttoHa)),
          row('Codes', schlag.codes),
          row('Begrünung', schlag.begruenungsvariante),
          feldstueck ? row('Feldstück', `${feldstueck.nutzungsart.bezeichnung}, ${formatHa(feldstueck.flaecheHa)}`) : null,
        ),
        schlag.grundstuecke.length > 0
          ? h(
              'table',
              { class: 'table' },
              h('caption', {}, 'Grundstücke'),
              h('thead', {}, h('tr', {}, h('th', {}, 'KG'), h('th', {}, 'Gst.-Nr.'), h('th', { class: 'num' }, 'Anteil'), h('th', {}, 'RV'))),
              h(
                'tbody',
                {},
                ...schlag.grundstuecke.map((g) =>
                  h('tr', {},
                    h('td', {}, g.katastralgemeindenummer),
                    h('td', {}, g.nummer),
                    h('td', { class: 'num' }, formatHa(g.anteilsflaecheHa)),
                    h('td', {}, g.rechtsverhaeltnis ?? '–')),
                ),
              ),
            )
          : null,
        onShowOnMap
          ? h('button', { class: 'btn btn-primary btn-block', onclick: () => { close(); onShowOnMap(); } }, 'Auf Karte zeigen')
          : null,
      ];
      root.replaceChildren(...parts.filter((p) => p !== null));
      root.hidden = false;
    },
  };
}
