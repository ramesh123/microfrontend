import type { ComponentProps, ReactNode } from "react";
import { useState } from "react";
import { AlertTriangle, ClipboardList, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACTION_PLAN_STEPS,
  AMOUNT_FAILURE_EXAMPLES,
  CUSTOMER_FAILURE_EXAMPLES,
  EXECUTIVE_SUMMARY_METRICS,
  FAILED_RECORDS_SUMMARY_DROPDOWN_ROWS,
  KEY_STATISTICS_ROWS,
  OUTPUT_LOCATION,
  QUICK_REFERENCE_FILES,
  SUMMARY_RULE_ROWS,
  SUMMARY_STATS,
  TYPE_FAILURE_EXAMPLES,
  VALIDATION_SUMMARY_RULES,
  V2_AMOUNT_BREAKDOWN,
  V2_AMOUNT_ISSUE_DETAIL_ROWS,
  V3_CURRENCY_ISSUE_DETAIL_ROWS,
  V4_TYPE_ISSUE_DETAIL_ROWS,
  V4_TYPE_BREAKDOWN,
  V5_DATE_ISSUE_DETAIL_ROWS,
  V6_CUSTOMER_ISSUE_DETAIL_ROWS,
  V6_CUSTOMER_BREAKDOWN,
  V7_DUPLICATE_ISSUE_DETAIL_ROWS,
} from "./finalReportDummyData";

/** Summary table header bar (second screenshot) */
const TABLE_HEADER_BLUE = "#1D42A1";
/** Rule / action column accent (second screenshot) */
const RULE_ACTION_RED = "#A52A2A";
/** Total row background (second screenshot) */
const TOTAL_ROW_YELLOW = "#FFF4A3";
const RED = "#b91c1c";

/** Action plan panel: navy border/text, peach title highlight (first screenshot) */
const ACTION_PLAN_NAVY = "#1a365d";
const ACTION_PLAN_TITLE_HIGHLIGHT = "#ffedd5";
/** Detailed tables — fix / remediation column (screenshot) */
const FIX_ACTION_GREEN = "#15803d";

const shellClass =
  "w-full bg-white text-slate-900 border border-slate-200/90 rounded-md shadow-sm";
const scrollClass = "h-[min(76vh,860px)] w-full min-h-[240px] pr-1";

type DataQualitySection =
  | "executive_summary"
  | "validation_summary"
  | "key_statistics"
  | "failed_records_summary"
  | "v2_amount_issues"
  | "v3_currency_issues"
  | "v4_type_issues"
  | "v5_date_issues"
  | "v6_customer_issues"
  | "v7_duplicates";

/** Data Quality tab dropdown views (not the full failed-records report tab). */
const DATA_QUALITY_SECTIONS: ReadonlyArray<{ value: DataQualitySection; label: string }> = [
  { value: "executive_summary", label: "Executive Summary" },
  { value: "validation_summary", label: "Validation Summary" },
  { value: "key_statistics", label: "Key Statistics" },
  { value: "failed_records_summary", label: "Failed Records Summary" },
  { value: "v2_amount_issues", label: `V2 - Amount Issues (${V2_AMOUNT_ISSUE_DETAIL_ROWS.length})` },
  { value: "v3_currency_issues", label: `V3 - Currency Issues (${V3_CURRENCY_ISSUE_DETAIL_ROWS.length})` },
  { value: "v4_type_issues", label: `V4 - Type Issues (${V4_TYPE_ISSUE_DETAIL_ROWS.length})` },
  { value: "v5_date_issues", label: `V5 - Date Issues (${V5_DATE_ISSUE_DETAIL_ROWS.length})` },
  { value: "v6_customer_issues", label: `V6 - Customer Issues (${V6_CUSTOMER_ISSUE_DETAIL_ROWS.length})` },
  { value: "v7_duplicates", label: `V7 - Duplicates (${V7_DUPLICATE_ISSUE_DETAIL_ROWS.length})` },
];

const simpleGridTableClass =
  "w-full table-fixed border-collapse border border-slate-400 text-left text-[11px] sm:text-sm [&_th]:border [&_th]:border-slate-400 [&_th]:bg-slate-100 [&_th]:px-2 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-slate-300 [&_td]:px-2 [&_td]:py-1.5 [&_td]:text-left [&_td]:text-slate-900";

const tabTriggerClass = cn(
  "rounded-none border-0 border-b-2 border-transparent bg-transparent px-2 py-1.5 text-sm font-medium text-slate-600 shadow-none ring-offset-0 sm:px-3",
  "hover:bg-transparent hover:text-slate-800",
  "focus-visible:ring-0 focus-visible:outline-none",
  "data-[state=active]:border-b-[#1e40af] data-[state=active]:bg-transparent data-[state=active]:text-[#1e40af] data-[state=active]:shadow-none"
);

