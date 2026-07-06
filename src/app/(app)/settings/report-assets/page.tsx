import { requirePermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getLabAsset } from "@/lib/queries/lab";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssetUploader } from "@/components/settings/asset-uploader";

export const metadata = { title: "Report Assets" };

export default async function ReportAssetsPage() {
  const user = await requirePermission(PERMISSIONS.SETTINGS_MANAGE);
  const [header, footer, logo, billHeader, billFooter] = await Promise.all([
    getLabAsset(user.labId, "report_header"),
    getLabAsset(user.labId, "report_footer"),
    getLabAsset(user.labId, "logo"),
    getLabAsset(user.labId, "bill_header"),
    getLabAsset(user.labId, "bill_footer"),
  ]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Report letterhead</CardTitle>
          <p className="text-sm text-muted-foreground">These images are placed exactly as uploaded at the top and bottom of every A4 report. Use full-width images (recommended width ~1000px).</p>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <AssetUploader kind="report_header" label="Report header" currentUrl={header?.url} currentId={header?.id} hint="Appears at the top of reports" />
          <AssetUploader kind="report_footer" label="Report footer" currentUrl={footer?.url} currentId={footer?.id} hint="Appears at the bottom of reports" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bill letterhead (optional)</CardTitle>
          <p className="text-sm text-muted-foreground">If set, these are used on printed bills. Otherwise the report letterhead is used.</p>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <AssetUploader kind="bill_header" label="Bill header" currentUrl={billHeader?.url} currentId={billHeader?.id} />
          <AssetUploader kind="bill_footer" label="Bill footer" currentUrl={billFooter?.url} currentId={billFooter?.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Logo</CardTitle></CardHeader>
        <CardContent>
          <AssetUploader kind="logo" label="Lab logo" currentUrl={logo?.url} currentId={logo?.id} aspect="square" hint="Square image works best" />
        </CardContent>
      </Card>
    </div>
  );
}
