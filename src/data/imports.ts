import type { Feldstueck, Import, ParsedImport, Schlag } from '../domain/types';
import { getDb, type OutboxEntry } from './db';
import { uuid } from './uuid';

export interface ImportData {
  import: Import;
  feldstuecke: Feldstueck[];
  schlaege: Schlag[];
}

/** All live imports, newest Förderart first. */
export async function listImports(): Promise<Import[]> {
  const db = await getDb();
  const all = await db.getAll('imports');
  return all
    .filter((i) => !i.deleted)
    .sort((a, b) => b.foerderart.localeCompare(a.foerderart) || b.importedAt.localeCompare(a.importedAt));
}

export async function findImportByFoerderart(foerderart: string): Promise<Import | undefined> {
  const db = await getDb();
  const matches = await db.getAllFromIndex('imports', 'foerderart', foerderart);
  return matches.find((i) => !i.deleted);
}

/**
 * Stores a parsed import. An existing live import of the same Förderart is
 * replaced (tombstoned); the caller is responsible for asking first.
 */
export async function saveImport(parsed: ParsedImport, sourceXml: string): Promise<Import> {
  const db = await getDb();
  const tx = db.transaction(['imports', 'feldstuecke', 'schlaege', 'outbox'], 'readwrite');
  const imports = tx.objectStore('imports');
  const now = new Date().toISOString();

  const previous = (await imports.index('foerderart').getAll(parsed.foerderart)).filter((i) => !i.deleted);
  for (const old of previous) {
    const tombstone: Import = { ...old, sourceXml: '', deleted: true, updatedAt: now, rev: old.rev + 1 };
    await imports.put(tombstone);
    await tx.objectStore('outbox').put(outboxEntry(tombstone, now));
    for (const store of ['feldstuecke', 'schlaege'] as const) {
      let cursor = await tx.objectStore(store).index('importId').openCursor(old.id);
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
    }
  }

  const record: Import = {
    id: uuid(),
    createdAt: now,
    updatedAt: now,
    deleted: false,
    rev: 1,
    datum: parsed.datum,
    foerderart: parsed.foerderart,
    betriebsnummer: parsed.betriebsnummer,
    importedAt: now,
    sourceXml,
  };
  await imports.put(record);
  await tx.objectStore('outbox').put(outboxEntry(record, now));

  for (const { schlaege, ...fs } of parsed.feldstuecke) {
    const feldstueck: Feldstueck = { ...fs, id: `${record.id}/fs${fs.nummer}`, importId: record.id };
    await tx.objectStore('feldstuecke').put(feldstueck);
    for (const s of schlaege) {
      await tx.objectStore('schlaege').put({
        ...s,
        id: `${feldstueck.id}/s${s.nummer}`,
        importId: record.id,
        feldstueckId: feldstueck.id,
      });
    }
  }

  await tx.done;
  return record;
}

export async function loadImportData(importId: string): Promise<ImportData | undefined> {
  const db = await getDb();
  const record = await db.get('imports', importId);
  if (!record || record.deleted) return undefined;
  const [feldstuecke, schlaege] = await Promise.all([
    db.getAllFromIndex('feldstuecke', 'importId', importId),
    db.getAllFromIndex('schlaege', 'importId', importId),
  ]);
  return { import: record, feldstuecke, schlaege };
}

export async function listOutbox(): Promise<OutboxEntry[]> {
  return (await getDb()).getAll('outbox');
}

function outboxEntry(record: Import, now: string): OutboxEntry {
  return { key: `imports/${record.id}`, store: 'imports', id: record.id, rev: record.rev, changedAt: now };
}
