import {
  Users,
  ReceiptText,
  Banknote,
  Wallet,
  TestTube,
  FlaskConical,
  CheckCircle2,
  Send,
  Clock,
  Stethoscope,
  Activity,
} from "lucide-react";
import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getLab } from "@/lib/queries/lab";
import {
  getDashboardStats,
  getRevenueTrend,
  getTopTests,
  getCollectionByMode,
  getRecentActivity,
  getPeakHours,
  getRevenueByDoctor,
} from "@/lib/queries/dashboard";
import { PageHeader } from "@/components/ui/page";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { RevenueTrendChart, TopTestsChart, ModeDonut, PeakHoursChart, DoctorRevenueChart } from "@/components/dashboard/charts";
import { formatMoney, money } from "@/lib/utils";
import { fmtRelative } from "@/lib/datetime";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requirePermission(PERMISSIONS.DASHBOARD_VIEW);
  const { lab, settings } = await getLab(user.labId);
  const currency = settings?.currency ?? "NPR";

  const canFinance = hasPermission(user, PERMISSIONS.FINANCE_REPORTS_VIEW) || hasPermission(user, PERMISSIONS.TRANSACTIONS_VIEW);
  const canBilling = hasPermission(user, PERMISSIONS.BILL_VIEW);

  const [stats, trend, topTests, byMode, activity, peakHours, byDoctor] = await Promise.all([
    getDashboardStats(user.labId),
    canFinance ? getRevenueTrend(user.labId) : Promise.resolve([]),
    getTopTests(user.labId),
    canFinance ? getCollectionByMode(user.labId) : Promise.resolve([]),
    getRecentActivity(user.labId),
    getPeakHours(user.labId),
    canFinance ? getRevenueByDoctor(user.labId) : Promise.resolve([]),
  ]);
  const peakBusiest = peakHours.reduce((a, b) => (b.count > a.count ? b : a), { label: "—", count: 0 });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user.name.split(" ")[0]}`}
        description={`Here's what's happening at ${lab?.name ?? "your laboratory"} today.`}
      />

      {/* Top metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Today's patients" value={stats.todayPatients} icon={Users} tone="brand" href="/patients" />
        <StatCard label="Today's visits" value={stats.todayVisits} icon={ReceiptText} tone="info" href="/billing" />
        {canBilling && (
          <StatCard
            label="Today's billing"
            value={formatMoney(stats.todayBilled, currency)}
            sub={`Due generated ${money(stats.todayDueGenerated)}`}
            icon={ReceiptText}
            tone="brand"
          />
        )}
        {canFinance ? (
          <StatCard
            label="Collected today"
            value={formatMoney(stats.todayCollected, currency)}
            sub={`Outstanding ${money(stats.outstandingDue)}`}
            icon={Banknote}
            tone="info"
            href="/transactions"
          />
        ) : (
          <StatCard label="Reports ready" value={stats.readyDispatch} icon={Send} tone="brand" href="/dispatch" />
        )}
      </div>

      {/* Workflow queues */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending collection" value={stats.pendingSamples} icon={TestTube} tone="warning" href="/sample-collection" />
        <StatCard label="Pending results" value={stats.pendingResults} icon={FlaskConical} tone="warning" href="/results" />
        <StatCard label="Awaiting approval" value={stats.pendingApproval} icon={CheckCircle2} tone="warning" href="/approval" />
        {hasPermission(user, PERMISSIONS.DUE_VIEW) ? (
          <StatCard label="Outstanding dues" value={formatMoney(stats.outstandingDue, currency)} icon={Wallet} tone="danger" href="/dues" />
        ) : (
          <StatCard label="Ready to dispatch" value={stats.readyDispatch} icon={Send} tone="brand" href="/dispatch" />
        )}
      </div>

      {/* Quick insight strip */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <StatCard label="Busiest hour (last 30 days)" value={peakBusiest.count > 0 ? peakBusiest.label : "—"} sub={peakBusiest.count > 0 ? `${peakBusiest.count} visits in that hour` : "Not enough data yet"} icon={Clock} tone="info" />
        {canFinance && byDoctor.length > 0 && (
          <StatCard label="Top referrer (30 days)" value={byDoctor[0].doctor} sub={`${formatMoney(byDoctor[0].revenue, currency)} · ${byDoctor[0].count} visits`} icon={Stethoscope} tone="brand" />
        )}
      </div>

      {/* Charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {canFinance && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Revenue trend</CardTitle>
            </CardHeader>
            <CardContent>
              <RevenueTrendChart data={trend} />
            </CardContent>
          </Card>
        )}

        <Card className={canFinance ? "" : "lg:col-span-2"}>
          <CardHeader>
            <CardTitle>Most performed tests</CardTitle>
          </CardHeader>
          <CardContent>
            {topTests.length ? (
              <TopTestsChart data={topTests} />
            ) : (
              <EmptyState title="No tests performed yet" description="Test frequency will appear here once visits are billed." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {canFinance && (
          <Card>
            <CardHeader>
              <CardTitle>Collection by mode (today)</CardTitle>
            </CardHeader>
            <CardContent>
              {byMode.length ? (
                <>
                  <ModeDonut data={byMode} />
                  <div className="mt-3 space-y-1.5">
                    {byMode.map((m) => (
                      <div key={m.mode} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{m.mode}</span>
                        <span className="font-medium tabular">{money(m.total)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState title="No collection today" description="Payments received today appear here." />
              )}
            </CardContent>
          </Card>
        )}

        {/* Peak hours */}
        <Card className={canFinance ? "" : "lg:col-span-2"}>
          <CardHeader>
            <CardTitle>Busiest hours</CardTitle>
          </CardHeader>
          <CardContent>
            {peakHours.some((h) => h.count > 0) ? (
              <PeakHoursChart data={peakHours} />
            ) : (
              <EmptyState icon={Clock} title="No visit data yet" description="Visit volume by hour appears here." />
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length ? (
              <ul className="space-y-3">
                {activity.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                      <Activity className="size-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm leading-tight">{a.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.actorName} · {fmtRelative(a.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={Activity} title="No activity yet" description="Actions across the lab will show up here." />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue by referring doctor */}
      {canFinance && (
        <div className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue by referring doctor (last 30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              {byDoctor.length ? (
                <DoctorRevenueChart data={byDoctor} />
              ) : (
                <EmptyState icon={Stethoscope} title="No referral revenue yet" description="Revenue grouped by referring doctor appears here." />
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
