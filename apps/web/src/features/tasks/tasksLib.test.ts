import { expect, test } from 'bun:test'
import type { Task } from '@/features/tasks/api/models'
import { activityChangeText, canEditTaskProperties, quickSearchTasks, supervisorChangeConfirmation } from './tasksLib'

function task(id: string, statusId: string, position: number, version: number): Task {
  return {
    id, statusId, position, version, projectId: 'project-1', title: id, description: '',
    identifier: id, priority: 'none', assigneeIds: [], creatorId: 'user-1', labels: [],
    attachments: [], dueAt: null, createdAt: '', updatedAt: '', comments: [], activity: [],
  }
}

test('quick search matches title, description and identifier in memory', () => {
  const title = task('ORB-1', 'todo', 0, 1)
  title.title = 'Ship release'
  const description = task('ORB-2', 'todo', 1, 1)
  description.description = 'Prepare launch notes'

  expect(quickSearchTasks([title, description], ' Launch ').map(({ id }) => id)).toEqual(['ORB-2'])
  expect(quickSearchTasks([title, description], 'orb-1').map(({ id }) => id)).toEqual(['ORB-1'])
  const all = [title, description]
  expect(quickSearchTasks(all, '  ')).toBe(all)
})

test('supervisor change warning explains who keeps the right', () => {
  expect(supervisorChangeConfirmation({
    currentSupervisorId: 'me', nextSupervisorId: 'bo', currentUserId: 'me', nextSupervisorName: 'Bo',
  })).toEqual({
    title: 'Change supervisor to Bo?',
    description: 'You will no longer be able to change the supervisor. Only Bo or a workspace admin will be able to change it later.',
    confirmLabel: 'Change supervisor',
    danger: true,
  })
  expect(supervisorChangeConfirmation({
    currentSupervisorId: null, nextSupervisorId: 'me', currentUserId: 'me', nextSupervisorName: 'Me',
  }).description).toBe('You will become the supervisor. Only you or a workspace admin will be able to change it later.')
  expect(supervisorChangeConfirmation({
    currentSupervisorId: 'ada', nextSupervisorId: 'bo', currentUserId: 'admin', nextSupervisorName: 'Bo',
  }).description).toBe('Only Bo or a workspace admin will be able to change it later.')
  expect(supervisorChangeConfirmation({
    currentSupervisorId: 'ada', nextSupervisorId: null, currentUserId: 'admin',
  }).description).toBe('Supervisor-only completion turns off if it is on. Any member who can edit this task can choose a new supervisor.')
})

test('only task people and admins can edit properties', () => {
  const record = { creatorId: 'creator', assigneeIds: ['assignee'], supervisorId: 'supervisor' }
  expect(canEditTaskProperties(record, 'creator', false)).toBe(true)
  expect(canEditTaskProperties(record, 'assignee', false)).toBe(true)
  expect(canEditTaskProperties(record, 'supervisor', false)).toBe(true)
  expect(canEditTaskProperties(record, 'admin', true)).toBe(true)
  expect(canEditTaskProperties(record, 'stranger', false)).toBe(false)
})

test('activity sentences name the changed values', () => {
  const state = {
    users: [{ id: 'u1', name: 'Ada' }, { id: 'u2', name: 'Bo' }],
    statuses: [{ id: 's1', name: 'Backlog' }, { id: 's2', name: 'Done' }],
    labels: [{ id: 'l1', name: 'bug' }],
  } as unknown as Parameters<typeof activityChangeText>[1]
  expect(activityChangeText({ field: 'status', from: 's1', to: 's2' }, state)).toBe('changed status from Backlog to Done')
  expect(activityChangeText({ field: 'status', from: 'gone', to: 's2' }, state)).toBe('changed status to Done')
  expect(activityChangeText({ field: 'priority', from: 'none', to: 'high' }, state)).toBe('set priority to High')
  expect(activityChangeText({ field: 'priority', from: 'high', to: 'none' }, state)).toBe('removed priority')
  expect(activityChangeText({ field: 'assignees', added: ['u1'], removed: ['u2'] }, state)).toBe('assigned Ada and unassigned Bo')
  expect(activityChangeText({ field: 'supervisor', from: null, to: 'u2' }, state)).toBe('set supervisor to Bo')
  expect(activityChangeText({ field: 'supervisor', from: 'u2', to: null }, state)).toBe('removed the supervisor')
  expect(activityChangeText({ field: 'completion_rule', from: false, to: true }, state)).toBe('made completion supervisor-only')
  expect(activityChangeText({ field: 'completion_rule', from: true, to: false }, state)).toBe('restored assignee completion')
  expect(activityChangeText({ field: 'labels', added: [], removed: ['l1', 'gone'] }, state)).toBe('removed labels bug, a deleted label')
  expect(activityChangeText({ field: 'due', start: null, end: null }, state)).toBe('removed due date')
  expect(activityChangeText({ field: 'title', from: 'A', to: 'B' }, state)).toBe('changed title from "A" to "B"')
})
