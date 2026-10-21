import { expect, test, type Page } from "@playwright/test";

async function openRange(page: Page, query = "") {
  await page.goto(`/memorize/range${query}`);
  await expect(page.getByTestId("range-picker")).toHaveAttribute("data-interactive", "true");
}

const verse = (page: Page, n: number) =>
  page.getByRole("button", { name: `Verse ${n}`, exact: true });
const summary = (page: Page) => page.getByTestId("range-summary");

test.describe("verse range selector", () => {
  test("shows the passage from the link, with its verses marked", async ({ page }) => {
    await openRange(page, "?p=john+1%3A3-7");
    await expect(page.getByRole("button", { name: "John 1", exact: true })).toBeVisible();
    await expect(
      page.getByRole("group", { name: "John 1 verses" }).getByRole("button"),
    ).toHaveCount(51);
    await expect(verse(page, 3)).toHaveAttribute("data-mark", "endpoint");
    await expect(verse(page, 5)).toHaveAttribute("data-mark", "inside");
    await expect(verse(page, 7)).toHaveAttribute("data-mark", "endpoint");
    await expect(verse(page, 8)).toHaveAttribute("data-mark", "none");
    await expect(summary(page)).toHaveText("John 1:3–7 · 5 verses");
  });

  test("starts at John 1:1 with no link, and clamps verses that don't exist", async ({ page }) => {
    await openRange(page);
    await expect(summary(page)).toHaveText("John 1:1 · 1 verse");
    await openRange(page, "?p=john+2%3A1-99");
    await expect(summary(page)).toHaveText("John 2:1–25 · 25 verses");
  });

  test("tap a start verse, then an end verse", async ({ page }) => {
    await openRange(page, "?p=john+1%3A1");
    await verse(page, 10).click();
    await expect(page.getByRole("status")).toHaveText("Now tap the closing verse.");
    await verse(page, 14).click();
    await expect(summary(page)).toHaveText("John 1:10–14 · 5 verses");
    await expect(page).toHaveURL(/p=john\+1%3A10-14/);
  });

  test("either endpoint can be changed afterwards", async ({ page }) => {
    await openRange(page, "?p=john+1%3A3-7");
    await page.getByRole("button", { name: /^Start:/ }).click();
    await expect(page.getByRole("status")).toHaveText("Tap the new start verse.");
    await verse(page, 5).click();
    await expect(summary(page)).toHaveText("John 1:5–7 · 3 verses");

    await page.getByRole("button", { name: /^End:/ }).click();
    await verse(page, 20).click();
    await expect(summary(page)).toHaveText("John 1:5–20 · 16 verses");
  });

  test("a range can cross chapters and has no length limit", async ({ page }) => {
    await openRange(page, "?p=john+1%3A50");
    await page.getByRole("button", { name: /^End:/ }).click();
    await page.getByRole("button", { name: "Next chapter" }).click();
    await expect(page.getByRole("button", { name: "John 2", exact: true })).toBeVisible();
    await verse(page, 5).click();

    await expect(summary(page)).toHaveText("John 1:50–2:5 · 7 verses");
    await expect(page).toHaveURL(/p=john\+1%3A50-2%3A5/);
    // Chapter 2's verses 1–4 are inside the range, 5 is the end.
    await expect(verse(page, 3)).toHaveAttribute("data-mark", "inside");
    await expect(verse(page, 5)).toHaveAttribute("data-mark", "endpoint");
    await expect(verse(page, 6)).toHaveAttribute("data-mark", "none");

    // A whole-chapter-plus range far longer than a song.
    await page.getByRole("button", { name: /^End:/ }).click();
    await page.getByRole("button", { name: "Next chapter" }).click();
    await verse(page, 36).click();
    await expect(summary(page)).toHaveText("John 1:50–3:36 · 63 verses");
  });

  test("the chapter dropdown moves the grid without losing the selection", async ({ page }) => {
    await openRange(page, "?p=john+1%3A3-7");
    await page.getByRole("button", { name: "John 1", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Choose a book and chapter" });
    await dialog.getByRole("button", { name: /^John/ }).click();
    await dialog.getByRole("button", { name: "4", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "John 4", exact: true })).toBeVisible();
    await expect(summary(page)).toHaveText("John 1:3–7 · 5 verses");
    await expect(verse(page, 3)).toHaveAttribute("data-mark", "none"); // chapter 4's grid
  });

  test("choosing another book starts a fresh selection there", async ({ page }) => {
    await openRange(page, "?p=john+1%3A3-7");
    await page.getByRole("button", { name: "John 1", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Choose a book and chapter" });
    await dialog.getByRole("button", { name: /^Psalms/ }).click();
    await dialog.getByRole("button", { name: "23", exact: true }).click();
    await expect(page).toHaveURL(/p=psalms\+23%3A1/);
    await expect(page.getByRole("button", { name: "Psalms 23", exact: true })).toBeVisible();
    await expect(
      page.getByRole("group", { name: "Psalms 23 verses" }).getByRole("button"),
    ).toHaveCount(6);
  });

  test("the chapter arrows stop at the ends of the book", async ({ page }) => {
    await openRange(page, "?p=ruth+1%3A1");
    await expect(page.getByRole("button", { name: "Previous chapter" })).toBeDisabled();
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Next chapter" }).click();
    await expect(page.getByRole("button", { name: "Ruth 4", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next chapter" })).toBeDisabled();
  });

  test("Memorize carries the passage on", async ({ page }) => {
    await openRange(page, "?p=john+1%3A3-7");
    await expect(page.getByRole("link", { name: "Memorize John 1:3–7" })).toHaveAttribute(
      "href",
      "/memorize?p=john+1%3A3-7",
    );
  });

  test("phones show five verses per row", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone layout");
    await openRange(page, "?p=john+1%3A1");
    const columns = await page
      .getByRole("group", { name: "John 1 verses" })
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    expect(columns).toBe(5);
  });
});
