-- Veges incremental migration: share one package visibility range across Release and CI.
-- Apply after 20260828_organization_package_market_policy_excluded_mode.sql.
-- Legacy per-channel rows remain intact for compatibility; this migration writes
-- the canonical shared policy without broadening any existing channel's access.

begin;

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

create index if not exists idx_organization_package_market_selection_rules_lookup
  on organization_package_market_selection_rules(organization_id, rule_id);

-- A legacy pair cannot always be represented exactly by one shared range.
-- Select the intersection of the two legacy allow-sets, or the union of their
-- deny-lists, so the migration never makes a package newly visible.
with legacy as (
  select channel_policy.organization_id,
         coalesce(
           max(channel_policy.mode) filter (where channel_policy.channel = 'release'),
           'all'
         ) as release_mode,
         coalesce(
           max(channel_policy.mode) filter (where channel_policy.channel = 'ci'),
           'all'
         ) as ci_mode
    from organization_package_market_channel_policies channel_policy
   group by channel_policy.organization_id
),
inserted_policies as (
  insert into organization_package_market_selection_policies (organization_id, mode)
  select legacy.organization_id,
         case
           when legacy.release_mode = 'selected' or legacy.ci_mode = 'selected' then 'selected'
           when legacy.release_mode = 'excluded' or legacy.ci_mode = 'excluded' then 'excluded'
           else 'all'
         end
    from legacy
  on conflict (organization_id) do nothing
  returning organization_id, mode
),
selected_candidates as (
  select inserted_policies.organization_id,
         selection.rule_id
    from inserted_policies
    join legacy on legacy.organization_id = inserted_policies.organization_id
    join organization_package_market_selections selection
      on selection.organization_id = inserted_policies.organization_id
     and (
       (legacy.release_mode = 'selected' and selection.channel = 'release')
       or (legacy.ci_mode = 'selected' and selection.channel = 'ci')
     )
   where inserted_policies.mode = 'selected'
     and (
       legacy.release_mode <> 'selected'
       or exists (
         select 1
           from organization_package_market_selections release_selection
          where release_selection.organization_id = inserted_policies.organization_id
            and release_selection.channel = 'release'
            and release_selection.rule_id = selection.rule_id
       )
     )
     and (
       legacy.ci_mode <> 'selected'
       or exists (
         select 1
           from organization_package_market_selections ci_selection
          where ci_selection.organization_id = inserted_policies.organization_id
            and ci_selection.channel = 'ci'
            and ci_selection.rule_id = selection.rule_id
       )
     )
     and (
       legacy.release_mode <> 'excluded'
       or not exists (
         select 1
           from organization_package_market_selections release_selection
          where release_selection.organization_id = inserted_policies.organization_id
            and release_selection.channel = 'release'
            and release_selection.rule_id = selection.rule_id
       )
     )
     and (
       legacy.ci_mode <> 'excluded'
       or not exists (
         select 1
           from organization_package_market_selections ci_selection
          where ci_selection.organization_id = inserted_policies.organization_id
            and ci_selection.channel = 'ci'
            and ci_selection.rule_id = selection.rule_id
       )
     )
),
excluded_candidates as (
  select inserted_policies.organization_id,
         selection.rule_id
    from inserted_policies
    join legacy on legacy.organization_id = inserted_policies.organization_id
    join organization_package_market_selections selection
      on selection.organization_id = inserted_policies.organization_id
   where inserted_policies.mode = 'excluded'
     and (
       (legacy.release_mode = 'excluded' and selection.channel = 'release')
       or (legacy.ci_mode = 'excluded' and selection.channel = 'ci')
     )
),
rule_candidates as (
  select organization_id, rule_id from selected_candidates
  union
  select organization_id, rule_id from excluded_candidates
)
insert into organization_package_market_selection_rules (organization_id, rule_id)
select organization_id, rule_id
  from rule_candidates
on conflict (organization_id, rule_id) do nothing;

commit;
