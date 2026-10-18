import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { SegmentedControl } from "../../components/ui/segmented-control";
import { PunchCard } from "./PunchCard";
import { CorrectionsPanel, MyDays, TeamDay } from "./TimeViews";

/**
 * Time: punch card, day ribbons (team or company for reviewers), the user's
 * own recent days with correction requests, and corrections to review.
 * The CEO does not punch; they see the company view only.
 */
export default function TimePage() {
  const { user } = useAuth();
  const role = user?.role;
  const punches = role !== "superAdmin";
  const reviewer = role !== "employee";
  const [view, setView] = useState(reviewer ? "team" : "mine");

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold leading-tight">Time</h2>
          <p className="text-[13px] text-ink-2">Punches, breaks and exceptions on a 07:00–19:00 track. Late after 08:30, overtime after 18:00.</p>
        </div>
        {reviewer && punches && (
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: "team", label: role === "manager" ? "My team" : "Company" },
              { value: "mine", label: "My days" },
            ]}
          />
        )}
      </div>

      {punches && (
        <div className={reviewer ? "grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]" : "grid gap-4"}>
          <PunchCard />
          {reviewer && <CorrectionsPanel scope="review" />}
        </div>
      )}
      {!punches && <CorrectionsPanel scope="review" />}

      {view === "team" && reviewer ? <TeamDay linkPeople /> : <MyDays />}
      {punches && view === "mine" && <CorrectionsPanel scope="mine" />}
    </div>
  );
}
