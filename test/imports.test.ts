import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { closeDb } from '../src/data/db';
import { findImportByFoerderart, listImports, listOutbox, loadImportData, saveImport } from '../src/data/imports';
import { decodeEamaXml, parseFeldstuecksliste } from '../src/domain/parser';

const xml = decodeEamaXml(readFileSync(join(process.cwd(), 'test/fixtures/feldstuecksliste-anonym.xml')));
const parsed = parseFeldstuecksliste(xml);

afterEach(async () => {
  await closeDb();
  indexedDB.deleteDatabase('feldblick');
});

describe('import repository', () => {
  it('stores an import with sync fields and derived records', async () => {
    const record = await saveImport(parsed, xml);
    expect(record).toMatchObject({ foerderart: 'MFA2026', deleted: false, rev: 1 });
    expect(record.id).toMatch(/^[0-9a-f-]{36}$/);

    const data = await loadImportData(record.id);
    expect(data!.feldstuecke).toHaveLength(3);
    expect(data!.schlaege).toHaveLength(4);
    const schlag = data!.schlaege.find((s) => s.nutzungsart.code === 'SG')!;
    expect(schlag.feldstueckId).toBe(`${record.id}/fs1`);

    expect(await listOutbox()).toEqual([
      expect.objectContaining({ store: 'imports', id: record.id, rev: 1 }),
    ]);
  });

  it('replaces an import of the same Förderart with a tombstone', async () => {
    const first = await saveImport(parsed, xml);
    const second = await saveImport(parsed, xml);

    expect((await listImports()).map((i) => i.id)).toEqual([second.id]);
    expect((await findImportByFoerderart('MFA2026'))!.id).toBe(second.id);
    expect(await loadImportData(first.id)).toBeUndefined();

    const outbox = await listOutbox();
    expect(outbox).toHaveLength(2);
    expect(outbox.find((e) => e.id === first.id)!.rev).toBe(2);
  });

  it('keeps imports of other years', async () => {
    await saveImport(parsed, xml);
    await saveImport({ ...parsed, foerderart: 'MFA2027' }, xml);
    expect((await listImports()).map((i) => i.foerderart)).toEqual(['MFA2027', 'MFA2026']);
  });
});
