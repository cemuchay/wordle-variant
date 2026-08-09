// src/__tests__/archiveDb.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FIRST_ARCHIVE_DATE,
  getYesterdayArchiveDate,
  getAllValidArchiveDates,
} from '../utils/archiveDb';
import {
  getTodayDateString,
  getGuestFreePlayState,
  saveGuestFreePlayState,
  clearGuestFreePlayState,
} from '../utils/guestFreePlay';

describe('Archive DB & Date Utilities', () => {
  it('correctly returns FIRST_ARCHIVE_DATE as 2026-05-18', () => {
    expect(FIRST_ARCHIVE_DATE).toBe('2026-05-18');
  });

  it('correctly calculates yesterday archive date string', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const expected = yesterday.toISOString().split('T')[0];
    expect(getYesterdayArchiveDate()).toBe(expected);
  });

  it('returns valid array of archive dates starting at FIRST_ARCHIVE_DATE up to yesterday', () => {
    const dates = getAllValidArchiveDates();
    expect(dates.length).toBeGreaterThan(0);
    expect(dates[0]).toBe('2026-05-18');
    expect(dates[dates.length - 1]).toBe(getYesterdayArchiveDate());
  });
});

describe('Guest FreePlay Utilities', () => {
  beforeEach(() => {
    clearGuestFreePlayState();
  });

  it('returns null when no guest state is saved', () => {
    expect(getGuestFreePlayState()).toBeNull();
  });

  it('saves and retrieves current day guest freeplay state', () => {
    const mockData = {
      word: 'CRANE',
      guesses: ['CRANE'],
      isGameOver: true,
      isWon: true,
      score: 1000,
      attempts: 1,
    };
    saveGuestFreePlayState(mockData);

    const saved = getGuestFreePlayState();
    expect(saved).not.toBeNull();
    expect(saved?.word).toBe('CRANE');
    expect(saved?.date).toBe(getTodayDateString());
    expect(saved?.isWon).toBe(true);
  });
});
