import { expect, test, type Page } from "@playwright/test";

const badge = (page: Page) => page.getByRole("button", { name: /^Translation:/ });

async function chooseTranslation(page: Page, label: "WEB" | "ESV") {
  // Retry until the page has hydrated and the menu opens.
  await expect(async () => {
    await badge(page).click();
    await expect(page.getByRole("menu")).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.getByRole("menuitemradio", { name: new RegExp(`^${label}`) }).click();
}

test.describe("translation switch", () => {
  test("starts on the WEB and lists both translations", async ({ page }) => {
    await page.goto("/read/genesis/1");
    await expect(badge(page)).toHaveAccessibleName("Translation: World English Bible");
    await expect(badge(page)).toContainText("WEB");
    await expect(page.getByTestId("scripture-attribution")).toHaveAttribute(
      "data-translation",
      "WEB",
    );
  });

  test("the ESV is offered but explains itself outside its scope", async ({ page }) => {
    await page.goto("/read/genesis/1");
    await chooseTranslation(page, "ESV");

    await expect(badge(page)).toContainText("ESV");
    await expect(page.getByRole("note")).toContainText("isn't available for this chapter yet");
    // The text on screen is the WEB, so the notice must be the WEB's, not Crossway's.
    await expect(page.getByTestId("scripture-attribution")).toHaveAttribute(
      "data-translation",
      "WEB",
    );
    await expect(page.locator('[data-verse="1"]')).toContainText("In the beginning, God");
  });

  test("the choice is remembered, and switching back clears the note", async ({ page }) => {
    await page.goto("/read/genesis/1");
    await chooseTranslation(page, "ESV");
    await expect(page.getByRole("note")).toBeVisible();

    await page.goto("/read/genesis/2");
    await expect(badge(page)).toContainText("ESV");
    await expect(page.getByRole("note")).toBeVisible();

    await chooseTranslation(page, "WEB");
    await expect(badge(page)).toContainText("WEB");
    await expect(page.getByRole("note")).toHaveCount(0);
  });

  test("a cookie naming a translation that is not on offer is ignored", async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: "lt_translation", value: "KJV", url: baseURL! }]);
    await page.goto("/read/genesis/1");
    await expect(badge(page)).toContainText("WEB");
  });
});
