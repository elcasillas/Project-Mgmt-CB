import { PageHeader } from "@/components/shared/page-header";
import { TasksView } from "@/components/tasks/tasks-view";
import { Card } from "@/components/ui/card";
import { getProjects, getTaskAttachments, getTasks, getTeamMembers } from "@/lib/data/queries";

export default async function CalendarPage({
  searchParams
}: {
  searchParams: Promise<{ task?: string; error?: string; success?: string; calendarDate?: string }>;
}) {
  const params = await searchParams;
  const [tasks, projects, teamMembers] = await Promise.all([getTasks(), getProjects(), getTeamMembers()]);
  const attachments = await getTaskAttachments(params.task ? [params.task] : []);
  const profiles = teamMembers.map(({ activeProjects, assignedTasks, workloadSummary, ...profile }) => profile);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Execution Calendar"
        title="Calendar"
        description="Review task timing by date and open work details directly from the monthly schedule."
      />
      {params.error ? (
        <Card className="border-rose-200 bg-rose-50 text-rose-800">
          <p className="text-sm font-medium">{params.error}</p>
        </Card>
      ) : null}
      {params.success ? (
        <Card className="border-emerald-200 bg-emerald-50 text-emerald-800">
          <p className="text-sm font-medium">{params.success}</p>
        </Card>
      ) : null}
      <TasksView
        tasks={tasks}
        projects={projects}
        profiles={profiles}
        attachments={attachments}
        selectedTaskId={params.task}
        initialCalendarDate={params.calendarDate}
        initialView="calendar"
        redirectPath="/calendar"
        showViewSwitcher={false}
        showCreateTask={false}
        showFilters={false}
      />
    </div>
  );
}
