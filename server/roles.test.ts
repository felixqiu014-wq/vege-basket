import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  canAssumeUserRole,
  getSwitchableUserRoles,
  isUserRole,
  isSwitchableUserRole,
} from './roles.ts'

const appSource = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const roleSelectionSource = readFileSync(
  new URL('../src/components/user-role-dialogs.tsx', import.meta.url),
  'utf8',
).split('export function UserRoleManagementDialog')[0]

test('organization administrator is an additive capability, not a switchable role', () => {
  assert.equal(isSwitchableUserRole('organization_admin'), false)
  assert.deepEqual(
    getSwitchableUserRoles(['organization_admin']),
    ['developer', 'tester'],
  )
})

test('login identity selection contains only switchable business personas', () => {
  assert.match(roleSelectionSource, /getSwitchableUserRoles\(user\.roles\)\.map/u)
  assert.doesNotMatch(roleSelectionSource, /organization_admin/u)
  assert.doesNotMatch(roleSelectionSource, /onOpenOrganization/u)
})

test('organization administrator can assume every business role', () => {
  assert.equal(canAssumeUserRole(['organization_admin'], 'developer'), true)
  assert.equal(canAssumeUserRole(['organization_admin'], 'tester'), true)
  assert.equal(canAssumeUserRole(['tester'], 'developer'), false)
})

test('developer navigation keeps the test workbench hidden until the tester persona is active', () => {
  assert.match(
    appSource,
    /const canNavigateToTestWorkbench = authUser\?\.activeRole === 'tester'/u,
  )
  assert.match(appSource, /if \(view === 'testing'\) return user\.activeRole === 'tester'/u)
})

test('delivery is no longer an account role', () => {
  assert.equal(isUserRole('delivery'), false)
  assert.equal(isSwitchableUserRole('delivery'), false)
})
