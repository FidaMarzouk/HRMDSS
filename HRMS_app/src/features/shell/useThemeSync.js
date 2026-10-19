import { useEffect, useRef } from "react";
import api from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { useTodaySessions } from "../../lib/queries";
import { offShiftByClock, useTheme } from "../../theme/theme";
import { summarizeSessions } from "../time/sessions";

/**
 * Keeps the theme in step with the profile: the saved choice is applied when
 * you sign in (on any device), and changes made anywhere in the app are saved
 * back. In "shift" mode the colour follows your punch state: dark once you have
 * punched out, or outside 07:00-19:00 when you have not punched in.
 */
export function useThemeSync() {
  const { user, setUser } = useAuth();
  const { mode, setMode, setShiftDark, registerRemote } = useTheme();
  const appliedFor = useRef(null);
  const sessions = useTodaySessions();

  // Registered first: the sign-in effect below may save straight away.
  useEffect(
    () =>
      registerRemote(async (theme) => {
        try {
          await api.put("/api/users/me/preferences", { theme });
          setUser((prev) => (prev ? { ...prev, preferences: { ...(prev.preferences || {}), theme } } : prev));
        } catch {
          // The choice still applies on this device.
        }
      }),
    [registerRemote, setUser]
  );

  // On sign-in: a theme saved to the profile wins; if none was ever saved,
  // this device's current choice becomes the saved one.
  useEffect(() => {
    if (!user?.id || appliedFor.current === user.id || !user.preferences) return;
    appliedFor.current = user.id;
    const saved = user.preferences.theme;
    if (saved && saved !== mode) setMode(saved, { save: false });
    if (!saved) setMode(mode);
  }, [user, mode, setMode]);

  useEffect(() => {
    if (mode !== "shift") return undefined;
    const update = () => {
      const shift = summarizeSessions(sessions.data || []);
      setShiftDark(shift.state === "left" || (shift.state === "out" && offShiftByClock()));
    };
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [mode, sessions.data, setShiftDark]);
}
