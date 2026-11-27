// レッスン候補日時（純粋関数）。静的サイトのため、閲覧者の現在時刻を基準に Asia/Tokyo の日付を作る

export type CandidateDay = { date: string; weekday: number }; // date: YYYY-MM-DD（東京の日付）、weekday: 0=日

/** 東京時間での「今」の日付と分（0:00 からの経過分） */
export function tokyoNow(now: Date, timeZone = "Asia/Tokyo"): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = Number(get("hour")) % 24;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: hour * 60 + Number(get("minute")) };
}

/** 今日から count 日分の候補日 */
export function candidateDays(now: Date, count: number, timeZone = "Asia/Tokyo"): CandidateDay[] {
  const today = tokyoNow(now, timeZone).date;
  const [y, m, d] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const dt = new Date(Date.UTC(y, m - 1, d + i));
    return { date: dt.toISOString().slice(0, 10), weekday: dt.getUTCDay() };
  });
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** 開始時刻が過ぎているか（今日の、現在時刻以前の時刻は選べない） */
export function isPast(date: string, time: string, now: Date, timeZone = "Asia/Tokyo"): boolean {
  const t = tokyoNow(now, timeZone);
  if (date < t.date) return true;
  return date === t.date && toMinutes(time) <= t.minutes;
}

/** 終了時刻が受付時間の終わりを過ぎるか（所要時間が不明なときは開始時刻が終わりと同じ場合だけ） */
export function endsAfter(time: string, minutes: number | null, dayEnd: string): boolean {
  const start = toMinutes(time);
  return minutes == null ? start >= toMinutes(dayEnd) : start + minutes > toMinutes(dayEnd);
}

export type Candidate = { date: string; time: string };

/** 候補の妥当性。重複・過去・範囲外を除いたうえで、1 件以上あるか */
export function validCandidates(list: Candidate[], allowedDates: string[], allowedTimes: string[], now: Date, timeZone = "Asia/Tokyo"): Candidate[] {
  const seen = new Set<string>();
  return list.filter((c) => {
    const k = `${c.date} ${c.time}`;
    if (seen.has(k) || !allowedDates.includes(c.date) || !allowedTimes.includes(c.time) || isPast(c.date, c.time, now, timeZone)) return false;
    seen.add(k);
    return true;
  });
}
