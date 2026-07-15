import type { ProjectPackageEventStatus } from './project-package-timeline.ts'

export function shouldRetirePackageEventNotification(
  previousStatus: ProjectPackageEventStatus,
  nextStatus: ProjectPackageEventStatus | undefined,
) {
  return nextStatus !== undefined && (
    previousStatus !== 'draft' || nextStatus !== 'draft'
  )
}
