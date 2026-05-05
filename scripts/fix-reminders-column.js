#!/usr/bin/env node
import postgres from 'postgres';
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL || process.env.PGDATABASE_URL || '';

if (!DATABASE_URL) {
  console.error('DATABASE_URL not found');
  process.exit(1);
}

console.log('Connecting to database...');
const sql = postgres(DATABASE_URL, { ssl: 'require', max: 1 });

async function main() {
  try {
    console.log('Adding direction column to reminders...');
    await sql`
      ALTER TABLE reminders ADD COLUMN IF NOT EXISTS direction VARCHAR(20) NOT NULL DEFAULT 'outbound'
    `;
    console.log('✓ direction column added');

    console.log('Adding indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_reminders_direction ON reminders(direction)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_reminders_requester ON reminders(requester_name)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_reminders_assignee ON reminders(assignee_name)`;
    console.log('✓ indexes added');

    console.log('Checking existing data...');
    const count = await sql`SELECT COUNT(*) FROM reminders`;
    console.log('Reminders count:', count[0].count);

    console.log('\n✅ Migration complete!');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await sql.end();
  }
}

main();