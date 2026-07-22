// French date/time formatting, pinned to Europe/Paris so showtimes read the same
// regardless of where the server runs.
const dateTime = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

const dayMonth = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Paris",
});

export const formatDateTime = (d: Date) => dateTime.format(d);
export const formatDayMonth = (d: Date) => dayMonth.format(d);
