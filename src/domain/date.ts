import type { ISODate } from "./types";

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

// Dates are calendar-only (no timezone in ISODate) — anchor every Date object
// to UTC midnight so day-of-week/day-of-month math never drifts with the host's local TZ.
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parseISO(iso: string): Date | null {
  const m = ISO_RE.exec(iso);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

export function toISO(date: Date): ISODate {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO(): ISODate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addMonthsClamped(iso: ISODate, months: number): ISODate {
  const d = parseISO(iso);
  if (!d) return iso;
  const day = d.getUTCDate();
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth0 = ((total % 12) + 12) % 12;
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth0 + 1));
  return toISO(new Date(Date.UTC(targetYear, targetMonth0, clampedDay)));
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = parseISO(iso);
  if (!d) return iso;
  return toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days)));
}

export function diffDays(from: ISODate, to: ISODate): number {
  const a = parseISO(from);
  const b = parseISO(to);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function formatKoreanDate(iso: ISODate): string {
  const d = parseISO(iso);
  if (!d) return iso;
  const weekday = WEEKDAY_KO[d.getUTCDay()];
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${weekday})`;
}

const SEOUL_TZ = "Asia/Seoul";
const SEOUL_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Parses a 'YYYY-MM-DD' string as Asia/Seoul local midnight, returning the real UTC instant. */
export function parseSeoulDate(dateString: string): Date {
  const anchored = parseISO(dateString);
  if (!anchored) return new Date(NaN);
  return new Date(anchored.getTime() - SEOUL_OFFSET_MS);
}

function seoulDateParts(date: Date): Record<"YYYY" | "MM" | "DD" | "HH" | "mm" | "ss", string> {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SEOUL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  return {
    YYYY: map.year,
    MM: map.month,
    DD: map.day,
    HH: map.hour === "24" ? "00" : map.hour,
    mm: map.minute,
    ss: map.second,
  };
}

/** Formats a Date as Asia/Seoul local time using `format` tokens (YYYY, MM, DD, HH, mm, ss). */
export function formatSeoulDate(date: Date, format: string = "YYYY-MM-DD"): string {
  if (Number.isNaN(date.getTime())) return "";
  const parts = seoulDateParts(date);
  return format.replace(/YYYY|MM|DD|HH|mm|ss/g, (token) => parts[token as keyof typeof parts]);
}

export function formatWon(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const digits = Math.trunc(Math.abs(amount)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}${grouped}원`;
}
