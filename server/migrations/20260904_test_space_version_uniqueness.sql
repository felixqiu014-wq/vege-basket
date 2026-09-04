-- Veges incremental migration: organization-scoped unique test-space versions.
-- The lookup is a keyed blind index; the human-facing version remains encrypted.

begin;

alter table test_spaces
  add column if not exists version_label_lookup text;

create unique index if not exists idx_test_spaces_organization_version_lookup
  on test_spaces(organization_id, version_label_lookup)
  where organization_id is not null and version_label_lookup is not null;

commit;
