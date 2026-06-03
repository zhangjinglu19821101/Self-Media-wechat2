// Quick password reset script
const { db } = require('./src/lib/db/index.js');
const { accounts } = require('./src/lib/db/schema/auth.js');
const { eq } = require('drizzle-orm');
const { hashPassword } = require('./src/lib/auth/password.js');

const targetEmail = '891492905@qq.com';
const newPassword = 'Admin@123';

async function run() {
  console.log(`Resetting password for ${targetEmail}...`);
  
  try {
    // Find account
    const [account] = await db.select()
      .from(accounts)
      .where(eq(accounts.email, targetEmail))
      .limit(1);

    if (!account) {
      console.error('ERROR: Account not found');
      process.exit(1);
    }

    console.log(`Found account: ${account.name || account.email} (${account.id})`);

    // Hash password
    const passwordHash = await hashPassword(newPassword);

    // Update database
    await db.update(accounts)
      .set({
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, account.id));

    console.log('\n✅ SUCCESS! Password reset completed!');
    console.log(`   Email: ${targetEmail}`);
    console.log(`   New password: ${newPassword}`);
    
  } catch (error) {
    console.error('ERROR:', error);
    process.exit(1);
  }
}

run();
