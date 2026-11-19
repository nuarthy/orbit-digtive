import { useMemo, useState, type CSSProperties } from 'react'
import { Add, ChevronLeft, ChevronRight } from 'reicon-react'
import { barsOn, calendarWeeks, localeWeekStart, millisSpan, monthTitle, placeSpans, weekdayName, type SpanEntry } from '@orbit/database/calendar'
import { addMonths, localDay } from '@orbit/database/dates'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tip } from '@/components/common/Tip'
import type { Task, TaskStatusDef } from '../api/models'

const MAX_LANES = 3
const LANE_HEIGHT = 28
const MORE_HEIGHT = 20

interface TaskCalendarProps {
  tasks: readonly Task[]
  /** Project statuses: their colors and categories drive the bar colors. */
  statuses: readonly TaskStatusDef[]
  onOpen: (taskId: string) => void
  onAdd: () => void
}

/** A bar inherits its project status color: grey to do, amber started, green done, etc. */
export function statusColor(task: Task, statuses: readonly TaskStatusDef[]): string {
  return statuses.find((status) => status.id === task.statusId)?.color ?? 'var(--primary)'
}

function barStyle(color: string): CSSProperties {
  return { backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`, borderLeft: `3px solid ${color}` }
}

/** Duration of a task's date range, rounded to hours below a day and whole days above it. */
export function durationText(task: Task): string | null {
  const start = task.dueStartAt ? Date.parse(task.dueStartAt) : null
  const end = task.dueAt ? Date.parse(task.dueAt) : null
  if (start == null) return null
  const hours = Math.max(0, Math.round(((end ?? start) - start) / 3_600_000))
  if (hours < 1) return 'under an hour'
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

function rangeText(task: Task): string {
  const start = task.dueStartAt ?? task.dueAt
  const end = task.dueAt ?? task.dueStartAt
  if (!start) return 'No dates'
  const format = (value: string) => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
  return `${format(start)} → ${format(end ?? start)} · ${durationText(task) ?? 'no duration'}`
}

/** A personal month calendar: each assigned task is a bar from `due_start_at` to `due_at`. */
export function TaskCalendar({ tasks, statuses, onOpen, onAdd }: TaskCalendarProps) {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const weekStart = localeWeekStart(navigator.language)
  const today = useMemo(() => localDay(Date.now(), timeZone), [timeZone])
  const [anchor, setAnchor] = useState(today)

  const entries = useMemo<SpanEntry<Task>[]>(() => tasks.flatMap((task) => {
    const span = millisSpan(
      task.dueStartAt ? Date.parse(task.dueStartAt) : null,
      task.dueAt ? Date.parse(task.dueAt) : null,
      timeZone,
    )
    return span ? [{ item: task, span }] : []
  }), [tasks, timeZone])
  const undated = tasks.length - entries.length
  const weeks = calendarWeeks(anchor, weekStart)
  const heading = monthTitle(anchor)
  const weekdays = Array.from({ length: 7 }, (_, index) => weekdayName(weeks[0]![index]!, navigator.language))

  return (
    <div className="flex min-h-0 flex-col p-3" data-view="calendar">
      <div className="mb-3 flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" aria-label="Previous month" onClick={() => setAnchor((day) => addMonths(day, -1))}><ChevronLeft /></Button>
        <h2 className="min-w-40 text-center text-sm font-semibold" aria-live="polite">{heading}</h2>
        <Button type="button" variant="outline" size="icon" aria-label="Next month" onClick={() => setAnchor((day) => addMonths(day, 1))}><ChevronRight /></Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setAnchor(today)}>Today</Button>
      </div>
      <div className="grid grid-cols-7 border-b border-border pb-1 text-center text-xs text-muted-foreground">
        {weekdays.map((name, index) => <div key={index}>{name}</div>)}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {weeks.map((week, weekIndex) => {
          const bars = placeSpans(entries, week)
          return (
            <div key={weekIndex} className="border-b border-border">
              <div className="grid grid-cols-7">
                {week.map((day) => (
                  <div key={day} className={cn('px-1 py-2 text-xs tabular-nums', day === today ? 'font-semibold text-primary' : 'text-muted-foreground')}>
                    {Number(day.slice(-2))}
                  </div>
                ))}
              </div>
              {/* Fixed height: no matter how many tasks land on a week, the grid never grows. */}
              <div className="relative" style={{ height: MAX_LANES * LANE_HEIGHT + MORE_HEIGHT }}>
                <div className="absolute inset-0 grid grid-cols-7">
                  {week.map((day, column) => {
                    const hidden = barsOn(bars, column).filter((bar) => bar.lane >= MAX_LANES)
                    // Every day keeps a cell: CSS grid would move a lone overflow chip to column one.
                    return (
                      <div key={day} className="relative">
                        {hidden.length === 0 ? null : (
                          <div className="absolute bottom-0 left-0.5 right-0.5">
                            <DayTasksPopover
                              label={`+${hidden.length} more`}
                              tasks={hidden.map((bar) => bar.item)}
                              statuses={statuses}
                              onOpen={onOpen}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {bars.filter((bar) => bar.lane < MAX_LANES).map((bar) => (
                  <Tip key={bar.item.id} label={rangeText(bar.item)}>
                    <button
                      type="button"
                      aria-label={`${bar.item.title} · ${rangeText(bar.item)}`}
                      onClick={() => onOpen(bar.item.id)}
                      className={cn(
                        'absolute flex items-center gap-1 overflow-hidden rounded px-1.5 text-left text-xs text-foreground hover:brightness-110',
                        bar.continuesBefore && 'rounded-l-none',
                        bar.continuesAfter && 'rounded-r-none',
                      )}
                      style={{
                        ...barStyle(statusColor(bar.item, statuses)),
                        left: `calc(${(bar.column / 7) * 100}% + 2px)`,
                        width: `calc(${(bar.length / 7) * 100}% - 4px)`,
                        top: bar.lane * LANE_HEIGHT + 2,
                        height: LANE_HEIGHT - 4,
                      }}
                    >
                      <span className="truncate">{bar.item.title || 'Untitled'}</span>
                      <span className="ml-auto shrink-0 text-muted-foreground">{durationText(bar.item)}</span>
                    </button>
                  </Tip>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>{undated > 0 ? `${undated} task${undated === 1 ? '' : 's'} without dates` : 'Every task has a date'}</span>
        <Button type="button" variant="ghost" size="sm" onClick={onAdd}>
          <Add /> New task
        </Button>
      </div>
    </div>
  )
}

/** The overflow of one day: all its tasks stay reachable without making the week taller. */
function DayTasksPopover({ label, tasks, statuses, onOpen }: { label: string; tasks: readonly Task[]; statuses: readonly TaskStatusDef[]; onOpen: (taskId: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<button type="button" className="h-[18px] w-full truncate rounded px-1 text-left text-[11px] text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50" />}
      >
        {label}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 gap-0 p-1">
        <ul className="flex max-h-80 flex-col overflow-y-auto">
          {tasks.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                className="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-muted/60"
                onClick={() => { setOpen(false); onOpen(task.id) }}
              >
                <span className="flex items-center gap-1.5">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: statusColor(task, statuses) }} />
                  <span className="truncate text-sm text-foreground">{task.title || 'Untitled'}</span>
                </span>
                <span className="truncate pl-3.5 text-xs text-muted-foreground">{rangeText(task)}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
