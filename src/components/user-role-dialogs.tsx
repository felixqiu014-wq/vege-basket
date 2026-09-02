import { useEffect, useState } from 'react'
import { Check, Code, Flask, UserMinus, UsersThree } from '@phosphor-icons/react'
import {
  fetchOffboardingPreview,
  fetchManagedUsers,
  offboardManagedUser,
  updateManagedUserRoles,
  updateManagedUserStatus,
  type AuthUser,
  type ManagedUser,
  type OffboardingPreview,
  type UserRole,
} from '@/api'
import {
  getSwitchableUserRoles,
  userRoleLabel,
  type SwitchableUserRole,
} from '@/user-roles'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const roleIcon: Record<SwitchableUserRole, typeof Code> = {
  developer: Code,
  tester: Flask,
}

const roleDescription: Record<SwitchableUserRole, string> = {
  developer: '项目工作区与指派给我的 Bug',
  tester: '用例、测试计划与 Bug 追踪',
}

export function UserRoleSelectionDialog({
  busy,
  onSelect,
  open,
  user,
}: {
  busy: boolean
  onSelect: (role: SwitchableUserRole) => void
  open: boolean
  user: AuthUser
}) {
  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="role-selection-dialog">
        <DialogHeader>
          <DialogTitle>选择本次登录身份</DialogTitle>
          <DialogDescription>身份决定本次会话中显示的工作区域，可以稍后从账户菜单切换。</DialogDescription>
        </DialogHeader>
        <div className="role-selection-list">
          {getSwitchableUserRoles(user.roles).map((role) => {
            const Icon = roleIcon[role]
            return (
              <button disabled={busy} key={role} type="button" onClick={() => onSelect(role)}>
                <Icon size={22} weight="duotone" />
                <span><strong>{userRoleLabel[role]}</strong><small>{roleDescription[role]}</small></span>
                {user.activeRole === role ? <Check /> : null}
              </button>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function UserRoleManagementDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [drafts, setDrafts] = useState<Record<number, UserRole[]>>({})
  const [busyUserId, setBusyUserId] = useState<number>()
  const [error, setError] = useState('')
  const [offboardingUser, setOffboardingUser] = useState<ManagedUser>()
  const [offboardingPreview, setOffboardingPreview] = useState<OffboardingPreview>()
  const [offboardingSelections, setOffboardingSelections] = useState<Record<number, string>>({})
  const [offboardingBusy, setOffboardingBusy] = useState(false)

  async function loadUsers() {
    const result = await fetchManagedUsers()
    setUsers(result.users)
    setDrafts(Object.fromEntries(result.users.map((user) => [user.id, user.roles])))
  }

  useEffect(() => {
    if (!open) return
    setError('')
    loadUsers()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : '用户读取失败。'))
  }, [open])

  function toggleRole(userId: number, role: UserRole) {
    setDrafts((current) => {
      const roles = current[userId] ?? []
      return {
        ...current,
        [userId]: roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role],
      }
    })
  }

  async function saveUser(userId: number) {
    const roles = drafts[userId] ?? []
    if (roles.length === 0) {
      setError('每个账号至少需要一个角色。')
      return
    }
    setBusyUserId(userId)
    setError('')
    try {
      const result = await updateManagedUserRoles(userId, roles)
      setUsers((current) => current.map((user) => user.id === userId ? { ...user, roles: result.roles } : user))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '角色保存失败。')
    } finally {
      setBusyUserId(undefined)
    }
  }

  async function openOffboarding(user: ManagedUser) {
    setBusyUserId(user.id)
    setError('')
    try {
      const preview = await fetchOffboardingPreview(user.id)
      setOffboardingUser(user)
      setOffboardingPreview(preview)
      setOffboardingSelections(Object.fromEntries(
        preview.organizations.map((organization) => [organization.id, '']),
      ))
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : '离职信息读取失败。')
    } finally {
      setBusyUserId(undefined)
    }
  }

  async function submitOffboarding() {
    if (!offboardingUser || !offboardingPreview) return
    const selections = offboardingPreview.organizations.map((organization) => ({
      organizationId: organization.id,
      targetAdminUserId: Number(offboardingSelections[organization.id]),
    }))
    if (selections.some((selection) => !Number.isSafeInteger(selection.targetAdminUserId) || selection.targetAdminUserId <= 0)) {
      setError('请为每个组织选择接收管理员。')
      return
    }
    setOffboardingBusy(true)
    setError('')
    try {
      await offboardManagedUser(offboardingUser.id, selections)
      setOffboardingUser(undefined)
      setOffboardingPreview(undefined)
      await loadUsers()
    } catch (offboardingError) {
      setError(offboardingError instanceof Error ? offboardingError.message : '离职操作失败。')
    } finally {
      setOffboardingBusy(false)
    }
  }

  async function toggleDisabled(user: ManagedUser) {
    const nextStatus = user.accountStatus === 'disabled' ? 'active' : 'disabled'
    setBusyUserId(user.id)
    setError('')
    try {
      const result = await updateManagedUserStatus(user.id, nextStatus)
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, accountStatus: result.accountStatus } : item))
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : '账号状态更新失败。')
    } finally {
      setBusyUserId(undefined)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="role-management-dialog">
        <DialogHeader>
          <DialogTitle>用户与角色</DialogTitle>
          <DialogDescription>职业角色可以多选；组织管理员角色控制组织管理看板入口。</DialogDescription>
        </DialogHeader>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="role-management-list">
          {users.map((user) => (
            <article key={user.id}>
              <div className="role-managed-user">
                <strong>{user.displayName}{user.accountStatus === 'departed' ? <Badge variant="secondary" className="user-departed-badge">已离职</Badge> : null}</strong>
                <small>{user.username}</small>
              </div>
              <div className="role-checkboxes">
                {(Object.keys(userRoleLabel) as UserRole[]).map((role) => (
                  <label key={role}>
                    <Checkbox checked={(drafts[user.id] ?? []).includes(role)} onCheckedChange={() => toggleRole(user.id, role)} />
                    {userRoleLabel[role]}
                  </label>
                ))}
              </div>
              <div className="role-managed-actions">
                <Button size="sm" variant="outline" disabled={busyUserId === user.id || user.accountStatus === 'departed'} onClick={() => void saveUser(user.id)}>
                  {busyUserId === user.id ? '保存中...' : '保存'}
                </Button>
                <Button size="sm" variant="outline" disabled={busyUserId === user.id || user.accountStatus === 'departed'} onClick={() => void toggleDisabled(user)}>
                  {user.accountStatus === 'disabled' ? '启用账号' : '禁用账号'}
                </Button>
                <Button size="sm" variant="destructive" disabled={busyUserId === user.id || user.accountStatus === 'departed'} onClick={() => void openOffboarding(user)}>
                  <UserMinus /> 离职
                </Button>
              </div>
            </article>
          ))}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button></DialogFooter>
      </DialogContent>
      <Dialog
        open={Boolean(offboardingUser && offboardingPreview)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !offboardingBusy) {
            setOffboardingUser(undefined)
            setOffboardingPreview(undefined)
          }
        }}
      >
        <DialogContent className="offboarding-dialog">
          <DialogHeader>
            <DialogTitle>办理离职</DialogTitle>
            <DialogDescription>{offboardingUser?.displayName} 的账号将被禁用，组织内资源和工作归属将按下方选择处理。</DialogDescription>
          </DialogHeader>
          <div className="offboarding-organizations">
            {offboardingPreview?.organizations.map((organization) => (
              <section key={organization.id} className="offboarding-organization">
                <div className="offboarding-organization-heading">
                  <strong>{organization.name}</strong>
                  <small>待办 {organization.openTodoCount} 条 · Bug {organization.bugCount} 个</small>
                </div>
                <Select
                  value={offboardingSelections[organization.id] ?? ''}
                  onValueChange={(value) => setOffboardingSelections((current) => ({ ...current, [organization.id]: value }))}
                  disabled={offboardingBusy || organization.admins.length === 0}
                >
                  <SelectTrigger aria-label={`${organization.name} 接收管理员`}>
                    <SelectValue placeholder="选择接收管理员" />
                  </SelectTrigger>
                  <SelectContent>
                    {organization.admins.map((admin) => (
                      <SelectItem key={admin.id} value={String(admin.id)}>{admin.displayName} · {admin.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {organization.ownedProjects.length > 0 ? <small>将转移项目 {organization.ownedProjects.length} 个</small> : null}
                {organization.ownedTestSpaces.length > 0 ? <small>将转移测试空间 {organization.ownedTestSpaces.length} 个</small> : null}
                {organization.admins.length === 0 ? <p className="form-error">该组织没有可接收的组织管理员。</p> : null}
              </section>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={offboardingBusy} onClick={() => setOffboardingUser(undefined)}>取消</Button>
            <Button variant="destructive" disabled={offboardingBusy || !offboardingPreview?.organizations.every((organization) => organization.admins.length > 0)} onClick={() => void submitOffboarding()}>
              {offboardingBusy ? '处理中...' : '确认离职'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

export function ManageRolesMenuLabel() {
  return <><UsersThree /> 用户与角色</>
}
