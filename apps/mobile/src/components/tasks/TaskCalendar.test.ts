import { expect, test } from 'bun:test'
import type { TaskRecord } from '@orbit/api/generated/types.gen'
import { durationText } from '../../data/taskCalendar'

const task = (due_start_at: string | null, due_at: string | null) => ({ title: 'Task', due_start_at, due_at }) as TaskRecord

test('task duration follows the task date range', () => {
  expect(durationText(task(null, null))).toBe(null)
  expect(durationText(task('2026-11-20T09:00:00Z', '2026-11-20T11:00:00Z'))).toBe('2h')
  expect(durationText(task('2026-11-20T09:00:00Z', null))).toBe('under an hour')
  expect(durationText(task('2026-11-20T09:00:00Z', '2026-11-22T17:00:00Z'))).toBe('2 days')
})
