import type { TaskRecord } from '@orbit/api/generated/types.gen'

/** A task's duration from its start to its end, in hours below a day and whole days above it. */
export function durationText(task: TaskRecord): string | null {
  const start = task.due_start_at ? Date.parse(task.due_start_at) : null
  const end = task.due_at ? Date.parse(task.due_at) : null
  if (start == null) return null
  const hours = Math.max(0, Math.round(((end ?? start) - start) / 3_600_000))
  if (hours < 1) return 'under an hour'
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

/** The task's start and end as one readable line for the calendar list. */
export function rangeText(task: TaskRecord): string {
  const start = task.due_start_at ?? task.due_at
  const end = task.due_at ?? task.due_start_at
  if (!start) return 'No dates'
  const format = (value: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
  return `${format(start)} → ${format(end ?? start)} · ${durationText(task) ?? 'no duration'}`
}
