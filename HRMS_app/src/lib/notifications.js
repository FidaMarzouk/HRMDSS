// Lets pages that read or delete notifications tell the badge to refresh
// (lib/useLiveUpdates.js listens for this event).
export const notifyNotificationsChanged = () => window.dispatchEvent(new Event("notifications:changed"));
