-- Veges incremental migration: reusable organization test environments and
-- their test-space assignments. Human-facing values are encrypted by the
-- application; name_lookup is a keyed blind index used for uniqueness.

begin;

create table if not exists test_environments (
  id bigserial primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  name text not null,
  name_lookup text not null,
  access_url text not null,
  created_by_user_id bigint references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists test_environment_spaces (
  test_environment_id bigint not null references test_environments(id) on delete cascade,
  test_space_id bigint not null references test_spaces(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (test_environment_id, test_space_id)
);

alter table test_bugs
  add column if not exists test_environment_id bigint references test_environments(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'test_bugs_test_environment_id_fkey'
      and conrelid = 'test_bugs'::regclass
  ) then
    alter table test_bugs
      add constraint test_bugs_test_environment_id_fkey
      foreign key (test_environment_id)
      references test_environments(id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'test_bugs_environment_space_fkey'
      and conrelid = 'test_bugs'::regclass
  ) then
    alter table test_bugs
      add constraint test_bugs_environment_space_fkey
      foreign key (test_environment_id, test_space_id)
      references test_environment_spaces(test_environment_id, test_space_id)
      on delete set null (test_environment_id);
  end if;
end $$;

create index if not exists idx_test_environments_organization_id
  on test_environments(organization_id, updated_at desc);

create unique index if not exists idx_test_environments_organization_name_lookup
  on test_environments(organization_id, name_lookup);

create index if not exists idx_test_environment_spaces_space_id
  on test_environment_spaces(test_space_id, test_environment_id);

create index if not exists idx_test_environment_spaces_environment_id
  on test_environment_spaces(test_environment_id, test_space_id);

create index if not exists idx_test_bugs_environment_id
  on test_bugs(test_environment_id, updated_at desc)
  where test_environment_id is not null;

commit;
