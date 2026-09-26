import { findImportByFoerderart, saveImport } from '../data/imports';
import { formatDatum } from '../domain/format';
import { decodeEamaXml, parseFeldstuecksliste, ParseError } from '../domain/parser';
import type { Import } from '../domain/types';
import { alertDialog, confirmDialog } from './dialog';

/**
 * Reads, parses and stores an eAMA export. Returns the new import, or
 * undefined if the file was rejected or the user cancelled.
 */
export async function importFile(file: File): Promise<Import | undefined> {
  let text: string;
  let parsed;
  try {
    text = decodeEamaXml(await file.arrayBuffer());
    parsed = parseFeldstuecksliste(text);
  } catch (err) {
    const detail = err instanceof ParseError ? err.message : 'Die Datei konnte nicht gelesen werden.';
    await alertDialog('Import nicht möglich', `${file.name}: ${detail}`);
    return undefined;
  }

  const existing = await findImportByFoerderart(parsed.foerderart);
  if (existing) {
    const ok = await confirmDialog(
      'Import ersetzen?',
      `Für ${parsed.foerderart} gibt es bereits einen Import (Stand ${formatDatum(existing.datum)}). ` +
        `Soll er durch den Stand ${formatDatum(parsed.datum)} ersetzt werden?`,
      'Ersetzen',
    );
    if (!ok) return undefined;
  }

  try {
    return await saveImport(parsed, text);
  } catch (err) {
    console.error(err);
    await alertDialog('Speichern fehlgeschlagen', 'Die Daten konnten nicht auf dem Gerät gespeichert werden.');
    return undefined;
  }
}

/** Opens the file picker. */
export function pickFile(): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml,application/xml,text/xml';
    input.addEventListener('change', () => resolve(input.files?.[0]));
    input.addEventListener('cancel', () => resolve(undefined));
    input.click();
  });
}

/** Lets the user drop an XML file anywhere on the page. */
export function enableDropImport(onFile: (file: File) => void): void {
  let depth = 0;
  const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false;
  window.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    depth++;
    document.body.classList.add('dragging');
  });
  window.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) document.body.classList.remove('dragging');
  });
  window.addEventListener('dragover', (e) => {
    if (hasFiles(e)) e.preventDefault();
  });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    document.body.classList.remove('dragging');
    const file = e.dataTransfer?.files[0];
    if (file) onFile(file);
  });
}
