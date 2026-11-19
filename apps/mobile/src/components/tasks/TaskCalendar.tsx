import { useMemo, useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'

import { barsOn, calendarWeeks, localeWeekStart, millisSpan, monthTitle, placeSpans, weekdayName, type SpanEntry } from '@orbit/database/calendar'
import { addMonths, localDay } from '@orbit/database/dates'
import type { StatusRecord, TaskRecord } from '@orbit/api/generated/types.gen'
import { durationText, rangeText } from '../../data/taskCalendar'
import { useTheme } from '../../theme'
import { Icon, Text } from '../../ui'

/** The personal task calendar: a month of days with tasks, and the selected day's tasks below it. */
export function TaskCalendar({ tasks, statuses, onOpen }: { tasks: readonly TaskRecord[]; statuses: readonly StatusRecord[]; onOpen: (taskId: string) => void }) {
  const { colors } = useTheme()
  const taskColor = (task: TaskRecord) => statuses.find((status) => status.id === task.status_id)?.color ?? colors.mutedForeground
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const weekStart = localeWeekStart()
  const today = useMemo(() => localDay(Date.now(), timeZone), [timeZone])
  const [anchor, setAnchor] = useState(today)
  const [selected, setSelected] = useState(today)

  const entries = useMemo<SpanEntry<TaskRecord>[]>(() => tasks.flatMap((task) => {
    const span = millisSpan(
      task.due_start_at ? Date.parse(task.due_start_at) : null,
      task.due_at ? Date.parse(task.due_at) : null,
      timeZone,
    )
    return span ? [{ item: task, span }] : []
  }), [tasks, timeZone])
  const weeks = calendarWeeks(anchor, weekStart)
  const onDay = entries.filter(({ span }) => span.start <= selected && span.end >= selected)
  const undated = tasks.length - entries.length

  return (
    <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
      <View className="flex-row items-center justify-between px-3 py-2">
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={10} onPress={() => setAnchor((day) => addMonths(day, -1))}>
          <Icon name="chevronLeft" size={20} color={colors.mutedForeground} />
        </Pressable>
        <Text className="font-noto-semibold text-[16px] leading-[22px] text-foreground">{monthTitle(anchor)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" hitSlop={10} onPress={() => setAnchor((day) => addMonths(day, 1))}>
          <Icon name="chevronRight" size={20} color={colors.mutedForeground} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Today" onPress={() => { setAnchor(today); setSelected(today) }}>
          <Text className="font-noto-medium text-[13px] text-primary">Today</Text>
        </Pressable>
      </View>
      <View className="flex-row px-1">
        {weeks[0]!.map((day, index) => (
          <View key={index} className="flex-1 items-center py-1">
            <Text className="text-[11px] text-muted-foreground">{weekdayName(day, undefined, 'short').slice(0, 2)}</Text>
          </View>
        ))}
      </View>
      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} className="flex-row border-t border-border">
          {week.map((day, index) => {
            const busy = barsOn(placeSpans(entries, week), index).map((bar) => bar.item)
            const count = busy.length
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityLabel={`${day}, ${count} task${count === 1 ? '' : 's'}`}
                onPress={() => setSelected(day)}
                className={`flex-1 items-center justify-center py-3 ${day === selected ? 'rounded-lg bg-primary/15' : ''}`}
              >
                <Text className={`text-[13px] ${day === today ? 'font-noto-semibold text-primary' : 'text-foreground'}`}>{Number(day.slice(-2))}</Text>
                <View className="mt-1 h-3 flex-row items-center justify-center gap-0.5">
                  {busy.slice(0, 3).map((task) => <View key={task.id} className="size-1 rounded-full" style={{ backgroundColor: taskColor(task) }} />)}
                  {count > 3 ? <Text className="ml-0.5 text-[9px] leading-[12px] text-muted-foreground">+{count - 3}</Text> : null}
                </View>
              </Pressable>
            )
          })}
        </View>
      ))}
      <View className="mt-3 px-3">
        <Text className="font-noto-semibold text-[14px] text-foreground">{onDay.length === 0 ? 'No tasks on this day' : `${onDay.length} task${onDay.length === 1 ? '' : 's'}`}</Text>
        {onDay.map(({ item }) => (
          <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.title}, ${rangeText(item)}`} onPress={() => onOpen(item.id)} className="mt-2 rounded-lg border border-l-2 border-border px-2.5 py-2 active:bg-muted" style={{ borderLeftColor: taskColor(item) }}>
            <Text className="font-noto-medium text-[14px] text-foreground" numberOfLines={1}>{item.title || 'Untitled'}</Text>
            <Text className="mt-0.5 text-[12px] text-muted-foreground" numberOfLines={1}>{rangeText(item)}</Text>
          </Pressable>
        ))}
        {undated > 0 ? <Text className="mt-3 text-[12px] text-muted-foreground">{undated} task{undated === 1 ? '' : 's'} without dates</Text> : null}
      </View>
    </ScrollView>
  )
}
