-- add_can_view_reports migration
-- this migration does not change the schema; it populates a new
-- permissions flag for existing admin records to avoid accidental
-- lock‑out after enforcing the new authorization check.

UPDATE "Admin"
SET permissions = jsonb_set(coalesce(permissions, '{}'), '{canViewReports}', 'true'::jsonb)
WHERE (permissions->'canViewReports') IS NULL;
