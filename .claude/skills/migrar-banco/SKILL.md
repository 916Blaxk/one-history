---
name: migrar-banco
description: Generates a database migration, tests it on a copy of the data, backs up dados/ and applies it to the real database.
disable-model-invocation: true
---

Schema change requested: $ARGUMENTS

`dados/one-history.db` holds real data and this folder has no git history, so the backup is the only way back. Talk to the user in Brazilian Portuguese.

1. **Change the schema.** If the request above describes a change, make it in `lib/servidor/schema.ts`. Remember that there are no foreign keys, so a new relation needs its manual cleanup in `lib/servidor/rotas.ts`.

2. **Generate.** Run `npm run db:gerar`, then read the new `.sql` file in `migracoes/`.

3. **Review with the user.** Show the SQL and point out anything that can lose data or fail on existing rows: dropped tables or columns, rebuilt tables, or `NOT NULL` without a default. Wait for their approval. If they reject it, delete only the files this run generated, including its entries in `migracoes/meta/`, after confirming with them.

4. **Test on a copy.** Copy `dados/one-history.db` to a new folder in the temporary directory, then apply the migration to the copy by setting `DATABASE_URL=file:<path to the copy>` and running `node scripts/migrar.mjs`. Forward slashes are required in that path. If it fails, stop and report the error. Then run `/verificar`.

5. **Back up.** Ask the user to stop the site if it is running, and wait for their confirmation. Then copy the whole folder to `dados-backup-<YYYYMMDD-HHMMSS>` in the project root and confirm that the copied database has the same size as the original.

6. **Apply.** Run `npm run db:migrar`. The protection hook will ask the user to confirm.

7. **Report.** Give the user:
   - the name of the migration that was applied
   - the backup folder, which should be kept. To restore, stop the site and copy the backup over `dados/`.
   - a reminder that production applies this migration on its next `npm run build` or `npm start`, so `dados/` on the server should be backed up first
