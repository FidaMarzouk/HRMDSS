import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarPlus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/button";
import { SegmentedControl } from "../../components/ui/segmented-control";
import { useToday } from "../../lib/queries";
import { LEAVE_ROLE_CONFIG, VIEW_LABELS } from "./leavePolicy";
import { buildPipeline, pipelineColumns } from "./stages";
import { useLeaveList } from "./leaveApi";
import { idOf } from "./leaveUtils";
import { Pipeline } from "./Pipeline";
import { RequestList } from "./RequestList";
import { DecisionPanel } from "./DecisionPanel";
import LeaveRequestForm from "./LeaveRequestForm";

const isTyping = (el) => el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/**
 * Leave workspace. Reviewers see requests by stage (pipeline) with a decision
 * panel: approval track, team coverage, policy checks, suggested dates, and
 * approve / propose / reject with undo. Keyboard: A, C, R, J, K.
 * Employees see their own requests and answer counter-proposals.
 */
export default function LeaveRequestsPage() {
  const { user } = useAuth();
  const me = user?.id;
  const config = LEAVE_ROLE_CONFIG[user?.role] || LEAVE_ROLE_CONFIG.employee;
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState(config.views[0]);
  const [selectedId, setSelectedId] = useState(() => searchParams.get("request"));
  // ?new=1 (from the command palette) opens the request form directly.
  const [createOpen, setCreateOpen] = useState(() => searchParams.get("new") === "1");
  const panelRef = useRef(null);
  const panelBoxRef = useRef(null);

  const list = useLeaveList();
  const today = useToday();
  const viewer = useMemo(() => ({ id: me, role: user?.role }), [me, user?.role]);
  const groups = useMemo(() => buildPipeline(list.data || [], viewer), [list.data, viewer]);
  const columns = useMemo(() => pipelineColumns(user?.role), [user?.role]);
  const queueFlags = useMemo(
    () => Object.fromEntries((today.data?.queue || []).filter((q) => q.kind === "leave").map((q) => [q.id, q.flags])),
    [today.data]
  );

  // Keep ?request= in the URL so a request can be linked from notifications.
  const select = useCallback(
    (id) => {
      setSelectedId(id);
      const next = new URLSearchParams(searchParams);
      next.delete("new");
      if (id) next.set("request", id);
      else next.delete("request");
      setSearchParams(next, { replace: true });
      requestAnimationFrame(() => {
        const box = panelBoxRef.current;
        if (box && box.getBoundingClientRect().top > window.innerHeight * 0.6) box.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    [searchParams, setSearchParams]
  );

  // Stable filters: a new function each render would reset the list's paging.
  const othersFilter = useCallback((r) => idOf(r.employeeId) !== me, [me]);
  const mineFilter = useCallback((r) => idOf(r.employeeId) === me, [me]);

  // J/K move through "Your decision" in the pipeline.
  const triageList = useMemo(() => (view === "pipeline" ? groups.yours : []), [view, groups]);

  const moveBy = useCallback(
    (step) => {
      if (!triageList.length) return;
      const i = triageList.findIndex((r) => r._id === selectedId);
      const next = triageList[Math.min(triageList.length - 1, Math.max(0, i < 0 ? 0 : i + step))];
      select(next._id);
    },
    [triageList, selectedId, select]
  );

  // After a decision, move to the next request waiting on this viewer.
  const afterDecision = useCallback(() => {
    const i = triageList.findIndex((r) => r._id === selectedId);
    const next = triageList[i + 1] || triageList[i - 1];
    if (next && next._id !== selectedId) select(next._id);
  }, [triageList, selectedId, select]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || document.querySelector("dialog[open]")) return;
      const key = e.key.toLowerCase();
      if (key === "j") moveBy(1);
      else if (key === "k") moveBy(-1);
      else if (key === "a") panelRef.current?.approve();
      else if (key === "c") panelRef.current?.propose();
      else if (key === "r") panelRef.current?.reject();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moveBy]);

  const viewOptions = config.views.map((v) => ({ value: v, label: VIEW_LABELS[v] }));
  const reviewer = config.views.includes("pipeline");

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold leading-tight">{reviewer ? "Leave requests" : "My leave"}</h2>
          <p className="text-[13px] text-ink-2">
            {reviewer
              ? `${groups.yours.length} waiting on your decision · ${groups.employee.length} waiting on employees`
              : "Your requests, where they are in the approval track, and any new dates proposed to you."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {config.views.length > 1 && <SegmentedControl label="View" options={viewOptions} value={view} onChange={setView} />}
          {config.canCreate && (
            <Button onClick={() => setCreateOpen(true)}>
              <CalendarPlus /> Request leave
            </Button>
          )}
        </div>
      </div>

      {list.isError && <p role="alert" className="rounded-md border border-red/30 bg-red/10 px-3 py-2 text-sm text-red">Leave requests could not be loaded.</p>}

      {view === "pipeline" &&
        (list.isLoading ? (
          <div aria-busy="true" className="h-48 animate-pulse rounded-xl bg-sunk" />
        ) : (
          <Pipeline columns={columns} groups={groups} selectedId={selectedId} onSelect={select} queueFlags={queueFlags} />
        ))}
      {view === "all" && <RequestList scopeFilter={othersFilter} showEmployee selectedId={selectedId} onSelect={select} />}
      {view === "mine" && (
        <RequestList
          scopeFilter={mineFilter}
          showEmployee={false}
          selectedId={selectedId}
          onSelect={select}
          emptyMessage="You have no leave requests yet."
        />
      )}

      <div ref={panelBoxRef} className="scroll-mt-20">
        <DecisionPanel ref={panelRef} requestId={selectedId} onDecided={afterDecision} />
      </div>

      {config.canCreate && <LeaveRequestForm open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => list.refetch()} />}
    </div>
  );
}
