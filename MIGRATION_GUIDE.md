# Database Migration Guide

This guide explains how to safely manage database changes between development and production environments.

## 🛡️ Safe Migration Workflow

### Before Making Schema Changes

1. **Always backup production first:**
   ```bash
   tsx scripts/db-backup.ts production
   ```

2. **Compare schemas to see differences:**
   ```bash
   tsx scripts/db-compare.ts
   ```

### Making Schema Changes

1. **Update schema in `shared/schema.ts`**
   - Make your changes to the Drizzle schema

2. **Test in development:**
   ```bash
   npm run db:push
   ```
   
   If you get data conflicts:
   ```bash
   npm run db:push -- --force
   ```

3. **Verify the changes work:**
   - Test your application thoroughly
   - Check all CRUD operations
   - Verify data integrity

### Deploying to Production

**Option 1: Automated Safe Sync (Recommended)**

```bash
tsx scripts/db-sync-to-production.ts
```

This interactive script will:
- ✅ Automatically backup production
- 🔍 Show you what will change
- ⚠️ Ask for confirmation
- 🔄 Run the migration
- 💾 Keep backup for rollback

**Option 2: Manual Process**

```bash
# 1. Backup production
tsx scripts/db-backup.ts production

# 2. Preview changes
npm run db:push

# 3. Apply changes (with force if needed)
npm run db:push -- --force
```

## 🔄 Rollback Process

If something goes wrong after migration:

```bash
# Restore from backup
tsx scripts/db-restore.ts backups/backup-production-[timestamp].json
```

## 📋 Available Scripts

### `db-backup.ts`
Creates a JSON backup of all database tables.

```bash
# Backup development
tsx scripts/db-backup.ts development

# Backup production
tsx scripts/db-backup.ts production
```

**Output:** `backups/backup-[env]-[timestamp].json`

### `db-restore.ts`
Restores database from a backup file.

```bash
tsx scripts/db-restore.ts backups/backup-production-2025-10-21.json
```

⚠️ **Warning:** This overwrites existing data!

### `db-compare.ts`
Shows schema differences between environments.

```bash
# Requires PROD_DATABASE_URL environment variable
tsx scripts/db-compare.ts
```

### `db-sync-to-production.ts`
Interactive guided migration to production.

```bash
tsx scripts/db-sync-to-production.ts
```

## 🔧 Environment Variables

### Required
- `DATABASE_URL` - Your development database connection string

### Optional
- `PROD_DATABASE_URL` - Your production database connection string (for comparison)

## 📝 Best Practices

### ✅ DO:
- Always backup before migrations
- Test schema changes in development first
- Review migration preview before applying
- Keep backups for at least 30 days
- Document breaking changes

### ❌ DON'T:
- Never change primary key types (serial ↔ varchar)
- Don't skip backups "just this once"
- Don't apply untested migrations to production
- Don't delete backup files immediately after migration
- Don't rename tables/columns without data migration plan

## 🚨 Emergency Recovery

If production is broken after a migration:

1. **Immediate rollback:**
   ```bash
   tsx scripts/db-restore.ts backups/[latest-backup].json
   ```

2. **Check what went wrong:**
   - Review the migration output
   - Check error logs
   - Compare schemas

3. **Fix and retry:**
   - Fix the schema issue in development
   - Test thoroughly
   - Re-run the migration process

## 📊 Backup Management

Backups are stored in `backups/` directory:

```
backups/
├── backup-development-2025-10-21T10-00-00.json
├── backup-production-2025-10-21T09-30-00.json
└── backup-production-2025-10-20T14-15-00.json
```

**Retention Policy:**
- Keep daily backups for 7 days
- Keep weekly backups for 30 days
- Archive important milestone backups

**Manual cleanup:**
```bash
# Remove backups older than 30 days
find backups/ -name "*.json" -mtime +30 -delete
```

## 🔍 Troubleshooting

### "Cannot cast column to type numeric"

**Problem:** Existing data can't be converted to new type.

**Solution:**
```bash
npm run db:push -- --force
```

**Note:** This may lose data that can't be converted. Backup first!

### "Table does not exist"

**Problem:** Production missing tables from development.

**Solution:** This is normal for new features. The migration will create them.

### "Duplicate key violation"

**Problem:** Restore trying to insert existing data.

**Solution:** Truncate table first or use fresh database.

## 📞 Support

If you encounter issues:
1. Check the error message carefully
2. Review this guide's troubleshooting section
3. Restore from backup if needed
4. Test fixes in development first

---

**Remember:** When in doubt, backup first! 🛡️
