The scheduled worker runs hourly after checking `MAINTENANCE_MODE`.
Deploy it only after the legacy evidence import and initial derived repair are verified.
It needs D1 only; do not add `AUTH_SECRET` or sender credentials.

Operator health query (investigate when `needs_attention = 1`):

```sql
SELECT last_success_at, last_failure_at, last_error,
       CASE WHEN last_success_at IS NULL
              OR (julianday('now') - julianday(last_success_at)) * 1440 > 75
            THEN 1 ELSE 0 END AS needs_attention,
       CAST((julianday('now') - julianday(last_success_at)) * 1440 AS INTEGER)
         AS minutes_since_success
FROM maintenance_status WHERE id = 1;
```

Pending users:

```sql
SELECT user_id, revision, published_revision, last_error, updated_at
FROM user_derived_state
WHERE revision != published_revision
ORDER BY updated_at;
```