function SectionRedBar({ children }: { children: ReactNode }) {
  return (
    <div
      className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-white sm:text-xs"
      style={{ backgroundColor: RED }}
    >
      {children}
    </div>
  );
}

function DenseTableHead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <TableHead
      className={cn("h-8 px-1.5 py-1 text-[11px] font-semibold text-white sm:text-xs", className)}
      style={{ backgroundColor: TABLE_HEADER_BLUE }}
    >
      {children}
    </TableHead>
  );
}

function DenseCell({
  children,
  className,
  ...rest
}: ComponentProps<typeof TableCell>) {
  return (
    <TableCell className={cn("px-1.5 py-1 text-[11px] leading-tight sm:text-xs", className)} {...rest}>
      {children}
    </TableCell>
  );
}

export default function FinalReportScreen() {
  return (
    <div className="flex w-full min-w-0 flex-col gap-0.5">
      <Tabs defaultValue="failed-records" className="w-full gap-0">
        <TabsList
          className="h-auto w-full flex-wrap justify-start gap-0 rounded-none border-b border-slate-200 bg-transparent p-0"
          aria-label="Final report"
        >
          <TabsTrigger value="failed-records" className={tabTriggerClass}>
            Failed Records
          </TabsTrigger>
          <TabsTrigger value="detailed-records" className={tabTriggerClass}>
            Failed Detailed Records
          </TabsTrigger>
          <TabsTrigger value="data-quality" className={tabTriggerClass}>
            Data Quality
          </TabsTrigger>
          
        </TabsList>

        <TabsContent value="failed-records" className="mt-0 outline-none">
          <ScrollArea className={scrollClass}>
            <FailedRecordsTab />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="data-quality" className="mt-0 outline-none">
          <ScrollArea className={scrollClass}>
            <DataQualityTab />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="detailed-records" className="mt-0 outline-none">
          <ScrollArea className={scrollClass}>
            <DetailedRecordsTab />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FailedRecordsTab() {
  return (
    <div className="w-full min-w-0 space-y-3 px-1 pb-3 pt-1">
      <header className="w-full text-center">
        <h1 className="text-sm font-semibold text-slate-900 sm:text-base">
          Financial Transactions — 1,000 Records | Team Remediation Guide
        </h1>
      </header>
      <FailedRecordsSummaryView />
    </div>
  );
}

function DataQualityTab() {
  const [section, setSection] = useState<DataQualitySection>("executive_summary");

  return (
    <div className="w-full min-w-0 space-y-3 px-1 pb-3 pt-1 text-left">
      <header className="w-full text-left">
        <h1 className="text-sm font-semibold text-slate-900 sm:text-base">
          Financial Transactions — 1,000 Records | Team Remediation Guide
        </h1>
      </header>

      <div className="w-full min-w-0 text-left">
        <label htmlFor="data-quality-view" className="mb-1 block text-xs font-medium text-slate-600">
          View
        </label>
        <Select value={section} onValueChange={(v) => setSection(v as DataQualitySection)}>
          <SelectTrigger
            id="data-quality-view"
            className="h-9 w-full min-w-0 max-w-none justify-between text-left shadow-xs [&>span]:line-clamp-1 [&>span]:text-left"
            size="sm"
          >
            <SelectValue placeholder="Choose view" />
          </SelectTrigger>
          <SelectContent className="max-h-[min(60vh,320px)]">
            {DATA_QUALITY_SECTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {section === "executive_summary" && <ExecutiveSummaryView />}
      {section === "validation_summary" && <ValidationSummaryView />}
      {section === "key_statistics" && <KeyStatisticsView />}
      {section === "failed_records_summary" && <FailedRecordsSummaryDropdownView />}
      {section === "v2_amount_issues" && <V2AmountIssuesOnlyView />}
      {section === "v3_currency_issues" && <V3CurrencyIssuesOnlyView />}
      {section === "v4_type_issues" && <V4TypeIssuesOnlyView />}
      {section === "v5_date_issues" && <V5DateIssuesOnlyView />}
      {section === "v6_customer_issues" && <V6CustomerIssuesOnlyView />}
      {section === "v7_duplicates" && <V7DuplicateIssuesOnlyView />}
    </div>
  );
}

function ExecutiveSummaryView() {
  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <table className={simpleGridTableClass}>
        <thead>
          <tr>
            <th className="w-[40%]">Metric</th>
            <th className="w-[35%]">Value</th>
            <th className="w-[25%]">Status</th>
          </tr>
        </thead>
        <tbody>
          {EXECUTIVE_SUMMARY_METRICS.map((row) => (
            <tr key={row.metric} className="bg-white">
              <td className="align-top font-medium">{row.metric}</td>
              <td className="tabular-nums">{row.value}</td>
              <td className="font-medium">{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ValidationSummaryView() {
  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <table className={cn(simpleGridTableClass, "min-w-[720px]")}>
        <thead>
          <tr>
            <th className="w-[7%]">Rule ID</th>
            <th className="w-[28%]">Rule Name</th>
            <th className="w-[10%]">Passed</th>
            <th className="w-[10%]">Failed</th>
            <th className="w-[11%]">Pass Rate</th>
            <th className="w-[10%]">Status</th>
            <th className="w-[14%]">Severity</th>
          </tr>
        </thead>
        <tbody>
          {VALIDATION_SUMMARY_RULES.map((row) => (
            <tr key={row.ruleId} className="bg-white">
              <td className="font-semibold">{row.ruleId}</td>
              <td>{row.ruleName}</td>
              <td className="tabular-nums">{row.passed}</td>
              <td className="tabular-nums">{row.failed}</td>
              <td className="tabular-nums">{row.passRate}</td>
              <td>{row.status}</td>
              <td>{row.severity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KeyStatisticsView() {
  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <table className={simpleGridTableClass}>
        <thead>
          <tr>
            <th className="w-[55%]">Category</th>
            <th className="w-[45%]">Count/Value</th>
          </tr>
        </thead>
        <tbody>
          {KEY_STATISTICS_ROWS.map((row) => (
            <tr key={row.category} className="bg-white">
              <td>{row.category}</td>
              <td className="font-mono tabular-nums">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Data Quality dropdown — same table pattern as Executive / Validation Summary. */
function FailedRecordsSummaryDropdownView() {
  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <table className={cn(simpleGridTableClass, "min-w-[720px]")}>
        <thead>
          <tr>
            <th className="w-[8%]">Validation Rule</th>
            <th className="w-[26%]">Issue Description</th>
            <th className="w-[12%]">Failed Records Count</th>
            <th className="w-[10%]">Percentage</th>
            <th className="w-[10%]">Severity</th>
            <th className="w-[34%]">Action Required</th>
          </tr>
        </thead>
        <tbody>
          {FAILED_RECORDS_SUMMARY_DROPDOWN_ROWS.map((row) => (
            <tr key={row.rule} className="bg-white">
              <td className="align-top font-medium">{row.rule}</td>
              <td className="align-top">{row.issueDescription}</td>
              <td className="tabular-nums">{row.failed}</td>
              <td className="tabular-nums">{row.pct}</td>
              <td className="align-top font-medium">{row.severity}</td>
              <td className="align-top">{row.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FailedRecordsSummaryView() {
  return (
    <>
      <div className={cn(shellClass, "w-full overflow-hidden")}>
        <div
          className="w-full px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-white sm:text-xs"
          style={{ backgroundColor: TABLE_HEADER_BLUE }}
        >
          Failed records by validation rule — action required
        </div>
        <div className="w-full min-w-0 overflow-x-auto">
          <Table className="w-full min-w-[640px] table-fixed">
            <TableHeader>
              <TableRow className="border-0 hover:bg-transparent">
                <DenseTableHead className="w-[8%]">Rule</DenseTableHead>
                <DenseTableHead className="w-[22%]">Description</DenseTableHead>
                <DenseTableHead className="w-[10%] text-right">Failed</DenseTableHead>
                <DenseTableHead className="w-[10%] text-right">%</DenseTableHead>
                <DenseTableHead className="w-[22%]">Issue type</DenseTableHead>
                <DenseTableHead className="w-[28%]">Action required</DenseTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SUMMARY_RULE_ROWS.map((row, i) => (
                <TableRow
                  key={row.rule}
                  className={cn("border-slate-200", i % 2 === 1 ? "bg-slate-50/80" : "bg-white")}
                >
                  <DenseCell className="font-semibold" style={{ color: RULE_ACTION_RED }}>
                    {row.rule}
                  </DenseCell>
                  <DenseCell className="text-slate-900">{row.description}</DenseCell>
                  <DenseCell className="text-right tabular-nums text-slate-900">{row.failed}</DenseCell>
                  <DenseCell className="text-right tabular-nums text-slate-900">{row.pct}</DenseCell>
                  <DenseCell className="text-slate-800">{row.issueType}</DenseCell>
                  <DenseCell className="font-medium" style={{ color: RULE_ACTION_RED }}>
                    {row.action}
                  </DenseCell>
                </TableRow>
              ))}
              <TableRow
                style={{ backgroundColor: TOTAL_ROW_YELLOW }}
                className="border-slate-300 font-bold"
              >
                <DenseCell colSpan={2} className="text-slate-900">
                  Total
                </DenseCell>
                <DenseCell className="text-right tabular-nums text-slate-900">291</DenseCell>
                <DenseCell className="text-right tabular-nums text-slate-900">28.5%</DenseCell>
                <DenseCell className="text-slate-900">—</DenseCell>
                <DenseCell className="text-slate-900">See CSV files for details.</DenseCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="w-full space-y-4">
        <div className={cn(shellClass, "overflow-hidden")}>
          <SectionRedBar>{V2_AMOUNT_BREAKDOWN.title}</SectionRedBar>
          <div className="space-y-4 bg-white px-2.5 py-3">
            {V2_AMOUNT_BREAKDOWN.categories.map((cat) => (
              <div key={cat.label} className="space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0"
                    style={{ color: RED }}
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold sm:text-sm" style={{ color: RED }}>
                      {cat.label}
                    </p>
                    <p className="mt-1.5 text-[11px] font-medium text-slate-700 sm:text-xs">Examples:</p>
                    <ul className="mt-1 space-y-1">
                      {cat.examples.map((line) => (
                        <li
                          key={line}
                          className="font-mono text-[11px] leading-relaxed text-slate-900 sm:text-xs"
                        >
                          {line}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex justify-end">
                      <span className="text-[11px] font-medium text-slate-800 sm:text-xs">
                        {V2_AMOUNT_BREAKDOWN.action}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <CsvFullListFooter fileName={V2_AMOUNT_BREAKDOWN.csv} />
          </div>
        </div>

        <div className={cn(shellClass, "overflow-hidden")}>
          <SectionRedBar>{V4_TYPE_BREAKDOWN.title}</SectionRedBar>
          <div className="space-y-4 bg-white px-2.5 py-3">
            <p className="text-[12px] font-medium text-slate-800 sm:text-sm">{V4_TYPE_BREAKDOWN.intro}</p>
            {V4_TYPE_BREAKDOWN.types.map((t) => (
              <div key={t.name} className="space-y-2 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                <p className="text-[12px] font-semibold sm:text-sm" style={{ color: RED }}>
                  {t.name}: {t.count} records
                </p>
                <p className="font-mono text-[11px] leading-relaxed text-slate-900 sm:text-xs">{t.example}</p>
                <div className="flex justify-end pt-1">
                  <span className="text-[11px] font-medium sm:text-xs" style={{ color: RED }}>
                    {V4_TYPE_BREAKDOWN.action}
                  </span>
                </div>
              </div>
            ))}
            <CsvFullListFooter fileName={V4_TYPE_BREAKDOWN.csv} />
          </div>
        </div>

        <div className={cn(shellClass, "overflow-hidden")}>
          <SectionRedBar>{V6_CUSTOMER_BREAKDOWN.title}</SectionRedBar>
          <div className="space-y-3 bg-white px-2.5 py-3">
            <p className="text-[12px] font-bold text-slate-900 sm:text-sm">
              {V6_CUSTOMER_BREAKDOWN.subheader}
            </p>
            <ul className="space-y-2">
              {V6_CUSTOMER_BREAKDOWN.invalidRows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-baseline gap-x-1 gap-y-0.5 text-[11px] leading-snug sm:text-xs"
                >
                  <span className="font-bold" style={{ color: RED }}>
                    • {row.id}
                  </span>
                  <span style={{ color: RED }}>: {row.recordCount} record(s)</span>
                  <span className="text-slate-900">→</span>
                  <span className="text-slate-900">{V6_CUSTOMER_BREAKDOWN.rowAction}</span>
                </li>
              ))}
            </ul>
            <CsvFullListFooter fileName={V6_CUSTOMER_BREAKDOWN.csv} showFileIcon />
          </div>
        </div>
      </div>

      <TeamRemediationActionPlanPanel />
    </>
  );
}

/** Data Quality — V2: same grid table pattern as other dropdown views. */
function V2AmountIssuesOnlyView() {
  const cell = "font-mono text-[11px] sm:text-sm";
  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <table className={cn(simpleGridTableClass, "min-w-[1100px]")}>
        <thead>
          <tr>
            <th className="w-[9%]">transaction_id</th>
            <th className="w-[9%]">date</th>
            <th className="w-[9%]">customer_id</th>
            <th className="w-[8%]">amount</th>
            <th className="w-[7%]">currency</th>
            <th className="w-[10%]">transaction_type</th>
            <th className="w-[8%]">merchant_id</th>
            <th className="w-[10%]">account_number</th>
            <th className="w-[9%]">conversion_rate</th>
            <th className="w-[10%]">converted_amount</th>
            <th className="w-[11%]">Issue</th>
          </tr>
        </thead>
        <tbody>
          {V2_AMOUNT_ISSUE_DETAIL_ROWS.map((row, i) => (
            <tr key={`${row.transactionId}-${i}`} className="bg-white">
              <td className={cell}>{row.transactionId}</td>
              <td className={cn(cell, "tabular-nums")}>{row.date}</td>
              <td className={cell}>{row.customerId}</td>
              <td className={cn(cell, "tabular-nums")}>{row.amount}</td>
              <td className={cell}>{row.currency}</td>
              <td className="text-[11px] sm:text-sm">{row.transactionType}</td>
              <td className={cell}>{row.merchantId}</td>
              <td className={cell}>{row.accountNumber}</td>
              <td className={cn(cell, "tabular-nums")}>{row.conversionRate}</td>
              <td className={cn(cell, "tabular-nums")}>{row.convertedAmount}</td>
              <td className="text-[11px] sm:text-sm">{row.issue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function V3CurrencyIssuesOnlyView() {
  const cell = "font-mono text-[11px] sm:text-sm";
  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <table className={cn(simpleGridTableClass, "min-w-[1100px]")}>
        <thead>
          <tr>
            <th className="w-[9%]">transaction_id</th>
            <th className="w-[9%]">date</th>
            <th className="w-[9%]">customer_id</th>
            <th className="w-[8%]">amount</th>
            <th className="w-[7%]">currency</th>
            <th className="w-[10%]">transaction_type</th>
            <th className="w-[8%]">merchant_id</th>
            <th className="w-[10%]">account_number</th>
            <th className="w-[9%]">conversion_rate</th>
            <th className="w-[10%]">converted_amount</th>
            <th className="w-[11%]">Issue</th>
          </tr>
        </thead>
        <tbody>
          {V3_CURRENCY_ISSUE_DETAIL_ROWS.map((row, i) => (
            <tr key={`${row.transactionId}-${i}`} className="bg-white">
              <td className={cell}>{row.transactionId}</td>
              <td className={cn(cell, "tabular-nums")}>{row.date}</td>
              <td className={cell}>{row.customerId}</td>
              <td className={cn(cell, "tabular-nums")}>{row.amount}</td>
              <td className={cell}>{row.currency}</td>
              <td className="text-[11px] sm:text-sm">{row.transactionType}</td>
              <td className={cell}>{row.merchantId}</td>
              <td className={cell}>{row.accountNumber}</td>
              <td className={cn(cell, "tabular-nums")}>{row.conversionRate}</td>
              <td className={cn(cell, "tabular-nums")}>{row.convertedAmount}</td>
              <td className="text-[11px] sm:text-sm">{row.issue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function V4TypeIssuesOnlyView() {
  const cell = "font-mono text-[11px] sm:text-sm";
  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <table className={cn(simpleGridTableClass, "min-w-[1100px]")}>
        <thead>
          <tr>
            <th className="w-[9%]">transaction_id</th>
            <th className="w-[9%]">date</th>
            <th className="w-[9%]">customer_id</th>
            <th className="w-[8%]">amount</th>
            <th className="w-[7%]">currency</th>
            <th className="w-[10%]">transaction_type</th>
            <th className="w-[8%]">merchant_id</th>
            <th className="w-[10%]">account_number</th>
            <th className="w-[9%]">conversion_rate</th>
            <th className="w-[10%]">converted_amount</th>
            <th className="w-[11%]">Issue</th>
          </tr>
        </thead>
        <tbody>
          {V4_TYPE_ISSUE_DETAIL_ROWS.map((row, i) => (
            <tr key={`${row.transactionId}-${i}`} className="bg-white">
              <td className={cell}>{row.transactionId}</td>
              <td className={cn(cell, "tabular-nums")}>{row.date}</td>
              <td className={cell}>{row.customerId}</td>
              <td className={cn(cell, "tabular-nums")}>{row.amount}</td>
              <td className={cell}>{row.currency}</td>
              <td className="text-[11px] sm:text-sm">{row.transactionType}</td>
              <td className={cell}>{row.merchantId}</td>
              <td className={cell}>{row.accountNumber}</td>
              <td className={cn(cell, "tabular-nums")}>{row.conversionRate}</td>
              <td className={cn(cell, "tabular-nums")}>{row.convertedAmount}</td>
              <td className="text-[11px] sm:text-sm">{row.issue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function V6CustomerIssuesOnlyView() {
  const cell = "font-mono text-[11px] sm:text-sm";
  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <table className={cn(simpleGridTableClass, "min-w-[1100px]")}>
        <thead>
          <tr>
            <th className="w-[9%]">transaction_id</th>
            <th className="w-[9%]">date</th>
            <th className="w-[9%]">customer_id</th>
            <th className="w-[8%]">amount</th>
            <th className="w-[7%]">currency</th>
            <th className="w-[10%]">transaction_type</th>
            <th className="w-[8%]">merchant_id</th>
            <th className="w-[10%]">account_number</th>
            <th className="w-[9%]">conversion_rate</th>
            <th className="w-[10%]">converted_amount</th>
            <th className="w-[11%]">Issue</th>
          </tr>
        </thead>
        <tbody>
          {V6_CUSTOMER_ISSUE_DETAIL_ROWS.map((row, i) => (
            <tr key={`${row.transactionId}-${i}`} className="bg-white">
              <td className={cell}>{row.transactionId}</td>
              <td className={cn(cell, "tabular-nums")}>{row.date}</td>
              <td className={cell}>{row.customerId}</td>
              <td className={cn(cell, "tabular-nums")}>{row.amount}</td>
              <td className={cell}>{row.currency}</td>
              <td className="text-[11px] sm:text-sm">{row.transactionType}</td>
              <td className={cell}>{row.merchantId}</td>
              <td className={cell}>{row.accountNumber}</td>
              <td className={cn(cell, "tabular-nums")}>{row.conversionRate}</td>
              <td className={cn(cell, "tabular-nums")}>{row.convertedAmount}</td>
              <td className="text-[11px] sm:text-sm">{row.issue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function V7DuplicateIssuesOnlyView() {
  const cell = "font-mono text-[11px] sm:text-sm";
  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <table className={cn(simpleGridTableClass, "min-w-[1200px]")}>
        <thead>
          <tr>
            <th className="w-[8%]">transaction_id</th>
            <th className="w-[8%]">date</th>
            <th className="w-[8%]">customer_id</th>
            <th className="w-[7%]">amount</th>
            <th className="w-[7%]">currency</th>
            <th className="w-[9%]">transaction_type</th>
            <th className="w-[7%]">merchant_id</th>
            <th className="w-[9%]">account_number</th>
            <th className="w-[8%]">conversion_rate</th>
            <th className="w-[8%]">converted_amount</th>
            <th className="w-[10%]">Issue</th>
            <th className="w-[11%]">Corrected Value</th>
          </tr>
        </thead>
        <tbody>
          {V7_DUPLICATE_ISSUE_DETAIL_ROWS.map((row, i) => (
            <tr key={`${row.transactionId}-${i}`} className="bg-white">
              <td className={cell}>{row.transactionId}</td>
              <td className={cn(cell, "tabular-nums")}>{row.date}</td>
              <td className={cell}>{row.customerId}</td>
              <td className={cn(cell, "tabular-nums")}>{row.amount}</td>
              <td className={cell}>{row.currency}</td>
              <td className="text-[11px] sm:text-sm">{row.transactionType}</td>
              <td className={cell}>{row.merchantId}</td>
              <td className={cell}>{row.accountNumber}</td>
              <td className={cn(cell, "tabular-nums")}>{row.conversionRate}</td>
              <td className={cn(cell, "tabular-nums")}>{row.convertedAmount}</td>
              <td className="text-[11px] sm:text-sm">{row.issue}</td>
              <td className="font-mono text-[11px] font-semibold text-slate-900 sm:text-sm">{row.correctedValue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function V5DateIssuesOnlyView() {
  const cell = "font-mono text-[11px] sm:text-sm";
  return (
    <div className="w-full min-w-0 overflow-x-auto">
      <table className={cn(simpleGridTableClass, "min-w-[1100px]")}>
        <thead>
          <tr>
            <th className="w-[9%]">transaction_id</th>
            <th className="w-[9%]">date</th>
            <th className="w-[9%]">customer_id</th>
            <th className="w-[8%]">amount</th>
            <th className="w-[7%]">currency</th>
            <th className="w-[10%]">transaction_type</th>
            <th className="w-[8%]">merchant_id</th>
            <th className="w-[10%]">account_number</th>
            <th className="w-[9%]">conversion_rate</th>
            <th className="w-[10%]">converted_amount</th>
            <th className="w-[11%]">Issue</th>
          </tr>
        </thead>
        <tbody>
          {V5_DATE_ISSUE_DETAIL_ROWS.map((row, i) => (
            <tr key={`${row.transactionId}-${i}`} className="bg-white">
              <td className={cell}>{row.transactionId}</td>
              <td className={cn(cell, "tabular-nums")}>{row.date}</td>
              <td className={cell}>{row.customerId}</td>
              <td className={cn(cell, "tabular-nums")}>{row.amount}</td>
              <td className={cell}>{row.currency}</td>
              <td className="text-[11px] sm:text-sm">{row.transactionType}</td>
              <td className={cell}>{row.merchantId}</td>
              <td className={cell}>{row.accountNumber}</td>
              <td className={cn(cell, "tabular-nums")}>{row.conversionRate}</td>
              <td className={cn(cell, "tabular-nums")}>{row.convertedAmount}</td>
              <td className="text-[11px] sm:text-sm">{row.issue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TeamRemediationActionPlanPanel() {
  return (
    <section
      className="w-full rounded-lg border-2 bg-white p-4 sm:p-5"
      style={{ borderColor: ACTION_PLAN_NAVY }}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ClipboardList
          className="size-5 shrink-0 sm:size-[1.35rem]"
          style={{ color: ACTION_PLAN_NAVY }}
          strokeWidth={2}
          aria-hidden
        />
        <h2
          className="text-[11px] font-bold uppercase tracking-wide sm:text-xs"
          style={{ color: ACTION_PLAN_NAVY }}
        >
          <span
            className="rounded px-1 py-0.5"
            style={{ backgroundColor: ACTION_PLAN_TITLE_HIGHLIGHT }}
          >
            Team remediation action plan
          </span>
        </h2>
      </div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <ol
          className="w-full min-w-0 list-decimal space-y-2.5 pl-5 text-[11px] font-medium leading-relaxed sm:text-sm lg:max-w-[75%]"
          style={{ color: ACTION_PLAN_NAVY }}
        >
          {ACTION_PLAN_STEPS.map((step) => (
            <li key={step} className="pl-1">
              {step}
            </li>
          ))}
        </ol>
        <div className="flex w-full shrink-0 flex-col items-end gap-1.5 text-[11px] font-bold tabular-nums sm:text-xs lg:w-auto lg:min-w-[200px]">
          <span style={{ color: ACTION_PLAN_NAVY }}>
            Total Records: {SUMMARY_STATS.totalRecords.toLocaleString()}
          </span>
          <span style={{ color: ACTION_PLAN_NAVY }}>Failed: {SUMMARY_STATS.failed}</span>
          <span style={{ color: ACTION_PLAN_NAVY }}>Pass Rate: {SUMMARY_STATS.passRate}</span>
        </div>
      </div>
    </section>
  );
}

function CsvFullListFooter({ fileName, showFileIcon }: { fileName: string; showFileIcon?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-sm border-2 px-2.5 py-2 text-[11px] font-medium sm:text-xs",
        showFileIcon ? "flex items-center justify-center gap-2" : "text-center"
      )}
      style={{ borderColor: RED, color: RED }}
    >
      {showFileIcon ? <FileText className="size-4 shrink-0" aria-hidden /> : null}
      <span>
        Full list in: {fileName}
      </span>
    </div>
  );
}

function DetailedRecordsTab() {
  const detailShell = cn(shellClass, "w-full overflow-hidden rounded-md");

  return (
    <div className="w-full min-w-0 space-y-3 px-1 pb-3 pt-1">
      <header className="w-full text-center">
        <h1 className="text-sm font-semibold text-slate-900 sm:text-base">Data Quality Detailed Records</h1>
      </header>

      <div className={detailShell}>
        <SectionRedBar>V2 examples: Amount validation failures (first 10)</SectionRedBar>
        <div className="w-full min-w-0 overflow-x-auto">
          <Table className="w-full min-w-[720px]">
            <TableHeader>
              <TableRow className="border-0 hover:bg-transparent">
                <DenseTableHead>Transaction ID</DenseTableHead>
                <DenseTableHead>Date</DenseTableHead>
                <DenseTableHead>Customer</DenseTableHead>
                <DenseTableHead className="text-right">Amount</DenseTableHead>
                <DenseTableHead>Issue</DenseTableHead>
                <DenseTableHead>Fix Action</DenseTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {AMOUNT_FAILURE_EXAMPLES.map((r, i) => (
                <TableRow
                  key={r.txn}
                  className={cn("border-slate-200", i % 2 === 1 ? "bg-slate-50/90" : "bg-white")}
                >
                  <DenseCell className="font-mono text-slate-900">{r.txn}</DenseCell>
                  <DenseCell className="text-slate-800">{r.date}</DenseCell>
                  <DenseCell className="text-slate-800">{r.customer}</DenseCell>
                  <DenseCell className="text-right font-medium font-mono" style={{ color: RED }}>
                    {r.amount}
                  </DenseCell>
                  <DenseCell className="font-medium" style={{ color: RED }}>
                    {r.issue}
                  </DenseCell>
                  <DenseCell className="font-medium" style={{ color: FIX_ACTION_GREEN }}>
                    {r.fix}
                  </DenseCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className={detailShell}>
        <SectionRedBar>V4 examples: Transaction type failures (first 15)</SectionRedBar>
        <div className="w-full min-w-0 overflow-x-auto">
          <Table className="w-full min-w-[720px]">
            <TableHeader>
              <TableRow className="border-0 hover:bg-transparent">
                <DenseTableHead>Transaction ID</DenseTableHead>
                <DenseTableHead>Date</DenseTableHead>
                <DenseTableHead>Current Type</DenseTableHead>
                <DenseTableHead className="text-right">Amount</DenseTableHead>
                <DenseTableHead>Correction Needed</DenseTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TYPE_FAILURE_EXAMPLES.map((r, i) => (
                <TableRow
                  key={r.txn}
                  className={cn("border-slate-200", i % 2 === 1 ? "bg-slate-50/90" : "bg-white")}
                >
                  <DenseCell className="font-mono text-slate-900">{r.txn}</DenseCell>
                  <DenseCell className="text-slate-800">{r.date}</DenseCell>
                  <DenseCell className="font-medium font-mono" style={{ color: RED }}>
                    {r.currentType}
                  </DenseCell>
                  <DenseCell className="text-right font-mono tabular-nums text-slate-900">{r.amount}</DenseCell>
                  <DenseCell className="font-medium font-mono text-[11px] sm:text-xs" style={{ color: FIX_ACTION_GREEN }}>
                    {r.correction}
                  </DenseCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className={detailShell}>
        <SectionRedBar>V6 examples: Customer reference failures (all 18 records)</SectionRedBar>
        <div className="w-full min-w-0 overflow-x-auto">
          <Table className="w-full min-w-[640px]">
            <TableHeader>
              <TableRow className="border-0 hover:bg-transparent">
                <DenseTableHead>Transaction ID</DenseTableHead>
                <DenseTableHead>Date</DenseTableHead>
                <DenseTableHead>Invalid Customer ID</DenseTableHead>
                <DenseTableHead className="text-right">Amount</DenseTableHead>
                <DenseTableHead>Fix Action</DenseTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CUSTOMER_FAILURE_EXAMPLES.map((r, i) => (
                <TableRow
                  key={r.txn}
                  className={cn("border-slate-200", i % 2 === 1 ? "bg-slate-50/90" : "bg-white")}
                >
                  <DenseCell className="font-mono text-slate-900">{r.txn}</DenseCell>
                  <DenseCell className="text-slate-800">{r.date}</DenseCell>
                  <DenseCell className="font-medium font-mono" style={{ color: RED }}>
                    {r.invalidId}
                  </DenseCell>
                  <DenseCell className="text-right font-mono tabular-nums text-slate-900">{r.amount}</DenseCell>
                  <DenseCell className="font-medium" style={{ color: FIX_ACTION_GREEN }}>
                    {r.fix}
                  </DenseCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className={detailShell}>
        <div className="border-b border-slate-200 px-2.5 py-2">
          <h2
            className="text-[11px] font-bold uppercase tracking-wide sm:text-xs"
            style={{ color: TABLE_HEADER_BLUE }}
          >
            Quick reference — file locations & record counts
          </h2>
        </div>
        <div className="space-y-2 px-2.5 py-3">
          {QUICK_REFERENCE_FILES.map((f) => (
            <div
              key={f.file}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[11px] sm:text-xs"
            >
              <FileText className="size-3.5 shrink-0 text-slate-500" aria-hidden />
              <span className="font-mono font-medium text-slate-900">{f.file}</span>
              <span className="font-semibold tabular-nums" style={{ color: RED }}>
                {f.count} records
              </span>
              <span className="text-slate-600">— {f.desc}</span>
            </div>
          ))}
        </div>
        <footer className="border-t border-slate-200 px-2.5 py-2 text-[10px] text-slate-600">
          Location: <span className="font-mono">{OUTPUT_LOCATION}</span>
        </footer>
      </div>
    </div>
  );
}
