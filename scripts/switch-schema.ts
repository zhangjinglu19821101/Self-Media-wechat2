/**
 * Schema 切换脚本
 * 用法: npx tsx scripts/switch-schema.ts <schema名>
 * 示例: 
 *   npx tsx scripts/switch-schema.ts dev      → 切换到 dev_schema
 *   npx tsx scripts/switch-schema.ts public  → 切换到 public
 *   npx tsx scripts/switch-schema.ts current → 查看当前 schema
 */

import * as fs from 'fs';
import * as path from 'path';

const envLocalPath = path.join(__dirname, '..', '.env.local');

function getCurrentSchema(): string {
  try {
    const content = fs.readFileSync(envLocalPath, 'utf-8');
    const match = content.match(/DEV_SCHEMA=(\S+)/);
    return match ? match[1] : 'dev_schema';
  } catch {
    return 'dev_schema (默认)';
  }
}

function switchSchema(targetSchema: string) {
  let content = '';
  
  try {
    content = fs.readFileSync(envLocalPath, 'utf-8');
  } catch {
    console.log('❌ 找不到 .env.local 文件');
    process.exit(1);
  }

  // 标准化 schema 名称
  let schemaName = targetSchema.toLowerCase();
  if (schemaName === 'dev') schemaName = 'dev_schema';
  if (schemaName === 'prod') schemaName = 'public';
  
  // 验证 schema 名称
  const validSchemas = ['dev_schema', 'public'];
  if (!validSchemas.includes(schemaName)) {
    console.log(`❌ 无效的 schema: ${targetSchema}`);
    console.log(`   有效的 schema: dev, dev_schema, prod, public`);
    process.exit(1);
  }

  // 更新 DEV_SCHEMA
  if (content.includes('DEV_SCHEMA=')) {
    content = content.replace(/DEV_SCHEMA=\S*/, `DEV_SCHEMA=${schemaName}`);
  } else {
    content += `\nDEV_SCHEMA=${schemaName}`;
  }

  // 同步更新 PROD_SCHEMA（保持一致）
  if (content.includes('PROD_SCHEMA=')) {
    content = content.replace(/PROD_SCHEMA=\S*/, `PROD_SCHEMA=${schemaName}`);
  } else {
    content += `\nPROD_SCHEMA=${schemaName}`;
  }

  fs.writeFileSync(envLocalPath, content);
  console.log(`✅ 已切换到: ${schemaName}`);
  console.log(`\n⚠️  需要重启服务才能生效:`);
  console.log(`   pkill -f "next dev" && cd /workspace/projects/ai-venture && pnpm next dev --port 5000 -H 0.0.0.0`);
}

function showStatus() {
  const currentSchema = getCurrentSchema();
  console.log('\n=== Schema 状态 ===');
  console.log(`当前 DEV_SCHEMA: ${currentSchema}`);
  console.log('\n可用的 schema:');
  console.log('  - dev / dev_schema  → 开发环境数据（隔离）');
  console.log('  - prod / public     → 生产环境数据');
  console.log('\n切换命令:');
  console.log('  npx tsx scripts/switch-schema.ts dev     # 切换到开发 schema');
  console.log('  npx tsx scripts/switch-schema.ts public  # 切换到生产 schema');
}

// 主逻辑
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === 'current' || args[0] === 'status') {
  showStatus();
} else {
  switchSchema(args[0]);
}
