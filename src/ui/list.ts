import type { ImportData } from '../data/imports';
import { colorForCode } from '../domain/colors';
import { formatHa } from '../domain/format';
import type { Feldstueck, Schlag } from '../domain/types';
import { h, swatch } from './dom';

type SortKey = 'nummer' | 'name' | 'flaeche';

export interface ListView {
  show(data: ImportData): void;
}

export function createListView(root: HTMLElement, onSelect: (schlag: Schlag) => void): ListView {
  let data: ImportData | undefined;
  let sort: SortKey = 'nummer';
  let kultur = '';

  const sortSelect = h(
    'select',
    { 'aria-label': 'Sortierung', onchange: () => { sort = sortSelect.value as SortKey; render(); } },
    h('option', { value: 'nummer' }, 'Nach Nummer'),
    h('option', { value: 'name' }, 'Nach Name'),
    h('option', { value: 'flaeche' }, 'Nach Fläche'),
  );
  const kulturSelect = h('select', {
    'aria-label': 'Kultur',
    onchange: () => { kultur = kulturSelect.value; render(); },
  });
  const items = h('div', { class: 'fs-list' });
  root.replaceChildren(h('div', { class: 'toolbar' }, sortSelect, kulturSelect), items);

  function fillKulturOptions(schlaege: Schlag[]) {
    const kulturen = new Map<string, string>();
    for (const s of schlaege) kulturen.set(s.nutzungsart.code, s.nutzungsart.bezeichnung);
    if (!kulturen.has(kultur)) kultur = '';
    kulturSelect.replaceChildren(
      h('option', { value: '' }, 'Alle Kulturen'),
      ...[...kulturen]
        .sort((a, b) => a[1].localeCompare(b[1], 'de-AT'))
        .map(([code, name]) => h('option', { value: code, selected: code === kultur }, name || code)),
    );
  }

  function compare(a: Feldstueck, b: Feldstueck): number {
    if (sort === 'name') return a.bezeichnung.localeCompare(b.bezeichnung, 'de-AT') || a.nummer - b.nummer;
    if (sort === 'flaeche') return b.flaecheHa - a.flaecheHa || a.nummer - b.nummer;
    return a.nummer - b.nummer;
  }

  function render() {
    if (!data) return;
    const byFeldstueck = new Map<string, Schlag[]>();
    for (const s of data.schlaege) {
      if (kultur && s.nutzungsart.code !== kultur) continue;
      const list = byFeldstueck.get(s.feldstueckId) ?? [];
      list.push(s);
      byFeldstueck.set(s.feldstueckId, list);
    }

    const feldstuecke = data.feldstuecke
      .filter((fs) => !kultur || byFeldstueck.has(fs.id))
      .sort(compare);

    items.replaceChildren(
      ...feldstuecke.map((fs) => {
        const schlaege = (byFeldstueck.get(fs.id) ?? []).sort((a, b) => a.nummer - b.nummer);
        return h(
          'details',
          { class: 'fs', open: kultur !== '' },
          h(
            'summary',
            {},
            h('span', { class: 'fs-nr' }, String(fs.nummer)),
            h('span', { class: 'fs-main' },
              h('strong', {}, fs.bezeichnung || `Feldstück ${fs.nummer}`),
              h('small', {}, `${fs.nutzungsart.bezeichnung} · ${schlaege.length} ${schlaege.length === 1 ? 'Schlag' : 'Schläge'}`)),
            h('span', { class: 'fs-area' }, formatHa(fs.flaecheHa)),
          ),
          h(
            'ul',
            { class: 'schlag-list' },
            ...schlaege.map((s) =>
              h('li', {}, h(
                'button',
                { class: 'schlag', onclick: () => onSelect(s) },
                swatch(colorForCode(s.nutzungsart.code)),
                h('span', { class: 'schlag-main' }, `${s.nummer} · ${s.nutzungsart.bezeichnung}`),
                h('span', { class: 'schlag-area' }, formatHa(s.flaecheNettoHa)),
              )),
            ),
          ),
        );
      }),
    );
    if (feldstuecke.length === 0) items.append(h('p', { class: 'empty-hint' }, 'Keine Feldstücke für diese Auswahl.'));
  }

  return {
    show(next) {
      data = next;
      fillKulturOptions(next.schlaege);
      render();
    },
  };
}
