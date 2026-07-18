import { Fragment } from "react";
import { PrintHeader, PrintFooter, type LabInfo } from "./letterhead";
import { flagSymbol, type ResultFlag } from "@/lib/result-flags";
import { ageLabel } from "@/lib/utils";
import { fmtDateTime, type CalendarSystem } from "@/lib/datetime";

export interface ReportValue {
  id: string;
  label: string;
  valueText: string | null;
  unit: string | null;
  refText: string | null;
  flag: string;
}
export interface ReportEntry {
  entry: {
    id: string;
    testName: string;
    interpretation: string | null;
    approvedByName: string | null;
    approvedByDesignation: string | null;
    approvedAt: Date | number | null;
  };
  values: ReportValue[];
  department: string | null;
  note?: string | null;
  method?: string | null;
}

/** Admin-managed signatory shown at the end of the report. */
export interface ReportSignatory {
  id: string;
  name: string;
  description: string | null;
  url: string;
}

export interface ReportSheetProps {
  lab: LabInfo;
  headerUrl: string | null;
  footerUrl: string | null;
  /** Blank band reserved at the top of EVERY page when the header is hidden — set it to the height of your pre-printed letterhead. */
  marginTopMm?: number;
  /** Blank band reserved at the bottom of EVERY page when the footer is hidden. */
  marginBottomMm?: number;
  marginXMm?: number;
  /** When false, the digital header band is hidden but its blank space is still reserved on every page (for printing on pre-printed letterpads). */
  showHeader?: boolean;
  /** When false, the digital footer band is hidden but its blank space is still reserved on every page. */
  showFooter?: boolean;
  /** Display calendar (AD/BS). Passed explicitly since this component renders client-side. */
  cal?: CalendarSystem;
  patient: {
    fullName: string;
    code: string;
    gender: string;
    ageValue: number | null;
    ageUnit: string | null;
    phone: string | null;
    address?: string | null;
    referredBy?: string | null;
  };
  visit: { code: string; referredBy: string | null; visitDate: Date | number };
  entries: ReportEntry[];
  /** Admin-managed signatories rendered at the end of the report (last page). */
  signatories?: ReportSignatory[];
  qrDataUrl?: string;
  publicUrl?: string | null;
  watermark?: string;
}

