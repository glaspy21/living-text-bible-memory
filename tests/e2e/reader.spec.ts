import { expect, test, type Page } from "@playwright/test";

/** Open a chapter and wait until taps will work (the page has hydrated). */
async function openReader(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByTestId("chapter-text")).toHaveAttribute("data-interactive", "true");
}

test.describe("reading a chapter", () => {
  test("shows the whole chapter with verse numbers, in the WEB, with its notice", async ({
    page,
  }) => {
    await page.goto("/read/john/1");
    await expect(page.getByRole("heading", { name: "John 1", level: 1 })).toBeAttached();
    await expect(page.locator("[data-verse]")).toHaveCount(51);
    await expect(page.locator('[data-verse="1"]')).toContainText(
      "In the beginning was the Word, and the Word was with God, and the Word was God.",
    );
    await expect(page.getByTestId("scripture-attribution")).toContainText("public domain");
  });

  test("a verse number is shown beside its text", async ({ page }) => {
    await page.goto("/read/john/1");
    await expect(page.locator('[data-verse="14"]')).toContainText("14");
    await expect(page.locator('[data-verse="14"]')).toContainText("The Word became flesh");
  });

  test("the book name in the URL may use a slug with a number", async ({ page }) => {
    await page.goto("/read/1-john/3");
    await expect(page.locator('[data-verse="16"]')).toContainText("By this we know love");
    await expect(page.getByRole("heading", { name: "1 John 3", level: 1 })).toBeAttached();
  });

  test("unknown books and chapters are a 404 page", async ({ page }) => {
    for (const path of ["/read/nonsense/1", "/read/john/99", "/read/john/0", "/read/john/abc"]) {
      await page.goto(path);
      await expect(page.getByText("This page could not be found")).toBeVisible();
    }
  });
});

test.describe("choosing verses", () => {
  test("two taps select a range and it survives a reload", async ({ page }) => {
    await openReader(page, "/read/john/1");
    await page.locator('[data-verse="3"]').click();
    await expect(page.locator('[data-verse="3"]')).toHaveAttribute("aria-pressed", "true");
    await page.locator('[data-verse="7"]').click();

    for (const n of [3, 4, 5, 6, 7]) {
      await expect(page.locator(`[data-verse="${n}"]`)).toHaveAttribute("aria-pressed", "true");
    }
    await expect(page.locator('[data-verse="8"]')).toHaveAttribute("aria-pressed", "false");
    await expect(page).toHaveURL(/p=john\+1%3A3-7/);

    await page.reload();
    await expect(page.getByTestId("chapter-text")).toHaveAttribute("data-interactive", "true");
    await expect(page.locator('[data-verse="5"]')).toHaveAttribute("aria-pressed", "true");
  });

  test("tapping upward and a third tap work too", async ({ page }) => {
    await openReader(page, "/read/john/1");
    await page.locator('[data-verse="9"]').click();
    await page.locator('[data-verse="6"]').click();
    await expect(page.locator('[data-verse="6"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-verse="9"]')).toHaveAttribute("aria-pressed", "true");

    await page.locator('[data-verse="20"]').click(); // starts over
    await expect(page.locator('[data-verse="6"]')).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator('[data-verse="20"]')).toHaveAttribute("aria-pressed", "true");
  });

  test("the keyboard can select verses", async ({ page }) => {
    await openReader(page, "/read/john/1");
    await page.locator('[data-verse="2"]').focus();
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-verse="2"]')).toHaveAttribute("aria-pressed", "true");
  });

  test("Memorize carries the selected passage", async ({ page }) => {
    await openReader(page, "/read/john/1");
    await page.locator('[data-verse="1"]').click();
    await page.locator('[data-verse="18"]').click();
    const memorize = page.getByRole("link", { name: /^Memorize John 1:1–18$/ });
    await expect(memorize).toHaveAttribute("href", "/memorize?p=john+1%3A1-18");
  });

  test("with nothing selected, Memorize uses the whole chapter", async ({ page }) => {
    await page.goto("/read/john/2");
    await expect(page.getByRole("link", { name: /^Memorize John 2:1–25$/ })).toBeVisible();
  });

  test("ignores a selection from another chapter's URL", async ({ page }) => {
    await page.goto("/read/john/1?p=genesis+1%3A1-3");
    await expect(page.locator('[data-verse="1"]')).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("moving between chapters", () => {
  test("Prev and Next move through chapters and across books", async ({ page }) => {
    await openReader(page, "/read/john/1");
    await page.getByRole("link", { name: "Next ›" }).click();
    await expect(page).toHaveURL(/\/read\/john\/2$/);

    await page.goto("/read/john/21");
    await page.getByRole("link", { name: "Next ›" }).click();
    await expect(page).toHaveURL(/\/read\/acts\/1$/);
    await page.getByRole("link", { name: "‹ Prev" }).click();
    await expect(page).toHaveURL(/\/read\/john\/21$/);
  });

  test("there is no Prev at Genesis 1 and no Next at Revelation 22", async ({ page }) => {
    await page.goto("/read/genesis/1");
    await expect(page.getByRole("link", { name: "‹ Prev" })).toHaveCount(0);
    await page.goto("/read/revelation/22");
    await expect(page.getByRole("link", { name: "Next ›" })).toHaveCount(0);
  });
});

test.describe("side panel", () => {
  test("desktop shows the selection and the music note", async ({ page, isMobile }) => {
    test.skip(isMobile, "the right panel is hidden on phones");
    await openReader(page, "/read/john/1");
    await expect(page.getByTestId("selected-passage")).toContainText("John 1:1–51");
    await expect(page.getByText("No recording for this chapter yet")).toBeVisible();
    await page.locator('[data-verse="4"]').click();
    await expect(page.getByTestId("selected-passage")).toContainText("John 1:4");
    await expect(page.getByRole("link", { name: "Edit verse range" })).toHaveAttribute(
      "href",
      "/memorize/range?p=john+1%3A4",
    );
  });

  test("phones still get a Memorize button", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone layout");
    await page.goto("/read/john/1");
    await expect(page.getByRole("link", { name: /^Memorize John 1:1–51$/ })).toBeVisible();
  });
});
