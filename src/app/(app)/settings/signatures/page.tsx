import { eq, and, asc } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { db } from "@/db/client";
import { users, labAssets } from "@/db/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { AssetUploader } from "@/components/settings/asset-uploader";

export const metadata = { title: "Signatures" };

export default async function SignaturesPage() {
  const me = await requirePermission(PERMISSIONS.USERS_MANAGE);
  const staff = await db.select().from(users).where(eq(users.labId, me.labId)).orderBy(asc(users.name));
  // Doctors/pathologists/admins are the typical signatories.
  const signatories = staff.filter((u) => ["pathologist", "lab_admin", "super_admin"].includes(u.roleKey));
  const sigRows = await db.select().from(labAssets).where(and(eq(labAssets.labId, me.labId), eq(labAssets.kind, "signature"), eq(labAssets.isActive, true)));
  const sigByUser = new Map(sigRows.filter((s) => s.ownerUserId).map((s) => [s.ownerUserId!, s]));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Upload signatures for doctors and pathologists. A signature only appears on reports the person has approved.</p>
      {signatories.length === 0 ? (
        <EmptyState title="No signatories" description="Add a doctor or pathologist user first." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {signatories.map((u) => {
            const sig = sigByUser.get(u.id);
            return (
              <Card key={u.id}>
                <CardContent className="pt-5">
                  <div className="mb-3">
                    <p className="font-semibold">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.designation ?? "—"}</p>
                    {u.signatureAssetId ? <Badge tone="success" className="mt-1">Signature set</Badge> : <Badge tone="neutral" className="mt-1">No signature</Badge>}
                  </div>
                  <AssetUploader kind="signature" ownerUserId={u.id} currentUrl={sig?.url} currentId={sig?.id} label="Signature image" hint="Transparent PNG recommended" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
