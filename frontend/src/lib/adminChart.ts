/** Every calendar day from the first to the last sign-up (UTC), so quiet days show as zero. */
export function fillDays(byDay: Record<string, number>): { day: string; count: number }[] {
  const days = Object.keys(byDay).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (days.length === 0) return [];
  const out: { day: string; count: number }[] = [];
  const end = new Date(`${days[days.length - 1]}T00:00:00Z`);
  for (let d = new Date(`${days[0]}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, count: byDay[key] ?? 0 });
  }
  return out;
}
