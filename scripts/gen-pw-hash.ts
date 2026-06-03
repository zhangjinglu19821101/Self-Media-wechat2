import bcrypt from "bcryptjs";

const email = "891492905@qq.com";
const newPassword = "Abcd1234!";

// 生成密码哈希
const saltRounds = 12;
const passwordHash = await bcrypt.hash(newPassword, saltRounds);

console.log("密码哈希:", passwordHash);
console.log("\n执行 SQL:");
console.log(`
UPDATE accounts 
SET password_hash = '${passwordHash}',
    failed_login_attempts = 0,
    locked_until = NULL,
    updated_at = NOW()
WHERE email = '${email}';
`);
