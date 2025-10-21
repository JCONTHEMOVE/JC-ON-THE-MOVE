# Database Migration - Quick Reference Card

## 🚀 Most Common Commands

### Before Deploying to Production

```bash
# 1. Backup production database
npm run db:backup:prod

# 2. Use the automated sync (RECOMMENDED)
npm run db:sync
```

The sync script will:
- ✅ Auto-backup production
- 🔍 Show what will change
- ⚠️ Ask for your approval
- 🔄 Run the migration safely

### Emergency Rollback

```bash
# Restore from latest backup
npm run db:restore backups/[filename].json
```

### Check Schema Differences

```bash
npm run db:compare
```

## 📋 All Available Commands

| Command | What It Does |
|---------|-------------|
| `npm run db:backup` | Backup development database |
| `npm run db:backup:prod` | Backup production database |
| `npm run db:restore [file]` | Restore from backup file |
| `npm run db:compare` | Compare dev vs prod schemas |
| `npm run db:sync` | **Interactive production sync (RECOMMENDED)** |
| `npm run db:push` | Push schema to dev database |
| `npm run db:push -- --force` | Force push (may lose data) |

## 🛡️ Safety Checklist

Before deploying schema changes:

- [ ] Backup production (`npm run db:backup:prod`)
- [ ] Test changes in development
- [ ] Review migration preview
- [ ] Use `npm run db:sync` for guided process
- [ ] Keep backup file until verified working

## ⚡ Quick Troubleshooting

**"Cannot cast column to type"**
→ Use `npm run db:push -- --force` (backups first!)

**"Need to rollback"**
→ `npm run db:restore backups/[latest-file].json`

**"Check what changed"**
→ `npm run db:compare`

---

For detailed information, see [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)
