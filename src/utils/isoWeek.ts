const LAGOS_TIMEZONE = 'Africa/Lagos';

function getLagosDate(): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: LAGOS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.format(new Date()).split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function getISOWeekKey(date: Date): string {
  const weekNum = getISOWeekNumber(date);
  const year = date.getFullYear();
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

export function getPreviousIsoWeekKey(): string {
  const lagosDate = getLagosDate();
  const dayNum = (lagosDate.getDay() + 6) % 7;
  const prevMonday = new Date(lagosDate);
  prevMonday.setDate(lagosDate.getDate() - dayNum - 7);
  return getISOWeekKey(prevMonday);
}
