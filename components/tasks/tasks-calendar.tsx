"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TaskFormModal } from "@/components/tasks/task-form-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { darkenColor, getContrastTextColor, getStatusTone } from "@/lib/utils/status-colors";
import type { Profile, Project, Task } from "@/lib/types/domain";

const INITIAL_PAST_MONTHS = 4;
const INITIAL_FUTURE_MONTHS = 8;
const LOAD_MORE_MONTHS = 3;
const WHEEL_NAVIGATION_THRESHOLD = 24;
const WHEEL_NAVIGATION_LOCK_MS = 520;

export function TasksCalendar({
  tasks,
  profiles,
  projects,
  availableTasks = tasks,
  redirectPath,
  initialFocusDate,
  title = "Calendar view",
  description = "Tasks grouped by due date in a standard monthly calendar."
}: {
  tasks: Task[];
  profiles: Profile[];
  projects: Project[];
  availableTasks?: Task[];
  redirectPath?: string;
  initialFocusDate?: string;
  title?: string;
  description?: string;
}) {
  const todayMonth = useMemo(() => startOfMonth(new Date()), []);
  const initialAnchorDate = useMemo(() => {
    if (!initialFocusDate) {
      return new Date();
    }

    const parsed = new Date(`${initialFocusDate}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  }, [initialFocusDate]);
  const anchorMonth = useMemo(() => startOfMonth(initialAnchorDate), [initialAnchorDate]);
  const initialAnchorDateKey = useMemo(() => format(initialAnchorDate, "yyyy-MM-dd"), [initialAnchorDate]);
  const [monthRange, setMonthRange] = useState({
    start: -INITIAL_PAST_MONTHS,
    end: INITIAL_FUTURE_MONTHS
  });
  const [activeMonth, setActiveMonth] = useState(anchorMonth);
  const dayRefs = useRef<Record<string, HTMLElement | null>>({});
  const pendingScrollDateKeyRef = useRef<string | null>(initialFocusDate ? initialAnchorDateKey : null);
  const wheelLockRef = useRef(false);
  const wheelLockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestVisibleDateRef = useRef(initialFocusDate ?? initialAnchorDateKey);

  const tasksByDueDate = useMemo(() => {
    const groupedDays = new Map<string, Task[]>();

    tasks.forEach((task) => {
      if (!task.due_date) {
        return;
      }

      const current = groupedDays.get(task.due_date) ?? [];
      current.push(task);
      groupedDays.set(task.due_date, current);
    });

    return groupedDays;
  }, [tasks]);

  const monthSections = useMemo(() => {
    return Array.from({ length: monthRange.end - monthRange.start + 1 }, (_, index) => {
      const offset = monthRange.start + index;
      const month = addMonths(anchorMonth, offset);
      const calendarDays = eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
      });

      while (calendarDays.length < 42) {
        calendarDays.push(addDays(calendarDays[calendarDays.length - 1], 1));
      }

      const weeks: Date[][] = [];

      for (let dayIndex = 0; dayIndex < calendarDays.length; dayIndex += 7) {
        weeks.push(calendarDays.slice(dayIndex, dayIndex + 7));
      }

      const monthTasks = tasks
        .filter((task) => task.due_date && isSameMonth(new Date(`${task.due_date}T00:00:00`), month))
        .sort((left, right) => String(left.due_date).localeCompare(String(right.due_date)));

      const mobileAgenda = new Map<string, Task[]>();
      monthTasks.forEach((task) => {
        if (!task.due_date) {
          return;
        }

        const current = mobileAgenda.get(task.due_date) ?? [];
        current.push(task);
        mobileAgenda.set(task.due_date, current);
      });

      return {
        key: format(month, "yyyy-MM"),
        month,
        monthLabel: format(month, "MMMM yyyy"),
        weeks,
        mobileAgenda: Array.from(mobileAgenda.entries())
      };
    });
  }, [anchorMonth, monthRange.end, monthRange.start, tasks]);

  const activeMonthKey = useMemo(() => format(activeMonth, "yyyy-MM"), [activeMonth]);
  const activeMonthIndex = useMemo(() => {
    const index = monthSections.findIndex((section) => section.key === activeMonthKey);
    return Math.max(0, index);
  }, [activeMonthKey, monthSections]);
  const monthTrackWidth = `${monthSections.length * 100}%`;
  const monthSlideWidth = `${100 / Math.max(1, monthSections.length)}%`;
  const monthTrackOffset = `${activeMonthIndex * (100 / Math.max(1, monthSections.length))}%`;
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  useEffect(() => {
    latestVisibleDateRef.current = initialFocusDate ?? initialAnchorDateKey;
    setMonthRange({
      start: -INITIAL_PAST_MONTHS,
      end: INITIAL_FUTURE_MONTHS
    });
    setActiveMonth(anchorMonth);
    pendingScrollDateKeyRef.current = initialFocusDate ? initialAnchorDateKey : null;
  }, [anchorMonth, initialAnchorDateKey, initialFocusDate]);

  const focusDay = (dateKey: string) => {
    const dayElement = dayRefs.current[dateKey];
    if (!dayElement) {
      return false;
    }

    dayElement.focus({ preventScroll: true });
    return true;
  };

  useLayoutEffect(() => {
    if (pendingScrollDateKeyRef.current) {
      const pendingDateKey = pendingScrollDateKeyRef.current;
      requestAnimationFrame(() => {
        if (pendingDateKey && focusDay(pendingDateKey)) {
          latestVisibleDateRef.current = pendingDateKey;
          pendingScrollDateKeyRef.current = null;
        }
      });
    }
  }, [activeMonthKey, monthSections]);

  useEffect(() => {
    return () => {
      if (wheelLockTimeoutRef.current) {
        clearTimeout(wheelLockTimeoutRef.current);
      }
    };
  }, []);

  const ensureMonthInRange = (month: Date) => {
    const monthOffset =
      (month.getFullYear() - anchorMonth.getFullYear()) * 12 + (month.getMonth() - anchorMonth.getMonth());
    setMonthRange((current) => {
      const nextStart = monthOffset <= current.start + 1 ? Math.min(current.start, monthOffset - LOAD_MORE_MONTHS) : current.start;
      const nextEnd = monthOffset >= current.end - 1 ? Math.max(current.end, monthOffset + LOAD_MORE_MONTHS) : current.end;
      return nextStart === current.start && nextEnd === current.end ? current : { start: nextStart, end: nextEnd };
    });
  };

  const setVisibleMonth = (month: Date, focusDate?: string) => {
    const nextMonth = startOfMonth(month);
    ensureMonthInRange(nextMonth);
    setActiveMonth(nextMonth);
    latestVisibleDateRef.current = focusDate ?? format(nextMonth, "yyyy-MM-dd");
  };

  const navigateMonth = (direction: -1 | 1) => {
    const nextMonth = addMonths(activeMonth, direction);
    setVisibleMonth(nextMonth);
  };

  const handleCalendarWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const dominantDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(dominantDelta) < WHEEL_NAVIGATION_THRESHOLD) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    if (wheelLockRef.current) {
      return;
    }

    wheelLockRef.current = true;
    navigateMonth(dominantDelta > 0 ? 1 : -1);
    wheelLockTimeoutRef.current = setTimeout(() => {
      wheelLockRef.current = false;
    }, WHEEL_NAVIGATION_LOCK_MS);
  };

  const scrollToMonth = (month: Date) => {
    setVisibleMonth(month);
  };

  const renderTaskCard = (task: Task) => {
    const tone = getStatusTone(task.status);
    const textColor = getContrastTextColor(tone.background);
    const borderColor = darkenColor(tone.background, 0.1);

    return (
      <TaskFormModal
        key={task.id}
        profiles={profiles}
        projects={projects}
        availableTasks={availableTasks}
        task={task}
        initialMode="view"
        redirectPath={redirectPath}
        calendarContextDate={latestVisibleDateRef.current}
        triggerVariant="ghost"
        triggerSize="sm"
        triggerAriaLabel={`Task Details for ${task.title}`}
        triggerTitle="Task Details"
        triggerClassName="h-auto w-full cursor-pointer flex-col items-start rounded-xl p-3 text-left shadow-sm transition-[filter,box-shadow,transform] hover:brightness-95 hover:shadow-md"
        triggerStyle={{
          backgroundColor: tone.background,
          borderColor,
          color: textColor
        }}
        triggerLabel={
          <>
            <span className="text-sm font-medium" style={{ color: textColor }}>
              {task.title}
            </span>
            <span className="mt-1 text-xs" style={{ color: textColor, opacity: 0.82 }}>
              {task.project?.name ?? "General task"}
            </span>
          </>
        }
      />
    );
  };

  return (
    <Card className="flex h-[calc(100dvh-11.5rem)] min-h-[520px] flex-col overflow-hidden p-0 max-sm:h-auto max-sm:min-h-0">
      <div className="sticky top-0 z-20 flex flex-col gap-3 border-b border-slate-100 bg-white/95 p-4 backdrop-blur md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <p className="text-sm text-slate-500">{description.replace("standard monthly calendar", "continuous monthly calendar")}</p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <Button variant="secondary" size="sm" onClick={() => scrollToMonth(subMonths(activeMonth, 1))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[180px] text-center">
            <p className="text-sm font-medium text-slate-900">{format(activeMonth, "MMMM yyyy")}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => scrollToMonth(addMonths(activeMonth, 1))} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => scrollToMonth(todayMonth)}>
            Today
          </Button>
        </div>
      </div>
      <div
        className="min-h-0 flex-1 overflow-hidden px-4 pb-4 [touch-action:pan-x_pan-y] max-sm:overflow-x-hidden max-sm:overflow-y-visible"
        onWheel={handleCalendarWheel}
      >
        <div
          className="flex h-full transition-transform duration-500 ease-out will-change-transform max-sm:h-auto"
          style={{ width: monthTrackWidth, transform: `translateX(-${monthTrackOffset})` }}
        >
          {monthSections.map((section) => (
            <section
              key={section.key}
              data-month-key={section.key}
              style={{ flexBasis: monthSlideWidth }}
              className="flex h-full w-full shrink-0 flex-col space-y-3 rounded-[20px] border border-slate-100 bg-white/90 p-3 sm:p-4 max-sm:h-auto"
            >
              <div className="rounded-2xl bg-white/95 px-1 py-2">
                <h3 className="text-base font-semibold text-slate-950 sm:text-lg">{section.monthLabel}</h3>
              </div>

            <div className="space-y-4 sm:hidden">
              {section.mobileAgenda.length ? (
                section.mobileAgenda.map(([date, dayTasks]) => (
                  <div key={date} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                    <p
                      ref={(element) => {
                        dayRefs.current[date] = element;
                      }}
                      className="text-sm font-semibold text-slate-900"
                    >
                      {format(new Date(`${date}T00:00:00`), "EEEE, MMM d")}
                    </p>
                    <div className="mt-3 space-y-2">{dayTasks.map((task) => renderTaskCard(task))}</div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
                  No tasks due in {section.monthLabel}.
                </div>
              )}
            </div>

            <div className="hidden min-h-0 flex-1 sm:block">
              <div className="grid h-full min-w-0 grid-rows-[auto_1fr] overflow-hidden">
                <div className="grid grid-cols-7 border-b border-slate-100">
                  {weekdayLabels.map((label) => (
                    <div key={`${section.key}-${label}`} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {label}
                    </div>
                  ))}
                </div>
                <div className="grid min-h-0 grid-rows-6">
                  {section.weeks.map((week, weekIndex) => (
                    <div key={`${section.key}-week-${weekIndex}`} className="grid min-h-0 grid-cols-7">
                      {week.map((day) => {
                        const dayTasks = tasksByDueDate.get(format(day, "yyyy-MM-dd")) ?? [];
                        const inVisibleMonth = isSameMonth(day, section.month);
                        const isCurrentDay = isToday(day);

                        return (
                          <div
                            key={day.toISOString()}
                            ref={(element) => {
                              if (inVisibleMonth) {
                                dayRefs.current[format(day, "yyyy-MM-dd")] = element;
                              }
                            }}
                            tabIndex={inVisibleMonth ? -1 : undefined}
                            className={`min-h-0 overflow-hidden border-b border-r border-slate-100 p-2 align-top lg:p-3 ${
                              inVisibleMonth ? "bg-white" : "bg-slate-50/70"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                                  isCurrentDay ? "bg-[#0071e3] text-white" : inVisibleMonth ? "text-slate-900" : "text-slate-400"
                                }`}
                              >
                                {format(day, "d")}
                              </span>
                            </div>
                            <div className="mt-2 space-y-1.5 overflow-hidden">{dayTasks.slice(0, 3).map((task) => renderTaskCard(task))}</div>
                            {dayTasks.length > 3 ? <p className="mt-1 text-xs font-medium text-slate-500">+{dayTasks.length - 3} more</p> : null}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            </section>
          ))}
        </div>
      </div>
    </Card>
  );
}
