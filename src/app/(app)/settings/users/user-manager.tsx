"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { saveUser, setUserActive } from "@/lib/actions/settings-actions";

type Role = { id: string; name: string };
type UserRow = { id: string; name: string; email: string; phone: string | null; roleId: string; designation: string | null; registrationNo: string | null };

export function NewUserButton({ roles }: { roles: Role[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Add user</Button>
      {open && <UserFormModal roles={roles} onClose={() => setOpen(false)} />}
    </>
  );
}

export function EditUserButton({ user, roles }: { user: UserRow; roles: Role[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label="Edit"><Pencil className="size-4" /></Button>
      {open && <UserFormModal roles={roles} initial={user} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ToggleUserButton({ userId, active, isSelf }: { userId: string; active: boolean; isSelf: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (isSelf) return null;
  return (
    <Button variant="ghost" size="sm" loading={pending} onClick={() => start(async () => { const r = await setUserActive(userId, !active); r.ok ? toast.success(r.message ?? "") : toast.error(r.error); if (r.ok) router.refresh(); })}>
      {active ? "Deactivate" : "Activate"}
    </Button>
  );
}

function UserFormModal({ roles, initial, onClose }: { roles: Role[]; initial?: UserRow; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    roleId: initial?.roleId ?? roles[0]?.id ?? "",
    designation: initial?.designation ?? "",
    registrationNo: initial?.registrationNo ?? "",
    password: "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function submit() {
    setErrors({});
    start(async () => {
      const res = await saveUser({ ...form, id: initial?.id });
      if (res.ok) { toast.success(res.message ?? "Saved"); onClose(); router.refresh(); }
      else { if (res.fieldErrors) setErrors(res.fieldErrors); toast.error(res.error); }
    });
  }

  return (
    <Modal open onClose={onClose} title={initial ? "Edit user" : "Add user"} description="Staff accounts are created here. There is no public sign-up." size="md"
      footer={<><Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button><Button onClick={submit} loading={pending}>Save user</Button></>}>
      <div className="space-y-3">
        <Field label="Full name" required error={errors.name}><Input value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email" required error={errors.email}><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Phone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        </div>
        <Field label="Role" required error={errors.roleId}>
          <Select value={form.roleId} onChange={(e) => set("roleId", e.target.value)}>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Designation" hint="Shown on reports (for doctors)"><Input value={form.designation} onChange={(e) => set("designation", e.target.value)} placeholder="e.g. MD Pathologist" /></Field>
          <Field label="Registration no."><Input value={form.registrationNo} onChange={(e) => set("registrationNo", e.target.value)} /></Field>
        </div>
        <Field label={initial ? "New password (leave blank to keep)" : "Password"} required={!initial} error={errors.password}>
          <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder={initial ? "••••••••" : "Min 6 characters"} autoComplete="new-password" />
        </Field>
      </div>
    </Modal>
  );
}
