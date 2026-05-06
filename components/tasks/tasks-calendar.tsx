"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
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
const APP_SCROLL_CONTAINER_ID = "app-content-scroll";

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
  const [activeMonthKey, setActiveMonthKey] = useState(() => format(anchorMonth, "yyyy-MM"));
  const didRestoreInitialPositionRef = useRef(false);
  const monthRefs = useRef<Record<string, HTMLElement | null>>({});
  const dayRefs = useRef<Record<string, HTMLElement | null>>({});
  const scrollRootRef = useRef<HTMLElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);
  const calendarContainerRef = useRef<HTMLDivElement | null>(null);
  const prependAnchorRef = useRef<{ height: number; scrollTop: number } | null>(null);
  const pendingScrollMonthKeyRef = useRef<string | null>(null);
  const pendingScrollDateKeyRef = useRef<string | null>(initialFocusDate ? initialAnchorDateKey : null);
  const topLoadLockedRef = useRef(false);
  const bottomLoadLockedRef = useRef(false);

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

  const activeMonth = useMemo(() => {
    return monthSections.find((section) => section.key === activeMonthKey)?.month ?? anchorMonth;
  }, [activeMonthKey, monthSections]);
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  useEffect(() => {
    setMonthRange({
      start: -INITIAL_PAST_MONTHS,
      end: INITIAL_FUTURE_MONTHS
    });
    setActiveMonthKey(format(anchorMonth, "yyyy-MM"));
    didRestoreInitialPositionRef.current = false;
    pendingScrollMonthKeyRef.current = null;
    pendingScrollDateKeyRef.current = initialFocusDate ? initialAnchorDateKey : null;
  }, [anchorMonth, initialAnchorDateKey, initialFocusDate]);

  useEffect(() => {
    scrollRootRef.current = document.getElementById(APP_SCROLL_CONTAINER_ID);
  }, []);

  const scrollSectionIntoView = (section: HTMLElement, behavior: ScrollBehavior = "auto") => {
    const scrollRoot = scrollRootRef.current;
    if (!scrollRoot) {
      section.scrollIntoView({ behavior, block: "start" });
      return;
    }

    const rootRect = scrollRoot.getBoundingClientRect();
    const sectionRect = section.getBoundingClientRect();
    const nextTop = scrollRoot.scrollTop + (sectionRect.top - rootRect.top) - 12;
    scrollRoot.scrollTo({ top: Math.max(0, nextTop), behavior });
  };

  const scrollDayIntoView = (dateKey: string, behavior: ScrollBehavior = "smooth") => {
    const dayElement = dayRefs.current[dateKey];
    if (!dayElement) {
      return false;
    }

    const scrollRoot = scrollRootRef.current;
    if (!scrollRoot) {
      dayElement.scrollIntoView({ behavior, block: "center" });
      return true;
    }

    const rootRect = scrollRoot.getBoundingClientRect();
    const dayRect = dayElement.getBoundingClientRect();
    const nextTop = scrollRoot.scrollTop + (dayRect.top - rootRect.top) - Math.max(24, rootRect.height * 0.2);
    scrollRoot.scrollTo({ top: Math.max(0, nextTop), behavior });
    return true;
  };

  useEffect(() => {
    if (didRestoreInitialPositionRef.current) {
      return;
    }

    const targetMonthKey = format(anchorMonth, "yyyy-MM");
    const targetMonthElement = monthRefs.current[targetMonthKey];
    if (!targetMonthElement) {
      return;
    }

    scrollSectionIntoView(targetMonthElement);
    didRestoreInitialPositionRef.current = true;

    if (pendingScrollDateKeyRef.current) {
      requestAnimationFrame(() => {
        if (pendingScrollDateKeyRef.current && scrollDayIntoView(pendingScrollDateKeyRef.current, "auto")) {
          pendingScrollDateKeyRef.current = null;
        }
      });
    }
  }, [anchorMonth, monthSections]);

  useEffect(() => {
    const topSentinel = topSentinelRef.current;
    const bottomSentinel = bottomSentinelRef.current;
    if (!topSentinel || !bottomSentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            if (entry.target === topSentinel) {
              topLoadLockedRef.current = false;
            }
            if (entry.target === bottomSentinel) {
              bottomLoadLockedRef.current = false;
            }
            return;
          }

          if (!didRestoreInitialPositionRef.current) {
            return;
          }

          if (entry.target === topSentinel && !topLoadLockedRef.current) {
            topLoadLockedRef.current = true;
            prependAnchorRef.current = {
              height: calendarContainerRef.current?.offsetHeight ?? 0,
              scrollTop: scrollRootRef.current?.scrollTop ?? 0
            };
            setMonthRange((current) => ({
              start: current.start - LOAD_MORE_MONTHS,
              end: current.end
            }));
          }

          if (entry.target === bottomSentinel && !bottomLoadLockedRef.current) {
            bottomLoadLockedRef.current = true;
            setMonthRange((current) => ({
              start: current.start,
              end: current.end + LOAD_MORE_MONTHS
            }));
          }
        });
      },
      {
        root: scrollRootRef.current,
        rootMargin: "400px 0px",
        threshold: 0
      }
    );

    observer.observe(topSentinel);
    observer.observe(bottomSentinel);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const anchor = prependAnchorRef.current;
    if (!anchor) {
      const pendingMonthKey = pendingScrollMonthKeyRef.current;
      if (!pendingMonthKey) {
        return;
      }

      const targetSection = monthRefs.current[pendingMonthKey];
      if (targetSection) {
        scrollSectionIntoView(targetSection, "smooth");
      }
      if (pendingScrollDateKeyRef.current) {
        requestAnimationFrame(() => {
          if (pendingScrollDateKeyRef.current && scrollDayIntoView(pendingScrollDateKeyRef.current)) {
            pendingScrollDateKeyRef.current = null;
          }
        });
      }
      pendingScrollMonthKeyRef.current = null;
      return;
    }

    const nextHeight = calendarContainerRef.current?.offsetHeight ?? 0;
    const heightDelta = nextHeight - anchor.height;
    if (heightDelta !== 0 && scrollRootRef.current) {
      scrollRootRef.current.scrollTop = anchor.scrollTop + heightDelta;
    }
    prependAnchorRef.current = null;
  }, [monthSections]);

  useEffect(() => {
    const sections = monthSections
      .map((section) => monthRefs.current[section.key])
      .filter((section): section is HTMLElement => Boolean(section));
    if (!sections.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio);
        if (!visibleEntries.length) {
          return;
        }

        const monthKey = visibleEntries[0].target.getAttribute("data-month-key");
        if (monthKey) {
          setActiveMonthKey(monthKey);
        }
      },
      {
        root: scrollRootRef.current,
        rootMargin: "-15% 0px -55% 0px",
        threshold: [0.2, 0.4, 0.6]
      }
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, [monthSections]);

  const scrollToMonth = (month: Date) => {
    const monthKey = format(startOfMonth(month), "yyyy-MM");
    const section = monthRefs.current[monthKey];
    if (section) {
      scrollSectionIntoView(section, "smooth");
      return;
    }

    const monthOffset =
      (month.getFullYear() - anchorMonth.getFullYear()) * 12 + (month.getMonth() - anchorMonth.getMonth());
    pendingScrollMonthKeyRef.current = monthKey;
    setMonthRange((current) => ({
      start: Math.min(current.start, monthOffset),
      end: Math.max(current.end, monthOffset)
    }));
    setActiveMonthKey(monthKey);
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
        calendarContextDate={task.due_date ?? task.start_date ?? format(activeMonth, "yyyy-MM-dd")}
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
    <Card className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
      <div ref={calendarContainerRef} className="space-y-6">
        <div ref={topSentinelRef} aria-hidden="true" className="h-px w-full" />
        {monthSections.map((section) => (
          <section
            key={section.key}
            data-month-key={section.key}
            ref={(element) => {
              monthRefs.current[section.key] = element;
            }}
            className="space-y-4 rounded-[28px] border border-slate-100 bg-white/90 p-3 sm:p-4"
          >
            <div className="sticky top-0 z-10 -mx-1 rounded-2xl bg-white/95 px-1 py-2 backdrop-blur">
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

            <div className="hidden overflow-x-auto sm:block">
              <div className="min-w-[840px]">
                <div className="grid grid-cols-7 border-b border-slate-100">
                  {weekdayLabels.map((label) => (
                    <div key={`${section.key}-${label}`} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {label}
                    </div>
                  ))}
                </div>
                <div className="space-y-0">
                  {section.weeks.map((week, weekIndex) => (
                    <div key={`${section.key}-week-${weekIndex}`} className="grid grid-cols-7">
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
                            className={`min-h-[160px] border-b border-r border-slate-100 p-3 align-top ${
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
                            <div className="mt-3 space-y-2">{dayTasks.map((task) => renderTaskCard(task))}</div>
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
        <div ref={bottomSentinelRef} aria-hidden="true" className="h-px w-full" />
      </div>
    </Card>
  );
}
