// Small display helpers shared by the caregiver screens.

// "HH:MM" (24h, as stored) -> "3:20 PM". The am/pm words come from the
// content pack, so a translated build does not read half in English.
export function formatTime(time, clock) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time || ''));
  if (!match) return String(time || '');
  const words = clock || { am: 'AM', pm: 'PM' };
  const hours = Number(match[1]);
  const suffix = hours < 12 ? words.am : words.pm;
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return display + ':' + match[2] + ' ' + suffix;
}

function timeOfDay(date, clock) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return formatTime(hours + ':' + (minutes < 10 ? '0' + minutes : String(minutes)), clock);
}

function startOfDay(date) {
  const copy = new Date(date.getTime());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// A timestamp phrased the way a caregiver would say it.
export function formatWhen(timestamp, strings, now, clock) {
  if (!timestamp) return strings.never;
  const when = new Date(timestamp);
  const current = now ? new Date(now) : new Date();
  const minutesAgo = Math.floor((current.getTime() - when.getTime()) / 60000);

  if (minutesAgo < 1) return strings.justNow;
  if (minutesAgo < 60) return strings.minutesAgo.replace('{n}', String(minutesAgo));

  const dayGap = Math.round(
    (startOfDay(current).getTime() - startOfDay(when).getTime()) / 86400000);
  if (dayGap === 0) return strings.todayAt.replace('{time}', timeOfDay(when, clock));
  if (dayGap === 1) return strings.yesterdayAt.replace('{time}', timeOfDay(when, clock));
  return strings.onDate
    .replace('{date}', when.toLocaleDateString())
    .replace('{time}', timeOfDay(when, clock));
}

export function isToday(timestamp, now) {
  if (!timestamp) return false;
  const current = now ? new Date(now) : new Date();
  return startOfDay(new Date(timestamp)).getTime() === startOfDay(current).getTime();
}
