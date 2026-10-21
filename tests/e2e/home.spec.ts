import { expect, test } from "@playwright/test";
import { streamed } from "./helpers";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await streamed(page);
  await expect(page.getByRole("heading", { name: "Living Text" })).toBeAttached();
  await expect(page.getByRole("link", { name: /Browse Scripture/ })).toBeVisible();
});
