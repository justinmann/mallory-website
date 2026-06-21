import { expect, test } from '@playwright/test';

// Smoke test for the library + book flow.
//
// NOTE: `/library` is auth-gated and the book view's getBook call hits the
// database, so this spec needs a logged-in session AND a configured local DB
// (same as the repo's other authed e2e specs). Run with the dev DB up:
//   PORT=4933 pnpm run test:e2e tests/e2e/library.spec.ts
test('library mounts a canvas and exposes the new-volume control', async ({ page }) => {
  await page.goto('/library');
  // The Kaplay game renders into a <canvas>.
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByText('+ New Volume')).toBeVisible();
});

test('an unknown book renders the "sealed" message', async ({ page }) => {
  // getBook returns null for a missing/forbidden book → the view shows a notice
  // (not the editor). This exercises the public book route end-to-end.
  await page.goto('/book/does-not-exist');
  await expect(page.getByText(/sealed|Opening/i)).toBeVisible();
});
