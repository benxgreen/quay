// Runs db/migrations/*.sql in name order, each in its own transaction,
// and records what has run in public.schema_migrations.
//
//   MIGRATE_DATABASE_URL="postgres://portal_migrator:...@<server>.postgres.database.azure.com:5432/quay?sslmode=require" \
//     node db/scripts/migrate.mjs
//
// Always use port 5432 (direct), never 6432 (PgBouncer): migrations need a
// real session for DDL and the advisory lock below.
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const url = process.env.MIGRATE_DATABASE_URL;
if (!url) throw new Error('Set MIGRATE_DATABASE_URL');
if (/:6432\//.test(url)) throw new Error('Use port 5432 for migrations, not the PgBouncer port 6432');

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  // Stops two deploys migrating at the same time.
  await client.query('SELECT pg_advisory_lock(727001)');
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      name        text PRIMARY KEY,
      checksum    text NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )`);

  const done = new Map(
    (await client.query('SELECT name, checksum FROM public.schema_migrations')).rows
      .map((r) => [r.name, r.checksum]),
  );
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = await readFile(path.join(dir, file), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    if (done.has(file)) {
      if (done.get(file) !== checksum) {
        throw new Error(`${file} has changed since it was applied. Add a new migration instead of editing an old one.`);
      }
      continue;
    }
    process.stdout.write(`Applying ${file} … `);
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO public.schema_migrations (name, checksum) VALUES ($1, $2)', [file, checksum]);
      await client.query('COMMIT');
      console.log('done');
    } catch (err) {
      await client.query('ROLLBACK');
      console.log('failed');
      throw err;
    }
  }
  console.log('Up to date.');
} finally {
  await client.query('SELECT pg_advisory_unlock(727001)').catch(() => {});
  await client.end();
}
