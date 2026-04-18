
import { db } from '@/lib/db';
import { agentSubTasksStepHistory } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkArticle() {
  const commandResultId = '58ea520c-e7f1-4c27-bd24-2b3aab034066';
  
  console.log('🔍 检查 commandResultId:', commandResultId);
  
  const records = await db
    .select()
    .from(agentSubTasksStepHistory)
    .where(eq(agentSubTasksStepHistory.commandResultId, commandResultId as any))
    .orderBy(agentSubTasksStepHistory.stepNo, agentSubTasksStepHistory.interactNum);
  
  console.log(`\n📊 找到 ${records.length} 条记录\n`);
  
  for (const record of records) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Step ${record.stepNo}, Interact ${record.interactNum}, Type: ${record.interactType}, User: ${record.interactUser}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    const content = record.interactContent as any;
    
    if (content?.execution_result) {
      console.log('\n✅ 找到 execution_result:');
      console.log(typeof content.execution_result);
      
      if (typeof content.execution_result === 'string') {
        try {
          const parsed = JSON.parse(content.execution_result);
          console.log('\n📝 解析后的内容:');
          console.log(JSON.stringify(parsed, null, 2).substring(0, 2000));
        } catch (e) {
          console.log('\n📝 原始字符串内容:');
          console.log(content.execution_result.substring(0, 2000));
        }
      } else {
        console.log('\n📝 对象内容:');
        console.log(JSON.stringify(content.execution_result, null, 2).substring(0, 2000));
      }
    }
    
    if (content?.response) {
      console.log('\n📋 找到 response:');
      console.log('Keys:', Object.keys(content.response));
      
      if (content.response.final_conclusion) {
        console.log('\n🎯 final_conclusion:');
        console.log(content.response.final_conclusion);
      }
    }
  }
}

checkArticle().catch(console.error);

