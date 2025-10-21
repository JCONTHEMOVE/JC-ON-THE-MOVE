/**
 * Database Backup Script
 * Creates a JSON backup of all tables before migrations
 * Usage: tsx scripts/db-backup.ts [development|production]
 */

import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

const environment = process.argv[2] || "development";
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("❌ DATABASE_URL environment variable not set");
  process.exit(1);
}

const sql = neon(dbUrl);

// Tables to backup (in order to respect foreign key constraints on restore)
const TABLES = [
  "users",
  "leads",
  "contacts",
  "employee_stats",
  "mining_sessions",
  "mining_claims",
  "point_transactions",
  "rewards",
  "user_wallets",
  "treasury_wallets",
  "wallet_transactions",
  "supported_currencies",
  "notifications",
  "daily_checkins",
  "achievement_types",
  "employee_achievements",
  "faucet_config",
  "faucet_wallets",
  "faucet_claims",
  "faucet_revenue",
  "cashout_requests",
  "fraud_logs",
  "funding_deposits",
  "treasury_accounts",
  "treasury_withdrawals",
  "reserve_transactions",
  "wallet_accounts",
  "price_history",
  "shop_items",
  "help_requests",
  "gamification_config",
  "ad_impressions",
  "ad_clicks",
  "ad_completions",
  "weekly_leaderboards",
];

async function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "backups");
  const backupFile = path.join(
    backupDir,
    `backup-${environment}-${timestamp}.json`
  );

  // Create backups directory if it doesn't exist
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log(`📦 Starting ${environment} database backup...`);
  console.log(`📁 Backup location: ${backupFile}`);

  const backup: Record<string, any[]> = {};
  let totalRows = 0;

  for (const table of TABLES) {
    try {
      const rows = await sql(`SELECT * FROM ${table}`);
      backup[table] = rows;
      totalRows += rows.length;
      console.log(`✅ ${table}: ${rows.length} rows`);
    } catch (error: any) {
      console.log(`⚠️  ${table}: Table doesn't exist or error - ${error.message}`);
      backup[table] = [];
    }
  }

  // Save backup to file
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));

  console.log(`\n✅ Backup completed successfully!`);
  console.log(`📊 Total: ${totalRows} rows across ${Object.keys(backup).length} tables`);
  console.log(`💾 File: ${backupFile}`);
  console.log(`📏 Size: ${(fs.statSync(backupFile).size / 1024 / 1024).toFixed(2)} MB`);

  return backupFile;
}

backupDatabase()
  .then((file) => {
    console.log(`\n🎉 Backup saved to: ${file}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Backup failed:", error);
    process.exit(1);
  });
