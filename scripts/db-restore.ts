/**
 * Database Restore Script
 * Restores database from a JSON backup file
 * Usage: tsx scripts/db-restore.ts <backup-file-path>
 * 
 * WARNING: This will overwrite existing data!
 */

import { neon } from "@neondatabase/serverless";
import fs from "fs";

const backupFile = process.argv[2];

if (!backupFile) {
  console.error("❌ Please provide a backup file path");
  console.error("Usage: tsx scripts/db-restore.ts <backup-file-path>");
  process.exit(1);
}

if (!fs.existsSync(backupFile)) {
  console.error(`❌ Backup file not found: ${backupFile}`);
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("❌ DATABASE_URL environment variable not set");
  process.exit(1);
}

const sql = neon(dbUrl);

async function restoreDatabase() {
  console.log(`📥 Loading backup from: ${backupFile}`);
  
  const backup = JSON.parse(fs.readFileSync(backupFile, "utf-8"));
  const tables = Object.keys(backup);
  
  console.log(`📊 Found ${tables.length} tables in backup`);
  console.log(`\n⚠️  WARNING: This will overwrite existing data!`);
  console.log(`⏳ Starting restore in 5 seconds... (Ctrl+C to cancel)`);
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  let totalRows = 0;
  
  for (const table of tables) {
    const rows = backup[table];
    
    if (!rows || rows.length === 0) {
      console.log(`⏭️  ${table}: No data to restore`);
      continue;
    }
    
    try {
      // Truncate table first
      await sql(`TRUNCATE TABLE ${table} CASCADE`);
      
      // Insert rows one by one to handle conflicts
      let inserted = 0;
      for (const row of rows) {
        try {
          const columns = Object.keys(row);
          const values = Object.values(row);
          const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");
          
          await sql(
            `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
            values
          );
          inserted++;
        } catch (error: any) {
          console.log(`  ⚠️  Failed to insert row: ${error.message}`);
        }
      }
      
      totalRows += inserted;
      console.log(`✅ ${table}: ${inserted}/${rows.length} rows restored`);
    } catch (error: any) {
      console.log(`❌ ${table}: Restore failed - ${error.message}`);
    }
  }
  
  console.log(`\n✅ Restore completed!`);
  console.log(`📊 Total: ${totalRows} rows restored`);
}

restoreDatabase()
  .then(() => {
    console.log("\n🎉 Database restore completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Restore failed:", error);
    process.exit(1);
  });
