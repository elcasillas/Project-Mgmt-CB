"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
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
import { Modal } from "@/components/ui/modal";
import { darkenColor, getContrastTextColor, getStatusTone } from "@/lib/utils/status-colors";
import type { Profile, Project, Task } from "@/lib/types/domain";

const INITIAL_PAST_MONTHS = 4;
const INITIAL_FUTURE_MONTHS = 8;
const LOAD_MORE_MONTHS = 3;
const WHEEL_NAVIGATION_THRESHOLD = 24;
const WHEEL_NAVIGATION_LOCK_MS = 520;
const DAY_TASK_PREVIEW_LIMIT = 2;

export function TasksCalendar({
  tasks,
  profiles,
  projects,
  availableTasks = tasks,
  redirectPath,
  initialFocusDate
}: {
  tasks: Task[];
  profiles: Profile[];
  projects: Project[];
  availableTasks?: Task[];
  redirectPath?: string;
  initialFocusDate?: string;
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
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
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
        end: addDays(startOfWeek(startOfMonth(month), { weekStartsOn: 0 }), 34)
      });

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
  const selectedDayTasks = selectedDayKey ? tasksByDueDate.get(selectedDayKey) ?? [] : [];
  const selectedDayLabel = selectedDayKey ? format(new Date(`${selectedDayKey}T00:00:00`), "EEEE, MMM d, yyyy") : "";

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

  const openDayDetails = (dateKey: string) => {
    latestVisibleDateRef.current = dateKey;
    setSelectedDayKey(dateKey);
  };

  const closeDayDetails = () => {
    setSelectedDayKey(null);
  };

  const renderTaskCard = (task: Task, calendarDateKey: string) => {
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
        calendarContextDate={calendarDateKey}
        triggerVariant="ghost"
        triggerSize="sm"
        triggerAriaLabel={`Task Details for ${task.title}`}
        triggerTitle="Task Details"
        triggerClassName="h-auto w-full cursor-pointer justify-start rounded-lg border px-2 py-1.5 text-left shadow-sm transition-[filter,box-shadow,transform] hover:brightness-95 hover:shadow-md"
        triggerStyle={{
          backgroundColor: tone.background,
          borderColor,
          color: textColor
        }}
        triggerLabel={<span className="block w-full truncate text-[11px] font-medium leading-tight">{task.title}</span>}
      />
    );
  };

  return (
    <Card className="flex h-[calc(100dvh-10rem)] min-h-[520px] flex-col overflow-hidden p-0 max-sm:h-auto max-sm:min-h-0">
      <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-100 bg-white/95 px-3 py-3 backdrop-blur sm:px-4">
        <p className="min-w-0 truncate text-base font-semibold text-slate-950">{format(activeMonth, "MMMM yyyy")}</p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => scrollToMonth(subMonths(activeMonth, 1))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
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
              className="flex h-full w-full shrink-0 flex-col space-y-2 rounded-[20px] border border-slate-100 bg-white/90 p-2.5 sm:p-3 max-sm:h-auto"
            >
              <div className="space-y-3 sm:hidden">
                {section.mobileAgenda.length ? (
                  section.mobileAgenda.map(([date, dayTasks]) => {
                    const visibleTasks = dayTasks.slice(0, DAY_TASK_PREVIEW_LIMIT);
                    const hiddenTasks = dayTasks.slice(DAY_TASK_PREVIEW_LIMIT);
                    const hiddenCount = hiddenTasks.length;

                    return (
                      <div key={date} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-2.5">
                        <p
                          ref={(element) => {
                            dayRefs.current[date] = element;
                          }}
                          tabIndex={-1}
                          className="text-[12px] font-semibold text-slate-900"
                        >
                          {format(new Date(`${date}T00:00:00`), "EEEE, MMM d")}
                        </p>
                        <div className="mt-1.5 space-y-1">
                          {visibleTasks.map((task) => renderTaskCard(task, date))}
                          {hiddenCount > 0 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-auto w-auto justify-start rounded-md px-0 py-0 text-[11px] font-medium text-slate-500 hover:bg-transparent hover:text-slate-700 hover:underline"
                              onClick={() => openDayDetails(date)}
                            >
                              +{hiddenCount} more
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
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
                      <div key={`${section.key}-${label}`} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {label}
                      </div>
                    ))}
                  </div>
                  <div className="grid min-h-0 grid-rows-5">
                    {section.weeks.map((week, weekIndex) => (
                      <div key={`${section.key}-week-${weekIndex}`} className="grid min-h-0 grid-cols-7">
                        {week.map((day) => {
                          const dayKey = format(day, "yyyy-MM-dd");
                          const dayTasks = tasksByDueDate.get(dayKey) ?? [];
                          const visibleTasks = dayTasks.slice(0, DAY_TASK_PREVIEW_LIMIT);
                          const hiddenTasks = dayTasks.slice(DAY_TASK_PREVIEW_LIMIT);
                          const hiddenCount = hiddenTasks.length;
                          const inVisibleMonth = isSameMonth(day, section.month);
                          const isCurrentDay = isToday(day);

                          return (
                            <div
                              key={day.toISOString()}
                              ref={(element) => {
                                if (inVisibleMonth) {
                                  dayRefs.current[dayKey] = element;
                                }
                              }}
                              tabIndex={inVisibleMonth ? -1 : undefined}
                              className={`min-h-0 overflow-hidden border-b border-r border-slate-100 p-1.5 align-top lg:p-2 ${
                                inVisibleMonth ? "bg-white" : "bg-slate-50/70"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span
                                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold ${
                                    isCurrentDay ? "bg-[#0071e3] text-white" : inVisibleMonth ? "text-slate-900" : "text-slate-400"
                                  }`}
                                >
                                  {format(day, "d")}
                                </span>
                              </div>
                              <div className="mt-1 space-y-0.5 overflow-hidden">
                                {visibleTasks.map((task) => renderTaskCard(task, dayKey))}
                              </div>
                              {hiddenCount > 0 ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="mt-0.5 h-auto w-auto justify-start rounded-md px-0 py-0 text-[11px] font-medium text-slate-500 hover:bg-transparent hover:text-slate-700 hover:underline"
                                  onClick={() => openDayDetails(dayKey)}
                                >
                                  +{hiddenCount} more
                                </Button>
                              ) : null}
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
      <Modal
        open={Boolean(selectedDayKey)}
        onClose={closeDayDetails}
        title={selectedDayLabel}
        description="All tasks due on this date."
        panelClassName="max-w-sm"
      >
        <div className="space-y-2">
          {selectedDayTasks.length ? (
            selectedDayTasks.map((task) => (
              <TaskFormModal
                key={`${selectedDayKey}-${task.id}`}
                profiles={profiles}
                projects={projects}
                availableTasks={availableTasks}
                task={task}
                initialMode="view"
                redirectPath={redirectPath}
                calendarContextDate={selectedDayKey ?? latestVisibleDateRef.current}
                triggerVariant="ghost"
                triggerSize="sm"
                triggerAriaLabel={`Task Details for ${task.title}`}
                triggerTitle="Task Details"
                triggerClassName="h-auto w-full justify-start rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-left shadow-sm hover:bg-slate-50"
                triggerLabel={
                  <div className="min-w-0">
                    <span className="block truncate text-sm font-medium leading-tight text-slate-950">{task.title}</span>
                    <span className="mt-0.5 block text-[11px] leading-tight text-slate-500">
                      {task.project?.name ?? "General task"}
                    </span>
                  </div>
                }
              />
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              No tasks due on this date.
            </p>
          )}
        </div>
      </Modal>
    </Card>
  );
}
