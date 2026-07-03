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

function getISOYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
}

export function getISOWeekKey(date: Date): string {
  const weekNum = getISOWeekNumber(date);
  const year = getISOYear(date);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

export function getCurrentIsoWeekKey(): string {
  return getISOWeekKey(getLagosDate());
}

export function getCurrentMonthKey(): string {
  const d = getLagosDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getPreviousIsoWeekKey(): string {
  const lagosDate = getLagosDate();
  const dayNum = (lagosDate.getDay() + 6) % 7;
  const prevMonday = new Date(lagosDate);
  prevMonday.setDate(lagosDate.getDate() - dayNum - 7);
  return getISOWeekKey(prevMonday);
}

function parseISOWeekKey(weekKey: string): { start: Date; end: Date } {
  const [yearPart, weekPart] = weekKey.split('-W');
  const year = Number(yearPart);
  const week = Number(weekPart);
  const jan4 = new Date(year, 0, 4);
  const offset = (jan4.getDay() + 6) % 7;
  const mondayWeek1 = new Date(year, 0, 4 - offset);
  const start = new Date(mondayWeek1);
  start.setDate(mondayWeek1.getDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

export function isCurrentPeriod(awardType: string, periodKey: string): boolean {
  if (awardType === 'monthly_champion') {
    return periodKey === getCurrentMonthKey();
  }
  return periodKey === getCurrentIsoWeekKey();
}

export function formatAwardPeriod(awardType: string, periodKey: string): string {
  if (awardType === 'monthly_champion') {
    const [yearStr, monthStr] = periodKey.split('-');
    const month = Number(monthStr);
    const date = new Date(Number(yearStr), month - 1, 1);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }

  const [, weekPart] = periodKey.split('-W');
  const week = Number(weekPart);
  const { start, end } = parseISOWeekKey(periodKey);

  const fmtMonth: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const startStr = start.toLocaleDateString('en-US', fmtMonth);
  const endStr = end.toLocaleDateString('en-US', { ...fmtMonth, year: 'numeric' });

  if (start.getFullYear() !== end.getFullYear()) {
    const startWithYearStr = start.toLocaleDateString('en-US', { ...fmtMonth, year: 'numeric' });
    return `Week ${week} · ${startWithYearStr} – ${endStr}`;
  }

  return `Week ${week} · ${startStr} – ${endStr}`;
}
