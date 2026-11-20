import { expect, test } from 'bun:test'

import type { ProjectRecord, StatusRecord, TaskRecord } from './orbit'
import { canEditTaskProperties, defaultStatusOf, dueLabel, groupTasksByStatus, identifier, myOpenTasks, supervisorChangeConfirmation } from './tasks'

const status = (id: string, name: string, category: string, position: number, project_id = 'p1'): StatusRecord => ({
  id,
  name,
  category,
  position,
  project_id,
  color: '#8b8f98',
  description: '',
  version: 1,
  workspace_id: 'w',
})

const task = (id: string, fields: Partial<TaskRecord>): TaskRecord =>
  ({
    id,
    title: id,
    number: 1,
    project_id: 'p1',
    status_id: 'todo',
    priority: 'none',
    assignee_ids: [],
    due_at: null,
    updated_at: '2026-10-01T00:00:00Z',
    ...fields,
  }) as TaskRecord

const STATUSES = [
  status('done', 'Done', 'completed', 3),
  status('progress', 'In Progress', 'started', 2),
  status('todo', 'Todo', 'unstarted', 1),
  status('backlog', 'Backlog', 'unstarted', 0),
  // the same "Todo" in a second project merges into one group
  status('todo2', 'todo', 'unstarted', 1, 'p2'),
]

test('groups tasks by status in workflow order, merging same-named statuses and dropping empty groups', () => {
  const groups = groupTasksByStatus(
    [
      task('a', { status_id: 'done' }),
      task('b', { status_id: 'todo', priority: 'low' }),
      task('c', { status_id: 'todo2', priority: 'urgent' }),
      task('d', { status_id: 'gone' }),
      task('e', { status_id: 'backlog' }),
    ],
    STATUSES,
  )
  expect(groups.map((group) => [group.name, group.tasks.map((item) => item.id)])).toEqual([
    ['Backlog', ['e']],
    ['Todo', ['c', 'b']],
    ['Done', ['a']],
    ['No status', ['d']],
  ])
})

test('my open tasks: assigned to me, not closed, soonest due first, then priority', () => {
  const mine = myOpenTasks(
    [
      task('later', { assignee_ids: ['me'], due_at: '2026-11-02T00:00:00Z' }),
      task('closed', { assignee_ids: ['me'], status_id: 'done' }),
      task('other', { assignee_ids: ['you'] }),
      task('undated-high', { assignee_ids: ['me'], priority: 'high' }),
      task('soon', { assignee_ids: ['me', 'you'], due_at: '2026-10-25T00:00:00Z' }),
      task('undated-low', { assignee_ids: ['me'], priority: 'low' }),
    ],
    STATUSES,
    'me',
    3,
  )
  expect(mine.map((item) => item.id)).toEqual(['soon', 'later', 'undated-high'])
})

test('only task people and admins can edit properties', () => {
  const record = { creator_id: 'creator', assignee_ids: ['assignee'], supervisor_id: 'supervisor' }
  expect(canEditTaskProperties(record, 'creator', false)).toBe(true)
  expect(canEditTaskProperties(record, 'assignee', false)).toBe(true)
  expect(canEditTaskProperties(record, 'supervisor', false)).toBe(true)
  expect(canEditTaskProperties(record, 'admin', true)).toBe(true)
  expect(canEditTaskProperties(record, 'stranger', false)).toBe(false)
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
    currentSupervisorId: 'ada', nextSupervisorId: 'bo', currentUserId: 'admin', nextSupervisorName: 'Bo',
  }).description).toBe('Only Bo or a workspace admin will be able to change it later.')
  expect(supervisorChangeConfirmation({
    currentSupervisorId: 'ada', nextSupervisorId: null, currentUserId: 'admin',
  }).confirmLabel).toBe('Remove supervisor')
})

test('identifier joins the project key and the number', () => {
  const projects = [{ id: 'p1', key: 'GEN' } as ProjectRecord]
  expect(identifier({ project_id: 'p1', number: 12 }, projects)).toBe('GEN-12')
  expect(identifier({ project_id: 'p9', number: 3 }, projects)).toBe('#3')
})

test('a new task gets the first unstarted status of its project', () => {
  expect(defaultStatusOf(STATUSES, 'p1')?.id).toBe('backlog')
  expect(defaultStatusOf(STATUSES, 'p2')?.id).toBe('todo2')
})

test('due label', () => {
  const now = new Date(2026, 9, 23, 15)
  expect(dueLabel(new Date(2026, 9, 22, 23).toISOString(), now)).toBe('Overdue')
  expect(dueLabel(new Date(2026, 9, 23, 8).toISOString(), now)).toBe('Today')
  expect(dueLabel(new Date(2026, 9, 24, 8).toISOString(), now)).toBe('Tomorrow')
  expect(dueLabel(new Date(2026, 9, 30, 8).toISOString(), now, 'en-US')).toBe('Fri, Oct 30')
})
