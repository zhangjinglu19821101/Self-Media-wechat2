import { sql } from "drizzle-orm";
import { db } from "../index";

async function dropDailyTaskFKs() {
  console.log("Checking daily_task foreign keys...\n");
  
  // 查询 daily_task 表的外键
  const dailyTaskFKs = await db.execute(sql`
    SELECT
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'daily_task' 
      AND tc.constraint_type = 'FOREIGN KEY'
  `);
  
  console.log("Found FKs in daily_task:", dailyTaskFKs);
  
  // 删除外键
  for (const row of dailyTaskFKs) {
    const fkName = row.constraint_name;
    console.log(`\nDropping FK: ${fkName}`);
    await db.execute(sql.raw(`ALTER TABLE "daily_task" DROP CONSTRAINT IF EXISTS "${fkName}"`));
  }
  
  // 确认已删除
  const remaining = await db.execute(sql`
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE table_name = 'daily_task' AND constraint_type = 'FOREIGN KEY'
  `);
  
  console.log("\nRemaining FKs in daily_task:", remaining);
  console.log("\n✓ daily_task foreign keys dropped!");
  
  process.exit(0);
}

dropDailyTaskFKs().catch(e => {
  console.error(e);
  process.exit(1);
});
