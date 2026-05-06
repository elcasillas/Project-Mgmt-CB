"use client";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { useState } from "react";
import type { Profile, Project, Task } from "@/lib/types/domain";

export function AppShell({
  children,
  profile,
  workspaceName,
  projects,
  tasks
}: {
  children: React.ReactNode;
  profile: Profile | null;
  workspaceName: string;
  projects: Project[];
  tasks: Task[];
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="h-screen overflow-hidden bg-[#f5f5f7] text-[#1d1d1f]">
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="flex h-full min-w-0 flex-1 flex-col lg:pl-[272px]">
        <Header
          profile={profile}
          workspaceName={workspaceName}
          projects={projects}
          tasks={tasks}
          onOpenMobileNav={() => setMobileNavOpen(true)}
        />
        <main id="app-content-scroll" className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
