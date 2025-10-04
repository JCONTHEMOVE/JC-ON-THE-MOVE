import { db } from './server/db.js';
import { treasuryAccounts } from './shared/schema.js';
import { eq } from 'drizzle-orm';

const [account] = await db
  .select()
  .from(treasuryAccounts)
  .where(eq(treasuryAccounts.isActive, true))
  .limit(1);

console.log('Raw account from DB:', JSON.stringify(account, null, 2));
console.log('\nToken Reserve:');
console.log('  Raw value:', account.tokenReserve);
console.log('  Type:', typeof account.tokenReserve);
console.log('  Parsed:', parseFloat(account.tokenReserve));

process.exit(0);
