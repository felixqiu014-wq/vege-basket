export const schemaSql = `
create table if not exists users (
  id bigserial primary key,
  email text not null unique,
  display_name text not null default '',
  password_hash text not null default '',
  account_status text not null default 'active'
    check (account_status in ('active', 'disabled', 'departed')),
  disabled_at timestamptz,
  disabled_by_user_id bigint references users(id) on delete set null,
  departed_at timestamptz,
  departed_by_user_id bigint references users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table users add column if not exists display_name text not null default '';
alter table users add column if not exists feishu_user_id text not null default '';
alter table users add column if not exists feishu_receive_id_type text not null default 'user_id';
alter table users add column if not exists feishu_email text not null default '';
alter table users add column if not exists account_status text not null default 'active';
alter table users add column if not exists disabled_at timestamptz;
alter table users add column if not exists disabled_by_user_id bigint references users(id) on delete set null;
alter table users add column if not exists departed_at timestamptz;
alter table users add column if not exists departed_by_user_id bigint references users(id) on delete set null;

alter table users
  drop constraint if exists users_account_status_check;

alter table users
  add constraint users_account_status_check
  check (account_status in ('active', 'disabled', 'departed'));

update users
set feishu_email = feishu_user_id
where feishu_email = ''
  and feishu_user_id like '%@%';

drop table if exists ai_settings;

create table if not exists sessions (
  token text primary key,
  user_id bigint not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table sessions
  add column if not exists active_role text not null default 'developer';

create table if not exists user_roles (
  user_id bigint not null references users(id) on delete cascade,
  role text not null check (role in ('developer', 'tester', 'delivery', 'organization_admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists image_sync_workflow_runs (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  dispatch_key uuid not null default gen_random_uuid(),
  image_ref_encrypted text not null,
  architecture text not null check (architecture in ('amd64', 'arm64')),
  status text not null
    check (status in ('dispatching', 'queued', 'in_progress', 'completed', 'failed')),
  conclusion text,
  github_run_id bigint unique,
  github_run_url text,
  progress jsonb not null default '[]'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_synced_at timestamptz,
  next_sync_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table image_sync_workflow_runs
  add column if not exists dispatch_key uuid;
update image_sync_workflow_runs
set dispatch_key = gen_random_uuid()
where dispatch_key is null;
alter table image_sync_workflow_runs
  alter column dispatch_key set default gen_random_uuid();
alter table image_sync_workflow_runs
  alter column dispatch_key set not null;
alter table image_sync_workflow_runs
  add column if not exists next_sync_at timestamptz not null default now();

-- The delivery persona was folded into developer. Preserve existing accounts by
-- moving the legacy assignment before tightening the role constraint.
insert into user_roles (user_id, role)
select user_id, 'developer'
from user_roles
where role = 'delivery'
on conflict do nothing;

delete from user_roles where role = 'delivery';

update sessions
set active_role = 'developer'
where active_role = 'delivery';

alter table user_roles
  drop constraint if exists user_roles_role_check;

alter table user_roles
  add constraint user_roles_role_check
  check (role in ('developer', 'tester', 'organization_admin'));

create table if not exists organizations (
  id bigserial primary key,
  owner_user_id bigint not null references users(id) on delete restrict,
  name text not null,
  name_lookup text not null,
  week_starts_on smallint not null default 1 check (week_starts_on between 1 and 7),
  weekly_report_open_day smallint not null default 5,
  weekly_report_open_time time not null default '00:00',
  weekly_report_close_day smallint not null default 1,
  weekly_report_close_time time not null default '23:59',
  feishu_tenant_key text not null default '',
  created_by_user_id bigint references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name_lookup)
);

alter table organizations
  add column if not exists feishu_tenant_key text not null default '',
  add column if not exists week_starts_on smallint not null default 1,
  add column if not exists weekly_report_open_day smallint not null default 5,
  add column if not exists weekly_report_open_time time not null default '00:00',
  add column if not exists weekly_report_close_day smallint not null default 1,
  add column if not exists weekly_report_close_time time not null default '23:59';

-- Keep this idempotent definition synchronized with the versioned package-market migrations.
create table if not exists organization_feature_settings (
  organization_id bigint not null references organizations(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  revision integer not null default 0 check (revision >= 0),
  updated_by_user_id bigint references users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, feature_key)
);

create table if not exists organization_package_market_channel_policies (
  organization_id bigint not null references organizations(id) on delete cascade,
  channel text not null check (channel in ('release', 'ci')),
  enabled boolean not null default true,
  mode text not null default 'all' check (mode in ('all', 'selected', 'excluded')),
  updated_by_user_id bigint references users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, channel)
);

-- Existing databases created before the excluded mode need their named check
-- constraint replaced; CREATE TABLE IF NOT EXISTS does not evolve it.
do $$
declare
  existing_mode_constraint text;
begin
  select pg_get_constraintdef(constraint_row.oid)
    into existing_mode_constraint
  from pg_constraint constraint_row
  where constraint_row.conrelid = 'organization_package_market_channel_policies'::regclass
    and constraint_row.conname = 'organization_package_market_channel_policies_mode_check';

  if existing_mode_constraint is null then
    alter table organization_package_market_channel_policies
      add constraint organization_package_market_channel_policies_mode_check
      check (mode in ('all', 'selected', 'excluded'));
  elsif position('excluded' in existing_mode_constraint) = 0 then
    alter table organization_package_market_channel_policies
      drop constraint organization_package_market_channel_policies_mode_check;
    alter table organization_package_market_channel_policies
      add constraint organization_package_market_channel_policies_mode_check
      check (mode in ('all', 'selected', 'excluded'));
  end if;
end
$$;

create table if not exists organization_package_market_selections (
  organization_id bigint not null references organizations(id) on delete cascade,
  channel text not null check (channel in ('release', 'ci')),
  rule_id text not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, channel, rule_id)
);

-- The organization now owns one visibility range shared by every enabled
-- channel. Channel rows retain only their on/off state in the current model;
-- their legacy mode/selection fields are mirrored for a controlled rollback.
create table if not exists organization_package_market_selection_policies (
  organization_id bigint not null references organizations(id) on delete cascade,
  mode text not null default 'all' check (mode in ('all', 'selected', 'excluded')),
  updated_by_user_id bigint references users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (organization_id)
);

create table if not exists organization_package_market_selection_rules (
  organization_id bigint not null references organizations(id) on delete cascade,
  rule_id text not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, rule_id)
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_week_starts_on_check'
      and conrelid = 'organizations'::regclass
  ) then
    alter table organizations
      add constraint organizations_week_starts_on_check
      check (week_starts_on between 1 and 7);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_weekly_report_rule_days_check'
      and conrelid = 'organizations'::regclass
  ) then
    alter table organizations
      add constraint organizations_weekly_report_rule_days_check
      check (
        weekly_report_open_day between 1 and 7
        and weekly_report_close_day between 1 and 7
        and (
          weekly_report_close_day < weekly_report_open_day
          or (
            weekly_report_close_day = weekly_report_open_day
            and weekly_report_close_time < weekly_report_open_time
          )
        )
      );
  end if;
end
$$;

create table if not exists organization_memberships (
  organization_id bigint not null references organizations(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  access_role text not null default 'member'
    check (access_role in ('owner', 'admin', 'member')),
  status text not null default 'active'
    check (status in ('active', 'removed')),
  invited_by_user_id bigint references users(id) on delete set null,
  joined_at timestamptz not null default now(),
  removed_at timestamptz,
  primary key (organization_id, user_id)
);

create table if not exists organization_invitations (
  id bigserial primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  invited_by_user_id bigint references users(id) on delete set null,
  target_email text not null,
  target_email_lookup text not null,
  target_open_id text not null,
  target_tenant_key text not null default '',
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'revoked', 'expired', 'delivery_failed')),
  expires_at timestamptz not null,
  responded_by_user_id bigint references users(id) on delete set null,
  feishu_message_id text not null default '',
  last_error text not null default '',
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create table if not exists organization_callback_events (
  event_id text primary key,
  invitation_id bigint references organization_invitations(id) on delete set null,
  received_at timestamptz not null default now()
);

create table if not exists organization_invite_links (
  id bigserial primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  created_by_user_id bigint references users(id) on delete set null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create table if not exists organization_audit_events (
  id bigserial primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  actor_user_id bigint references users(id) on delete set null,
  action text not null,
  subject_type text not null,
  subject_id text not null default '',
  detail text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists account_offboarding_records (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references users(id) on delete restrict,
  actor_user_id bigint not null references users(id) on delete restrict,
  status text not null default 'completed'
    check (status in ('completed')),
  organization_targets jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists account_offboarding_asset_transfers (
  id bigserial primary key,
  offboarding_id uuid not null references account_offboarding_records(id) on delete cascade,
  organization_id bigint references organizations(id) on delete set null,
  asset_type text not null check (asset_type in ('project', 'test_space', 'todo', 'test_bug')),
  asset_id bigint not null,
  previous_assignee_user_id bigint references users(id) on delete set null,
  next_assignee_user_id bigint references users(id) on delete set null,
  previous_owner_user_id bigint references users(id) on delete set null,
  next_owner_user_id bigint references users(id) on delete set null,
  action text not null check (action in ('transferred', 'unassigned')),
  created_at timestamptz not null default now()
);

create table if not exists account_offboarding_notifications (
  id bigserial primary key,
  offboarding_id uuid not null references account_offboarding_records(id) on delete cascade,
  recipient_user_id bigint not null references users(id) on delete cascade,
  summary text not null,
  created_at timestamptz not null default now(),
  unique (offboarding_id, recipient_user_id)
);

create table if not exists organization_weekly_reports (
  id bigserial primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  week_start date not null,
  content text not null default '',
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (organization_id, user_id, week_start)
);

alter table organization_weekly_reports
  add column if not exists draft_content text not null default '',
  add column if not exists draft_version integer not null default 1,
  add column if not exists draft_source_mode text not null default 'manual';

update organization_weekly_reports
set draft_content = content
where draft_content = '' and content <> '';

do $$
begin
  alter table organization_weekly_reports
    add constraint organization_weekly_reports_draft_source_mode_check
    check (draft_source_mode in ('manual', 'ai'));
exception
  when duplicate_object then null;
end $$;

create table if not exists organization_weekly_report_revisions (
  id bigserial primary key,
  report_id bigint not null references organization_weekly_reports(id) on delete cascade,
  revision_number integer not null check (revision_number > 0),
  draft_version integer not null default 1 check (draft_version > 0),
  content text not null,
  source_mode text not null default 'manual' check (source_mode in ('manual', 'ai')),
  submitted_by_user_id bigint references users(id) on delete set null,
  submitted_at timestamptz not null default now(),
  unique (report_id, revision_number),
  unique (id, report_id)
);

alter table organization_weekly_report_revisions
  add column if not exists draft_version integer not null default 1;

alter table organization_weekly_reports
  add column if not exists published_revision_id bigint
    references organization_weekly_report_revisions(id) on delete set null;

insert into organization_weekly_report_revisions (
  report_id,
  revision_number,
  content,
  source_mode,
  submitted_by_user_id,
  submitted_at
)
select report.id, 1, report.content, report.draft_source_mode, report.user_id,
  coalesce(report.submitted_at, report.updated_at)
from organization_weekly_reports report
where report.status = 'submitted'
  and not exists (
    select 1 from organization_weekly_report_revisions revision
    where revision.report_id = report.id
  )
on conflict (report_id, revision_number) do nothing;

update organization_weekly_reports report
set published_revision_id = revision.id
from organization_weekly_report_revisions revision
where revision.report_id = report.id
  and report.status = 'submitted'
  and report.published_revision_id is null
  and revision.revision_number = (
    select max(candidate.revision_number)
    from organization_weekly_report_revisions candidate
    where candidate.report_id = report.id
  );

create table if not exists organization_weekly_report_reminders (
  id bigserial primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  target_user_id bigint not null references users(id) on delete cascade,
  requested_by_user_id bigint references users(id) on delete set null,
  week_start date not null,
  reminder_day date not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  last_error text not null default '',
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, target_user_id, week_start, reminder_day)
);

create table if not exists organization_weekly_summaries (
  id bigserial primary key,
  organization_id bigint not null references organizations(id) on delete cascade,
  week_start date not null,
  requested_by_user_id bigint references users(id) on delete set null,
  content text not null,
  source_report_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, week_start)
);

-- Organization owners are also organization administrators. Keep this
-- idempotent so existing organizations receive the same capability as new ones.
insert into user_roles (user_id, role)
select owner_user_id, 'organization_admin'
from organizations
on conflict (user_id, role) do nothing;

insert into user_roles (user_id, role)
select id, 'developer'
from users
where not exists (
  select 1 from user_roles where user_roles.user_id = users.id
)
on conflict (user_id, role) do nothing;

create table if not exists projects (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  name text not null,
  status text not null default 'active',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table projects
  add column if not exists organization_id bigint references organizations(id) on delete restrict;

alter table projects
  add column if not exists tags_encrypted text;

alter table projects
  add column if not exists description_encrypted text;

alter table projects
  add column if not exists health_status text not null default 'on_track',
  add column if not exists health_note_encrypted text;

alter table projects
  drop constraint if exists projects_health_status_check;

alter table projects
  add constraint projects_health_status_check
  check (health_status in ('on_track', 'at_risk', 'off_track'));

update projects
set tags_encrypted = array_to_json(tags)::text
where tags_encrypted is null;

create table if not exists project_memberships (
  id bigserial primary key,
  project_id bigint not null references projects(id) on delete cascade,
  owner_user_id bigint not null references users(id) on delete cascade,
  invited_user_id bigint references users(id) on delete cascade,
  invited_email text not null,
  invited_email_lookup text,
  role text not null default 'member',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  declined_at timestamptz,
  unique (project_id, invited_email)
);

alter table project_memberships
  add column if not exists invited_email_lookup text;

alter table project_memberships
  add column if not exists declined_at timestamptz;

create table if not exists project_invite_links (
  id bigserial primary key,
  project_id bigint not null references projects(id) on delete cascade,
  owner_user_id bigint not null references users(id) on delete cascade,
  token text not null unique,
  password_hash text not null default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

alter table project_invite_links
  add column if not exists expires_at timestamptz;

alter table project_invite_links
  add column if not exists password_hash text not null default '';

update project_invite_links
set expires_at = created_at + interval '10 minutes'
where expires_at is null;

alter table project_invite_links
  alter column expires_at set not null;

create table if not exists project_transfer_requests (
  id bigserial primary key,
  project_id bigint not null references projects(id) on delete cascade,
  organization_id bigint not null references organizations(id) on delete cascade,
  requested_by_user_id bigint not null references users(id) on delete cascade,
  target_user_id bigint not null references users(id) on delete cascade,
  target_open_id text not null,
  token_hash text not null unique,
  status text not null default 'pending',
  feishu_message_id text not null default '',
  last_error text not null default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '72 hours',
  responded_by_user_id bigint references users(id) on delete set null,
  responded_at timestamptz,
  check (status in ('pending', 'accepted', 'declined', 'expired', 'revoked', 'delivery_failed'))
);

alter table project_transfer_requests
  add column if not exists organization_id bigint references organizations(id) on delete cascade;

alter table project_transfer_requests
  add column if not exists requested_by_user_id bigint references users(id) on delete cascade;

alter table project_transfer_requests
  add column if not exists target_user_id bigint references users(id) on delete cascade;

alter table project_transfer_requests
  add column if not exists target_open_id text not null default '';

alter table project_transfer_requests
  add column if not exists token_hash text;

alter table project_transfer_requests
  add column if not exists status text not null default 'pending';

alter table project_transfer_requests
  add column if not exists feishu_message_id text not null default '';

alter table project_transfer_requests
  add column if not exists last_error text not null default '';

alter table project_transfer_requests
  add column if not exists expires_at timestamptz not null default now() + interval '72 hours';

alter table project_transfer_requests
  add column if not exists responded_by_user_id bigint references users(id) on delete set null;

alter table project_transfer_requests
  add column if not exists responded_at timestamptz;

create table if not exists project_transfer_callback_events (
  event_id text primary key,
  transfer_request_id bigint not null references project_transfer_requests(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists journal_entries (
  id bigserial primary key,
  project_id bigint not null references projects(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table journal_entries
  add column if not exists author_user_id bigint references users(id) on delete set null,
  add column if not exists visibility text not null default 'private';

update journal_entries
set author_user_id = projects.user_id
from projects
where journal_entries.project_id = projects.id
  and journal_entries.author_user_id is null;

create table if not exists todos (
  id bigserial primary key,
  project_id bigint not null references projects(id) on delete cascade,
  title text not null,
  detail text not null default '',
  due_date date not null,
  priority text not null default 'medium',
  done boolean not null default false,
  confirmation_status text not null default 'confirmed'
    check (confirmation_status in ('confirmed', 'pending_review', 'rejected', 'acceptance_failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_modules (
  id bigserial primary key,
  project_id bigint not null references projects(id) on delete cascade,
  name text not null default '',
  created_at timestamptz not null default now(),
  unique (project_id, name)
);

create table if not exists collaborators (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  project_id bigint not null references projects(id) on delete cascade,
  name text not null,
  name_lookup text,
  role text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table collaborators
  add column if not exists name_lookup text;

alter table todos
  add column if not exists collaborator_id bigint references collaborators(id) on delete set null;

alter table todos
  add column if not exists created_by_user_id bigint references users(id) on delete set null;

alter table todos
  add column if not exists detail text not null default '';

alter table todos
  add column if not exists assignee_user_id bigint references users(id) on delete set null,
  add column if not exists assigned_by_user_id bigint references users(id) on delete set null,
  add column if not exists assigned_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by_user_id bigint references users(id) on delete set null;

alter table todos
  add column if not exists watcher_user_id bigint references users(id) on delete set null,
  add column if not exists watched_by_user_id bigint references users(id) on delete set null,
  add column if not exists watched_at timestamptz;

create table if not exists todo_watchers (
  todo_id bigint not null references todos(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  watched_by_user_id bigint references users(id) on delete set null,
  watched_at timestamptz not null default now(),
  primary key (todo_id, user_id)
);

insert into todo_watchers (todo_id, user_id, watched_by_user_id, watched_at)
select id, watcher_user_id, watched_by_user_id, coalesce(watched_at, now())
from todos
where watcher_user_id is not null
on conflict (todo_id, user_id) do nothing;

alter table todos
  add column if not exists reviewer_user_id bigint references users(id) on delete set null;

alter table todos
  add column if not exists project_module_id bigint references project_modules(id) on delete set null;

alter table todos
  add column if not exists confirmation_status text not null default 'confirmed';

alter table todos
  drop constraint if exists todos_confirmation_status_check;

alter table todos
  add constraint todos_confirmation_status_check
  check (confirmation_status in ('confirmed', 'pending_review', 'rejected', 'acceptance_failed'));

create table if not exists project_milestones (
  id bigserial primary key,
  project_id bigint not null references projects(id) on delete cascade,
  title text not null,
  acceptance_criteria text not null default '',
  execution_note text not null default '',
  baseline_date date not null,
  target_date date not null,
  responsible_user_id bigint references users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'in_review', 'achieved', 'cancelled')),
  sort_order integer not null default 0,
  created_by_user_id bigint references users(id) on delete set null,
  updated_by_user_id bigint references users(id) on delete set null,
  submitted_by_user_id bigint references users(id) on delete set null,
  submitted_at timestamptz,
  completed_by_user_id bigint references users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table project_milestones
  drop constraint if exists project_milestones_status_check;

alter table project_milestones
  add constraint project_milestones_status_check
  check (status in ('pending', 'in_review', 'achieved', 'cancelled'));

create unique index if not exists idx_todos_id_project_id_unique
  on todos(id, project_id);

create unique index if not exists idx_project_milestones_id_project_id_unique
  on project_milestones(id, project_id);

create table if not exists project_milestone_todos (
  milestone_id bigint not null,
  todo_id bigint not null,
  project_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (milestone_id, todo_id),
  foreign key (milestone_id, project_id)
    references project_milestones(id, project_id) on delete cascade,
  foreign key (todo_id, project_id)
    references todos(id, project_id) on delete cascade
);

create table if not exists project_milestone_events (
  id bigserial primary key,
  milestone_id bigint not null references project_milestones(id) on delete cascade,
  project_id bigint not null references projects(id) on delete cascade,
  actor_user_id bigint references users(id) on delete set null,
  event_type text not null
    check (event_type in ('created', 'updated', 'submitted', 'achieved', 'reopened', 'cancelled')),
  detail text not null default '',
  created_at timestamptz not null default now()
);

alter table todos
  drop column if exists confirmed;

update todos
set created_by_user_id = projects.user_id
from projects
where todos.project_id = projects.id
  and todos.created_by_user_id is null;

create table if not exists todo_activity_events (
  id bigserial primary key,
  project_id bigint not null references projects(id) on delete cascade,
  todo_id bigint references todos(id) on delete set null,
  actor_user_id bigint references users(id) on delete set null,
  assignee_user_id bigint references users(id) on delete set null,
  event_type text not null
    check (event_type in ('created', 'completed', 'reopened', 'assigned', 'confirmed', 'rejected', 'acceptance_failed')),
  title text not null,
  due_date date not null,
  priority text not null default 'medium',
  occurred_at timestamptz not null default now()
);

alter table todo_activity_events
  drop constraint if exists todo_activity_events_event_type_check;

alter table todo_activity_events
  add constraint todo_activity_events_event_type_check
  check (event_type in ('created', 'completed', 'reopened', 'assigned', 'confirmed', 'rejected', 'acceptance_failed'));

create table if not exists risks (
  id bigserial primary key,
  project_id bigint not null references projects(id) on delete cascade,
  content text not null,
  journal_entry_id bigint references journal_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, content)
);

create table if not exists draft_items (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  source text not null default 'manual',
  item_type text not null default 'journal',
  todo_title text,
  content text not null,
  todo_due_date date,
  todo_priority text,
  suggested_project_id bigint references projects(id) on delete set null,
  processed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table draft_items
  add column if not exists item_type text not null default 'journal',
  add column if not exists todo_title text,
  add column if not exists todo_due_date date,
  add column if not exists todo_priority text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'draft_items_item_type_check'
      and conrelid = 'draft_items'::regclass
  ) then
    alter table draft_items
      add constraint draft_items_item_type_check
      check (item_type in ('journal', 'todo'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'draft_items_todo_fields_check'
      and conrelid = 'draft_items'::regclass
  ) then
    alter table draft_items
      add constraint draft_items_todo_fields_check
      check (
        (item_type = 'journal' and todo_title is null and todo_due_date is null and todo_priority is null)
        or
        (item_type = 'todo' and todo_title is not null and todo_due_date is not null and todo_priority in ('high', 'medium', 'low'))
      );
  end if;
end
$$;

create table if not exists ai_conversations (
  id uuid primary key,
  user_id bigint not null references users(id) on delete cascade,
  project_id bigint references projects(id) on delete cascade,
  context_kind text not null
    check (context_kind in ('general', 'project', 'conversation-analysis')),
  title text not null,
  next_turn_no integer not null default 1 check (next_turn_no > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_turn_at timestamptz not null default now(),
  check (
    (context_kind = 'project' and project_id is not null)
    or (context_kind <> 'project' and project_id is null)
  )
);

create table if not exists ai_conversation_tombstones (
  conversation_id uuid primary key,
  user_id bigint not null references users(id) on delete cascade,
  deleted_at timestamptz not null default now()
);

create table if not exists ai_turn_cancellations (
  user_id bigint not null references users(id) on delete cascade,
  conversation_id uuid not null,
  turn_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, turn_id)
);

create table if not exists ai_intent_classifications (
  user_id bigint not null references users(id) on delete cascade,
  turn_id uuid not null,
  input_digest text not null
    check (input_digest ~ '^veges:mac:[^:]+:[A-Za-z0-9_-]{43}$'),
  source_context_kind text not null
    check (source_context_kind in ('general', 'project', 'conversation-analysis')),
  source_project_id bigint,
  status text not null
    check (status in ('processing', 'completed', 'failed', 'consumed')),
  intent_payload text,
  error_code text,
  attempt_count integer not null default 1 check (attempt_count > 0),
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  consumed_at timestamptz,
  primary key (user_id, turn_id),
  unique (turn_id),
  check (
    (source_context_kind = 'project' and source_project_id is not null and source_project_id > 0)
    or (source_context_kind <> 'project' and source_project_id is null)
  ),
  check (
    (
      status = 'processing'
      and intent_payload is null
      and error_code is null
      and lease_token is not null
      and lease_until is not null
      and completed_at is null
      and consumed_at is null
    )
    or (
      status = 'completed'
      and intent_payload is not null
      and error_code is null
      and lease_token is null
      and lease_until is null
      and completed_at is not null
      and consumed_at is null
    )
    or (
      status = 'failed'
      and intent_payload is null
      and error_code is not null
      and lease_token is null
      and lease_until is null
      and completed_at is null
      and consumed_at is null
    )
    or (
      status = 'consumed'
      and intent_payload is not null
      and error_code is null
      and lease_token is null
      and lease_until is null
      and completed_at is not null
      and consumed_at is not null
    )
  )
);

create index if not exists ai_intent_classifications_cleanup_idx
  on ai_intent_classifications(updated_at);

create table if not exists ai_turns (
  id uuid primary key,
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  turn_no integer not null check (turn_no > 0),
  intent_kind text not null
    check (intent_kind in ('chat', 'project-summary', 'todo-extraction', 'conversation-analysis', 'workspace-review')),
  intent_payload text,
  status text not null
    check (status in ('processing', 'completed', 'failed', 'cancelled')),
  user_content text not null,
  assistant_content text,
  error_code text,
  attempt_count integer not null default 1 check (attempt_count > 0),
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (conversation_id, turn_no),
  check (
    (
      status = 'processing'
      and assistant_content is null
      and error_code is null
      and lease_token is not null
      and lease_until is not null
      and completed_at is null
    )
    or (
      status = 'completed'
      and assistant_content is not null
      and error_code is null
      and lease_token is null
      and lease_until is null
      and completed_at is not null
    )
    or (
      status in ('failed', 'cancelled')
      and assistant_content is null
      and error_code is not null
      and lease_token is null
      and lease_until is null
      and completed_at is null
    )
  )
);

create table if not exists ai_turn_attachments (
  id bigserial primary key,
  turn_id uuid not null references ai_turns(id) on delete cascade,
  ordinal smallint not null check (ordinal between 0 and 3),
  name text not null,
  media_type text not null,
  size_bytes integer not null check (size_bytes between 1 and 65536),
  content_characters integer not null check (content_characters between 1 and 20000),
  content text not null,
  created_at timestamptz not null default now(),
  unique (turn_id, ordinal)
);

create table if not exists ai_turn_project_sources (
  turn_id uuid not null references ai_turns(id) on delete cascade,
  project_id bigint not null,
  primary key (turn_id, project_id)
);

create table if not exists feishu_ai_chats (
  user_id bigint not null references users(id) on delete cascade,
  chat_id text not null,
  conversation_id uuid references ai_conversations(id) on delete set null,
  source_message_id text not null default '',
  source_content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, chat_id)
);

create table if not exists feishu_ai_messages (
  message_id text primary key,
  user_id bigint not null references users(id) on delete cascade,
  sender_open_id text not null,
  chat_id text not null,
  message_type text not null,
  event_content text not null default '',
  request_turn_id uuid not null default gen_random_uuid(),
  request_conversation_id uuid not null default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  conversation_id uuid references ai_conversations(id) on delete set null,
  turn_id uuid references ai_turns(id) on delete set null,
  response_message_id text not null default '',
  last_error text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check (
    (status = 'processing' and lease_token is not null and lease_until is not null)
    or (status <> 'processing' and lease_token is null and lease_until is null)
  )
);

alter table feishu_ai_messages
  add column if not exists sender_open_id text not null default '';
alter table feishu_ai_messages
  add column if not exists request_turn_id uuid not null default gen_random_uuid();
alter table feishu_ai_messages
  add column if not exists request_conversation_id uuid not null default gen_random_uuid();

create table if not exists ai_todo_proposal_batches (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  source_filename text not null,
  source_content text not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'discarded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists feishu_ai_callback_events (
  event_id text primary key,
  user_id bigint not null references users(id) on delete cascade,
  batch_id bigint references ai_todo_proposal_batches(id) on delete set null,
  action text not null,
  created_at timestamptz not null default now()
);

alter table ai_todo_proposal_batches
  add column if not exists source_turn_id uuid;

alter table ai_turns
  add column if not exists intent_payload text;

do $$
declare
  intent_constraint_definition text;
begin
  select pg_get_constraintdef(oid)
  into intent_constraint_definition
  from pg_constraint
  where conname = 'ai_turns_intent_kind_check'
    and conrelid = 'ai_turns'::regclass;

  if intent_constraint_definition is null
     or position('workspace-review' in intent_constraint_definition) = 0 then
    alter table ai_turns
      drop constraint if exists ai_turns_intent_kind_check;
    alter table ai_turns
      add constraint ai_turns_intent_kind_check
      check (intent_kind in ('chat', 'project-summary', 'todo-extraction', 'conversation-analysis', 'workspace-review'));
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'ai_todo_proposal_batches_source_turn_id_fkey'
      and conrelid = 'ai_todo_proposal_batches'::regclass
      and confdeltype <> 'n'
  ) then
    alter table ai_todo_proposal_batches
      drop constraint ai_todo_proposal_batches_source_turn_id_fkey;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_todo_proposal_batches_source_turn_id_fkey'
      and conrelid = 'ai_todo_proposal_batches'::regclass
  ) then
    alter table ai_todo_proposal_batches
      add constraint ai_todo_proposal_batches_source_turn_id_fkey
      foreign key (source_turn_id) references ai_turns(id) on delete set null;
  end if;
end
$$;

create table if not exists ai_todo_proposals (
  id bigserial primary key,
  batch_id bigint not null references ai_todo_proposal_batches(id) on delete cascade,
  proposal_key text not null,
  project_id bigint references projects(id) on delete set null,
  project_module_id bigint references project_modules(id) on delete set null,
  assignee_user_id bigint references users(id) on delete set null,
  title text not null,
  detail text not null default '',
  due_date date,
  priority text not null default 'medium',
  confidence double precision not null default 0,
  source_excerpt text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, proposal_key)
);

create table if not exists summaries (
  id bigserial primary key,
  user_id bigint references users(id) on delete cascade,
  project_id bigint not null references projects(id) on delete cascade,
  type text not null,
  title text not null,
  period text not null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table summaries
  add column if not exists user_id bigint references users(id) on delete cascade;

update summaries
set user_id = projects.user_id
from projects
where summaries.project_id = projects.id
  and summaries.user_id is null;

alter table summaries
  alter column project_id drop not null;

alter table summaries
  add column if not exists source_turn_id uuid references ai_turns(id) on delete set null;

create table if not exists notification_states (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  kind text not null,
  source_id bigint not null,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, source_id)
);

create table if not exists project_integrations (
  id bigserial primary key,
  project_id bigint not null references projects(id) on delete cascade,
  provider text not null,
  target_type text not null,
  target_id text not null default '',
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, provider, target_type)
);

create table if not exists notification_deliveries (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  kind text not null,
  source_id bigint not null,
  channel text not null,
  target_type text not null,
  target_id text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text not null default '',
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kind, source_id, channel, target_type, target_id)
);

create table if not exists notification_subscriptions (
  id bigserial primary key,
  user_id bigint not null references users(id) on delete cascade,
  kind text not null default 'daily_todo_digest',
  channel text not null default 'feishu',
  enabled boolean not null default false,
  timezone text not null default 'Asia/Shanghai',
  local_send_time time not null default '10:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind, channel)
);

create table if not exists notification_digest_runs (
  id bigserial primary key,
  subscription_id bigint not null references notification_subscriptions(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  kind text not null default 'daily_todo_digest',
  local_date date not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'retry', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  content text not null default '',
  last_error text not null default '',
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id, local_date)
);

create table if not exists project_package_events (
  id bigserial primary key,
  project_id bigint not null references projects(id) on delete cascade,
  type text not null default 'upgrade',
  status text not null default 'draft',
  title text not null,
  created_by_user_id bigint references users(id) on delete set null,
  assignee_user_id bigint references users(id) on delete set null,
  assigned_by_user_id bigint references users(id) on delete set null,
  assigned_at timestamptz,
  delivery_date date not null default current_date,
  delivery_start_at timestamptz not null default (current_date::timestamp at time zone 'Asia/Shanghai'),
  delivery_end_at timestamptz not null default ((current_date::timestamp + interval '1 day' - interval '1 second') at time zone 'Asia/Shanghai'),
  published_at timestamptz,
  published_by_user_id bigint references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Existing events were already visible and notified immediately after creation.
-- Mark them published only when this column is first introduced so future drafts
-- remain unpublished across repeated schema initialization.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'project_package_events'
      and column_name = 'published_at'
  ) then
    alter table project_package_events
      add column published_at timestamptz,
      add column published_by_user_id bigint references users(id) on delete set null;

    update project_package_events
    set published_at = created_at,
        published_by_user_id = created_by_user_id;
  end if;
end $$;

alter table project_package_events
  add column if not exists status text not null default 'draft';

alter table project_package_events
  alter column status set default 'draft';

alter table project_package_events
  add column if not exists assignee_user_id bigint references users(id) on delete set null,
  add column if not exists assigned_by_user_id bigint references users(id) on delete set null,
  add column if not exists assigned_at timestamptz;

alter table project_package_events
  add column if not exists delivery_date date not null default current_date;

alter table project_package_events
  add column if not exists delivery_start_at timestamptz,
  add column if not exists delivery_end_at timestamptz;

update project_package_events
set delivery_start_at = (delivery_date::timestamp at time zone 'Asia/Shanghai'),
    delivery_end_at = ((delivery_date::timestamp + interval '1 day' - interval '1 second') at time zone 'Asia/Shanghai')
where delivery_start_at is null
   or delivery_end_at is null;

alter table project_package_events
  alter column delivery_start_at set default (current_date::timestamp at time zone 'Asia/Shanghai'),
  alter column delivery_end_at set default ((current_date::timestamp + interval '1 day' - interval '1 second') at time zone 'Asia/Shanghai'),
  alter column delivery_start_at set not null,
  alter column delivery_end_at set not null;

alter table project_package_events
  add column if not exists published_at timestamptz,
  add column if not exists published_by_user_id bigint references users(id) on delete set null;

update project_package_events
set status = case
  when published_at is null then 'draft'
  when status in ('delivered', 'success') then 'delivered'
  else 'delivering'
end
where status not in ('draft', 'delivering', 'delivered')
   or (published_at is null and status <> 'draft')
   or (published_at is not null and status = 'draft');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_package_events_lifecycle_check'
      and conrelid = 'project_package_events'::regclass
  ) then
    alter table project_package_events
      add constraint project_package_events_lifecycle_check
      check (
        (published_at is null and status = 'draft')
        or (published_at is not null and status in ('delivering', 'delivered'))
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_package_events_delivery_window_check'
      and conrelid = 'project_package_events'::regclass
  ) then
    alter table project_package_events
      add constraint project_package_events_delivery_window_check
      check (delivery_start_at < delivery_end_at);
  end if;
end $$;

create index if not exists idx_project_package_events_assignee
  on project_package_events (assignee_user_id, created_at desc);

create index if not exists idx_project_package_events_publication
  on project_package_events (project_id, published_at, created_at desc);

create unique index if not exists idx_project_package_events_id_project_id_unique
  on project_package_events(id, project_id);

create table if not exists organization_weekly_report_sources (
  id bigserial primary key,
  report_id bigint not null references organization_weekly_reports(id) on delete cascade,
  revision_id bigint,
  project_id bigint not null references projects(id) on delete cascade,
  todo_id bigint,
  package_event_id bigint,
  milestone_id bigint,
  created_at timestamptz not null default now(),
  foreign key (revision_id, report_id)
    references organization_weekly_report_revisions(id, report_id) on delete cascade,
  foreign key (todo_id, project_id)
    references todos(id, project_id) on delete cascade,
  foreign key (package_event_id, project_id)
    references project_package_events(id, project_id) on delete cascade,
  foreign key (milestone_id, project_id)
    references project_milestones(id, project_id) on delete cascade,
  check (num_nonnulls(todo_id, package_event_id, milestone_id) = 1)
);

create unique index if not exists idx_organization_weekly_report_sources_identity
  on organization_weekly_report_sources (
    report_id,
    coalesce(revision_id, 0),
    project_id,
    coalesce(todo_id, 0),
    coalesce(package_event_id, 0),
    coalesce(milestone_id, 0)
  );

create table if not exists project_package_groups (
  id bigserial primary key,
  project_package_event_id bigint not null references project_package_events(id) on delete cascade,
  package_name text not null,
  created_at timestamptz not null default now(),
  unique (project_package_event_id, package_name)
);

create table if not exists project_package_items (
  id bigserial primary key,
  project_package_group_id bigint not null references project_package_groups(id) on delete cascade,
  source_package_id text not null default '',
  source_package_name text not null default '',
  channel text not null default 'release',
  channel_label text not null default '',
  arch text not null default 'amd64',
  version text not null default '',
  object_key text not null default '',
  object_last_modified timestamptz,
  size_bytes bigint,
  created_by_user_id bigint references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists project_package_operations (
  id bigserial primary key,
  project_package_event_id bigint not null references project_package_events(id) on delete cascade,
  project_package_group_id bigint references project_package_groups(id) on delete cascade,
  kind text not null default 'document',
  status text not null default 'pending',
  title text not null default '',
  label text not null default '',
  content text not null default '',
  completed boolean not null default false,
  auto_generated boolean not null default false,
  created_by_user_id bigint references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep the package group and its parent event as an inseparable identity.
-- The constraint is deliberately not validated so legacy rows can be cleaned
-- up without blocking schema initialization; all new writes are checked.
create unique index if not exists idx_project_package_groups_id_event_unique
  on project_package_groups(id, project_package_event_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_package_operations_group_event_fkey'
      and conrelid = 'project_package_operations'::regclass
  ) then
    alter table project_package_operations
      add constraint project_package_operations_group_event_fkey
      foreign key (project_package_group_id, project_package_event_id)
      references project_package_groups(id, project_package_event_id)
      on delete cascade
      not valid;
  end if;
end $$;

alter table project_package_operations
  add column if not exists completed boolean not null default false;

alter table project_package_operations
  add column if not exists status text not null default 'pending';

create table if not exists project_package_operation_todos (
  project_package_operation_id bigint not null references project_package_operations(id) on delete cascade,
  todo_id bigint not null references todos(id) on delete cascade,
  note text not null default '',
  note_author_user_id bigint references users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (project_package_operation_id, todo_id)
);

alter table project_package_operation_todos
  add column if not exists note text not null default '';

alter table project_package_operation_todos
  add column if not exists note_author_user_id bigint references users(id) on delete set null;

create table if not exists project_package_event_comments (
  id bigserial primary key,
  project_package_event_id bigint not null references project_package_events(id) on delete cascade,
  author_user_id bigint references users(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists idx_project_package_event_comments_event
  on project_package_event_comments(project_package_event_id, created_at, id);

create table if not exists todo_notes (
  id bigserial primary key,
  todo_id bigint not null references todos(id) on delete cascade,
  author_user_id bigint references users(id) on delete set null,
  content text not null default '',
  kind text not null default 'normal',
  source_operation_id bigint references project_package_operations(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table todo_notes
  add column if not exists kind text not null default 'normal';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'todo_notes_kind_check'
      and conrelid = 'todo_notes'::regclass
  ) then
    alter table todo_notes
      add constraint todo_notes_kind_check
      check (kind in ('normal', 'acceptance'));
  end if;
end
$$;

create unique index if not exists idx_todo_notes_source_operation_unique
  on todo_notes(todo_id, source_operation_id)
  where source_operation_id is not null;

create table if not exists todo_note_mentions (
  id bigserial primary key,
  todo_note_id bigint not null references todo_notes(id) on delete cascade,
  mentioned_user_id bigint not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (todo_note_id, mentioned_user_id)
);

create table if not exists todo_mentions (
  id bigserial primary key,
  todo_id bigint not null references todos(id) on delete cascade,
  mentioned_user_id bigint not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (todo_id, mentioned_user_id)
);

create table if not exists test_spaces (
  id bigserial primary key,
  owner_user_id bigint not null references users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table test_spaces
  add column if not exists organization_id bigint references organizations(id) on delete restrict,
  add column if not exists version_label text;

create table if not exists test_space_memberships (
  test_space_id bigint not null references test_spaces(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  access_level text not null default 'editor'
    check (access_level in ('owner', 'editor', 'viewer')),
  status text not null default 'active'
    check (status in ('pending', 'active', 'declined')),
  invited_by_user_id bigint references users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  declined_at timestamptz,
  primary key (test_space_id, user_id)
);

alter table test_space_memberships
  add column if not exists status text not null default 'active',
  add column if not exists invited_by_user_id bigint references users(id) on delete set null,
  add column if not exists accepted_at timestamptz,
  add column if not exists declined_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'test_space_memberships_status_check'
  ) then
    alter table test_space_memberships
      add constraint test_space_memberships_status_check
      check (status in ('pending', 'active', 'declined'));
  end if;
end $$;

create table if not exists test_space_invite_links (
  id bigserial primary key,
  test_space_id bigint not null references test_spaces(id) on delete cascade,
  owner_user_id bigint not null references users(id) on delete cascade,
  token text not null unique,
  password_hash text not null default '',
  access_level text not null default 'editor'
    check (access_level in ('editor', 'viewer')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create table if not exists test_subjects (
  id bigserial primary key,
  test_space_id bigint not null references test_spaces(id) on delete cascade,
  project_id bigint references projects(id) on delete set null,
  created_by_user_id bigint references users(id) on delete set null,
  name text not null,
  name_lookup text,
  description text not null default '',
  version_label text not null default '',
  environment text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (test_space_id, name),
  unique (id, test_space_id)
);

alter table test_subjects
  add column if not exists name_lookup text;

alter table test_subjects
  add column if not exists created_by_user_id bigint references users(id) on delete set null;

update test_subjects subject
set created_by_user_id = space.owner_user_id
from test_spaces space
where subject.test_space_id = space.id
  and subject.created_by_user_id is null
  and not exists (
    select 1
    from test_space_memberships membership
    where membership.test_space_id = subject.test_space_id
      and membership.user_id <> space.owner_user_id
  );

create table if not exists test_case_folders (
  id bigserial primary key,
  test_space_id bigint not null references test_spaces(id) on delete cascade,
  test_subject_id bigint not null,
  name text not null,
  name_lookup text,
  created_at timestamptz not null default now(),
  unique (test_subject_id, name),
  unique (id, test_space_id, test_subject_id),
  foreign key (test_subject_id, test_space_id)
    references test_subjects(id, test_space_id) on delete cascade
);

alter table test_case_folders
  add column if not exists name_lookup text;

create table if not exists test_cases (
  id bigserial primary key,
  test_space_id bigint not null references test_spaces(id) on delete cascade,
  test_subject_id bigint not null,
  folder_id bigint references test_case_folders(id),
  title text not null,
  preconditions text not null default '',
  steps text not null default '',
  expected_result text not null default '',
  remarks text not null default '',
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  case_type text not null default 'functional'
    check (case_type in ('functional', 'regression', 'smoke', 'security', 'performance')),
  case_kind text not null default 'functional' check (case_kind in ('functional', 'baseline')),
  custom_tags text not null default '',
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  owner_user_id bigint references users(id) on delete set null,
  version integer not null default 1,
  created_by_user_id bigint references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (test_subject_id, test_space_id)
    references test_subjects(id, test_space_id) on delete cascade,
  foreign key (folder_id, test_space_id, test_subject_id)
    references test_case_folders(id, test_space_id, test_subject_id)
);

alter table test_cases
  add column if not exists remarks text not null default '';

alter table test_cases
  add column if not exists case_kind text not null default 'functional';

alter table test_cases
  add column if not exists custom_tags text not null default '';

do $$
begin
  alter table test_cases
    add constraint test_cases_case_kind_check check (case_kind in ('functional', 'baseline'));
exception
  when duplicate_object then null;
end $$;

update test_cases
set case_kind = 'baseline',
    status = 'active'
where status = 'archived';

create table if not exists test_plans (
  id bigserial primary key,
  test_space_id bigint not null references test_spaces(id) on delete cascade,
  test_subject_id bigint not null,
  project_id bigint references projects(id) on delete set null,
  name text not null,
  version_label text not null default '',
  environment text not null default '',
  starts_on date,
  ends_on date,
  status text not null default 'draft'
    check (status in ('draft', 'in_progress', 'completed', 'aborted')),
  owner_user_id bigint references users(id) on delete set null,
  created_by_user_id bigint references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, test_space_id, test_subject_id),
  foreign key (test_subject_id, test_space_id)
    references test_subjects(id, test_space_id) on delete cascade
);

alter table test_plans
  add column if not exists project_id bigint references projects(id) on delete set null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'test_plans_id_space_unique'
      and conrelid = 'test_plans'::regclass
  ) then
    alter table test_plans
      add constraint test_plans_id_space_unique unique (id, test_space_id);
  end if;
end $$;

create table if not exists test_plan_subjects (
  test_plan_id bigint not null,
  test_space_id bigint not null,
  test_subject_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (test_plan_id, test_subject_id),
  foreign key (test_plan_id, test_space_id)
    references test_plans(id, test_space_id) on delete cascade,
  foreign key (test_subject_id, test_space_id)
    references test_subjects(id, test_space_id) on delete cascade
);

alter table test_plan_subjects
  add column if not exists test_space_id bigint;

update test_plan_subjects ps
set test_space_id = p.test_space_id
from test_plans p
where p.id = ps.test_plan_id
  and ps.test_space_id is null;

alter table test_plan_subjects
  alter column test_space_id set not null;

do $$
begin
  alter table test_plan_subjects
    add constraint test_plan_subjects_plan_space_fkey
    foreign key (test_plan_id, test_space_id)
    references test_plans(id, test_space_id) on delete cascade;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table test_plan_subjects
    add constraint test_plan_subjects_subject_space_fkey
    foreign key (test_subject_id, test_space_id)
    references test_subjects(id, test_space_id) on delete cascade;
exception
  when duplicate_object then null;
end $$;

insert into test_plan_subjects (test_plan_id, test_space_id, test_subject_id)
select id, test_space_id, test_subject_id
from test_plans
on conflict do nothing;

create table if not exists test_plan_cases (
  id bigserial primary key,
  test_plan_id bigint not null references test_plans(id) on delete cascade,
  test_case_id bigint references test_cases(id) on delete set null,
  test_subject_id bigint references test_subjects(id) on delete set null,
  snapshot_title text not null,
  snapshot_preconditions text not null default '',
  snapshot_steps text not null default '',
  snapshot_expected_result text not null default '',
  snapshot_case_version integer not null,
  result text not null default 'untested'
    check (result in ('untested', 'passed', 'failed', 'blocked', 'skipped')),
  result_note text not null default '',
  executed_by_user_id bigint references users(id) on delete set null,
  executed_at timestamptz,
  unique (test_plan_id, test_case_id),
  unique (id, test_plan_id)
);

alter table test_plan_cases
  add column if not exists test_subject_id bigint references test_subjects(id) on delete set null;

update test_plan_cases pc
set test_subject_id = coalesce(
  (select c.test_subject_id from test_cases c where c.id = pc.test_case_id),
  (select p.test_subject_id from test_plans p where p.id = pc.test_plan_id)
)
where pc.test_subject_id is null;

create table if not exists test_bugs (
  id bigserial primary key,
  test_space_id bigint not null references test_spaces(id) on delete cascade,
  test_subject_id bigint not null,
  test_plan_id bigint references test_plans(id),
  test_plan_case_id bigint references test_plan_cases(id),
  title text not null,
  severity text not null default 'major'
    check (severity in ('blocker', 'critical', 'major', 'minor', 'trivial')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status text not null default 'new'
    check (status in ('new', 'pending_confirmation', 'assigned', 'in_progress', 'pending_verification', 'closed', 'rejected')),
  environment text not null default '',
  reproduction_steps text not null default '',
  expected_result text not null default '',
  actual_result text not null default '',
  reporter_user_id bigint references users(id) on delete set null,
  assignee_user_id bigint references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (test_plan_case_id is null or test_plan_id is not null),
  foreign key (test_subject_id, test_space_id)
    references test_subjects(id, test_space_id) on delete cascade,
  foreign key (test_plan_id, test_space_id)
    references test_plans(id, test_space_id),
  foreign key (test_plan_case_id, test_plan_id)
    references test_plan_cases(id, test_plan_id) on delete set null
);

alter table test_bugs
  drop constraint if exists test_bugs_test_plan_id_test_space_id_test_subject_id_fkey;

do $$
begin
  alter table test_bugs
    add constraint test_bugs_test_plan_id_test_space_id_fkey
    foreign key (test_plan_id, test_space_id)
    references test_plans(id, test_space_id);
exception
  when duplicate_object then null;
end $$;

alter table test_bugs
  drop constraint if exists test_bugs_status_check;

update test_bugs
set status = 'pending_confirmation'
where status in ('confirmed', 'reopened');

update test_bugs
set status = 'closed'
where status = 'duplicate';

alter table test_bugs
  add constraint test_bugs_status_check
  check (status in ('new', 'pending_confirmation', 'assigned', 'in_progress', 'pending_verification', 'closed', 'rejected'));

create table if not exists test_bug_comments (
  id bigserial primary key,
  test_bug_id bigint not null references test_bugs(id) on delete cascade,
  author_user_id bigint references users(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

alter table test_bug_comments
  add column if not exists updated_at timestamptz,
  add column if not exists kind text not null default 'comment';

alter table test_bug_comments
  drop constraint if exists test_bug_comments_kind_check;

alter table test_bug_comments
  add constraint test_bug_comments_kind_check
  check (kind in ('comment', 'transfer', 'reject'));

create table if not exists test_bug_events (
  id bigserial primary key,
  test_bug_id bigint not null references test_bugs(id) on delete cascade,
  event_type text not null
    check (event_type in ('created', 'assigned', 'transferred', 'status_changed', 'space_transferred')),
  actor_user_id bigint references users(id) on delete set null,
  previous_status text,
  next_status text,
  assignee_user_id bigint references users(id) on delete set null,
  transfer_source text,
  previous_test_space_id bigint references test_spaces(id) on delete set null,
  next_test_space_id bigint references test_spaces(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table test_bug_events
  add column if not exists transfer_source text,
  add column if not exists previous_test_space_id bigint references test_spaces(id) on delete set null,
  add column if not exists next_test_space_id bigint references test_spaces(id) on delete set null;

alter table test_bug_events
  drop constraint if exists test_bug_events_transfer_source_check;

alter table test_bug_events
  add constraint test_bug_events_transfer_source_check
  check (transfer_source in ('manual', 'offboarding') or transfer_source is null);

update test_bug_events event
set transfer_source = 'offboarding'
from account_offboarding_asset_transfers transfer
where event.transfer_source is null
  and event.event_type = 'transferred'
  and transfer.asset_type = 'test_bug'
  and transfer.asset_id = event.test_bug_id
  and transfer.action = 'transferred'
  and transfer.next_assignee_user_id = event.assignee_user_id
  and transfer.created_at = event.created_at;

alter table test_bug_events
  drop constraint if exists test_bug_events_event_type_check;

alter table test_bug_events
  add constraint test_bug_events_event_type_check
  check (event_type in ('created', 'assigned', 'transferred', 'status_changed', 'space_transferred'));

create table if not exists test_space_data_imports (
  id bigserial primary key,
  target_test_space_id bigint not null references test_spaces(id) on delete cascade,
  source_test_space_id bigint not null references test_spaces(id) on delete cascade,
  data_type text not null check (data_type in ('subject', 'folder', 'case', 'plan', 'plan_case')),
  source_record_id bigint not null,
  target_record_id bigint not null,
  created_by_user_id bigint references users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (target_test_space_id, source_test_space_id, data_type, source_record_id)
);

create index if not exists idx_test_space_data_imports_target
  on test_space_data_imports(target_test_space_id, source_test_space_id, data_type);

create index if not exists idx_test_bug_events_bug
  on test_bug_events(test_bug_id, created_at, id);

create table if not exists bug_share_links (
  id bigserial primary key,
  test_bug_id bigint not null references test_bugs(id) on delete cascade,
  created_by_user_id bigint references users(id) on delete set null,
  token_hash text not null unique,
  token_encrypted text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists idx_bug_share_links_bug_id
  on bug_share_links(test_bug_id, created_at desc);

create unique index if not exists idx_bug_share_links_active_bug
  on bug_share_links(test_bug_id)
  where revoked_at is null;

create table if not exists todo_share_links (
  id bigserial primary key,
  todo_id bigint not null references todos(id) on delete cascade,
  created_by_user_id bigint references users(id) on delete set null,
  token_hash text not null unique,
  token_encrypted text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create index if not exists idx_todo_share_links_todo_id
  on todo_share_links(todo_id, created_at desc);

create unique index if not exists idx_todo_share_links_active_todo
  on todo_share_links(todo_id)
  where revoked_at is null;

alter table todo_notes
  add column if not exists source_share_link_id bigint references todo_share_links(id) on delete set null,
  add column if not exists source_share_request_id uuid;

create index if not exists idx_todo_notes_source_share_link
  on todo_notes(source_share_link_id, created_at desc)
  where source_share_link_id is not null;

create unique index if not exists idx_todo_notes_share_request_unique
  on todo_notes(source_share_link_id, author_user_id, source_share_request_id)
  where source_share_request_id is not null;

create table if not exists changelog_entries (
  id bigserial primary key,
  title_encrypted text not null,
  version_encrypted text not null default '',
  content_encrypted text not null,
  created_by_user_id bigint references users(id) on delete set null,
  updated_by_user_id bigint references users(id) on delete set null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_user_id on projects(user_id);
create index if not exists idx_projects_organization_id on projects(organization_id);
create index if not exists idx_organization_memberships_user_id
  on organization_memberships(user_id, status);
create index if not exists idx_organization_invitations_organization_id
  on organization_invitations(organization_id, status, created_at desc);
create unique index if not exists idx_organization_invitations_pending_target
  on organization_invitations(organization_id, target_email_lookup)
  where status = 'pending';
create index if not exists idx_organization_invite_links_organization_id
  on organization_invite_links(organization_id);
create index if not exists idx_changelog_entries_published_at
  on changelog_entries(published_at desc, id desc);
create unique index if not exists idx_organization_invite_links_active_organization
  on organization_invite_links(organization_id)
  where revoked_at is null;
create index if not exists idx_organization_weekly_reports_lookup
  on organization_weekly_reports(organization_id, week_start, status);
create index if not exists idx_organization_audit_events_lookup
  on organization_audit_events(organization_id, created_at desc);
create index if not exists idx_organization_package_market_selections_lookup
  on organization_package_market_selections(organization_id, channel, rule_id);
create index if not exists idx_organization_package_market_selection_rules_lookup
  on organization_package_market_selection_rules(organization_id, rule_id);
create index if not exists idx_project_memberships_project_id on project_memberships(project_id);
create index if not exists idx_project_memberships_owner_user_id on project_memberships(owner_user_id);
create index if not exists idx_project_memberships_invited_user_id on project_memberships(invited_user_id);
create index if not exists idx_project_memberships_invited_email on project_memberships(invited_email);
create index if not exists idx_project_memberships_invited_email_lookup on project_memberships(invited_email_lookup);
create unique index if not exists idx_project_memberships_project_email_lookup
  on project_memberships(project_id, invited_email_lookup)
  where invited_email_lookup is not null;
create index if not exists idx_project_invite_links_project_id on project_invite_links(project_id);
create index if not exists idx_project_invite_links_owner_user_id on project_invite_links(owner_user_id);
create index if not exists idx_project_invite_links_token on project_invite_links(token);
create unique index if not exists idx_project_invite_links_active_project
  on project_invite_links(project_id)
  where revoked_at is null;
create index if not exists idx_project_transfer_requests_project_id
  on project_transfer_requests(project_id, status, created_at desc);
create index if not exists idx_project_transfer_requests_target_user_id
  on project_transfer_requests(target_user_id, status, created_at desc);
create unique index if not exists idx_project_transfer_requests_token_hash
  on project_transfer_requests(token_hash)
  where token_hash is not null;
create unique index if not exists idx_project_transfer_requests_pending_project
  on project_transfer_requests(project_id)
  where status = 'pending';
create index if not exists idx_sessions_user_id on sessions(user_id);
create index if not exists idx_sessions_expires_at on sessions(expires_at);
create index if not exists idx_users_account_status on users(account_status, id);
create index if not exists idx_account_offboarding_records_user on account_offboarding_records(user_id, created_at desc);
create index if not exists idx_account_offboarding_asset_transfers_lookup
  on account_offboarding_asset_transfers(asset_type, asset_id, created_at desc);
create index if not exists idx_account_offboarding_notifications_recipient
  on account_offboarding_notifications(recipient_user_id, created_at desc);
create index if not exists idx_user_roles_role on user_roles(role, user_id);
create index if not exists idx_image_sync_workflow_runs_user_created
  on image_sync_workflow_runs(user_id, created_at desc);
create unique index if not exists idx_image_sync_workflow_runs_dispatch_key
  on image_sync_workflow_runs(dispatch_key);
create unique index if not exists idx_image_sync_workflow_runs_user_active
  on image_sync_workflow_runs(user_id)
  where status in ('dispatching', 'queued', 'in_progress');
create index if not exists idx_journal_entries_project_id on journal_entries(project_id);
create index if not exists idx_journal_entries_author_user_id on journal_entries(author_user_id);
create index if not exists idx_todos_project_id on todos(project_id);
create index if not exists idx_todos_collaborator_id on todos(collaborator_id);
create index if not exists idx_todos_created_by_user_id on todos(created_by_user_id);
create index if not exists idx_todos_assignee_user_id on todos(assignee_user_id);
create index if not exists idx_project_milestones_project_order
  on project_milestones(project_id, target_date, sort_order, id);
create index if not exists idx_project_milestone_todos_project
  on project_milestone_todos(project_id, milestone_id);
create index if not exists idx_project_milestone_events_project_time
  on project_milestone_events(project_id, created_at desc, id desc);
create index if not exists idx_todos_watcher_user_id on todos(watcher_user_id);
create index if not exists idx_todo_watchers_user_id on todo_watchers(user_id, watched_at desc, todo_id);
create index if not exists idx_todos_reviewer_user_id on todos(reviewer_user_id);
create index if not exists idx_todos_due_date on todos(due_date);
create index if not exists idx_todos_project_module_id on todos(project_module_id);
create index if not exists idx_todos_completed_at on todos(completed_at);
create index if not exists idx_todo_activity_events_project_time
  on todo_activity_events(project_id, occurred_at desc, id desc);
create index if not exists idx_todo_activity_events_todo_time
  on todo_activity_events(todo_id, occurred_at desc, id desc);
create index if not exists idx_todo_activity_events_assignee_time
  on todo_activity_events(assignee_user_id, occurred_at desc, id desc);
create index if not exists idx_project_modules_project_id on project_modules(project_id);
create index if not exists idx_todo_notes_todo_id on todo_notes(todo_id);
create index if not exists idx_todo_notes_author_user_id on todo_notes(author_user_id);
create index if not exists idx_todo_note_mentions_user_id on todo_note_mentions(mentioned_user_id);
create index if not exists idx_todo_mentions_todo_id on todo_mentions(todo_id);
create index if not exists idx_todo_mentions_user_id on todo_mentions(mentioned_user_id);
create index if not exists idx_collaborators_user_id on collaborators(user_id);
create index if not exists idx_collaborators_project_id on collaborators(project_id);
create index if not exists idx_collaborators_name_lookup on collaborators(user_id, name_lookup);
create index if not exists idx_risks_project_id on risks(project_id);
create index if not exists idx_draft_items_user_id on draft_items(user_id);
create index if not exists idx_ai_conversations_user_activity
  on ai_conversations(user_id, last_turn_at desc, id desc);
create index if not exists idx_ai_conversations_project_user
  on ai_conversations(project_id, user_id)
  where project_id is not null;
create index if not exists idx_ai_turn_cancellations_user_created
  on ai_turn_cancellations(user_id, created_at);
create index if not exists idx_ai_intent_classifications_user_created
  on ai_intent_classifications(user_id, created_at desc);
create index if not exists idx_ai_turns_conversation_order
  on ai_turns(conversation_id, turn_no desc);
create index if not exists idx_ai_turn_project_sources_project
  on ai_turn_project_sources(project_id, turn_id);
create unique index if not exists idx_ai_turns_one_processing
  on ai_turns(conversation_id)
  where status = 'processing';
create index if not exists idx_ai_turn_attachments_turn
  on ai_turn_attachments(turn_id, ordinal);
create index if not exists idx_ai_todo_proposal_batches_user_status
  on ai_todo_proposal_batches(user_id, status, created_at desc);
create unique index if not exists idx_ai_todo_proposal_batches_source_turn
  on ai_todo_proposal_batches(source_turn_id)
  where source_turn_id is not null;
create index if not exists idx_ai_todo_proposals_batch_status
  on ai_todo_proposals(batch_id, status, id);
create index if not exists idx_feishu_ai_messages_claim
  on feishu_ai_messages(status, next_attempt_at, lease_until, created_at);
create index if not exists idx_feishu_ai_messages_user_chat
  on feishu_ai_messages(user_id, chat_id, created_at desc);
create index if not exists idx_feishu_ai_chats_conversation
  on feishu_ai_chats(conversation_id);
create index if not exists idx_summaries_user_id on summaries(user_id);
create index if not exists idx_summaries_project_id on summaries(project_id);
create unique index if not exists idx_summaries_source_turn
  on summaries(source_turn_id)
  where source_turn_id is not null;
create index if not exists idx_notification_states_user_kind
  on notification_states(user_id, kind);
create index if not exists idx_project_integrations_project_provider
  on project_integrations(project_id, provider);
create index if not exists idx_notification_deliveries_status
  on notification_deliveries(channel, status, updated_at);
create index if not exists idx_notification_deliveries_user_kind
  on notification_deliveries(user_id, kind);
create index if not exists idx_notification_subscriptions_due
  on notification_subscriptions(enabled, timezone, local_send_time);
create index if not exists idx_notification_digest_runs_claim
  on notification_digest_runs(status, next_attempt_at, lease_until);
create index if not exists idx_project_package_events_project_id
  on project_package_events(project_id, created_at);
create index if not exists idx_project_package_groups_event_id
  on project_package_groups(project_package_event_id);
create index if not exists idx_project_package_items_group_id
  on project_package_items(project_package_group_id, created_at desc);
create index if not exists idx_project_package_operations_event_id
  on project_package_operations(project_package_event_id, created_at asc);
create index if not exists idx_project_package_operations_group_id
  on project_package_operations(project_package_group_id, created_at asc);
create unique index if not exists idx_project_package_operations_auto_group_unique
  on project_package_operations(project_package_group_id)
  where auto_generated;
create index if not exists idx_project_package_operation_todos_operation_id
  on project_package_operation_todos(project_package_operation_id);
create index if not exists idx_project_package_operation_todos_todo_id
  on project_package_operation_todos(todo_id);
create index if not exists idx_test_space_memberships_user_id
  on test_space_memberships(user_id, test_space_id);
create index if not exists idx_test_space_memberships_status
  on test_space_memberships(user_id, status, test_space_id);
create index if not exists idx_test_space_invite_links_space_id
  on test_space_invite_links(test_space_id);
create index if not exists idx_test_space_invite_links_token
  on test_space_invite_links(token);
create unique index if not exists idx_test_space_invite_links_active_space
  on test_space_invite_links(test_space_id)
  where revoked_at is null;
create index if not exists idx_test_subjects_space_id
  on test_subjects(test_space_id, created_at);
create unique index if not exists idx_test_subjects_space_name_lookup
  on test_subjects(test_space_id, name_lookup)
  where name_lookup is not null;
create unique index if not exists idx_test_case_folders_subject_name_lookup
  on test_case_folders(test_subject_id, name_lookup)
  where name_lookup is not null;
create index if not exists idx_test_cases_subject_id
  on test_cases(test_subject_id, updated_at desc);
create index if not exists idx_test_plans_subject_id
  on test_plans(test_subject_id, updated_at desc);
create index if not exists idx_test_plans_space_id
  on test_plans(test_space_id, updated_at desc);
create index if not exists idx_test_plans_project_id
  on test_plans(project_id, updated_at desc);
create index if not exists idx_test_plan_subjects_subject_id
  on test_plan_subjects(test_subject_id, test_plan_id);
create index if not exists idx_test_plan_cases_plan_id
  on test_plan_cases(test_plan_id, id);
create index if not exists idx_test_bugs_space_status
  on test_bugs(test_space_id, status, updated_at desc);
create index if not exists idx_test_bugs_assignee_id
  on test_bugs(assignee_user_id, status, updated_at desc);
create index if not exists idx_test_spaces_organization_id on test_spaces(organization_id);
create index if not exists idx_test_bug_comments_bug_id
  on test_bug_comments(test_bug_id, created_at);
`
