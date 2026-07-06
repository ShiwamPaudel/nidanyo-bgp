import { LabLoader } from "@/components/ui/lab-loader";

export default function PublicReportLoading() {
  return (
    <div className="min-h-screen bg-surface">
      <LabLoader label="Loading your report" />
    </div>
  );
}
