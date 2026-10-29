// Loads development data: db/seed/dev.sql and the portal email template.
//
//   npm run db:seed
//
// Only for a local database: refuses anything but localhost, refuses to run
// in production, and refuses a database that already has cases (rebuild
// with `npm run db:reset`). Runs as portal_migrator on port 5432 in one
// transaction, so it either loads everything or nothing.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const url = process.env.MIGRATE_DATABASE_URL;
if (!url) throw new Error('Set MIGRATE_DATABASE_URL');
if (process.env.NODE_ENV === 'production') throw new Error('Development data is never loaded in production');
const host = new URL(url).hostname;
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  throw new Error(`Development data is only loaded into a local database, not ${host}`);
}

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'seed');
const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const { rows } = await client.query('SELECT count(*)::int AS n FROM lr.cases');
  if (rows[0].n > 0) {
    throw new Error('The database already has cases. Rebuild it with `npm run db:reset`.');
  }

  const sql = await readFile(path.join(dir, 'dev.sql'), 'utf8');
  const template = await readFile(path.join(dir, 'portal-email-template.html'), 'utf8');

  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query(
      `INSERT INTO portal.email_template (html, updated_by)
       VALUES ($1, (SELECT id FROM portal.users WHERE email = 'john.smith@bcpcouncil.test'))`,
      [template],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }

  const counts = await client.query(`
    SELECT (SELECT count(*) FROM portal.users)::int    AS users,
           (SELECT count(*) FROM lr.sessions)::int     AS sessions,
           (SELECT count(*) FROM lr.cases)::int        AS cases,
           (SELECT count(*) FROM lr.bookings)::int     AS bookings,
           (SELECT count(*) FROM lr.journal_entries)::int AS journal_entries`);
  console.log('Development data loaded:', counts.rows[0]);
} finally {
  await client.end();
}
