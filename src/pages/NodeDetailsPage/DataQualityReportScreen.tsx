import { Check, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/** Served from `public/DATA_QUALITY_REPORT.pdf` (same file as the bundled report PDF). */
const REPORT_PDF_HREF = "/DATA_QUALITY_REPORT.pdf";

const REPORT_BLUE = "#1a365d";
const REPORT_BLUE_CLASS = "text-[#1a365d]";

/** Shared vertical rhythm — tight padding for all tab panels */
const scrollTabClass = "h-[min(78vh,880px)] w-full min-h-[260px] pr-2";
const tabShellClass =
  "mx-auto w-full max-w-[1200px] bg-slate-50/80 px-3 pb-4 pt-4 text-slate-900";
const tabCardClass = "rounded-lg border border-slate-200 bg-white p-4 shadow-sm";

function ReportFooterBar() {
  return (
    <footer
      className="mt-3 flex flex-col gap-0.5 px-2 py-2 text-center text-xs leading-tight text-white sm:flex-row sm:justify-center sm:gap-3 sm:text-sm"
      style={{ backgroundColor: REPORT_BLUE }}
    >
      <span className="font-medium">Data Quality Report</span>
      <span className="hidden sm:inline opacity-80">|</span>
      <span>Quality Score: 93.33%</span>
    </footer>
  );
}

/** Underline-style active tab: no box border, only `border-b` highlight. */
const tabTriggerClass = cn(
  "rounded-none border-0 border-b-2 border-transparent bg-transparent px-2 py-2 text-sm font-medium text-slate-600 shadow-none ring-offset-0 sm:px-3",
  "hover:bg-transparent hover:text-slate-800",
  "focus-visible:ring-0 focus-visible:outline-none",
  "data-[state=active]:border-b-[#1a365d] data-[state=active]:bg-transparent data-[state=active]:text-[#1a365d] data-[state=active]:shadow-none",
  "dark:data-[state=active]:border-0 dark:data-[state=active]:border-b-2 dark:data-[state=active]:border-b-[#1a365d] dark:data-[state=active]:bg-transparent dark:data-[state=active]:shadow-none"
);

export default function DataQualityReportScreen() {
  return (
    <div className="flex w-full max-w-none flex-col gap-1">
       <div className="flex items-center justify-end px-2 pt-0">
        <Button variant="outline" size="sm" className="gap-2 !h-8" asChild>
          <a href={REPORT_PDF_HREF} download="DATA_QUALITY_REPORT.pdf">
            <Download className="size-4" aria-hidden />
            Download report
          </a>
        </Button>
      </div>
      <Tabs defaultValue="executive-summary" className="w-full gap-0">
        <TabsList
          className="h-auto w-full flex-wrap justify-start gap-0 rounded-none border-b border-slate-200 bg-transparent p-0"
          aria-label="Report sections"
        >
          <TabsTrigger value="executive-summary" className={tabTriggerClass}>
            Executive Summary
          </TabsTrigger>
          <TabsTrigger value="snapshot" className={tabTriggerClass}>
            Snapshot
          </TabsTrigger>
          <TabsTrigger value="quality-dimensions" className={tabTriggerClass}>
            Quality Dimensions
          </TabsTrigger>
          <TabsTrigger value="validation-rules" className={tabTriggerClass}>
            Validation Rules
          </TabsTrigger>
          <TabsTrigger value="data-profiling" className={tabTriggerClass}>
            Data Profiling
          </TabsTrigger>
          <TabsTrigger value="risk-analysis" className={tabTriggerClass}>
            Risk Analysis
          </TabsTrigger>
          <TabsTrigger value="recommendations" className={tabTriggerClass}>
            Recommendations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="executive-summary" className="mt-0 outline-none">
          <ExecutiveSummaryTab />
        </TabsContent>

        <TabsContent value="snapshot" className="mt-0 outline-none">
          <ReportSnapshotTab />
        </TabsContent>

        <TabsContent value="quality-dimensions" className="mt-0 outline-none">
          <QualityDimensionsTab />
        </TabsContent>

        <TabsContent value="validation-rules" className="mt-0 outline-none">
          <ValidationRulesTab />
        </TabsContent>

        <TabsContent value="data-profiling" className="mt-0 outline-none">
          <DataProfilingTab />
        </TabsContent>

        <TabsContent value="risk-analysis" className="mt-0 outline-none">
          <RiskAnalysisTab />
        </TabsContent>

        <TabsContent value="recommendations" className="mt-0 outline-none">
          <RecommendationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** First tab — high-level summary (placeholder metrics; wire to real data later). */
function ExecutiveSummaryTab() {
  return (
    <ScrollArea className={scrollTabClass}>
      <div className={tabShellClass}>
        <div className={tabCardClass}>
          <h2 className="text-lg font-semibold" style={{ color: REPORT_BLUE }}>
            Executive Summary
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">High-level overview of data quality assessment</p>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryMetricCard
              label="Total Records Processed"
              value="20"
              sub="records"
              className="bg-sky-50 border-sky-200"
            />
            <SummaryMetricCard
              label="Valid Records"
              value="15"
              sub="75.00% records"
              className="bg-emerald-50 border-emerald-200"
            />
            <SummaryMetricCard
              label="Invalid Records"
              value="5"
              sub="25.00% records"
              className="bg-white border-slate-200"
            />
            <SummaryMetricCard
              label="Overall Quality Score"
              value="93.33"
              sub="%"
              className="bg-emerald-50 border-emerald-200"
            />
            {/* <SummaryMetricCard
              label="Production Readiness"
              value="READY FOR PRODUCTION"
              valueClassName="text-base leading-snug sm:text-lg"
              className="bg-white border-slate-200"
            /> */}
          </div>
        </div>

        <ReportFooterBar />
      </div>
    </ScrollArea>
  );
}

/** Tab 3 — five dimension scores + hero overall score. */
function QualityDimensionsTab() {
  const dimensions = [
    {
      title: "Completeness",
      pct: "100%",
      pctMuted: false,
      description: "Percentage of non-null values in critical fields",
      details: "All critical fields (transaction_id, date, customer_id) are present",
    },
    {
      title: "Uniqueness",
      pct: "100%",
      pctMuted: false,
      description: "Absence of duplicate records",
      details: "No duplicate records detected (20/20 unique)",
    },
    {
      title: "Validity",
      pct: "75%",
      pctMuted: true,
      description: "Records matching business rules and constraints",
      details: "75% of records match business rules (15/20 valid)",
    },
    {
      title: "Consistency",
      pct: "100%",
      pctMuted: false,
      description: "All references to master data are valid",
      details: "All customer references valid - 100% match rate",
    },
    {
      title: "Accuracy",
      pct: "100%",
      pctMuted: false,
      description: "Correct calculations and conversions",
      details: "100% successful amount conversion (20/20)",
    },
  ];

  return (
    <ScrollArea className={scrollTabClass}>
      <div className={tabShellClass}>
        <div className={tabCardClass}>
          <h2 className="text-2xl font-bold" style={{ color: REPORT_BLUE }}>
            Data Quality Dimensions
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">Assessment across five key dimensions</p>

          <div className="mt-4 rounded-2xl bg-gradient-to-br from-sky-100 via-sky-50 to-white px-4 py-3 text-center shadow-sm">
            <p className="text-4xl font-bold tabular-nums text-emerald-600">93.33%</p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {dimensions.slice(0, 4).map((d) => (
              <DimensionDetailCard key={d.title} {...d} />
            ))}
          </div>
          <div className="mt-2 flex justify-center">
            <div className="w-full max-w-md xl:max-w-sm">
              <DimensionDetailCard {...dimensions[4]} />
            </div>
          </div>
        </div>

        <ReportFooterBar />
      </div>
    </ScrollArea>
  );
}

function DimensionDetailCard({
  title,
  pct,
  pctMuted,
  description,
  details,
}: {
  title: string;
  pct: string;
  pctMuted?: boolean;
  description: string;
  details: string;
}) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <h3 className="text-sm font-bold" style={{ color: REPORT_BLUE }}>
        {title}
      </h3>
      <p
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums",
          pctMuted ? "text-amber-600" : "text-emerald-600"
        )}
      >
        {pct}
      </p>
      <p className="mt-2 text-xs leading-snug text-slate-600">{description}</p>
      <p className="mt-1 text-xs leading-snug text-slate-500">{details}</p>
    </div>
  );
}

