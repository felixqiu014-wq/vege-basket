import type { NotificationCenterData } from './types'

export const notificationRefreshIntervalMs = 5_000

export function startNotificationRefreshSchedule(options: {
  clearInterval: (handle: number) => void
  isVisible: () => boolean
  onFocus: (listener: () => void) => () => void
  onVisibilityChange: (listener: () => void) => () => void
  refresh: () => void
  setInterval: (listener: () => void, delay: number) => number
}) {
  const refreshIfVisible = () => {
    if (options.isVisible()) options.refresh()
  }
  const interval = options.setInterval(refreshIfVisible, notificationRefreshIntervalMs)
  const removeFocusListener = options.onFocus(refreshIfVisible)
  const removeVisibilityListener = options.onVisibilityChange(refreshIfVisible)

  return () => {
    options.clearInterval(interval)
    removeFocusListener()
    removeVisibilityListener()
  }
}

export function removePackageEventNotification(
  notifications: NotificationCenterData,
  eventId: number,
): NotificationCenterData {
  return {
    ...notifications,
    assignedPackageEvents: notifications.assignedPackageEvents.filter(
      (item) => item.id !== eventId,
    ),
  }
}

export function removeTodoNotifications(
  notifications: NotificationCenterData,
  todoId: number,
): NotificationCenterData {
  return {
    ...notifications,
    assignedTodos: notifications.assignedTodos.filter((item) => item.id !== todoId),
    dueTomorrowTodos: notifications.dueTomorrowTodos.filter((item) => item.id !== todoId),
    noteMentions: notifications.noteMentions.filter((item) => item.id !== todoId),
  }
}
