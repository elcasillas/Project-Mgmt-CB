"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, ChartNoAxesGantt, FolderKanban, LayoutGrid, ListTodo, Settings, ShieldUser, Users, X } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { NAV_ITEMS } from "@/lib/data/constants";
import { cn } from "@/lib/utils/cn";

const icons = {
  Dashboard: LayoutGrid,
  Projects: FolderKanban,
  Tasks: ListTodo,
  Calendar: Calendar,
  "Gantt Chart": ChartNoAxesGantt,
  Users: ShieldUser,
  Team: Users,
  Settings: Settings
};

const navLinkBaseClass =
  "flex items-center gap-3 rounded-full px-4 py-3 text-[14px] tracking-[-0.01em] transition-colors";
const navLinkInactiveClass = "text-white/85 hover:bg-white/10 hover:text-white dark:text-gray-200 dark:hover:text-white";
const navLinkActiveClass = "bg-white text-black font-semibold dark:bg-white dark:text-black";

function SidebarNav({
  pathname,
  onNavigate,
  linkClassName = navLinkBaseClass,
  activeClassName = navLinkActiveClass,
  inactiveClassName = navLinkInactiveClass
}: {
  pathname: string;
  onNavigate?: () => void;
  linkClassName?: string;
  activeClassName?: string;
  inactiveClassName?: string;
}) {
  return (
    <nav className="space-y-1.5">
      {NAV_ITEMS.map((item) => {
        const Icon = icons[item.label as keyof typeof icons];
        const active = pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(linkClassName, active ? activeClassName : inactiveClassName)}
            onClick={onNavigate}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({
  mobileOpen = false,
  onClose
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      <aside className="fixed inset-y-0 left-0 hidden w-[272px] shrink-0 flex-col border-r border-[rgba(255,255,255,0.08)] bg-[#000000] px-7 py-8 text-white lg:flex">
        <div className="mb-12 flex w-full justify-start">
          <BrandLogo alt="Casibros" width={4775} height={1842} className="h-auto w-full max-w-[216px]" fallbackClassName="w-full max-w-[216px]" />
        </div>
        <SidebarNav pathname={pathname} />
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/45 backdrop-blur-sm transition lg:hidden",
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
        aria-hidden={!mobileOpen}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[60] flex w-[min(84vw,272px)] flex-col border-r border-[rgba(255,255,255,0.08)] bg-[#000000] px-5 py-5 text-white shadow-2xl transition-transform lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!mobileOpen}
      >
        <div className="mb-8 flex items-center gap-4">
          <BrandLogo
            alt="Casibros"
            width={4775}
            height={1842}
            className="h-auto flex-1 w-full max-w-[180px]"
            fallbackClassName="w-full max-w-[180px]"
          />
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/6 text-white"
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <SidebarNav pathname={pathname} onNavigate={onClose} />
      </aside>
    </>
  );
}
