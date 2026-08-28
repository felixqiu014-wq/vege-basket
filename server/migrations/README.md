# Incremental database migrations

`server/schema.ts` remains the idempotent bootstrap schema used by the application
and by `db:init`. Every change to a table, constraint, or index must also add a new
timestamped SQL file in this directory. Migration files are append-only: do not
edit a file after it has been applied, and do not add an automatic down migration.

For each schema change:

1. Add the forward-only SQL to a new file named
   `YYYYMMDD_<short-description>.sql`.
2. Keep the corresponding idempotent definition in `server/schema.ts` so a fresh
   database and a legacy database can converge on the same shape.
3. Add or update schema assertions in the relevant server test.
4. Apply pending files in filename order before deploying code that depends on them.

The current migrations are:

| File | Change |
| --- | --- |
| `20260828_organization_package_market_policy.sql` | Adds organization feature settings, independent release/CI package-market policies, selected rule rows, and the lookup index. |
| `20260828_organization_package_market_policy_excluded_mode.sql` | Extends the channel-policy mode constraint with the `excluded` deny-list mode. |
| `20260828_organization_package_market_policy_shared_selection.sql` | Adds one canonical organization-wide visibility range and safely derives it from legacy channel policies without broadening package access. |

Run a migration only against the explicitly selected `DATABASE_URL`, after taking
the required backup and receiving authorization for that environment:

```bash
psql "$DATABASE_URL" --set=ON_ERROR_STOP=1 \
  --file=server/migrations/20260828_organization_package_market_policy.sql
psql "$DATABASE_URL" --set=ON_ERROR_STOP=1 \
  --file=server/migrations/20260828_organization_package_market_policy_excluded_mode.sql
psql "$DATABASE_URL" --set=ON_ERROR_STOP=1 \
  --file=server/migrations/20260828_organization_package_market_policy_shared_selection.sql
```

The file is wrapped in one transaction and can be retried safely when all existing
objects have the same definition. The application does not automatically execute
versioned migration files at startup; `schema.ts` is a compatibility safeguard,
not a replacement for recording and applying the incremental files.
