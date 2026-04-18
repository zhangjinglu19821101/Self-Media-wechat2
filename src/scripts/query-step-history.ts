import { db } from '@/lib/db';
import { stepHistory } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const records = await db
    .select()
    .from(stepHistory)
    .where(eq(stepHistory.commandResultId, '06d35021-47e8-44f4-ac50-6401fdb7b4d0'))
    .orderBy(stepHistory.orderIndex, stepHistory.createdAt);

  console.log('=== Step History Records (order_index=3) ===');
  const filteredRecords = records.filter(r => r.orderIndex === 3);
  console.log('Total records for order_index=3:', filteredRecords.length);
  
  filteredRecords.forEach((r, i) => {
    console.log('--- Record', i+1, '---');
    console.log('ID:', r.id);
    console.log('Agent Type:', r.agentType);
    console.log('Interaction Type:', r.interactionType);
    console.log('Request (first 500 chars):', JSON.stringify(r.requestContent)?.substring(0, 500));
    console.log('Response (first 500 chars):', JSON.stringify(r.responseContent)?.substring(0, 500));
    console.log('Created At:', r.createdAt);
    console.log('');
  });
}

main().catch(console.error);
