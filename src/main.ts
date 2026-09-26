import { registerSW } from 'virtual:pwa-register';
import { listImports, loadImportData, type ImportData } from './data/imports';
import type { Schlag } from './domain/types';
import { createDetailsSheet } from './ui/details';
import { h } from './ui/dom';
import { enableDropImport, importFile, pickFile } from './ui/importer';
import { createListView } from './ui/list';
import { createMapView } from './ui/map';
import { renderSummary } from './ui/summary';
import './style.css';

type Tab = 'map' | 'list' | 'summary';

const ACTIVE_IMPORT_KEY = 'feldblick.activeImport';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const importSelect = $<HTMLSelectElement>('import-select');
const tabbar = $('tabbar');
const emptyState = $('empty');
const views = { map: $('view-map'), list: $('view-list'), summary: $('view-summary') };

let current: ImportData | undefined;
let activeTab: Tab = 'map';

const details = createDetailsSheet($('details'));
const mapView = createMapView(views.map, (s) => openDetails(s, false));
const listView = createListView(views.list, (s) => openDetails(s, true));

function openDetails(schlag: Schlag, offerMap: boolean) {
  const feldstueck = current?.feldstuecke.find((fs) => fs.id === schlag.feldstueckId);
  details.open(schlag, feldstueck, offerMap ? () => { showTab('map'); mapView.focusSchlag(schlag.id); } : undefined);
}

function showTab(tab: Tab) {
  activeTab = tab;
  for (const [name, el] of Object.entries(views)) el.hidden = !current || name !== tab;
  for (const btn of tabbar.querySelectorAll<HTMLButtonElement>('button')) {
    if (btn.dataset.tab === tab) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  }
  if (tab === 'map') mapView.refresh();
}

async function refresh(preferredId?: string) {
  const imports = await listImports();
  const stored = readActiveImport();
  const active =
    imports.find((i) => i.id === preferredId) ?? imports.find((i) => i.id === stored) ?? imports[0];

  importSelect.hidden = imports.length < 2;
  importSelect.replaceChildren(
    ...imports.map((i) => h('option', { value: i.id, selected: i.id === active?.id }, i.foerderart)),
  );

  details.close();
  current = active ? await loadImportData(active.id) : undefined;
  emptyState.hidden = !!current;
  tabbar.hidden = !current;
  if (current) {
    writeActiveImport(current.import.id);
    mapView.show(current);
    listView.show(current);
    renderSummary(views.summary, current);
  }
  showTab(activeTab);
}

async function handleFile(file: File | undefined) {
  if (!file) return;
  const record = await importFile(file);
  if (record) {
    activeTab = 'map';
    await refresh(record.id);
  }
}

function readActiveImport(): string | null {
  try {
    return localStorage.getItem(ACTIVE_IMPORT_KEY);
  } catch {
    return null;
  }
}

function writeActiveImport(id: string) {
  try {
    localStorage.setItem(ACTIVE_IMPORT_KEY, id);
  } catch {
    // Only a convenience; ignore blocked storage.
  }
}

$('import-button').addEventListener('click', async () => handleFile(await pickFile()));
$('empty-import').addEventListener('click', async () => handleFile(await pickFile()));
importSelect.addEventListener('change', () => refresh(importSelect.value));
tabbar.addEventListener('click', (e) => {
  const tab = (e.target as HTMLElement).closest<HTMLButtonElement>('button')?.dataset.tab as Tab | undefined;
  if (tab) showTab(tab);
});
window.addEventListener('resize', () => {
  if (activeTab === 'map') mapView.refresh();
});
enableDropImport((file) => void handleFile(file));

registerSW({ immediate: true });
void refresh();
