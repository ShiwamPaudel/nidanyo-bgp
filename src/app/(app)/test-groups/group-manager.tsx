"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Search, ChevronUp, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { cn, money } from "@/lib/utils";
import { saveGroup, setGroupActive, loadGroupForEdit } from "@/lib/actions/catalog-actions";
import type { GroupInput } from "@/lib/validators/catalog";

type Option = { id: string; name: string };
type TestOption = { id: string; name: string; price: number; shortCode: string };

const blank = (): GroupInput & { id?: string } => ({ name: "", shortCode: null, departmentId: null, pricingMode: "fixed", groupPrice: 0, testIds: [] });

export function NewGroupButton({ departments, tests }: { departments: Option[]; tests: TestOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Add profile</Button>
      {open && <GroupFormModal departments={departments} tests={tests} initial={blank()} onClose={() => setOpen(false)} />}
    </>
  );
}

export function EditGroupButton({ groupId, departments, tests }: { groupId: string; departments: Option[]; tests: TestOption[] }) {
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<(GroupInput & { id?: string }) | null>(null);
  const [loading, setLoading] = useState(false);
  async function openEdit() {
    setLoading(true);
    const res = await loadGroupForEdit(groupId);
    setLoading(false);
    if (res.ok) { setInitial(res.data); setOpen(true); } else toast.error(res.error);
  }
  return (
    <>
      <Button variant="ghost" size="icon-sm" onClick={openEdit} loading={loading} aria-label="Edit"><Pencil className="size-4" /></Button>
      {open && initial && <GroupFormModal departments={departments} tests={tests} initial={initial} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ToggleGroupButton({ groupId, active }: { groupId: string; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return <Button variant="ghost" size="sm" loading={pending} onClick={() => start(async () => { const r = await setGroupActive(groupId, !active); r.ok ? toast.success(r.message ?? "") : toast.error(r.error); if (r.ok) router.refresh(); })}>{active ? "Deactivate" : "Activate"}</Button>;
}

function GroupFormModal({ departments, tests, initial, onClose }: { departments: Option[]; tests: TestOption[]; initial: GroupInput & { id?: string }; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState(initial);
  const [search, setSearch] = useState("");
  const set = <K extends keyof GroupInput>(k: K, v: (GroupInput & { id?: string })[K]) => setForm((f) => ({ ...f, [k]: v }));

  const selected = new Set(form.testIds);
  const filtered = useMemo(() => {
    const ql = search.trim().toLowerCase();
    return tests.filter((t) => !ql || t.name.toLowerCase().includes(ql) || t.shortCode.toLowerCase().includes(ql));
  }, [search, tests]);
  const sumPrice = tests.filter((t) => selected.has(t.id)).reduce((s, t) => s + t.price, 0);

  const testById = useMemo(() => new Map(tests.map((t) => [t.id, t])), [tests]);

  function toggle(id: string) {
    set("testIds", selected.has(id) ? form.testIds.filter((x) => x !== id) : [...form.testIds, id]);
  }

  /** Move a test up/down the print order. saveGroup writes displayOrder from this array's order. */
  function move(index: number, dir: -1 | 1) {
    const to = index + dir;
    if (to < 0 || to >= form.testIds.length) return;
    const next = [...form.testIds];
    [next[index], next[to]] = [next[to], next[index]];
    set("testIds", next);
  }

  function submit() {
    start(async () => {
      const res = await saveGroup(form);
      if (res.ok) { toast.success(res.message ?? "Saved"); onClose(); router.refresh(); } else toast.error(res.error);
    });
  }

  return (
    <Modal open onClose={onClose} title={form.id ? "Edit profile" : "Add profile"} description="Bundle tests into a profile with its own pricing." size="lg"
      footer={<><Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button><Button onClick={submit} loading={pending}>Save profile</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Profile name" required><Input value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus /></Field>
          <Field label="Short code"><Input value={form.shortCode ?? ""} onChange={(e) => set("shortCode", e.target.value || null)} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Department"><Select value={form.departmentId ?? ""} onChange={(e) => set("departmentId", e.target.value || null)}><option value="">—</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
          <Field label="Pricing"><Select value={form.pricingMode} onChange={(e) => set("pricingMode", e.target.value as "fixed" | "sum")}><option value="fixed">Fixed group price</option><option value="sum">Sum of tests</option></Select></Field>
          <Field label="Group price" hint={form.pricingMode === "sum" ? `Auto: ${money(sumPrice)}` : undefined}>
            <Input type="number" min={0} value={form.groupPrice} onChange={(e) => set("groupPrice", Number(e.target.value))} disabled={form.pricingMode === "sum"} />
          </Field>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Included tests <Badge tone="neutral">{form.testIds.length}</Badge></p>
          </div>

          {/* Print order. This list's order IS the order the tests appear in on
              the report and the result entry screen — saveGroup persists it as
              each item's displayOrder. */}
          {form.testIds.length > 0 && (
            <div className="mb-3 rounded-lg border border-border">
              <p className="border-b border-border px-2 py-1 text-xs text-muted-foreground">
                Print order — tests appear on the report in this order
              </p>
              <div className="scroll-thin max-h-44 overflow-y-auto">
                {form.testIds.map((id, i) => {
                  const t = testById.get(id);
                  return (
                    <div key={id} className="flex items-center gap-1 border-b border-border/50 px-2 py-1 last:border-0">
                      <span className="w-5 shrink-0 tabular text-xs text-muted-foreground">{i + 1}</span>
                      <span className="flex-1 truncate text-sm">{t?.name ?? "(unknown test)"}</span>
                      <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                        <ChevronUp className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === form.testIds.length - 1} onClick={() => move(i, 1)}>
                        <ChevronDown className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => toggle(id)}>
                        <X className="size-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search tests…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="scroll-thin grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
            {filtered.map((t) => {
              const active = selected.has(t.id);
              return (
                <button key={t.id} type="button" onClick={() => toggle(t.id)} className={cn("flex items-center justify-between rounded-lg border p-2 text-left text-sm transition-colors", active ? "border-brand-600 bg-brand-50" : "border-border hover:bg-surface")}>
                  <span className="truncate">{t.name}</span>
                  <span className="ml-2 flex items-center gap-2"><span className="text-xs tabular text-muted-foreground">{money(t.price)}</span><span className={cn("text-[10px] font-medium", active ? "text-brand-700" : "text-info")}>{active ? "✓" : "+"}</span></span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
