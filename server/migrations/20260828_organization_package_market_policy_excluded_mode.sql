-- Veges incremental migration: support deny-list package-market policies.
-- Apply after 20260828_organization_package_market_policy.sql.

begin;

alter table organization_package_market_channel_policies
  drop constraint if exists organization_package_market_channel_policies_mode_check;

alter table organization_package_market_channel_policies
  add constraint organization_package_market_channel_policies_mode_check
  check (mode in ('all', 'selected', 'excluded'));

commit;
