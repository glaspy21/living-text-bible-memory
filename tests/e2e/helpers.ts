import type { Page } from "@playwright/test";

/**
 * Wait until the page has finished streaming in. While it streams, Next keeps a hidden copy of
 * each streamed section (`<div hidden id="S:…">`) until the swap completes, and test locators
 * can briefly match both copies.
 */
export async function streamed(page: Page): Promise<void> {
  await page.waitForFunction(() => !document.querySelector('div[hidden][id^="S:"]'));
}
