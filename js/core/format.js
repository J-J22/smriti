// Small display helpers shared by the caregiver screens.

// "HH:MM" (24h, as stored) -> "3:20 PM"
export function formatTime(time) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time || ''));
  if (!match) return String(time || '');
  const hours = Number(match[1]);
  const suffix = hours < 12 ? 'AM' : 'PM';
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return display + ':' + match[2] + ' ' + suffix;
}

function timeOfDay(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return formatTime(hours + ':' + (minutes < 10 ? '0' + minutes : String(minutes)));
}

function startOfDay(date) {
  const copy = new Date(date.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// A timestamp phrased the way a caregiver would say it.
export function formatWhen(timestamp, strings, now) {
  if (!timestamp) return strings.never;
  const when = new Date(timestamp);
  const current = now ? new Date(now) : new Date();
  const minutesAgo = Math.floor((current.getTime() - when.getTime()) / 60000);

  if (minutesAgo < 1) return strings.justNow;
  if (minutesAgo < 60) return strings.minutesAgo.replace('{n}', String(minutesAgo));

  const dayGap = Math.round(
    (startOfDay(current).getTime() - startOfDay(when).getTime()) / 86400000);
  if (dayGap === 0) return strings.todayAt.replace('{time}', timeOfDay(when));
  if (dayGap === 1) return strings.yesterdayAt.replace('{time}', timeOfDay(when));
  return strings.onDate
    .replace('{date}', when.toLocaleDateString())
    .replace('{time}', timeOfDay(when));
}

export function isToday(timestamp, now) {
  if (!timestamp) return false;
  const current = now ? new Date(now) : new Date();
  return startOfDay(new Date(timestamp)).getTime() === startOfDay(current).getTime();
}
