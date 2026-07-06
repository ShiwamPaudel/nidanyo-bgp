"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PERMISSION_GROUPS } from "@/lib/rbac/permissions";
import { updateRolePermissions } from "@/lib/actions/settings-actions";

export function RoleEditor({ role }: { role: { id: string; name: string; key: string; description: string | null; permissions: string[]; isAdmin: boolean } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set(role.permissions));

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }
  function save() {
    start(async () => {
      const res = await updateRolePermissions(role.id, [...selected]);
      res.ok ? toast.success(res.message ?? "Saved") : toast.error(res.error);
      if (res.ok) router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{role.name}</h3>
              {role.isAdmin && <Badge tone="brand">Full access</Badge>}
            </div>
            {role.description && <p className="text-sm text-muted-foreground">{role.description}</p>}
          </div>
          {!role.isAdmin && <Button size="sm" onClick={save} loading={pending}><Save className="size-4" /> Save</Button>}
        </div>

        {role.isAdmin ? (
          <p className="rounded-lg bg-surface p-3 text-sm text-muted-foreground">Administrator roles always have access to every module and cannot be limited.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
                <div className="space-y-1.5">
                  {group.items.map((item) => (
                    <label key={item.key} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={selected.has(item.key)} onChange={() => toggle(item.key)} className="size-4 rounded border-border accent-[#075323]" />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
