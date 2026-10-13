import { describe, expect, it } from 'vitest';
import { formatDayMonthYear, formatDuration, formatMonthYear, monthsBetween, parseDate } from './date';

describe('parseDate', () => {
  it('parses a calendar date without timezone drift', () => {
    const d = parseDate('2024-04-22');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2024, 3, 22]);
  });

  it('rejects malformed input', () => {
    expect(() => parseDate('22/04/2024')).toThrow('Invalid ISO date');
  });
});

describe('monthsBetween', () => {
  const start = parseDate('2024-04-22');

  it('counts whole months, aware of the day of month', () => {
    expect(monthsBetween(start, parseDate('2024-05-21'))).toBe(0);
    expect(monthsBetween(start, parseDate('2024-05-22'))).toBe(1);
    expect(monthsBetween(start, parseDate('2026-10-09'))).toBe(29);
  });

  it('never goes negative', () => {
    expect(monthsBetween(start, parseDate('2023-01-01'))).toBe(0);
  });
});

describe('formatting', () => {
  it('formats durations compactly', () => {
    expect(formatDuration(0)).toBe('0 mos');
    expect(formatDuration(1)).toBe('1 mo');
    expect(formatDuration(12)).toBe('1 yr');
    expect(formatDuration(29)).toBe('2 yrs 5 mos');
  });

  it('formats dates', () => {
    expect(formatMonthYear(parseDate('2024-04-22'))).toBe('Apr 2024');
    expect(formatDayMonthYear(parseDate('2024-04-22'))).toBe('22 Apr 2024');
  });
});
