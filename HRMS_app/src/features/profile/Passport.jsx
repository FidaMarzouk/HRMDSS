import { useRef } from "react";
import { Camera } from "lucide-react";
import { Avatar } from "../../components/ui/avatar";
import { Meter } from "../../components/marks/Bars";
import { useTodaySessions } from "../../lib/queries";
import { cn } from "../../lib/utils";
import { formatClock, summarizeSessions } from "../time/sessions";

const ACCESS = { employee: "EMPLOYEE", manager: "MANAGER", admin: "HR ADMIN", superAdmin: "CEO" };

// A short, stable staff reference shown on the card (from the record id).
const staffRef = (id) => `EMP-${String(id || "").slice(-6).toUpperCase()}`;

// Machine-readable-style line, as on an access badge. Decorative.
const mrz = (p) => {
  const clean = (s) => String(s || "").toUpperCase().normalize("NFD").replace(/[^A-Z0-9]+/g, "<");
  const line = `P<ENOVA<${clean(p.lastName)}<<${clean(p.firstName)}<<${clean(ACCESS[p.role] || p.role)}<<${staffRef(p._id).slice(4)}<<${new Date().getFullYear()}`;
  return line.padEnd(54, "<").slice(0, 54);
};

const presenceLine = (shift) => {
  switch (shift.state) {
    case "in":
      return `In since ${formatClock(shift.since)}${shift.late ? " (late)" : ""}`;
    case "break":
      return `On break since ${formatClock(shift.breakSince)}`;
    case "left":
      return `Punched out at ${formatClock(shift.lastOut)}`;
    default:
      return "Not punched in";
  }
};

/** Passport-style card: photo, name, position, department, staff reference, today's punch state. */
export function Passport({ profile, onPhoto, uploading }) {
  const fileRef = useRef(null);
  const sessions = useTodaySessions();
  const shift = summarizeSessions(sessions.data || []);
  const punches = profile.role !== "superAdmin";

  return (
    <section aria-label="Access card" className="relative overflow-hidden rounded-2xl border border-line-2 bg-raise p-4">
      <span className="absolute inset-x-0 top-0 h-1 bg-teal" aria-hidden="true" />
      <div className="flex items-start gap-4">
        <div className="relative">
          <Avatar user={profile} size="lg" className="h-20 w-20 text-2xl" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Change your photo"
            className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border border-line-2 bg-panel text-ink-2 hover:text-teal"
          >
            <Camera className="h-4 w-4" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png"
            className="sr-only"
            tabIndex={-1}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onPhoto(file);
            }}
          />
        </div>
        <div className="min-w-0">
          <p className="font-display text-xl font-bold leading-tight text-ink">{profile.firstName} {profile.lastName}</p>
          <p className="text-[13px] text-ink-2">{profile.position}{profile.departmentId?.name ? ` · ${profile.departmentId.name}` : ""}</p>
          {punches && (
            <p className={cn("mt-1 text-[12.5px]", shift.state === "in" || shift.state === "break" ? "text-teal" : "text-ink-3")}>{presenceLine(shift)}</p>
          )}
          <p className="figure mt-2 text-[11.5px] tracking-[0.08em] text-ink-3">
            {staffRef(profile._id)} · {ACCESS[profile.role] || profile.role}
          </p>
        </div>
      </div>
      <p aria-hidden="true" className="figure mt-4 overflow-hidden whitespace-nowrap rounded-md bg-sunk px-2 py-1.5 text-[10.5px] tracking-[0.12em] text-ink-3">
        {mrz(profile)}
      </p>
    </section>
  );
}

const hm = (minutes) => `${minutes < 0 ? "−" : "+"}${Math.floor(Math.abs(minutes) / 60)}:${String(Math.abs(minutes) % 60).padStart(2, "0")}`;

/** This year's leave and this month's hours. */
export function Balances({ overview }) {
  if (!overview) return <div className="h-40 animate-pulse rounded-xl bg-sunk" />;
  const { leave, month } = overview;
  const monthName = new Date(month.start).toLocaleDateString("en-GB", { month: "long" });
  return (
    <section aria-labelledby="balances-title" className="grid gap-3 rounded-xl border border-line bg-panel p-4">
      <h3 id="balances-title" className="label-key">Balances · {leave.year}</h3>
      <div className="grid gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] text-ink">Annual leave</span>
          <span className="figure text-[13px] text-ink">
            <span className="text-lg font-medium">{leave.remainingDays}</span> left of {leave.totalAccruedDays} earned
          </span>
        </div>
        <Meter value={leave.daysTaken} max={Math.max(leave.totalAccruedDays, 1)} label="Taken this year" valueText={`${leave.daysTaken} day${leave.daysTaken === 1 ? "" : "s"}`} />
        <p className="text-[11.5px] text-ink-3">At most {leave.annualCap} days a year. Unused days do not carry over: balances restart at 0 on 1 January.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-line pt-3">
        <div>
          <p className="text-[12px] text-ink-3">Overtime in {monthName}</p>
          <p className="figure text-lg font-medium text-ink">{hm(month.overtimeMinutes)}</p>
        </div>
        <div>
          <p className="text-[12px] text-ink-3">Worked in {monthName}</p>
          <p className="figure text-lg font-medium text-ink">{month.productionHours} h <span className="text-[12px] text-ink-3">· {month.daysWorked} days</span></p>
        </div>
      </div>
    </section>
  );
}
