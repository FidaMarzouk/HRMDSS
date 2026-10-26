import { useEffect, useState } from "react";
import { Laptop, LogOut, Smartphone } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field, Input } from "../../components/ui/field";
import { Switch } from "../../components/ui/switch";
import { ThemeSwitch } from "../../components/ui/theme-switch";
import { confirmAction, showSuccess } from "../../lib/alerts";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../theme/theme";
import { cn } from "../../lib/utils";
import { endSession, saveProfile, savePreferences, signOutOthers, useSessions } from "./profileApi";

const THEME_HELP = {
  light: "Always light.",
  dark: "Always dark.",
  auto: "Follows your device's setting.",
  shift: "Light during your working day, dark once you have punched out (and outside 07:00–19:00 when you have not punched in).",
};

function Row({ title, help, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-t border-line py-3 first:border-t-0">
      <div className="min-w-0 max-w-md">
        <p className="text-[13.5px] font-medium text-ink">{title}</p>
        {help && <p className="text-[12px] text-ink-3">{help}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** Theme (saved to your profile), daily digest and quiet hours. */
export function Preferences() {
  const { user, setUser } = useAuth();
  const { mode } = useTheme();
  const prefs = user?.preferences || {};
  const [quiet, setQuiet] = useState(() => prefs.quietHours || { enabled: false, from: "19:00", to: "08:00" });
  useEffect(() => {
    if (prefs.quietHours) setQuiet(prefs.quietHours);
  }, [prefs.quietHours]);

  const update = async (changes, text) => {
    const saved = await savePreferences(changes, text);
    if (saved) setUser((prev) => (prev ? { ...prev, preferences: { ...(prev.preferences || {}), ...saved } } : prev));
    return Boolean(saved);
  };
  const quietChanged = JSON.stringify(quiet) !== JSON.stringify(prefs.quietHours || {});

  return (
    <section aria-labelledby="prefs-title" className="rounded-xl border border-line bg-panel p-4">
      <h3 id="prefs-title" className="label-key mb-1">Preferences</h3>
      <Row title="Theme" help={`${THEME_HELP[mode]} Saved to your profile, so it follows you on every device.`}>
        <ThemeSwitch />
      </Row>
      <Row title="Daily digest at 09:00" help="Non-urgent notifications arrive as one summary at 09:00 on working days. Urgent ones still arrive right away.">
        <Switch
          checked={Boolean(prefs.digest)}
          onChange={(v) => update({ digest: v }, v ? "Daily digest on" : "Daily digest off")}
          label="Daily digest at 09:00"
        />
      </Row>
      <Row title="Quiet hours" help="No pop-ups for non-urgent notifications during these hours; they still wait in your inbox. Urgent ones still pop up.">
        <Switch checked={quiet.enabled} onChange={(v) => setQuiet((q) => ({ ...q, enabled: v }))} label="Quiet hours" />
        <label className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
          From
          <Input type="time" value={quiet.from} onChange={(e) => setQuiet((q) => ({ ...q, from: e.target.value }))} disabled={!quiet.enabled} className="h-9 w-[110px] text-[13px]" />
        </label>
        <label className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
          to
          <Input type="time" value={quiet.to} onChange={(e) => setQuiet((q) => ({ ...q, to: e.target.value }))} disabled={!quiet.enabled} className="h-9 w-[110px] text-[13px]" />
        </label>
        <Button size="sm" variant="secondary" disabled={!quietChanged || (quiet.enabled && quiet.from === quiet.to)} onClick={() => update({ quietHours: quiet }, quiet.enabled ? `Quiet ${quiet.from}–${quiet.to}` : "Quiet hours off")}>
          Save
        </Button>
      </Row>
      <p className="border-t border-line pt-3 text-[12px] text-ink-3">Language: English. French arrives with the EN/FR update.</p>
    </section>
  );
}

function PasswordForm() {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.current) return setError("Enter your current password.");
    if (form.next.length < 6) return setError("The new password needs at least 6 characters.");
    if (form.next !== form.confirm) return setError("The two new passwords do not match.");
    if (form.next === form.current) return setError("Choose a password different from the current one.");
    setError("");
    setSaving(true);
    const result = await saveProfile({ currentPassword: form.current, password: form.next }, { quiet: true });
    setSaving(false);
    if (result) {
      setForm({ current: "", next: "", confirm: "" });
      const n = result.signedOutSessions || 0;
      showSuccess("Password changed", `${n ? `${n} other device${n === 1 ? " was" : "s were"} signed out. ` : ""}You stay signed in here; a notification and an email confirm the change.`);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3" noValidate>
      <Field label="Current password" className="content-start">
        <Input type="password" autoComplete="current-password" value={form.current} onChange={set("current")} />
      </Field>
      <Field label="New password" hint="At least 6 characters" className="content-start">
        <Input type="password" autoComplete="new-password" value={form.next} onChange={set("next")} />
      </Field>
      <Field label="New password again" className="content-start">
        <Input type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} />
      </Field>
      {error && <p role="alert" className="text-[12.5px] text-red sm:col-span-3">{error}</p>}
      <div className="sm:col-span-3">
        <Button type="submit" variant="secondary" disabled={saving}>{saving ? "Changing…" : "Change password"}</Button>
        <span className="ml-3 text-[12px] text-ink-3">Your other devices are signed out when it changes.</span>
      </div>
    </form>
  );
}

const when = (d) => new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Password, active sessions by device, sign out other devices. */
export function Security({ previousSignIn, onLogout }) {
  const { data, isLoading } = useSessions();
  const sessions = data?.sessions || [];
  const others = sessions.filter((s) => !s.current);

  const end = async (s) => {
    if (await confirmAction("Sign this device out?", `${s.device} (${s.ip}) will need to sign in again.`, "Sign out")) await endSession(s.id);
  };
  const endOthers = async () => {
    if (await confirmAction("Sign out all other devices?", "Every session except this one ends now.", "Sign out others")) await signOutOthers();
  };

  return (
    <section aria-labelledby="security-title" className="grid gap-4 rounded-xl border border-line bg-panel p-4">
      <h3 id="security-title" className="label-key">Sign-in and security</h3>
      <PasswordForm />
      <div className="grid gap-2 border-t border-line pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13.5px] font-medium text-ink">Active sessions</p>
          <Button size="sm" variant="secondary" onClick={endOthers} disabled={!others.length}>Sign out all other devices</Button>
        </div>
        {previousSignIn && (
          <p className="text-[12px] text-ink-3">Previous sign-in: {when(previousSignIn.at)} · {previousSignIn.device} · {previousSignIn.ip}</p>
        )}
        {isLoading ? (
          <div className="h-20 animate-pulse rounded-lg bg-sunk" />
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {data?.legacy && (
              <li className="px-3 py-2 text-[12px] text-ink-3">This sign-in started before session tracking; sign in again to see it listed.</li>
            )}
            {sessions.map((s) => {
              const Icon = /iPhone|Android|iPad/.test(s.device) ? Smartphone : Laptop;
              return (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <Icon className="h-4 w-4 text-ink-3" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-ink">
                      {s.device}
                      {s.current && <span className="ml-2 rounded-full border border-teal/40 px-2 text-[11px] text-teal">This device</span>}
                    </p>
                    <p className="figure text-[11.5px] text-ink-3">{s.ip} · signed in {when(s.createdAt)} · active {when(s.lastSeenAt)}</p>
                  </div>
                  {s.current ? (
                    <Button size="sm" variant="ghost" onClick={onLogout}><LogOut aria-hidden /> Log out</Button>
                  ) : (
                    <Button size="sm" variant="ghost" className={cn("text-red")} onClick={() => end(s)}>Sign out</Button>
                  )}
                </li>
              );
            })}
            {!sessions.length && !data?.legacy && <li className="px-3 py-3 text-[12.5px] text-ink-3">No other sessions.</li>}
          </ul>
        )}
      </div>
    </section>
  );
}
