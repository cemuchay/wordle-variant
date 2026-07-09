// ── Smoke tests (placeholder) ──────────────────────────────────────
import { test, expect } from '@playwright/test';

test.describe('WordUp smoke tests', () => {
  test('app loads and shows navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/variant/i).or(page.getByText(/wordle/i).or(page.getByText(/play/i))).first()).toBeVisible({ timeout: 15000 });
  });
});
