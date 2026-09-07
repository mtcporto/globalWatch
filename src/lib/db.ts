import { createClient, type Client, type InStatement } from '@libsql/client/web';

const databaseUrl = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

let client: Client | null = null;
let schemaPromise: Promise<void> | null = null;

function getClient(): Client | null {
  if (!databaseUrl) {
    return null;
  }

  if (!client) {
    client = createClient({
      url: databaseUrl,
      authToken,
    });
  }

  return client;
}

async function ensureSchema(): Promise<Client | null> {
  const database = getClient();
  if (!database) {
    return null;
  }

  schemaPromise ??= database.execute(`
    CREATE TABLE IF NOT EXISTS source_records (
      source TEXT NOT NULL,
      raw_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (source, raw_id)
    )
  `).then(() => undefined);

  await schemaPromise;
  return database;
}

export interface CachedRecord<T> {
  rawId: string;
  payload: T;
  updatedAt: number;
}

export async function getCachedRecords<T>(source: string): Promise<CachedRecord<T>[]> {
  try {
    const database = await ensureSchema();
    if (!database) {
      return [];
    }

    const result = await database.execute({
      sql: 'SELECT raw_id, payload, updated_at FROM source_records WHERE source = ? ORDER BY updated_at DESC',
      args: [source],
    });

    return result.rows.flatMap(row => {
      try {
        return [{
          rawId: String(row.raw_id),
          payload: JSON.parse(String(row.payload)) as T,
          updatedAt: Number(row.updated_at),
        }];
      } catch {
        return [];
      }
    });
  } catch (error) {
    console.error(`[database] Failed to read cached ${source} records`, error);
    return [];
  }
}

export async function getCachedRecord<T>(source: string, rawId: string): Promise<CachedRecord<T> | null> {
  try {
    const database = await ensureSchema();
    if (!database) {
      return null;
    }

    const result = await database.execute({
      sql: 'SELECT raw_id, payload, updated_at FROM source_records WHERE source = ? AND raw_id = ?',
      args: [source, rawId],
    });
    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      rawId: String(row.raw_id),
      payload: JSON.parse(String(row.payload)) as T,
      updatedAt: Number(row.updated_at),
    };
  } catch (error) {
    console.error(`[database] Failed to read cached ${source}/${rawId}`, error);
    return null;
  }
}

export async function saveRecords<T extends { rawId: string }>(source: string, records: T[]): Promise<void> {
  try {
    const database = await ensureSchema();
    if (!database || records.length === 0) {
      return;
    }

    const updatedAt = Date.now();
    const statements: InStatement[] = records.map(record => ({
      sql: `
        INSERT INTO source_records (source, raw_id, payload, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(source, raw_id) DO UPDATE SET
          payload = excluded.payload,
          updated_at = excluded.updated_at
      `,
      args: [source, record.rawId, JSON.stringify(record), updatedAt],
    }));

    await database.batch(statements, 'write');
  } catch (error) {
    console.error(`[database] Failed to save cached ${source} records`, error);
  }
}
