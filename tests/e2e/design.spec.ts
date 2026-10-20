import { expect, test } from "@playwright/test";

test.describe("design reference page", () => {
  test("shows the three end modes and the lockup logo", async ({ page }) => {
    await page.goto("/design");
    for (const label of ["Loop Verse", "Stop After Verse", "Next Verse"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(page.getByRole("img", { name: "Living Text", exact: true })).toBeVisible();
  });

  test("hovering a bar sweeps the gold fill across", async ({ page, isMobile }) => {
    test.skip(isMobile, "hover only applies to pointer devices");
    await page.goto("/design");
    const bar = page.getByRole("button", { name: /Browse Scripture/ }).first();
    const fill = bar.locator(".wipe-fill");
    await expect(fill).toHaveCSS("clip-path", /inset\(0(px)? 100%/);
    await bar.hover();
    await expect
      .poll(async () => fill.evaluate((el) => getComputedStyle(el).clipPath))
      .toMatch(/inset\(0(px)?( 0(px)?){0,3}\)/);
  });

  test("reduced motion turns the sunlight animation off", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/design");
    await expect(page.locator(".sun")).toHaveCSS("animation-name", "none");
  });
});
