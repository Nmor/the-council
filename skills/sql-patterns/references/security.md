
<!-- ============================================================
     Section: sql/security.md
     ============================================================ -->

# SQL Security

> Covers OWASP SQL specifics, RLS multi-tenancy, encryption, backups and privilege-escalation
> defence. Pointed at by the **Security** row in [../SKILL.md](../SKILL.md).
>
> Auto-fires on every `*.sql`, `migrations/**`, `db/**` file.
> Sister to `~/.claude/rules-library/common/security.md`. Standards:
> **OWASP SQL Injection Cheat Sheet**, **OWASP Database Security
> Cheat Sheet**, **CIS PostgreSQL / MySQL Benchmarks**,
> **PostgreSQL Row-Level Security**, **PCI-DSS** (cardholder
> data tables), **HIPAA** (PHI tables), **GDPR** (PII tables).
>
> **Size budget: 9 KB** — `token-budget.mjs --check`.

## Core Principle

**Least-privilege per role; multi-tenant isolation enforced at
the DB layer via RLS where possible; sensitive columns encrypted
at field level (pgcrypto, MySQL encryption, AWS KMS); audit
logging at column-level for sensitive operations; no DB role
shared between humans and services.**

## OWASP — SQL specifics

### A01 — Broken Access Control

```sql
-- Postgres Row-Level Security (RLS) — strong tenant isolation
alter table orders enable row level security;
alter table orders force row level security;

create policy orders_tenant_isolation
  on orders
  for all
  using (tenant_id = nullif(current_setting('app.tenant_id', true), '')::bigint)
  with check (tenant_id = nullif(current_setting('app.tenant_id', true), '')::bigint);

-- Validated tenant identity comes from the authenticated server context.
begin;
set local app.tenant_id = '42';
select id, tenant_id from orders;
commit;
```

Use a non-owner application role without SUPERUSER/BYPASSRLS. Set context in every
transaction, including pooled reuse; missing context must return no rows and reject
writes. Never use session-wide SET for request identity. FORCE RLS does not constrain
superusers/BYPASSRLS. A custom setting is not authentication: arbitrary SQL access
could change it, so do not expose this role to untrusted clients or accept tenant IDs
directly from a request without authorization.

### A02 — Cryptographic Failures

```sql
-- Postgres pgcrypto for field-level encryption
create extension if not exists pgcrypto;

create table users (
    id bigserial primary key,
    email text not null,
    ssn_encrypted bytea,  -- encrypted at rest
    ssn_hash bytea         -- for equality search
);

insert into users (email, ssn_encrypted, ssn_hash)
values (
    'user@example.com',
    pgp_sym_encrypt('123-45-6789', current_setting('app.kms_key')),
    digest('123-45-6789', 'sha256')
);

-- Search by hash, decrypt only when needed
select email, pgp_sym_decrypt(ssn_encrypted, current_setting('app.kms_key'))
from users
where ssn_hash = digest($1, 'sha256');
```

For PCI cardholder data: never store CVV / full PAN. Use Stripe
/ Adyen / Square — let the PSP hold the data.

### A03 — Injection (the canonical case)

Always parameterise. Application-layer (covered in
`no-discards.md` rule 1).

For dynamic table / column names within stored procs:

```sql
-- CORRECT — quote_ident escapes identifiers
execute 'select * from ' || quote_ident(table_name) || ' where id = $1'
  using id_value;

-- FORBIDDEN — string concat without escape
execute 'select * from ' || table_name || ' where id = ' || id;
```

### A07 — Authentication

```sql
-- Application user (read+write to app tables, NOTHING admin)
create role app_user noinherit;
grant connect on database mydb to app_user;
grant usage on schema public to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
revoke create on schema public from app_user;
alter role app_user set statement_timeout = '30s';

-- Report user (read-only)
create role report_user noinherit;
grant connect on database mydb to report_user;
grant select on all tables in schema public to report_user;
alter role report_user set statement_timeout = '5min';

-- Admin (humans only; MFA required at the IAM layer)
create role db_admin;
grant all on all tables in schema public to db_admin;
-- DB admin connects via SSO + audit log
```

