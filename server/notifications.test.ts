import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldRetirePackageEventNotification } from './notification-policy.ts'
import {
  notificationRefreshIntervalMs,
  removePackageEventNotification,
  removeTodoNotifications,
  startNotificationRefreshSchedule,
} from '../src/notifications.ts'
import type { NotificationCenterData, TodoNotification } from '../src/types.ts'

function todoNotification(id: number): TodoNotification {
  return {
    dueDate: '2026-07-16',
    id,
    priority: 'medium',
    projectId: 1,
    projectName: 'Project',
    title: `Todo ${id}`,
  }
}

test('removes a completed todo from every todo notification category', () => {
  const notifications: NotificationCenterData = {
    assignedPackageEvents: [{
      eventStatus: 'draft',
      eventType: 'upgrade',
      id: 30,
      projectId: 1,
      projectName: 'Project',
      title: 'Event',
    }],
    assignedTodos: [todoNotification(10), todoNotification(20)],
    dueTomorrowTodos: [todoNotification(10)],
    noteMentions: [todoNotification(10), todoNotification(20)],
    invites: [{
      createdAt: '2026-07-15 12:00',
      id: 40,
      invitedByName: 'Owner',
      projectId: 1,
      projectName: 'Project',
    }],
  }

  const result = removeTodoNotifications(notifications, 10)

  assert.deepEqual(result.assignedTodos.map((item) => item.id), [20])
  assert.deepEqual(result.dueTomorrowTodos, [])
  assert.deepEqual(result.noteMentions.map((item) => item.id), [20])
  assert.equal(result.assignedPackageEvents, notifications.assignedPackageEvents)
  assert.equal(result.invites, notifications.invites)
})

test('removes only the delivery event whose status advanced', () => {
  const notifications: NotificationCenterData = {
    assignedPackageEvents: [
      {
        eventStatus: 'draft',
        eventType: 'upgrade',
        id: 30,
        projectId: 1,
        projectName: 'Project',
        title: 'Event 30',
      },
      {
        eventStatus: 'draft',
        eventType: 'init',
        id: 31,
        projectId: 1,
        projectName: 'Project',
        title: 'Event 31',
      },
    ],
    assignedTodos: [todoNotification(10)],
    dueTomorrowTodos: [],
    noteMentions: [],
    invites: [],
  }

  const result = removePackageEventNotification(notifications, 30)

  assert.deepEqual(result.assignedPackageEvents.map((item) => item.id), [31])
  assert.equal(result.assignedTodos, notifications.assignedTodos)
})

test('retires a delivery event notification after it leaves draft for the first time', () => {
  assert.equal(shouldRetirePackageEventNotification('draft', 'delivering'), true)
  assert.equal(shouldRetirePackageEventNotification('draft', 'delivered'), true)
  assert.equal(shouldRetirePackageEventNotification('delivering', 'draft'), true)
  assert.equal(shouldRetirePackageEventNotification('delivered', 'draft'), true)
  assert.equal(shouldRetirePackageEventNotification('draft', 'draft'), false)
  assert.equal(shouldRetirePackageEventNotification('draft', undefined), false)
})

test('refreshes notifications while visible and cleans up the live schedule', () => {
  let visible = true
  let refreshCount = 0
  let intervalDelay = 0
  let intervalListener = () => {}
  let focusListener = () => {}
  let visibilityListener = () => {}
  let clearedInterval = 0
  let removedFocus = false
  let removedVisibility = false

  const stop = startNotificationRefreshSchedule({
    clearInterval: (handle) => {
      clearedInterval = handle
    },
    isVisible: () => visible,
    onFocus: (listener) => {
      focusListener = listener
      return () => {
        removedFocus = true
      }
    },
    onVisibilityChange: (listener) => {
      visibilityListener = listener
      return () => {
        removedVisibility = true
      }
    },
    refresh: () => {
      refreshCount += 1
    },
    setInterval: (listener, delay) => {
      intervalListener = listener
      intervalDelay = delay
      return 17
    },
  })

  assert.equal(intervalDelay, notificationRefreshIntervalMs)
  intervalListener()
  focusListener()
  assert.equal(refreshCount, 2)

  visible = false
  intervalListener()
  visibilityListener()
  assert.equal(refreshCount, 2)

  visible = true
  visibilityListener()
  assert.equal(refreshCount, 3)

  stop()
  assert.equal(clearedInterval, 17)
  assert.equal(removedFocus, true)
  assert.equal(removedVisibility, true)
})
