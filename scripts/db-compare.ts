/**
 * Database Schema Comparison Tool
 * Compares table structures between development and production
 * 
 * Usage: tsx scripts/db-compare.ts
 */

import { neon } from "@neondatabase/serverless";

const devUrl = process.env.DATABASE_URL;
const prodUrl = process.env.PROD_DATABASE_URL || devUrl; // Falls back to same DB if PROD not set

async function compareSchemas() {
  console.log("🔍 Comparing Development vs Production Database Schemas\n");
  
  if (devUrl === prodUrl) {
    console.log("⚠️  Note: PROD_DATABASE_URL not set, comparing to same database");
    console.log("   Set PROD_DATABASE_URL to compare different databases\n");
  }

  const devSql = neon(devUrl!);
  const prodSql = neon(prodUrl);

  // Get table list from both databases
  const devTables = await devSql(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);

  const prodTables = await prodSql(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);

  const devTableNames = devTables.map((t: any) => t.table_name);
  const prodTableNames = prodTables.map((t: any) => t.table_name);

  // Tables only in dev
  const devOnly = devTableNames.filter((t: string) => !prodTableNames.includes(t));
  // Tables only in prod
  const prodOnly = prodTableNames.filter((t: string) => !devTableNames.includes(t));
  // Tables in both
  const common = devTableNames.filter((t: string) => prodTableNames.includes(t));

  console.log("📊 Table Summary:");
  console.log(`  • Common tables: ${common.length}`);
  console.log(`  • Development-only: ${devOnly.length}`);
  console.log(`  • Production-only: ${prodOnly.length}\n`);

  if (devOnly.length > 0) {
    console.log("🆕 Tables only in DEVELOPMENT:");
    devOnly.forEach((t: string) => console.log(`  • ${t}`));
    console.log();
  }

  if (prodOnly.length > 0) {
    console.log("🏭 Tables only in PRODUCTION:");
    prodOnly.forEach((t: string) => console.log(`  • ${t}`));
    console.log();
  }

  // Compare column structures for common tables
  console.log("🔎 Comparing Column Structures for Common Tables:\n");
  
  for (const table of common) {
    const devColumns = await devSql(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [table]);

    const prodColumns = await prodSql(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `, [table]);

    const devColNames = devColumns.map((c: any) => c.column_name);
    const prodColNames = prodColumns.map((c: any) => c.column_name);

    const devOnlyCols = devColNames.filter((c: string) => !prodColNames.includes(c));
    const prodOnlyCols = prodColNames.filter((c: string) => !devColNames.includes(c));

    if (devOnlyCols.length > 0 || prodOnlyCols.length > 0) {
      console.log(`⚠️  ${table}:`);
      
      if (devOnlyCols.length > 0) {
        console.log(`   New columns in dev: ${devOnlyCols.join(", ")}`);
      }
      
      if (prodOnlyCols.length > 0) {
        console.log(`   Missing in dev: ${prodOnlyCols.join(", ")}`);
      }
      
      console.log();
    }
  }

  console.log("✅ Schema comparison complete!");
}

compareSchemas().catch((error) => {
  console.error("❌ Comparison failed:", error);
  process.exit(1);
});
