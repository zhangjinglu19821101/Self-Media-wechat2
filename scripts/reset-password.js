#!/usr/bin/env node
/**
 * 快速重置指定邮箱账户的密码
 * 
 * 使用: node scripts/reset-password.js <email> [new-password]
 * 
 * 示例: node scripts/reset-password.js 891492905@qq.com Admin@123
 */

import { db } from '../src/lib/db/index.js';
import { accounts } from '../src/lib/db/schema/auth.js';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../src/lib/auth/password.js';

const args = process.argv.slice(2);

if (args.length < 1) {
  console.error('用法: node scripts/reset-password.js <email> [new-password]');
  process.exit(1);
}

const targetEmail = args[0];
const newPassword = args[1] || 'Admin@123';

console.log(`正在重置 ${targetEmail} 的密码为: ${newPassword}`);

try {
  // 1. 查询用户
  const [account] = await db.select()
    .from(accounts)
    .where(eq(accounts.email, targetEmail))
    .limit(1);

  if (!account) {
    console.error(`错误: 找不到邮箱 ${targetEmail} 对应的账户`);
    process.exit(1);
  }

  console.log(`找到账户: ${account.name || account.email} (${account.id})`);

  // 2. 生成密码哈希
  const passwordHash = await hashPassword(newPassword);

  // 3. 更新数据库
  await db.update(accounts)
    .set({
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, account.id));

  console.log('\n✅ 密码重置成功！');
  console.log(`   邮箱: ${targetEmail}`);
  console.log(`   新密码: ${newPassword}`);
  console.log(`   账户状态: ${account.status}`);
  console.log(`\n请使用上述新密码登录！`);

  process.exit(0);

} catch (error) {
  console.error('❌ 密码重置失败:', error);
  process.exit(1);
}
