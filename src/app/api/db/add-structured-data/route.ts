import { NextResponse } from 'next/server';

const SQL_STATEMENTS = [
  `ALTER TABLE agent_sub_tasks ADD COLUMN IF NOT EXISTS structured_data JSONB;`,
  `ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS structured_data JSONB;`,
  `ALTER TABLE daily_task ADD COLUMN IF NOT EXISTS structured_data JSONB;`,
];

export async function GET() {
  try {
    const postgres = (await import('postgres')).default;
    const sql = postgres(process.env.DATABASE_URL!);

    const results: { statement: string; success: boolean; error?: string }[] = [];

    for (const statement of SQL_STATEMENTS) {
      try {
        await sql.unsafe(statement);
        results.push({ statement, success: true });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ statement, success: false, error: msg });
      }
    }

    await sql.end();
    return NextResponse.json({ success: true, results });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
