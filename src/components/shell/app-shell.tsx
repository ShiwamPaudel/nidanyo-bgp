"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NavigationLoader } from "./navigation-loader";
import { Menu, X, LogOut, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { cn, initials } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { visibleNav } from "@/lib/nav";
import type { PermissionKey } from "@/lib/rbac/permissions";
import { logoutAction } from "@/lib/actions/auth-actions";

export interface ShellUser {
  name: string;
  email: string;
  roleName: string;
  permissions: PermissionKey[];
}

export function AppShell({
  user,
  labName,
  badges,
  children,
}: {
  user: ShellUser;
  labName: string;
  badges: Record<string, number>;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const sections = visibleNav(user.permissions);

  return (
    <div className="min-h-screen bg-surface">
      <Suspense fallback={null}>
        <NavigationLoader />
      </Suspense>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex">
        <SidebarBody sections={sections} badges={badges} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-card shadow-lift animate-fade-in">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
            <SidebarBody
              sections={sections}
              badges={badges}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="lg:pl-64">
        <Topbar user={user} labName={labName} onMenu={() => setMobileOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarBody({
  sections,
  badges,
  onNavigate,
}: {
  sections: ReturnType<typeof visibleNav>;
  badges: Record<string, number>;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <>
      <div className="flex h-16 items-center border-b border-border px-5">
        <Logo size="sm" />
      </div>
      <nav className="scroll-thin flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {sections.map((section, i) => (
          <div key={i} className="space-y-1">
            {section.title && (
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/") ||
                (item.href !== "/dashboard" && pathname.startsWith("/settings") && item.href.startsWith("/settings"));
              const count = item.badgeKey ? badges[item.badgeKey] : undefined;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-brand-50 text-brand-700"
                      : "text-foreground/70 hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className={cn("size-[18px] shrink-0", active ? "text-brand-700" : "text-muted-foreground")} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {count ? (
                    <Badge tone={active ? "brand" : "neutral"} className="px-1.5 py-0 text-[10px]">
                      {count > 99 ? "99+" : count}
                    </Badge>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </>
  );
}

function Topbar({ user, labName, onMenu }: { user: ShellUser; labName: string; onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button
        onClick={onMenu}
        className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>
      <div className="lg:hidden">
        <Logo size="sm" />
      </div>
      <div className="hidden lg:block">
        <p className="text-sm font-semibold text-foreground">{labName}</p>
      </div>
      <div className="ml-auto">
        <UserMenu user={user} />
      </div>
    </header>
  );
}

function UserMenu({ user }: { user: ShellUser }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    await logoutAction();
    toast.success("Signed out");
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-brand-700 text-sm font-semibold text-white">
          {initials(user.name)}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-medium leading-tight">{user.name}</span>
          <span className="block text-xs text-muted-foreground">{user.roleName}</span>
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-lift animate-fade-in">
            <div className="border-b border-border p-3">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              <Badge tone="brand" className="mt-2">{user.roleName}</Badge>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-destructive hover:bg-danger-50"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