/** Tab 4 — validation rule rows with PASS/FAIL badges (dummy data; replace with API later). */
function ValidationRulesTab() {
  const rules: {
    id: string;
    description: string;
    pass: boolean;
    pct: string;
  }[] = [
    { id: "V1", description: "No Missing Critical Values", pass: true, pct: "100%" },
    { id: "V2", description: "Amount Must Be Positive", pass: false, pct: "85.71%" },
    { id: "V3", description: "Currency Code Valid", pass: true, pct: "100%" },
    { id: "V4", description: "Transaction Type Valid", pass: true, pct: "100%" },
    { id: "V5", description: "Date Within Expected Range", pass: true, pct: "100%" },
    { id: "V6", description: "Referential Integrity (Customer)", pass: true, pct: "100%" },
  ];

  return (
    <ScrollArea className={scrollTabClass}>
      <div className={tabShellClass}>
        <div className={tabCardClass}>
          <h2 className="text-xl font-bold" style={{ color: REPORT_BLUE }}>
            Validation Rules
          </h2>
          <ul className="mt-3 flex flex-col gap-1.5">
            {rules.map((row) => (
              <li
                key={row.id}
                className={cn(
                  "flex overflow-hidden rounded-lg border border-slate-200 bg-white",
                  !row.pass && "border-rose-200 bg-rose-50/90"
                )}
              >
                <div
                  className={cn("w-1.5 shrink-0", row.pass ? "bg-emerald-500" : "bg-red-500")}
                  aria-hidden
                />
                <div className="flex min-w-0 flex-1 flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-bold" style={{ color: REPORT_BLUE }}>
                      {row.id}
                    </span>
                    <span className="text-sm text-slate-800">{row.description}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 sm:pl-2">
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold uppercase text-white",
                        row.pass ? "bg-emerald-600" : "bg-red-600"
                      )}
                    >
                      {row.pass ? "PASS" : "FAIL"}
                    </span>
                    <span className="min-w-[4.5rem] text-right text-sm font-semibold tabular-nums text-slate-800">
                      {row.pct}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <ReportFooterBar />
      </div>
    </ScrollArea>
  );
}

/** Tab 5 — data profiling cards (Transaction Types). */
function DataProfilingTab() {
  const types = [
    { label: "DEBIT", count: "11", pct: "55%" },
    { label: "CREDIT", count: "6", pct: "30%" },
    { label: "TRANSFER", count: "3", pct: "15%" },
  ];

  return (
    <ScrollArea className={scrollTabClass}>
      <div className={tabShellClass}>
        <div className={tabCardClass}>
          <h2 className="text-xl font-bold" style={{ color: REPORT_BLUE }}>
            Data Profiling
          </h2>
          <h3 className="mt-1 text-base font-bold" style={{ color: REPORT_BLUE }}>
            Transaction Types
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {types.map((t) => (
              <div
                key={t.label}
                className="flex flex-col rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
              >
                <span className="font-bold" style={{ color: REPORT_BLUE }}>
                  {t.label}
                </span>
                <span className="mt-0 text-2xl font-bold tabular-nums text-slate-900">{t.count}</span>
                <span className="mt-0.5 text-sm text-slate-500">{t.pct}</span>
              </div>
            ))}
          </div>
        </div>

        <ReportFooterBar />
      </div>
    </ScrollArea>
  );
}

/** Tab 6 — high-risk transactions. */
function RiskAnalysisTab() {
  const items = [
    {
      id: "TXN002 - Maria Garcia",
      amount: "$2,500.5",
      riskScore: "5.001",
      action: "Conduct compliance review",
    },
    {
      id: "TXN019 - Paulo Silva",
      amount: "$2,800",
      riskScore: "8.4",
      action: "Conduct compliance review",
    },
  ];

  return (
    <ScrollArea className={scrollTabClass}>
      <div className={tabShellClass}>
        <div className={tabCardClass}>
          <h2 className="text-xl font-bold" style={{ color: REPORT_BLUE }}>
            Risk Analysis
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {items.map((row) => (
              <li
                key={row.id}
                className="flex overflow-hidden rounded-lg border border-rose-200 bg-rose-50/90"
              >
                <div className="w-1.5 shrink-0 bg-red-500" aria-hidden />
                <div className="min-w-0 flex-1 space-y-1 px-3 py-3">
                  <p className="font-bold" style={{ color: REPORT_BLUE }}>
                    {row.id}
                  </p>
                  <p className="text-sm text-slate-800">
                    <span className="font-medium">Amount:</span> {row.amount}
                  </p>
                  <p className="text-sm text-slate-800">
                    <span className="font-medium">Risk Score:</span>{" "}
                    <span className="font-semibold text-red-600 tabular-nums">{row.riskScore}</span>
                  </p>
                  <p className="text-sm text-slate-800">
                    <span className="font-medium">Action:</span> {row.action}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <ReportFooterBar />
      </div>
    </ScrollArea>
  );
}

/** Tab 7 — critical actions / recommendations. */
function RecommendationsTab() {
  const actions = [
    {
      code: "A1",
      title: "Investigate Invalid Records",
      description: "Review and resolve 5 invalid records (TXN004, TXN005, TXN006, TXN013, TXN014)",
      timeline: "5 business days",
    },
    {
      code: "A2",
      title: "High-Risk Transaction Review",
      description: "Conduct compliance review of TXN002 and TXN019",
      timeline: "3 business days",
    },
  ];

  return (
    <ScrollArea className={scrollTabClass}>
      <div className={tabShellClass}>
        <div className={tabCardClass}>
          <h2 className="text-xl font-bold" style={{ color: REPORT_BLUE }}>
            Recommendations
          </h2>
          <h3 className="mt-1 text-base font-bold" style={{ color: REPORT_BLUE }}>
            Critical Actions
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {actions.map((a) => (
              <li
                key={a.code}
                className="flex overflow-hidden rounded-lg border border-rose-200 bg-rose-50/90"
              >
                <div className="w-1.5 shrink-0 bg-red-600" aria-hidden />
                <div className="min-w-0 flex-1 px-3 py-3">
                  <p className="font-bold text-slate-900">
                    {a.code}: {a.title}
                  </p>
                  <p className="mt-1 text-sm text-slate-800">{a.description}</p>
                  <p className="mt-2 text-sm text-slate-800">
                    <span className="font-bold">Timeline:</span> {a.timeline}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <ReportFooterBar />
      </div>
    </ScrollArea>
  );
}

function SummaryMetricCard({
  label,
  value,
  sub,
  className,
  valueClassName,
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[88px] flex-col justify-center rounded-lg border-2 px-3 py-2.5",
        className
      )}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-slate-600">{label}</span>
      <span className={cn("mt-0 font-bold text-slate-900 tabular-nums text-2xl", valueClassName)}>{value}</span>
      {sub ? <span className="mt-0.5 text-xs text-slate-600">{sub}</span> : null}
    </div>
  );
}

/** Second tab — full static report (everything previously shown on one page). */
function ReportSnapshotTab() {
  return (
    <ScrollArea className={scrollTabClass}>
      <div className="mx-auto w-full max-w-[1200px] bg-white px-3 pb-6 pt-4 text-slate-900">
        <section className="mb-4">
          <div
            className="w-full py-2 text-center text-sm font-semibold uppercase tracking-widest text-white"
            style={{ backgroundColor: REPORT_BLUE }}
          >
            EXECUTIVE SUMMARY
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
            <MetricCard label="Total Records" value="20" borderClass="border-slate-300" valueClass="text-slate-800" />
            <MetricCard
              label="Valid Records"
              value="15 (75%)"
              borderClass="border-emerald-500"
              valueClass="text-emerald-600"
            />
            <MetricCard
              label="Invalid Records"
              value="5 (25%)"
              borderClass="border-red-500"
              valueClass="text-red-600"
            />
            <MetricCard
              label="Quality Score"
              value="93.33%"
              borderClass="border-emerald-500"
              valueClass="text-emerald-600"
            />
            <MetricCard
              label="Status"
              value="EXCELLENT ✓"
              borderClass="border-emerald-500"
              valueClass="text-emerald-600"
              className="col-span-2 md:col-span-1"
            />
          </div>
        </section>

        <section>
          <h2 className={cn("mb-2 text-sm font-bold uppercase tracking-wide", REPORT_BLUE_CLASS)} style={{ color: REPORT_BLUE }}>
            DATA QUALITY DIMENSIONS
          </h2>
          <div className="space-y-2">
            <DimensionRow label="Completeness" pct={100} variant="good" />
            <DimensionRow label="Uniqueness" pct={100} variant="good" />
            <DimensionRow label="Validity" pct={75} variant="warn" />
            <DimensionRow label="Consistency" pct={100} variant="good" />
            <DimensionRow label="Accuracy" pct={100} variant="good" />
          </div>
        </section>

        <section className="mt-5">
          <h2 className={cn("mb-2 text-sm font-bold uppercase tracking-wide", REPORT_BLUE_CLASS)} style={{ color: REPORT_BLUE }}>
            VALIDATION RULES SUMMARY
          </h2>
          <div className="overflow-x-auto rounded-sm border border-slate-200">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr style={{ backgroundColor: REPORT_BLUE }} className="text-white">
                  <th className="px-2 py-2 text-left font-semibold">Rule</th>
                  <th className="px-2 py-2 text-right font-semibold">Passed</th>
                  <th className="px-2 py-2 text-right font-semibold">Failed</th>
                  <th className="px-2 py-2 text-right font-semibold">Pass Rate</th>
                  <th className="px-2 py-2 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                <ValidationRow rule="No Missing Critical Values" passed={20} failed={0} rate="100%" ok />
                <ValidationRow rule="Amount Must Be Positive" passed={12} failed={2} rate="85.71%" ok={false} />
                <ValidationRow rule="Currency Code Valid" passed={20} failed={0} rate="100%" ok />
                <ValidationRow rule="Transaction Type Valid" passed={20} failed={0} rate="100%" ok />
                <ValidationRow rule="Date Within Range" passed={20} failed={0} rate="100%" ok />
                <ValidationRow rule="Referential Integrity" passed={20} failed={0} rate="100%" ok />
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-5">
          <h2 className={cn("mb-2 text-sm font-bold uppercase tracking-wide", REPORT_BLUE_CLASS)} style={{ color: REPORT_BLUE }}>
            DATA PROFILING &amp; ANALYSIS
          </h2>
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-slate-600">Transaction Types</p>
              <SegmentedBar
                segments={[
                  { label: "DEBIT (11)", pct: 55, className: "bg-blue-500" },
                  { label: "CREDIT (6)", pct: 30, className: "bg-emerald-500" },
                  { label: "TRANSFER (3)", pct: 15, className: "bg-violet-500" },
                ]}
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-slate-600">Currency Distribution</p>
              <SegmentedBar
                segments={[
                  { label: "USD (16)", pct: 80, className: "bg-blue-500" },
                  { label: "EUR (2)", pct: 10, className: "bg-amber-500" },
                  { label: "GBP (1)", pct: 5, className: "bg-yellow-400 text-slate-800" },
                  { label: "INR (1)", pct: 5, className: "bg-emerald-500" },
                ]}
              />
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <span className="font-semibold text-slate-700">Amount Statistics (USD):</span>{" "}
              <span className="text-slate-800">
                Min: $10.80 | Max: $5,000.00 | Avg: $1,869.06 | Total: $31,773.94
              </span>
            </div>
          </div>
        </section>

        <section className="mt-5">
          <h2 className={cn("mb-2 text-sm font-bold uppercase tracking-wide", REPORT_BLUE_CLASS)} style={{ color: REPORT_BLUE }}>
            DATA QUALITY ISSUES
          </h2>
          <ul className="space-y-1.5 text-sm">
            <IssueItem text="Missing Merchant ID: 1 record (TXN004)" />
            <IssueItem text="Missing Amount: 2 records (TXN005, TXN014)" />
            <IssueItem text="Missing Account#: 1 record (TXN013)" />
            <IssueItem text="Negative Amount: 1 record (TXN006)" />
            <IssueItem text="Zero Amount: 1 record (TXN014)" />
          </ul>
        </section>

        <section className="mt-5">
          <h2 className={cn("mb-2 text-sm font-bold uppercase tracking-wide", REPORT_BLUE_CLASS)} style={{ color: REPORT_BLUE }}>
            RISK ANALYSIS
          </h2>
          <div className="space-y-3">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-slate-600">Transaction Risk Distribution</p>
              <SegmentedBar
                segments={[
                  { label: "Low Risk (13)", pct: 65, className: "bg-emerald-500" },
                  { label: "Medium Risk (4)", pct: 20, className: "bg-amber-500" },
                  { label: "High Risk (3)", pct: 15, className: "bg-red-500" },
                ]}
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-red-600">High-Risk Transactions (Risk Score &gt; 5.0):</p>
              <ul className="space-y-1 text-sm text-red-600">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-sm bg-red-500" aria-hidden />
                  TXN002: Maria Garcia | $2,500.50 | Risk: 5.001
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-sm bg-red-500" aria-hidden />
                  TXN019: Paulo Silva | $2,800.00 | Risk: 8.4
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-5">
          <h2 className={cn("mb-2 text-sm font-bold uppercase tracking-wide", REPORT_BLUE_CLASS)} style={{ color: REPORT_BLUE }}>
            KEY RECOMMENDATIONS
          </h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm leading-snug text-slate-800">
            <li>Investigate and correct 5 invalid records within 5 business days</li>
            <li>Conduct compliance review of 2 high-risk transactions</li>
            <li>Implement mandatory field validation at data entry</li>
            <li>Establish controls to prevent negative amounts in DEBITs</li>
            <li>Deploy processed data to production with quarterly monitoring</li>
          </ol>
        </section>
      </div>
    </ScrollArea>
  );
}

function MetricCard({
  label,
  value,
  borderClass,
  valueClass,
  className,
}: {
  label: string;
  value: string;
  borderClass: string;
  valueClass: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-[80px] flex-col items-center justify-center border-2 px-2 py-2 text-center",
        borderClass,
        className
      )}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-600">{label}</span>
      <span className={cn("mt-1 text-lg font-bold tabular-nums", valueClass)}>{value}</span>
    </div>
  );
}

function DimensionRow({
  label,
  pct,
  variant,
}: {
  label: string;
  pct: number;
  variant: "good" | "warn";
}) {
  const fill = variant === "good" ? "bg-emerald-500" : "bg-amber-500";
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
      <span className="w-full min-w-[140px] text-sm font-medium text-slate-800 sm:w-40">{label}</span>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="h-3 flex-1 overflow-hidden rounded-sm bg-slate-200">
          <div className={cn("h-full rounded-sm transition-all", fill)} style={{ width: `${pct}%` }} />
        </div>
        <span className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-800">{pct.toFixed(1)}%</span>
      </div>
    </div>
  );
}

function ValidationRow({
  rule,
  passed,
  failed,
  rate,
  ok,
}: {
  rule: string;
  passed: number;
  failed: number;
  rate: string;
  ok: boolean;
}) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-2 py-2 text-slate-800">{rule}</td>
      <td className="px-2 py-2 text-right tabular-nums">{passed}</td>
      <td className="px-2 py-2 text-right tabular-nums">{failed}</td>
      <td className="px-2 py-2 text-right tabular-nums">{rate}</td>
      <td className="px-2 py-2 text-center">
        {ok ? (
          <Check className="mx-auto h-5 w-5 text-emerald-600" strokeWidth={2.5} aria-label="Passed" />
        ) : (
          <X className="mx-auto h-5 w-5 text-red-600" strokeWidth={2.5} aria-label="Failed" />
        )}
      </td>
    </tr>
  );
}

function IssueItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-slate-800">
      <span className="mt-1.5 h-2 w-2 shrink-0 bg-red-500" aria-hidden />
      <span>{text}</span>
    </li>
  );
}

function SegmentedBar({
  segments,
}: {
  segments: { label: string; pct: number; className: string }[];
}) {
  return (
    <div>
      <div className="flex h-8 w-full overflow-hidden rounded-sm shadow-sm">
        {segments.map((s) => (
          <div
            key={s.label}
            className={cn(
              "flex min-w-0 items-center justify-center px-1 text-center text-[10px] font-semibold leading-tight text-white sm:text-xs",
              s.className
            )}
            style={{ width: `${s.pct}%` }}
          >
            <span className="line-clamp-2">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
