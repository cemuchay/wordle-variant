import { test, expect } from '@playwright/test';

test.describe('WordUp smoke tests', () => {
  test('app loads and shows WordUp Battles', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/wordup battles/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('guest login works', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('wordle_anon_id', crypto.randomUUID());
      localStorage.setItem('wordle_anon_username', 'E2ETestPlayer');
    });
    await page.reload();
    await expect(page.getByText(/play/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/search opponent/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('lobby renders with play, rankings, pending, history tabs', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('wordle_anon_id', crypto.randomUUID());
      localStorage.setItem('wordle_anon_username', 'E2ETestPlayer');
    });
    await page.reload();
    await expect(page.getByText(/rankings/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/pending/i).first()).toBeVisible();
    await expect(page.getByText(/history/i).first()).toBeVisible();
  });
});
