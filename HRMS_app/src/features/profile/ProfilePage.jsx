import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Plus, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/field";
import { useAuth } from "../../context/AuthContext";
import { formatDay, toDayKey } from "../../lib/dates";
import { messagePath } from "../../config/navigation";
import { LogoutDialog } from "../shell/LogoutDialog";
import { useChatPeople } from "../inbox/inboxApi";
import { EditableField } from "./EditableField";
import { Balances, Passport } from "./Passport";
import { Preferences, Security } from "./Settings";
import { saveProfile, useProfile, useProfileOverview } from "./profileApi";

const NAME = /^[\p{L}\s'-]+$/u;
const ACCESS = { employee: "Employee", manager: "Manager", admin: "HR administrator", superAdmin: "CEO" };
const HR_NOTE = "Managed by HR";

function Panel({ title, children, footer }) {
  return (
    <section aria-label={title} className="rounded-xl border border-line bg-panel p-4">
      <h3 className="label-key mb-1">{title}</h3>
      {children}
      {footer}
    </section>
  );
}

function Skills({ skills, onSave }) {
  const [adding, setAdding] = useState("");
  const names = skills.map((s) => s.name);
  const add = async (e) => {
    e.preventDefault();
    const name = adding.trim();
    if (!name || names.some((n) => n.toLowerCase() === name.toLowerCase())) return;
    if (await onSave([...names, name])) setAdding("");
  };
  return (
    <div className="grid gap-3">
      <ul className="flex flex-wrap gap-2">
        {skills.map((s) => (
          <li key={s.name} className="inline-flex items-center gap-2 rounded-full border border-line-2 bg-raise py-1 pl-3 pr-1 text-[12.5px]">
            <span className="text-ink">{s.name}</span>
            {s.level ? (
              <span className="flex items-center gap-[2px]" title={`Level ${s.level} of 5${s.validatedBy ? ", validated" : ""}`} aria-label={`level ${s.level} of 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <i key={n} aria-hidden="true" className={n <= s.level ? "h-2.5 w-1.5 rounded-[1px] bg-teal" : "h-2.5 w-1.5 rounded-[1px] bg-sunk"} />
                ))}
              </span>
            ) : (
              <span className="text-[11px] text-ink-3">not rated</span>
            )}
            {!s.validatedBy ? (
              <button type="button" onClick={() => onSave(names.filter((n) => n !== s.name))} aria-label={`Remove ${s.name}`} className="grid h-6 w-6 place-items-center rounded-full text-ink-3 hover:bg-sunk hover:text-ink">
                <X className="h-3 w-3" />
              </button>
            ) : (
              <span className="w-1" />
            )}
          </li>
        ))}
        {!skills.length && <li className="text-[12.5px] text-ink-3">No skills recorded yet.</li>}
      </ul>
      <form onSubmit={add} className="flex max-w-sm gap-2">
        <Input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Add a skill (e.g. ROS, SolidWorks)" aria-label="Add a skill" maxLength={60} className="h-9 text-[13px]" />
        <Button type="submit" size="sm" variant="secondary" disabled={!adding.trim()}><Plus aria-hidden /> Add</Button>
      </form>
      <p className="text-[11.5px] text-ink-3">Your manager or HR rates the level (1–5); a rated skill stays on your profile.</p>
    </div>
  );
}

/**
 * Profile: an access-card style passport, balances, fields you edit in place,
 * the fields HR manages (read-only, with who to ask), skills, preferences
 * (theme, digest, quiet hours) and security (password, sessions).
 */
export default function ProfilePage() {
  const { setUser, refresh } = useAuth();
  const { data: profile, isLoading, isError } = useProfile();
  const overview = useProfileOverview();
  const people = useChatPeople(true);
  const [uploading, setUploading] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const hr = (people.data || []).find((p) => p.role === "admin");

  // Preferences can also change from the inbox or another device: start fresh.
  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = async (fields) => {
    const updated = await saveProfile(fields);
    if (updated) setUser((prev) => (prev ? { ...prev, firstName: updated.firstName, lastName: updated.lastName, profilePicture: updated.profilePicture } : prev));
    return Boolean(updated);
  };
  const savePhoto = async (file) => {
    if (file.size > 2 * 1024 * 1024) return;
    setUploading(true);
    const updated = await saveProfile({}, { file });
    setUploading(false);
    if (updated) setUser((prev) => (prev ? { ...prev, profilePicture: updated.profilePicture } : prev));
  };

  if (isError) return <p role="alert" className="text-[13px] text-red">Your profile could not be loaded.</p>;
  if (isLoading || !profile) return <div className="h-96 animate-pulse rounded-xl bg-sunk" />;

  const askHr = hr ? (
    <Button asChild size="sm" variant="ghost">
      <Link to={messagePath(hr._id)}><MessageCircle aria-hidden /> Message HR</Link>
    </Button>
  ) : (
    <Button asChild size="sm" variant="ghost">
      <a href="mailto:hr@enovarobotics.eu">Email HR</a>
    </Button>
  );

  return (
    <div className="grid gap-4">
      <div>
        <p className="label-key">{ACCESS[profile.role]}</p>
        <h2 className="font-display text-2xl font-bold leading-tight">Profile</h2>
      </div>
      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <Passport profile={profile} onPhoto={savePhoto} uploading={uploading} />
          <Balances overview={overview.data} />
          <Button variant="secondary" onClick={() => setLogoutOpen(true)}>Log out</Button>
        </div>
        <div className="grid content-start gap-4">
          <Panel title="Personal">
            <EditableField label="First name" value={profile.firstName} validate={(v) => (!v ? "Enter your first name." : NAME.test(v) ? "" : "Letters only.")} onSave={(v) => save({ firstName: v })} />
            <EditableField label="Last name" value={profile.lastName} validate={(v) => (!v ? "Enter your last name." : NAME.test(v) ? "" : "Letters only.")} onSave={(v) => save({ lastName: v })} />
            <EditableField label="Phone" value={profile.phone} type="tel" inputProps={{ inputMode: "numeric" }} validate={(v) => (!v || /^\d+$/.test(v) ? "" : "Digits only.")} onSave={(v) => save({ phone: v })} />
            <EditableField label="Personal email" value={profile.personalEmail} type="email" validate={(v) => (!v || /^\S+@\S+\.\S+$/.test(v) ? "" : "Enter a valid email.")} onSave={(v) => save({ personalEmail: v })} />
            <EditableField
              label="Date of birth"
              value={toDayKey(profile.birthdate)}
              display={profile.birthdate ? formatDay(profile.birthdate, { day: "numeric", month: "long", year: "numeric" }) : ""}
              type="date"
              inputProps={{ max: toDayKey(new Date()) }}
              onSave={(v) => save({ birthdate: v })}
            />
          </Panel>

          <Panel title="Work" footer={<div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-[12px] text-ink-3">These are managed by HR. Something wrong? {askHr}</div>}>
            <EditableField label="Work email" value={profile.email} readOnly readOnlyNote={HR_NOTE} />
            <EditableField label="Position" value={profile.position} readOnly readOnlyNote={HR_NOTE} />
            <EditableField label="Department" value={profile.departmentId?.name} readOnly readOnlyNote={HR_NOTE} />
            <EditableField label="Manager" value={profile.managerId ? `${profile.managerId.firstName} ${profile.managerId.lastName}` : ""} readOnly readOnlyNote="Set from your department" />
            <EditableField label="Hired" value={profile.hireDate ? formatDay(profile.hireDate, { day: "numeric", month: "long", year: "numeric" }) : ""} readOnly readOnlyNote={HR_NOTE} />
            <EditableField label="Access" value={ACCESS[profile.role]} readOnly readOnlyNote={HR_NOTE} />
          </Panel>

          <Panel title="Skills">
            <Skills skills={profile.skills || []} onSave={(names) => save({ skills: names })} />
          </Panel>

          <Preferences />
          <Security previousSignIn={overview.data?.previousSignIn} onLogout={() => setLogoutOpen(true)} />
        </div>
      </div>
      <LogoutDialog open={logoutOpen} onClose={() => setLogoutOpen(false)} />
    </div>
  );
}
