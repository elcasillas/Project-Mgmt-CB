"use client";

import { Eye, Pencil, Plus, Trash } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/shared/form-field";
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/data/constants";
import { cn } from "@/lib/utils/cn";
import { formatTaskDate, getTaskDateInputValue } from "@/lib/utils/task-dates";
import { resolveTaskDependencyNames } from "@/lib/utils/task-dependencies";
import { saveTaskAction } from "@/lib/actions/workspace";
import type { Profile, Project, Task, TaskPurchaseItem } from "@/lib/types/domain";

type ModalMode = "view" | "edit" | "create";
const TASK_MODAL_PANEL_CLASS = "max-w-4xl";

function logTaskModalDebug(marker: string, payload?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "production") {
    console.info(marker, payload ?? {});
  }
}

function serializeTaskForm(form: HTMLFormElement) {
  const formData = new FormData(form);
  const values: string[] = [];

  for (const [key, value] of formData.entries()) {
    values.push(`${key}:${value instanceof File ? `${value.name}:${value.size}:${value.type}` : String(value)}`);
  }

  return values.join("|");
}

function createEmptyPurchaseItem(): TaskPurchaseItem {
  return {
    id: crypto.randomUUID(),
    name: ""
  };
}

function DetailField({
  label,
  value,
  className
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-[12px] bg-white px-4 py-3.5 shadow-[rgba(0,0,0,0.05)_0px_8px_24px]", className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgba(29,29,31,0.5)]">{label}</p>
      <div className="mt-2 break-words text-[15px] font-medium leading-[1.35] tracking-[-0.01em] text-[#1d1d1f]">{value}</div>
    </div>
  );
}