/** A4 final report. Header/footer come from uploaded assets; nothing is hard-coded. */
export function ReportSheet({
  lab,
  headerUrl,
  footerUrl,
  marginTopMm = 14,
  marginBottomMm = 14,
  marginXMm = 12,
  showHeader = true,
  showFooter = true,
  cal,
  patient,
  visit,
  entries,
  signatories = [],
  qrDataUrl,
  publicUrl,
  watermark,
}: ReportSheetProps) {
  return (
    <div className="a4-sheet relative shadow-card print-sheet" style={{ padding: 0 }}>
      {watermark && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rotate-[-30deg] text-[80px] font-bold uppercase tracking-widest text-[#0E1B14] opacity-[0.04]">{watermark}</span>
        </div>
      )}

      {/*
        A <table> is used so the browser repeats the letterhead header (thead) and
        footer (tfoot) on every printed page. When the digital band is toggled off,
        an empty spacer of the same reserved height keeps the blank margin on each
        page so content never overprints a pre-printed physical letterpad.
      */}
      <table className="w-full border-collapse">
        <thead className="table-header-group">
          <tr>
            <td style={{ padding: 0 }}>
              {/* minHeight, not height: the configured margin is a floor. With the
                  header on, a taller letterhead still wins; with it off, this is
                  the blank reserve for a pre-printed pad. Repeated on every page
                  because a thead is a table-header-group. */}
              <div style={{ minHeight: `${marginTopMm}mm` }}>
                {showHeader ? <PrintHeader headerUrl={headerUrl} lab={lab} /> : null}
              </div>
            </td>
          </tr>
        </thead>
        <tfoot className="table-footer-group">
          <tr>
            <td style={{ padding: 0 }}>
              {/* Reserve the BOTTOM margin here — this used to reuse marginTopMm,
                  so the configured bottom margin never had any effect. */}
              <div style={{ minHeight: `${marginBottomMm}mm` }}>
                {showFooter ? <PrintFooter footerUrl={footerUrl} lab={lab} /> : null}
              </div>
            </td>
          </tr>
        </tfoot>
        <tbody>
          <tr>
            <td style={{ padding: `3mm ${marginXMm}mm` }}>
              <ReportBody cal={cal} patient={patient} visit={visit} entries={entries} signatories={signatories} qrDataUrl={qrDataUrl} publicUrl={publicUrl} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export type ReportBodyProps = Pick<ReportSheetProps, "cal" | "patient" | "visit" | "entries" | "qrDataUrl" | "publicUrl"> & {
  signatories?: ReportSignatory[];
};

/**
 * The printable content of a report (everything between the letterhead header
 * and footer). Shared by the table-based ReportSheet and the paged.js print
 * view so both render identical content.
 */
export function ReportBody({ cal, patient, visit, entries, signatories = [], qrDataUrl, publicUrl }: ReportBodyProps) {
  // Group entries by department for clean sectioning.
  const byDept = new Map<string, ReportEntry[]>();
  for (const e of entries) {
    const key = e.department ?? "Investigations";
    const arr = byDept.get(key) ?? [];
    arr.push(e);
    byDept.set(key, arr);
  }

  // Report date is taken from the (first) approved entry. Signatures no longer
  // depend on the approver — they come from the admin-managed signatory list.
  const reportMeta = entries[0]?.entry;
  const interpretations = entries.filter((e) => e.entry.interpretation).map((e) => ({ test: e.entry.testName, text: e.entry.interpretation! }));

  return (
    <>
      <div className="mt-2 text-center">
        <h2 className="inline-block rounded bg-brand-50 px-4 py-0.5 text-[12px] font-bold uppercase tracking-wider text-brand-700">Laboratory Report</h2>
      </div>

      {/* Patient + meta */}
      <div className="mt-3 grid grid-cols-2 gap-3 border-y border-[#0E1B14]/12 py-2 text-[11px]">
        <div className="space-y-0.5">
          <Line label="Patient" value={patient.fullName} bold />
          <Line label="Patient ID" value={patient.code} />
          <Line label="Age / Sex" value={`${ageLabel(patient.ageValue, patient.ageUnit)} / ${patient.gender}`} />
          <Line label="Address" value={patient.address ?? "—"} />
        </div>
        <div className="space-y-0.5 text-right">
          <Line label="Visit No" value={visit.code} align="right" bold />
          <Line label="Referred by" value={visit.referredBy ?? patient.referredBy ?? "—"} align="right" />
          <Line label="Report date" value={fmtDateTime(reportMeta?.approvedAt ?? visit.visitDate, cal)} align="right" />
        </div>
      </div>

      {/*
        Results by department — ONE table per department, so the column header is
        printed once instead of once per test. A single-value test (Dengue IgG →
        "Negative") is then just one row: repeating its name as both a heading and
        the row label wasted three lines each. Multi-parameter tests (Stool R/E)
        still get a name row above their parameters.
      */}
      {[...byDept.entries()].map(([dept, list]) => (
        // break-inside-avoid keeps a department whole: it stays on this page if
        // it fits in the space left, otherwise the entire section moves to the
        // next page rather than splitting its heading from its tests. (A
        // department taller than a full page still has to break — nothing can
        // fit it otherwise.)
        <div key={dept} className="mt-4 break-inside-avoid">
          <p className="mb-1 bg-[#F1F5F2] px-2 py-1 text-[13px] font-extrabold uppercase tracking-wide text-brand-700">{dept}</p>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-[#0E1B14]/15 text-left text-[#647067]">
                <th className="w-[38%] py-1">Investigation</th>
                <th className="w-[20%] py-1">Result</th>
                <th className="w-[14%] py-1">Unit</th>
                <th className="w-[28%] py-1">Reference Range</th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => {
                const only = e.values.length === 1 ? e.values[0] : null;
                // Collapse to one line only when the single value is the test
                // itself — a lone parameter under a different name still needs
                // both names shown, so it keeps the grouped form.
                const oneLiner =
                  only != null && only.label.trim().toLowerCase() === e.entry.testName.trim().toLowerCase();

                return (
                  <Fragment key={e.entry.id}>
                    {oneLiner ? (
                      <ValueRow value={only!} label={e.entry.testName} method={e.method} />
                    ) : (
                      <>
                        <tr className="break-inside-avoid">
                          <td colSpan={4} className="pt-1.5 text-[11px] font-semibold underline">
                            {e.entry.testName}
                          </td>
                        </tr>
                        {e.values.map((v) => (
                          <ValueRow key={v.id} value={v} label={v.label} indent />
                        ))}
                        {e.method && (
                          <tr>
                            <td colSpan={4} className="pb-1 text-[9.5px] italic text-[#647067]">Method: {e.method}</td>
                          </tr>
                        )}
                      </>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {/* Per-test "Report note / description" for THIS department — printed
              right after the department's tests (before the next department),
              not pooled at the end of the report. A blank-line gap separates
              notes when more than one test in the department has one. */}
          {list.some((e) => e.note && e.note.trim()) && (
            <div className="mt-1.5 text-[9.5px] italic leading-snug text-[#647067]">
              {list
                .filter((e) => e.note && e.note.trim())
                .map((e, idx) => (
                  <p key={e.entry.id} className={idx > 0 ? "mt-2" : ""}>
                    <span className="font-medium not-italic text-[#0E1B14]">{e.entry.testName}: </span>
                    {e.note!.trim()}
                  </p>
                ))}
            </div>
          )}
        </div>
      ))}

      {/* Interpretation */}
      {interpretations.length > 0 && (
        <div className="mt-4 break-inside-avoid rounded border border-[#DFE2E2] bg-[#F8FAF8] p-2 text-[11px]">
          <p className="mb-1 font-semibold text-brand-700">Interpretation / Comments</p>
          {interpretations.map((i, idx) => (
            <p key={idx} className="mb-0.5"><span className="font-medium">{i.test}: </span>{i.text}</p>
          ))}
        </div>
      )}

      <p className="mt-3 text-center text-[9px] italic text-[#647067]">
        ** End of report ** · Flags: L Low · H High · LL/HH Critical. Please correlate clinically.
      </p>

      {/* Verification QR */}
      {qrDataUrl && (
        <div className="mt-6 break-inside-avoid text-[10px]">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="Verify" className="size-16" />
            <div>
              <p className="font-semibold text-brand-700">Scan to verify</p>
              {publicUrl && <p className="break-all text-info">{publicUrl}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Admin-managed signatories — a single horizontal row, evenly spaced. */}
      {signatories.length > 0 && (
        <div className="mt-8 flex items-end justify-around gap-6 break-inside-avoid">
          {signatories.map((s) => (
            <div key={s.id} className="text-center text-[11px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt="" className="mx-auto mb-1 h-12 object-contain" />
              <div className="border-t border-[#0E1B14] px-6 pt-1">
                <p className="font-semibold">{s.name}</p>
                {s.description && <p className="text-[10px] text-[#647067]">{s.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * One result line: Investigation | Result | Unit | Reference Range.
 * Shared by the collapsed single-value form and the parameter rows of a
 * multi-parameter test, so both stay visually identical.
 */
function ValueRow({
  value: v,
  label,
  indent,
  method,
}: {
  value: ReportValue;
  label: string;
  indent?: boolean;
  method?: string | null;
}) {
  const flag = v.flag as ResultFlag;
  const critical = flag === "critical_low" || flag === "critical_high";
  const abnormal = flag !== "normal";
  return (
    <tr className="break-inside-avoid border-b border-[#F0F2F0]">
      <td className={`py-1 align-top${indent ? " pl-3" : ""}`}>
        {label}
        {method && (
          <span className="block text-[9.5px] italic text-[#647067]">Method: {method}</span>
        )}
      </td>
      <td
        className="py-1 align-top font-semibold tabular"
        style={{ color: critical ? "#FF3131" : abnormal ? "#B45309" : "#0E1B14" }}
      >
        {v.valueText ?? "—"} {abnormal && <span className="text-[9px]">{flagSymbol(flag)}</span>}
      </td>
      <td className="py-1 align-top text-[#475467]">{v.unit ?? ""}</td>
      <td className="whitespace-pre-line py-1 align-top text-[#475467]">{v.refText ?? ""}</td>
    </tr>
  );
}

function Line({ label, value, bold, align }: { label: string; value?: string | null; bold?: boolean; align?: "right" }) {
  return (
    <p className={align === "right" ? "text-right" : ""}>
      <span className="text-[#647067]">{label}: </span>
      <span className={bold ? "font-semibold" : ""}>{value || "—"}</span>
    </p>
  );
}
