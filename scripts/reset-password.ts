import { hashPassword } from "../src/lib/auth/password";
import { getDatabase } from "../src/lib/db";
import { accounts } from "../src/lib/db/schema/auth";
import { eq } from "drizzle-orm";

async function resetPassword() {
  console.log("🔑 密码重置工具");
  console.log("==================");

  const email = "891492905@qq.com";
  const newPassword = "Abcd1234!"; // 默认密码

  console.log(`- 账户邮箱: ${email}`);
  console.log(`- 新密码: ${newPassword}`);

  try {
    // 生成密码哈希
    console.log("\n🔐 生成密码哈希...");
    const passwordHash = await hashPassword(newPassword);
    console.log(`✓ 密码哈希已生成 (${passwordHash.length} 字符)`);

    // 更新数据库
    console.log("\n💾 更新数据库...");
    const db = getDatabase();

    const result = await db
      .update(accounts)
      .set({
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(accounts.email, email))
      .returning({
        id: accounts.id,
        email: accounts.email,
        name: accounts.name,
      });

    if (result.length === 0) {
      console.error("\n❌ 未找到该账户!");
      process.exit(1);
    }

    console.log("\n✅ 密码重置成功!");
    console.log("==================");
    console.log(`- 账户ID: ${result[0].id}`);
    console.log(`- 邮箱: ${result[0].email}`);
    console.log(`- 用户名: ${result[0].name}`);
    console.log(`- 登录密码: ${newPassword}`);
    console.log("\n⚠️  请用户登录后立即修改密码!");
  } catch (error) {
    console.error("\n❌ 密码重置失败:", error);
    process.exit(1);
  }
}

resetPassword();
