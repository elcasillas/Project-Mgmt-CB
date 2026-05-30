"use client";

import { useMemo, useState } from "react";
import { deleteAttachmentAction } from "@/lib/actions/workspace";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { AttachmentUploader } from "@/components/shared/attachment-uploader";
import { TasksCalendar } from "@/components/tasks/tasks-calendar";
import { TaskFormModal } from "@/components/tasks/task-form-modal";
import { TasksBoard } from "@/components/tasks/tasks-board";
import { TaskTable } from "@/components/tasks/task-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate, isDueThisWeek, isOverdue } from "@/lib/utils/format";
import type { Attachment, Profile, Project, Task } from "@/lib/types/domain";

type ViewMode = "table" | "kanban" | "calendar";

export function TasksView({
  tasks,
  profiles,
  projects,
  attachments,
  selectedTaskId,
  initialView = "table",
  availableViews = ["table", "kanban", "calendar"],
  showViewSwitcher = true,
  showCreateTask = true,
  canEditTasks = true,
  redirectPath = "/tasks",
  initialCalendarDate,
  showFilters = true
}: {
  tasks: Task[];
  profiles: Profile[];
  projects: Project[];
  attachments: Attachment[];
  selectedTaskId?: string;
  initialView?: ViewMode;
  availableViews?: ViewMode[];
  showViewSwitcher?: boolean;
  showCreateTask?: boolean;
  canEditTasks?: boolean;
  redirectPath?: string;
  initialCalendarDate?: string;
  showFilters?: boolean;
}) {
  const [view, setView] = useState<ViewMode>(initialView);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [priority, setPriority] = useState("All");
  const [assignee, setAssignee] = useState("All");
  const [project, setProject] = useState("All");
  const [dueWindow, setDueWindow] = useState("All");

  const filteredTasks = useMemo(() => {
    if (!showFilters) {
      return tasks;
    }

    return tasks.filter((task) => {
      const matchesQuery =
        !query ||
        task.title.toLowerCase().includes(query.toLowerCase()) ||
        task.description?.toLowerCase().includes(query.toLowerCase()) ||
        task.project?.name.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = status === "All" || task.status === status;
      const matchesPriority = priority === "All" || task.priority === priority;
      const matchesAssignee = assignee === "All" || task.assignee_id === assignee;
      const matchesProject = project === "All" || task.project_id === project;
      const matchesDueWindow =
        dueWindow === "All" ||
        (dueWindow === "Overdue" && isOverdue(task.due_date, task.status === "Done")) ||
        (dueWindow === "This Week" && isDueThisWeek(task.due_date)) ||
        (dueWindow === "No Due Date" && !task.due_date);

      return matchesQuery && matchesStatus && matchesPriority && matchesAssignee && matchesProject && matchesDueWindow;
    });
  }, [tasks, query, status, priority, assignee, project, dueWindow, showFilters]);

  const selectedTask = tasks.find((task) => task.id === selectedTaskId);
  const taskAttachments = attachments.filter((attachment) => attachment.task_id === selectedTask?.id);

  return (
    <div className="space-y-6">
      {showFilters || showViewSwitcher || showCreateTask ? (
        <div className={`flex flex-col gap-3 ${showFilters ? "lg:flex-row lg:items-center lg:justify-between" : "sm:flex-row sm:items-center sm:justify-end"}`}>
          {showFilters ? (
            <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks, projects, and descriptions" />
              <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option>All</option>
                <option>Not Started</option>
                <option>In Progress</option>
                <option>Blocked</option>
                <option>In Review</option>
                <option>Done</option>
              </Select>
              <Select value={priority} onChange={(event) => setPriority(event.target.value)}>
                <option>All</option>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Urgent</option>
              </Select>
              <Select value={assignee} onChange={(event) => setAssignee(event.target.value)}>
                <option value="All">All assignees</option>
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.full_name}
                  </option>
                ))}
              </Select>
              <Select value={project} onChange={(event) => setProject(event.target.value)}>
                <option value="All">All projects</option>
                {projects.map((currentProject) => (
                  <option key={currentProject.id} value={currentProject.id}>
                    {currentProject.name}
                  </option>
                ))}
              </Select>
              <Select value={dueWindow} onChange={(event) => setDueWindow(event.target.value)}>
                <option>All</option>
                <option>Overdue</option>
                <option>This Week</option>
                <option>No Due Date</option>
              </Select>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2 max-sm:[&>*]:flex-1">
            {showViewSwitcher
              ? availableViews.map((mode) => (
                  <Button key={mode} variant={view === mode ? "primary" : "secondary"} size="sm" onClick={() => setView(mode)} className="min-w-[96px]">
                    {mode[0].toUpperCase() + mode.slice(1)}
                  </Button>
                ))
              : null}
            {showCreateTask ? (
              <TaskFormModal profiles={profiles} projects={projects} availableTasks={tasks} redirectPath="/tasks" triggerSize="sm" />
            ) : null}
          </div>
        </div>
      ) : null}

      {view === "table" ? (
        <TaskTable
          tasks={filteredTasks}
          allTasks={tasks}
          profiles={profiles}
          projects={projects}
          selectedTaskId={selectedTask?.id}
          redirectPath={redirectPath}
          canEditTasks={canEditTasks}
        />
      ) : null}

      {view === "kanban" ? <TasksBoard tasks={filteredTasks} /> : null}

      {view === "calendar" ? (
        <TasksCalendar
          tasks={filteredTasks}
          profiles={profiles}
          projects={projects}
          availableTasks={tasks}
          redirectPath={redirectPath}
          initialFocusDate={initialCalendarDate}
        />
      ) : null}

      {selectedTask ? (
        <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
          <Card className="space-y-5">
            <div>
              <h2 className="break-words text-lg font-semibold text-slate-950">{selectedTask.title}</h2>
              <p className="mt-2 text-sm text-slate-500">{selectedTask.description || "No description provided."}</p>
              <div className="mt-4 space-y-2 text-sm">
                <p className="text-slate-700">
                  <span className="font-semibold text-slate-950">Status:</span>{" "}
                  <span>{selectedTask.status}</span>
                </p>
                <p className="text-slate-700">
                  <span className="font-semibold text-slate-950">Priority:</span>{" "}
                  <span>{selectedTask.priority}</span>
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Project</p>
                <p className="mt-2 font-medium text-slate-900">{selectedTask.project?.name ?? "General task"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Assignee</p>
                <p className="mt-2 font-medium text-slate-900">{selectedTask.assignee?.full_name ?? "Unassigned"}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Due date</p>
                <p className="mt-2 font-medium text-slate-900">{formatDate(selectedTask.due_date)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Estimated hours</p>
                <p className="mt-2 font-medium text-slate-900">{selectedTask.estimated_hours ?? "Not set"}</p>
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Purchase Items</p>
              {selectedTask.purchaseItems?.length ? (
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {selectedTask.purchaseItems.map((item) => (
                    <li key={item.id} className="rounded-xl bg-white px-3 py-2">
                      {item.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 font-medium text-slate-900">No purchase items added</p>
              )}
            </div>
          </Card>
          <Card className="space-y-5">
            <div>
              <h3 className="text-lg font-semibold text-slate-950">Attachments</h3>
              <p className="text-sm text-slate-500">Files linked to the selected task.</p>
            </div>
            <div className="space-y-3">
              {taskAttachments.map((attachment) => (
                <div key={attachment.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="break-words font-medium text-slate-900">{attachment.file_name}</p>
                      <p className="text-xs text-slate-500">{attachment.uploader?.full_name ?? "Unknown uploader"}</p>
                    </div>
                    <div className="flex gap-2">
                      <a href={attachment.file_url} target="_blank" rel="noreferrer" className="text-sm font-medium text-sky-600">
                        Open
                      </a>
                      <ConfirmActionButton
                        action={deleteAttachmentAction}
                        fields={[
                          { name: "attachment_id", value: attachment.id },
                          { name: "file_path", value: attachment.file_path },
                          { name: "project_id", value: selectedTask.project_id ?? "" }
                        ]}
                        variant="ghost"
                        size="sm"
                      >
                        Delete
                      </ConfirmActionButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <AttachmentUploader taskId={selectedTask.id} />
          </Card>
        </div>
      ) : null}
    </div>
  );
}
