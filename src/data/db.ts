import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Feldstueck, Import, Schlag } from '../domain/types';

/** A synced record that changed locally and still has to be pushed. */
export interface OutboxEntry {
  key: string; // `${store}/${id}`
  store: SyncedStore;
  id: string;
  rev: number;
  changedAt: string;
}

export type SyncedStore = 'imports';

export interface FeldblickDB extends DBSchema {
  imports: { key: string; value: Import; indexes: { foerderart: string } };
  feldstuecke: { key: string; value: Feldstueck; indexes: { importId: string } };
  schlaege: { key: string; value: Schlag; indexes: { importId: string } };
  outbox: { key: string; value: OutboxEntry };
}

export type DB = IDBPDatabase<FeldblickDB>;

const DB_NAME = 'feldblick';

let dbPromise: Promise<DB> | undefined;

export function getDb(): Promise<DB> {
  dbPromise ??= openDB<FeldblickDB>(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore('imports', { keyPath: 'id' }).createIndex('foerderart', 'foerderart');
      db.createObjectStore('feldstuecke', { keyPath: 'id' }).createIndex('importId', 'importId');
      db.createObjectStore('schlaege', { keyPath: 'id' }).createIndex('importId', 'importId');
      db.createObjectStore('outbox', { keyPath: 'key' });
    },
  });
  return dbPromise;
}

/** For tests: forget the cached connection. */
export async function closeDb(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = undefined;
}
