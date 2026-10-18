import { Download, Loader2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { Select } from "../../components/ui/field";
import { SegmentedControl } from "../../components/ui/segmented-control";
import { errorMessage } from "../../lib/api";
import { PeriodPicker } from "./PeriodPicker";
import { usePeriodParams } from "./usePeriodParams";
import { Signals } from "./Signals";
import { downloadBrief } from "./brief";
import { OverviewMarks, Tickers } from "./OverviewMarks";
import { HrSection } from "./HrSections";
import { ManagerSection } from "./ManagerSections";
import { HR_TABS, MANAGER_TABS } from "./tabs";
import { useDashboard, useOverview } from "./analyticsApi";

/**
 * Analytics: what needs attention this period. Tickers, ranked signals and the
 * four marks (arrivals, barcode, tide, hours), then the detailed sections of
 * the former HR or team dashboard. HR and the CEO see the company and can
 * narrow to one department; a manager sees their department.
 */
export default function AnalyticsPage() {
  const { user } = useAuth();
  const company = user?.role === "admin" || user?.role === "superAdmin";
  const { params, period, compare, update } = usePeriodParams();
  const department = company ? params.get("dept") || "" : "";
  const tabs = company ? HR_TABS : MANAGER_TABS;
  const tab = tabs.some((t) => t.value === params.get("tab")) ? params.get("tab") : tabs[0].value;

  const overview = useOverview({ ...period, department });
  const details = useDashboard(company ? "hr" : "manager", period);
  const data = overview.data;
  const departments = data?.scope.departments || [];
  const scopeName = company ? departments.find((d) => d.id === department)?.name || "Company" : departments[0]?.name || "My department";

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-key">{scopeName}{data ? ` · ${data.scope.headcount} people · ${data.period.workdays} working days` : ""}</p>
          <h2 className="font-display text-2xl font-bold leading-tight">What needs attention this period</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {company && (
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              <span className="sr-only">Department</span>
              <Select value={department} onChange={(e) => update({ dept: e.target.value })} className="h-10 w-auto min-w-[180px]">
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </label>
          )}
          <PeriodPicker value={period} onChange={(r) => update(r)} compare={compare} onCompareChange={(v) => update({ compare: v ? null : "0" })} />
          <Button variant="secondary" disabled={!data} onClick={() => downloadBrief({ title: "What needs attention this period", scope: scopeName, period: data.period, tickers: data.tickers, signals: data.signals })}>
            <Download aria-hidden /> Export brief
          </Button>
        </div>
      </div>

      {overview.isError ? (
        <p role="alert" className="rounded-xl border border-red/40 bg-panel px-4 py-3 text-[13px] text-red">Could not load analytics: {errorMessage(overview.error)}</p>
      ) : (
        <>
          <Tickers tickers={data?.tickers} compare={compare} loading={!data} />
          <section aria-label="Signals" className="grid gap-2">
            <p className="label-key flex items-center gap-2">
              Signals {overview.isFetching && data && <Loader2 className="h-3 w-3 animate-spin" aria-label="Updating" />}
            </p>
            <Signals signals={data?.signals || []} loading={!data} />
          </section>
          {data && <OverviewMarks data={data} compare={compare} />}
        </>
      )}

      <section aria-label="Details" className="grid gap-3 border-t border-line pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg font-semibold">{company ? "Company details" : "Team details"}</h3>
          <SegmentedControl label="Section" value={tab} onChange={(v) => update({ tab: v })} options={tabs} size="sm" />
        </div>
        {company && department && <p className="text-[12px] text-ink-3">The detailed sections cover the whole company.</p>}
        {details.isError ? (
          <p role="alert" className="text-[13px] text-red">Could not load the details: {errorMessage(details.error)}</p>
        ) : !details.data ? (
          <div className="h-64 animate-pulse rounded-xl border border-line bg-panel" aria-busy="true" />
        ) : company ? (
          <HrSection tab={tab} data={details.data} />
        ) : (
          <ManagerSection tab={tab} data={details.data} period={period} />
        )}
      </section>
    </div>
  );
}
