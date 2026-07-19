"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { money } from "@/lib/utils";

const GREEN = "#075323";
const BLUE = "#144FCA";
const PIE_COLORS = ["#075323", "#144FCA", "#16A34A", "#D97706", "#FF3131", "#647067"];

export function RevenueTrendChart({ data }: { data: { label: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GREEN} stopOpacity={0.25} />
            <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="#647067" />
        <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#647067" width={48} />
        <Tooltip
          formatter={(v: number) => [money(v), "Collected"]}
          contentStyle={{ borderRadius: 12, border: "1px solid #DFE2E2", fontSize: 12 }}
        />
        <Area type="monotone" dataKey="total" stroke={GREEN} strokeWidth={2} fill="url(#rev)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TopTestsChart({ data }: { data: { name: string; count: number; kind?: "group" | "test" }[] }) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            tickLine={false}
            axisLine={false}
            width={120}
            fontSize={11}
            stroke="#647067"
            tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 17) + "…" : v)}
          />
          <Tooltip
            formatter={(v: number, _n, p) => [v, p?.payload?.kind === "group" ? "Times (profile)" : "Times ordered"]}
            contentStyle={{ borderRadius: 12, border: "1px solid #DFE2E2", fontSize: 12 }}
          />
          {/* Profiles (CBC, Lipid Profile…) in green; standalone tests in blue. */}
          <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={16}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.kind === "group" ? GREEN : BLUE} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-1 flex items-center justify-center gap-4 text-[11px] text-[#647067]">
        <span className="inline-flex items-center gap-1"><span className="inline-block size-2 rounded-sm" style={{ background: GREEN }} /> Profile</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block size-2 rounded-sm" style={{ background: BLUE }} /> Test</span>
      </div>
    </div>
  );
}

export function PeakHoursChart({ data }: { data: { label: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={10} stroke="#647067" interval={1} />
        <YAxis tickLine={false} axisLine={false} fontSize={11} stroke="#647067" width={32} allowDecimals={false} />
        <Tooltip formatter={(v: number) => [v, "Visits"]} contentStyle={{ borderRadius: 12, border: "1px solid #DFE2E2", fontSize: 12 }} cursor={{ fill: "#07532310" }} />
        <Bar dataKey="count" fill={GREEN} radius={[4, 4, 0, 0]} barSize={12} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DoctorRevenueChart({ data }: { data: { doctor: string; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="doctor" tickLine={false} axisLine={false} width={130} fontSize={11} stroke="#647067" tickFormatter={(v: string) => (v.length > 20 ? v.slice(0, 19) + "…" : v)} />
        <Tooltip formatter={(v: number) => [money(v), "Revenue"]} contentStyle={{ borderRadius: 12, border: "1px solid #DFE2E2", fontSize: 12 }} cursor={{ fill: "#144FCA10" }} />
        <Bar dataKey="revenue" fill="#144FCA" radius={[0, 6, 6, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ModeDonut({ data }: { data: { mode: string; total: number }[] }) {
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="total" nameKey="mode" innerRadius={52} outerRadius={80} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v: number, n) => [money(v), n as string]}
          contentStyle={{ borderRadius: 12, border: "1px solid #DFE2E2", fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
