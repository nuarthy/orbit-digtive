import { expect, test } from 'bun:test'
import type { Task } from '../api/models'
import { durationText } from './TaskCalendar'

const task = (dueStartAt: string | null, dueAt: string | null) => ({ title: 'Task', dueStartAt, dueAt }) as Task

test('task duration follows the task date range', () => {
  expect(durationText(task(null, null))).toBe(null)
  expect(durationText(task('2026-11-20T09:00:00Z', '2026-11-20T11:00:00Z'))).toBe('2h')
  expect(durationText(task('2026-11-20T09:00:00Z', null))).toBe('under an hour')
  expect(durationText(task('2026-11-20T09:00:00Z', '2026-11-22T17:00:00Z'))).toBe('2 days')
})
