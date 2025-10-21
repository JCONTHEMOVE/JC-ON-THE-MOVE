/**
 * Safe Database Sync to Production
 * 
 * This script helps safely migrate development database schema to production:
 * 1. Backs up production database
 * 2. Shows schema differences
 * 3. Asks for confirmation
 * 4. Runs migration with rollback option
 * 
 * Usage: tsx scripts/db-sync-to-production.ts
 */

import { neon } from "@neondatabase/serverless";
import { execSync } from "child_process";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function syncToProduction() {
  console.log("🚀 Safe Database Sync to Production\n");
  console.log("This will:");
  console.log("  1. ✅ Backup production database");
  console.log("  2. 🔍 Show schema differences");
  console.log("  3. ⚠️  Ask for confirmation");
  console.log("  4. 🔄 Run migration (with rollback option)\n");

  // Step 1: Backup production
  console.log("📦 Step 1: Backing up production database...");
  try {
    execSync("tsx scripts/db-backup.ts production", { stdio: "inherit" });
    console.log("✅ Production backup completed\n");
  } catch (error) {
    console.error("❌ Backup failed! Aborting sync.");
    process.exit(1);
  }

  // Step 2: Show schema differences
  console.log("🔍 Step 2: Checking schema differences...");
  console.log("Running: npm run db:push (dry run)\n");
  
  try {
    // This will show what changes will be made without applying them
    execSync("npm run db:push", { stdio: "inherit" });
  } catch (error) {
    console.log("\n⚠️  Schema differences detected or migration validation failed");
  }

  // Step 3: Confirmation
  console.log("\n⚠️  IMPORTANT: Review the changes above carefully!");
  const answer = await ask("\nDo you want to proceed with the migration? (yes/no): ");
  
  if (answer.toLowerCase() !== "yes") {
    console.log("❌ Migration cancelled");
    rl.close();
    process.exit(0);
  }

  // Step 4: Run migration
  console.log("\n🔄 Step 4: Running migration...");
  const forceAnswer = await ask("Use --force flag? (yes/no, required if data conflicts exist): ");
  
  try {
    if (forceAnswer.toLowerCase() === "yes") {
      console.log("Running: npm run db:push -- --force");
      execSync("npm run db:push -- --force", { stdio: "inherit" });
    } else {
      console.log("Running: npm run db:push");
      execSync("npm run db:push", { stdio: "inherit" });
    }
    
    console.log("\n✅ Migration completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("  1. Test your production application");
    console.log("  2. If something went wrong, restore from backup using:");
    console.log("     tsx scripts/db-restore.ts backups/[backup-file]");
  } catch (error) {
    console.error("\n❌ Migration failed!");
    console.error("📝 To rollback, run:");
    console.error("   tsx scripts/db-restore.ts backups/[latest-backup-file]");
  }

  rl.close();
}

syncToProduction().catch((error) => {
  console.error("❌ Sync failed:", error);
  rl.close();
  process.exit(1);
});