export function TaskFormModal({
  profiles,
  projects,
  task,
  availableTasks = [],
  initialProjectId,
  lockProjectSelection = false,
  triggerLabel = "New Task",
  triggerAriaLabel,
  triggerTitle,
  triggerIconOnly = false,
  triggerVariant,
  triggerSize,
  triggerClassName,
  triggerStyle,
  renderTrigger,
  initialMode,
  redirectPath,
  calendarContextDate
}: {
  profiles: Profile[];
  projects: Project[];
  task?: Task;
  availableTasks?: Task[];
  initialProjectId?: string;
  lockProjectSelection?: boolean;
  triggerLabel?: React.ReactNode;
  triggerAriaLabel?: string;
  triggerTitle?: string;
  triggerIconOnly?: boolean;
  triggerVariant?: "primary" | "secondary" | "ghost" | "danger";
  triggerSize?: "sm" | "md";
  triggerClassName?: string;
  triggerStyle?: React.CSSProperties;
  renderTrigger?: (options: {
    open: () => void;
    defaultMode: ModalMode;
    ariaLabel?: string;
    title?: string;
  }) => React.ReactNode;
  initialMode?: "view" | "edit";
  redirectPath?: string;
  calendarContextDate?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const defaultMode: ModalMode = task ? (initialMode ?? "edit") : "create";
  const [persistedTask, setPersistedTask] = useState<Task | undefined>(task);
  const [modalMode, setModalMode] = useState<ModalMode>(defaultMode);
  const [returnToViewOnEditExit, setReturnToViewOnEditExit] = useState(defaultMode === "view");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeTask = persistedTask ?? task;
  const [selectedProjectId, setSelectedProjectId] = useState(activeTask?.project_id ?? initialProjectId ?? "");
  const [selectedDependencyIds, setSelectedDependencyIds] = useState<string[]>(activeTask?.dependency_ids ?? []);
  const [purchaseItems, setPurchaseItems] = useState<TaskPurchaseItem[]>(
    activeTask?.purchaseItems?.length ? activeTask.purchaseItems : [createEmptyPurchaseItem()]
  );
  const [dependencyQuery, setDependencyQuery] = useState("");
  const defaultTriggerText = typeof triggerLabel === "string" ? triggerLabel : undefined;
  const defaultTaskTriggerLabel = task && defaultMode === "view" ? "Task Details" : defaultTriggerText;
  const formRef = useRef<HTMLFormElement>(null);
  const closeSourceRef = useRef("initial");
  const skipUnsavedWarningRef = useRef(false);
  const wasOpenRef = useRef(false);
  const formKey = `${activeTask?.id ?? "new"}:${activeTask?.updated_at ?? "draft"}:${modalMode}`;
  const addPurchaseItem = () => {
    setPurchaseItems((current) => [...current, createEmptyPurchaseItem()]);
  };
  const updatePurchaseItem = (itemId: string, name: string) => {
    setPurchaseItems((current) => current.map((entry) => (entry.id === itemId ? { ...entry, name } : entry)));
  };
  const removePurchaseItem = (itemId: string) => {
    setPurchaseItems((current) => (current.length === 1 ? [createEmptyPurchaseItem()] : current.filter((entry) => entry.id !== itemId)));
  };
  const openModal = () => {
    setModalMode(defaultMode);
    setReturnToViewOnEditExit(defaultMode === "view");
    setOpen(true);
  };
  const handleModalDismiss = () => {
    const source = closeSourceRef.current;
    logTaskModalDebug("TASK_MODAL_DISMISS", {
      source,
      modalMode,
      returnToViewOnEditExit,
      activeTaskId: activeTask?.id ?? null
    });
    setError(null);
    if (modalMode === "edit" && task && returnToViewOnEditExit && source !== "save-success") {
      setModalMode("view");
      return;
    }

    setOpen(false);
  };
  const {
    isDirty: isTaskFormDirty,
    confirmOpen,
    requestClose,
    confirmLeave,
    stay,
    markClean,
    markCleanUntilNextChange
  } = useUnsavedChangesGuard({
    formRef,
    open: open && modalMode === "edit",
    onDiscard: handleModalDismiss,
    resetKey: formKey
  });
  const markTaskFormClean = (reason: string, options?: { untilNextChange?: boolean }) => {
    if (options?.untilNextChange) {
      skipUnsavedWarningRef.current = true;
      markCleanUntilNextChange();
    } else {
      skipUnsavedWarningRef.current = false;
      markClean();
    }
    logTaskModalDebug("TASK_MARK_CLEAN_CALLED", {
      reason,
      untilNextChange: Boolean(options?.untilNextChange),
      modalMode,
      activeTaskId: activeTask?.id ?? null
    });
  };
  const handleRequestClose = (source: string) => {
    closeSourceRef.current = source;
    logTaskModalDebug("TASK_CLOSE_REQUEST", {
      source,
      modalMode,
      skip: skipUnsavedWarningRef.current,
      isDirty: isTaskFormDirty,
      confirmOpen,
      activeTaskId: activeTask?.id ?? null
    });
    requestClose();
    if (skipUnsavedWarningRef.current) {
      skipUnsavedWarningRef.current = false;
    }
  };
  const selectedProject = projects.find((projectOption) => projectOption.id === selectedProjectId);
  const dependencyNames = activeTask ? resolveTaskDependencyNames(activeTask, availableTasks) : [];
  const sectionClassName = "rounded-[12px] bg-white p-5 shadow-[rgba(0,0,0,0.08)_0px_12px_32px]";
  const sectionHeadingClassName = "text-[21px] font-semibold leading-[1.19] tracking-[0.01em] text-[#1d1d1f]";
  const availableDependencyTasks = availableTasks.filter(
    (candidateTask) => candidateTask.project_id === selectedProjectId && candidateTask.id !== activeTask?.id
  );
  const filteredDependencyTasks = availableDependencyTasks.filter((candidateTask) => {
    const query = dependencyQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return (
      candidateTask.title.toLowerCase().includes(query) ||
      candidateTask.status.toLowerCase().includes(query) ||
      candidateTask.id.toLowerCase().includes(query)
    );
  });

  const buildRedirectHref = (message: string, savedTask?: Task) => {
    if (!redirectPath) {
      return null;
    }

    const [pathname, search = ""] = redirectPath.split("?");
    const params = new URLSearchParams(search);
    params.set("success", message);

    if (pathname === "/calendar") {
      // Calendar saves must carry a stable date anchor forward so the calendar can restore
      // the edited task's visible month/day instead of falling back to route-level defaults.
      const calendarDate = savedTask?.due_date ?? savedTask?.start_date ?? calendarContextDate;
      if (calendarDate) {
        params.set("calendarDate", calendarDate);
      } else {
        params.delete("calendarDate");
      }
    }

    const nextQuery = params.toString();
    return `${pathname}${nextQuery ? `?${nextQuery}` : ""}` as Route;
  };

  useEffect(() => {
    setPersistedTask(task);
  }, [task]);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      closeSourceRef.current = "closed";
      skipUnsavedWarningRef.current = false;
      return;
    }

    if (wasOpenRef.current) {
      return;
    }

    wasOpenRef.current = true;
    const taskToInitialize = persistedTask ?? task;
    setModalMode(defaultMode);
    setReturnToViewOnEditExit(defaultMode === "view");
    setSelectedProjectId(taskToInitialize?.project_id ?? initialProjectId ?? "");
    setSelectedDependencyIds(taskToInitialize?.dependency_ids ?? []);
    setPurchaseItems(taskToInitialize?.purchaseItems?.length ? taskToInitialize.purchaseItems : [createEmptyPurchaseItem()]);
    setDependencyQuery("");
    setError(null);
  }, [open, defaultMode, initialProjectId, persistedTask, task]);

  useEffect(() => {
    logTaskModalDebug("TASK_MODAL_RENDER", {
      open,
      modalMode,
      activeTaskId: activeTask?.id ?? null,
      isDirty: isTaskFormDirty,
      confirmOpen,
      skip: skipUnsavedWarningRef.current,
      returnToViewOnEditExit
    });
  }, [activeTask?.id, confirmOpen, isTaskFormDirty, modalMode, open, returnToViewOnEditExit]);

  useEffect(() => {
    if (isTaskFormDirty) {
      skipUnsavedWarningRef.current = false;
    }
  }, [isTaskFormDirty]);

  useEffect(() => {
    if (!confirmOpen) {
      return;
    }

    logTaskModalDebug("TASK_WARNING_DIALOG_OPENED_FROM", {
      component: "TaskFormModal",
      source: closeSourceRef.current,
      modalMode,
      isDirty: isTaskFormDirty,
      activeTaskId: activeTask?.id ?? null
    });
  }, [activeTask?.id, confirmOpen, isTaskFormDirty, modalMode]);

  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedDependencyIds([]);
      return;
    }

    const validDependencyIds = new Set(
      availableTasks
        .filter((candidateTask) => candidateTask.project_id === selectedProjectId && candidateTask.id !== activeTask?.id)
        .map((candidateTask) => candidateTask.id)
    );
    setSelectedDependencyIds((current) => current.filter((dependencyId) => validDependencyIds.has(dependencyId)));
  }, [selectedProjectId, activeTask?.id, availableTasks]);

  return (
    <>
      {renderTrigger ? (
        renderTrigger({
          open: openModal,
          defaultMode,
          ariaLabel: triggerAriaLabel ?? defaultTaskTriggerLabel,
          title: triggerTitle ?? triggerAriaLabel ?? defaultTaskTriggerLabel
        })
      ) : (
        <Button
          onClick={openModal}
          variant={triggerVariant ?? (task ? "secondary" : "primary")}
          size={triggerSize ?? "md"}
          className={
            triggerIconOnly
              ? `h-9 w-9 rounded-md border border-gray-200 bg-transparent p-0 text-slate-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#00ADB1] ${triggerClassName ?? ""}`
              : triggerClassName
          }
          aria-label={triggerAriaLabel ?? defaultTriggerText}
          title={triggerTitle ?? triggerAriaLabel ?? defaultTriggerText}
          style={triggerStyle}
        >
          {triggerIconOnly ? (defaultMode === "view" ? <Eye className="h-4 w-4" /> : <Pencil className="h-4 w-4" />) : triggerLabel}
        </Button>
      )}
      <Modal
        open={open}
        onClose={() => handleRequestClose("modal-x")}
        title={modalMode === "create" ? "Create Task" : modalMode === "edit" ? "Edit Task" : "Task Details"}
        description={
          modalMode === "view"
            ? "Review task ownership, timing, dependencies, and project linkage."
            : "Shape scope, ownership, and timing in one focused workflow."
        }
        panelClassName={TASK_MODAL_PANEL_CLASS}
        headerActions={
          activeTask && modalMode === "view" ? (
            <Button
              variant="ghost"
              size="sm"
              className="bg-[rgba(255,255,255,0.72)]"
              aria-label="Edit Task"
              title="Edit Task"
              onClick={() => {
                setReturnToViewOnEditExit(true);
                setModalMode("edit");
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          ) : null
        }
      >
        {error ? <p className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
        {modalMode === "view" && activeTask ? (
          <div className="space-y-4">
            <section className="rounded-[12px] bg-[#1d1d1f] px-4 py-4 text-white sm:px-5 sm:py-5">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-white/55">Task overview</p>
                <h3 className="mt-3 text-[24px] font-semibold leading-[1.12] tracking-[-0.02em] break-words sm:text-[28px]">
                  {activeTask.title}
                </h3>
                <p className="mt-2 max-w-3xl text-[14px] leading-[1.45] tracking-[-0.01em] text-white/78">
                  {activeTask.description || "No description provided."}
                </p>
                <div className="mt-3 flex flex-col gap-2.5 pt-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-medium tracking-[-0.01em] text-white/65">Status:</span>
                    <Badge value={activeTask.status} className="px-2.5 py-0.5 text-[11px]" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-medium tracking-[-0.01em] text-white/65">Priority:</span>
                    <Badge value={activeTask.priority} className="px-2.5 py-0.5 text-[11px]" />
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-3 md:grid-cols-2">
              <DetailField label="Project" value={activeTask.project?.name ?? "Not set"} />
              <DetailField label="Dependencies" value={dependencyNames.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {dependencyNames.map((dependencyName) => (
                    <span
                      key={`${activeTask.id}:${dependencyName}`}
                      className="inline-flex rounded-full bg-[#f5f5f7] px-2.5 py-1 text-[12px] font-medium tracking-[-0.01em] text-[rgba(29,29,31,0.72)]"
                    >
                      {dependencyName}
                    </span>
                  ))}
                </div>
              ) : "None"} />
              <DetailField label="Assignee" value={activeTask.assignee?.full_name ?? "Not set"} />
              <DetailField label="Reporter" value={activeTask.reporter?.full_name ?? "Not set"} />
              <DetailField label="Start date" value={formatTaskDate(activeTask.start_date)} />
              <DetailField label="Due date" value={formatTaskDate(activeTask.due_date)} />
              <DetailField
                label="Purchase Items"
                className="md:col-span-2"
                value={
                  activeTask.purchaseItems?.length ? (
                    <ul className="space-y-1.5 text-[14px] font-medium leading-[1.4] text-[#1d1d1f]">
                      {activeTask.purchaseItems.map((item) => (
                        <li key={item.id} className="rounded-[10px] bg-[#f5f5f7] px-3 py-2">
                          {item.name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    "No purchase items added"
                  )
                }
              />
            </div>

            <div className="flex justify-end border-t border-[rgba(29,29,31,0.08)] pt-1">
              <Button type="button" variant="ghost" onClick={() => handleRequestClose("view-close-button")} className="max-sm:w-full">
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form
            key={formKey}
            ref={formRef}
            className="space-y-6"
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={activeTask?.id ?? ""} />
            <div className="rounded-[12px] bg-[#1d1d1f] px-5 py-6 text-white">
              <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-white/55">
                {activeTask ? "Task refinement" : "Task creation"}
              </p>
              <h3 className="mt-3 text-[28px] font-semibold leading-[1.14] tracking-[-0.02em]">
                {activeTask ? activeTask.title : "Define the work clearly before execution starts."}
              </h3>
            </div>

            <section className={sectionClassName}>
              <div className="mb-5 space-y-1">
                <h3 className={sectionHeadingClassName}>Core Details</h3>
                <p className="text-[14px] leading-[1.43] tracking-[-0.01em] text-[rgba(29,29,31,0.56)]">
                  Start with the task identity, project placement, and execution priority.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <FormField label="Title">
                    <Input name="title" defaultValue={activeTask?.title} required />
                  </FormField>
                </div>
                <FormField label="Project">
                  {lockProjectSelection ? (
                    <>
                      <input type="hidden" name="project_id" value={selectedProjectId} />
                      <div className="flex min-h-11 items-center rounded-[11px] border border-[rgba(29,29,31,0.08)] bg-[#fafafc] px-4 text-[15px] text-slate-700">
                        {selectedProject?.name ?? "Current project"}
                      </div>
                    </>
                  ) : (
                    <Select
                      name="project_id"
                      value={selectedProjectId}
                      onChange={(event) => {
                        setSelectedProjectId(event.target.value);
                      }}
                    >
                      <option value="">No project</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>
                <FormField label="Status">
                  <Select name="status" defaultValue={activeTask?.status ?? "Not Started"}>
                    {TASK_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Priority">
                  <Select name="priority" defaultValue={activeTask?.priority ?? "Medium"}>
                    {TASK_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <div className="md:col-span-2">
                  <FormField label="Description">
                    <Textarea name="description" defaultValue={activeTask?.description ?? ""} className="min-h-[140px]" />
                  </FormField>
                </div>
              </div>
            </section>

            <section className={sectionClassName}>
              <div className="mb-5 space-y-1">
                <h3 className={sectionHeadingClassName}>Ownership And Schedule</h3>
                <p className="text-[14px] leading-[1.43] tracking-[-0.01em] text-[rgba(29,29,31,0.56)]">
                  Assign accountability and set the dates and effort needed to finish the work.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Assignee">
                  <Select name="assignee_id" defaultValue={activeTask?.assignee_id ?? ""}>
                    <option value="">Unassigned</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.full_name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Reporter">
                  <Select name="reporter_id" defaultValue={activeTask?.reporter_id ?? ""}>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.full_name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Start date">
                  <Input name="start_date" type="date" defaultValue={getTaskDateInputValue(activeTask?.start_date)} />
                </FormField>
                <FormField label="Due date">
                  <Input name="due_date" type="date" defaultValue={getTaskDateInputValue(activeTask?.due_date)} />
                </FormField>
              </div>
            </section>

            <section className={sectionClassName}>
              <div className="mb-5 space-y-1">
                <h3 className={sectionHeadingClassName}>Purchase Items</h3>
                <p className="text-[14px] leading-[1.43] tracking-[-0.01em] text-[rgba(29,29,31,0.56)]">
                  Track anything that may need to be bought before the task can be completed.
                </p>
              </div>
              <input type="hidden" name="purchase_items" value={JSON.stringify(purchaseItems)} />
              <div className="space-y-3">
                {purchaseItems.map((item, index) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <Input
                      value={item.name}
                      onChange={(event) => updatePurchaseItem(item.id, event.target.value)}
                      placeholder="Enter item to purchase"
                      aria-label={`Purchase item ${index + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove purchase item ${index + 1}`}
                      title="Remove item"
                      className="mt-1 h-10 w-10 shrink-0 rounded-[11px] border border-[rgba(29,29,31,0.08)] bg-white p-0 text-slate-600 hover:bg-slate-50"
                      onClick={() => removePurchaseItem(item.id)}
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={addPurchaseItem}
                >
                  <Plus className="h-4 w-4" />
                  + Add Item
                </Button>
              </div>
            </section>

            <section className={sectionClassName}>
              <div className="mb-5 space-y-1">
                <h3 className={sectionHeadingClassName}>Dependencies</h3>
                <p className="text-[14px] leading-[1.43] tracking-[-0.01em] text-[rgba(29,29,31,0.56)]">
                  Define the tasks that must land first so execution order stays explicit.
                </p>
              </div>
              <FormField
                label="Dependencies"
                hint={
                  selectedProjectId
                    ? "Select tasks in this project that must be completed first."
                    : "Choose a project before selecting dependencies."
                }
              >
                <input type="hidden" name="dependency_ids" value={selectedDependencyIds.join(",")} />
                <div className="space-y-3 rounded-[11px] border border-[rgba(29,29,31,0.08)] bg-[#fafafc] p-4">
                  <Input
                    value={dependencyQuery}
                    onChange={(event) => setDependencyQuery(event.target.value)}
                    placeholder="Search tasks by name or status"
                    disabled={!selectedProjectId || !availableDependencyTasks.length}
                  />
                  {selectedProjectId ? (
                    availableDependencyTasks.length ? (
                      <div className="max-h-56 space-y-2 overflow-y-auto">
                        {filteredDependencyTasks.length ? (
                          filteredDependencyTasks.map((candidateTask) => {
                            const isSelected = selectedDependencyIds.includes(candidateTask.id);

                            return (
                              <button
                                key={candidateTask.id}
                                type="button"
                                className={`flex w-full items-start justify-between rounded-2xl border px-4 py-3 text-left transition ${
                                  isSelected
                                    ? "border-[#0071e3] bg-[#e8f3ff]"
                                    : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                                }`}
                                onClick={() => {
                                  setSelectedDependencyIds((current) =>
                                    current.includes(candidateTask.id)
                                      ? current.filter((dependencyId) => dependencyId !== candidateTask.id)
                                      : [...current, candidateTask.id]
                                  );
                                }}
                              >
                                <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                                  <span className="truncate text-sm font-medium text-slate-900">{candidateTask.title}</span>
                                  <Badge value={candidateTask.status} className="shrink-0" />
                                </div>
                                <span
                                  className={`ml-4 mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                                    isSelected ? "border-[#0071e3] bg-[#0071e3] text-white" : "border-gray-300 text-transparent"
                                  }`}
                                >
                                  ✓
                                </span>
                              </button>
                            );
                          })
                        ) : (
                          <p className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-3 text-sm text-slate-500">
                            No matching tasks found in this project.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-3 text-sm text-slate-500">
                        No other tasks available in this project.
                      </p>
                    )
                  ) : (
                    <p className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-3 text-sm text-slate-500">
                      Select a project to choose dependency tasks.
                    </p>
                  )}
                </div>
              </FormField>
            </section>

            <div className="rounded-[12px] bg-white p-5 shadow-[rgba(0,0,0,0.08)_0px_12px_32px]">
              <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
                <Button type="button" variant="ghost" onClick={() => handleRequestClose("edit-cancel-button")} className="max-sm:w-full">
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={isSaving}
                  className="max-sm:w-full"
                  onClick={async () => {
                    if (!formRef.current) {
                      return;
                    }

                    const formData = new FormData(formRef.current);
                    logTaskModalDebug("TASK_SUBMIT_STARTED", {
                      activeTaskId: activeTask?.id ?? null,
                      modalMode,
                      isDirty: isTaskFormDirty,
                      purchaseItems
                    });
                    try {
                      setIsSaving(true);
                      setError(null);
                      logTaskModalDebug("TASK_SAVE_REQUEST_SENT", {
                        activeTaskId: activeTask?.id ?? null,
                        modalMode
                      });
                      const result = await saveTaskAction(formData);
                      if (!result?.ok) {
                        setError(result?.message || "Unable to save task.");
                        return;
                      }
                      logTaskModalDebug("TASK_SAVE_SUCCESS", {
                        activeTaskId: activeTask?.id ?? null,
                        resultTaskId: result.task?.id ?? null,
                        resultTask: result.task
                      });
                      if (result.task) {
                        setPersistedTask(result.task);
                        setPurchaseItems(result.task.purchaseItems?.length ? result.task.purchaseItems : [createEmptyPurchaseItem()]);
                      }
                      logTaskModalDebug("TASK_SAVE_SUCCESS_CLOSE", {
                        activeTaskId: result.task?.id ?? activeTask?.id ?? null
                      });
                      flushSync(() => {
                        closeSourceRef.current = "save-success";
                        markTaskFormClean("save-success-close", { untilNextChange: true });
                        setOpen(false);
                      });
                      logTaskModalDebug("TASK_DIRTY_STATE_AFTER_CLEAN", {
                        activeTaskId: result.task?.id ?? activeTask?.id ?? null,
                        isDirty: false,
                        skip: true
                      });
                      const nextRedirectHref = buildRedirectHref(result.message, result.task ?? activeTask);
                      if (nextRedirectHref) {
                        if (redirectPath === "/calendar") {
                          router.push(nextRedirectHref, { scroll: false });
                        } else {
                          router.push(nextRedirectHref);
                        }
                      }
                      router.refresh();
                    } catch (saveError) {
                      const message = saveError instanceof Error ? saveError.message : "Unable to save task.";
                      logTaskModalDebug("TASK_SAVE_EXCEPTION", {
                        activeTaskId: activeTask?.id ?? null,
                        message
                      });
                      setError(message);
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                >
                  {isSaving ? "Saving..." : activeTask ? "Save" : "Create task"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </Modal>
      <ConfirmationDialog
        open={confirmOpen}
        title="Unsaved Changes"
        description="You have unsaved changes. Do you want to leave without saving?"
        confirmLabel="Leave Without Saving"
        cancelLabel="Stay"
        confirmVariant="primary"
        onConfirm={confirmLeave}
        onCancel={stay}
      />
    </>
  );
}
