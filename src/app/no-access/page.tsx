import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "No access" };

export default function NoAccessPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface p-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-danger-50 text-destructive">
        <ShieldAlert className="size-8" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-bold">You don&apos;t have access to this page</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Your role doesn&apos;t include this module. If you believe this is a mistake, please
          contact your laboratory administrator.
        </p>
      </div>
      <Link href="/dashboard" className={buttonVariants()}>
        Back to dashboard
      </Link>
    </div>
  );
}