### A09 — Logging

```sql
-- Postgres audit logging
create extension if not exists pgaudit;
alter system set pgaudit.log = 'write, ddl';
alter system set pgaudit.log_relation = on;
alter system set log_min_duration_statement = '500ms';  -- slow query log

-- Column-level audit for sensitive tables
create or replace function audit_user_changes() returns trigger as $$
begin
    insert into audit_log (table_name, op, actor, row_id, before, after, ts)
    values (
        TG_TABLE_NAME, TG_OP, session_user, NEW.id,
        case TG_OP when 'UPDATE' then to_jsonb(OLD) else null end,
        case TG_OP when 'DELETE' then null else to_jsonb(NEW) end,
        now()
    );
    return coalesce(NEW, OLD);
end $$ language plpgsql;

create trigger users_audit
  after insert or update or delete on users
  for each row execute function audit_user_changes();
```

Per `~/.claude/rules/common/audit-logging.md`.

## Multi-tenant isolation patterns

| Pattern | Tradeoffs |
| --- | --- |
| **Separate database per tenant** | Highest isolation; expensive at scale |
| **Schema per tenant** | Postgres native; good isolation; ~1000s of schemas before performance issues |
| **Shared schema + tenant_id column + RLS** | Most scalable; isolation enforced at DB; default pattern |
| **Shared schema + tenant_id column, app-layer filter** | Cheapest; isolation depends on every query getting WHERE right (risky) |

Prefer RLS for any new multi-tenant table.

## Backup + recovery (encryption)

```sql
-- Encrypted backups (pg_dump + age / gpg)
pg_dump -h db -d mydb -Fc \
  | age -r age1...recipient... \
  > backup-$(date +%F).dump.age

-- Point-in-time recovery (PITR) via continuous archiving
-- alter system set archive_mode = on;
-- alter system set archive_command = 'aws s3 cp %p s3://backups/%f';
```

Test restore quarterly. Backups you can't restore are
encryption-at-rest theatre.

## Privilege escalation defence

```sql
-- Default to invoker privileges; do not grant callers unnecessary elevation.
create function notify_admin(message text) returns void as $$
begin
    -- runs as caller
    perform pg_notify('admin', message);
end $$ language plpgsql;

-- Restrict execution even for an invoker function when access is sensitive.
revoke all on function notify_admin(text) from public;
grant execute on function notify_admin(text) to app_notifier;
```

Use SECURITY DEFINER only for a reviewed operation requiring owner privileges, with
a minimally privileged owner, fixed trusted `search_path`, schema-qualified objects,
and PUBLIC EXECUTE revoked in the same creation transaction before specific grants.
Invoker functions do not inherently escalate privilege; `pg_notify` alone is not
evidence of a privilege escalation. Test unauthorized execution and search-path attacks.

## Required tooling

```bash
# Postgres security audit
psql -c "select * from pg_roles;"          # who has what
psql -c "select * from pg_settings where name in ('log_statement', 'log_min_duration_statement');"

# Migration safety
squawk migrations/*.sql

# CVE scan (catches Postgres / MySQL CVEs via OS packages)
trivy filesystem /var/lib/postgresql

# RLS verification
psql -c "select schemaname, tablename, rowsecurity from pg_tables where rowsecurity = false and schemaname = 'public';"
```

## Cross-references

- `~/.claude/rules/common/security.md`
- `~/.claude/rules/common/secrets-management.md`
- `~/.claude/rules/common/audit-logging.md`
- `~/.claude/rules/common/gdpr-ccpa.md`
- `~/.claude/rules/common/data-retention.md`
- `~/.claude/rules/sql/no-discards.md`
- `~/.claude/rules/sql/coding-style.md`
- OWASP SQL Injection Cheat Sheet
- OWASP Database Security Cheat Sheet
- CIS PostgreSQL Benchmark
- PostgreSQL Row-Level Security
