export function todayLocal(now = new Date()): string {
  return [
    now.getFullYear().toString().padStart(4, "0"),
    (now.getMonth() + 1).toString().padStart(2, "0"),
    now.getDate().toString().padStart(2, "0"),
  ].join("-");
}

export function timeLocal(now = new Date()): string {
  return `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

export function localDateTimeWithOffset(date: string, time: string): string {
  const local = new Date(`${date}T${time}:00`);
  if (Number.isNaN(local.getTime())) {
    throw new Error("Ogiltigt datum eller klockslag.");
  }
  const offsetMinutes = -local.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const hours = Math.floor(absolute / 60).toString().padStart(2, "0");
  const minutes = (absolute % 60).toString().padStart(2, "0");
  return `${date}T${time}:00${sign}${hours}:${minutes}`;
}

export function localDateFromIso(value: string): string {
  return value.slice(0, 10);
}

export function localTimeFromIso(value: string): string {
  return value.slice(11, 16);
}

export function currentTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Stockholm";
}
