import { expect, test, type Locator, type Page } from "@playwright/test";
import { streamed } from "./helpers";
import { TestDb } from "./db";

const db = new TestDb();
test.afterAll(() => db.cleanup());

/** A book's row; its name gains " Music available" when it has a dot, so match both. */
const book = (dialog: Locator, name: string) =>
  dialog.getByRole("button", { name: new RegExp(`^${name}( Music available)?$`) });

async function openSelector(page: Page, path: string) {
  await page.goto(path);
  await streamed(page);
  // Retry the click until the page has hydrated and the button's handler is attached.
  await expect(async () => {
    await page.locator("header button[aria-haspopup='dialog']").click();
    await expect(page.getByRole("dialog", { name: "Choose a book and chapter" })).toBeVisible({
      timeout: 1000,
    });
  }).toPass();
  return page.getByRole("dialog", { name: "Choose a book and chapter" });
}

test.describe("book and chapter selector", () => {
  test("opens from the header with every book in one list", async ({ page }) => {
    const dialog = await openSelector(page, "/read/genesis/1");
    await expect(book(dialog, "Genesis")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Old Testament" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(dialog.getByRole("button", { name: /^(?!.*Testament)/ })).toHaveCount(66);
  });

  test("opens at the current book's testament", async ({ page }) => {
    const dialog = await openSelector(page, "/read/john/3");
    await expect(dialog.getByRole("button", { name: "New Testament" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("clicking a tab scrolls to that testament and the underline follows the scroll", async ({
    page,
  }) => {
    const dialog = await openSelector(page, "/read/genesis/1");
    await dialog.getByRole("button", { name: "New Testament" }).click();
    await expect(dialog.getByRole("button", { name: "New Testament" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(book(dialog, "Matthew")).toBeInViewport();

    // Scrolling back by hand moves the tab back.
    const list = dialog.locator("div.overflow-auto");
    await page.waitForTimeout(700);
    await list.evaluate((el) => el.scrollTo({ top: 0 }));
    await expect(dialog.getByRole("button", { name: "Old Testament" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("a book expands to its chapters and choosing one opens it", async ({ page }) => {
    const dialog = await openSelector(page, "/read/genesis/1");
    await dialog.getByRole("button", { name: "New Testament" }).click();
    await book(dialog, "John").click();
    await expect(
      dialog.getByRole("group", { name: "John chapters" }).getByRole("link"),
    ).toHaveCount(21);
    await dialog.getByRole("link", { name: "3", exact: true }).click();
    await expect(page).toHaveURL(/\/read\/john\/3$/);
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { name: "John 3", level: 1 })).toBeAttached();
  });

  test("the current chapter is marked", async ({ page }) => {
    const dialog = await openSelector(page, "/read/john/3");
    await book(dialog, "John").click();
    await expect(dialog.getByRole("link", { name: "3", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("Escape and the backdrop close it", async ({ page }) => {
    const dialog = await openSelector(page, "/read/genesis/1");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await openSelector(page, "/read/genesis/1");
    await page.mouse.click(5, 500);
    await expect(dialog).toBeHidden();
  });

  test("it works from the home page too", async ({ page, isMobile }) => {
    test.skip(isMobile, "the phone home screen has no reference button");
    const dialog = await openSelector(page, "/");
    await book(dialog, "Psalms").click();
    await dialog.getByRole("link", { name: "23", exact: true }).click();
    await expect(page).toHaveURL(/\/read\/psalms\/23$/);
  });
});

test.describe("music dots", () => {
  test("a book with a published recording gets a dot, and its chapter says so", async ({
    page,
  }) => {
    test.skip(test.info().project.name === "mobile", "data setup runs once");
    await db.addRecording("recordings/e2e-ruth-0001/original.mp3", 1000, "PUBLISHED", {
      bookId: 8,
      chapter: 2,
      verseEnd: 5,
    });
    await db.addRecording("recordings/e2e-esther-01/original.mp3", 1000, "DRAFT", {
      bookId: 17,
      chapter: 1,
      verseEnd: 5,
    });

    const dialog = await openSelector(page, "/read/ruth/2");
    await expect(
      book(dialog, "Ruth").getByRole("img", {
        name: "Music available",
      }),
    ).toBeVisible();
    // A draft is invisible to listeners.
    await expect(book(dialog, "Esther").getByRole("img")).toHaveCount(0);
    await page.keyboard.press("Escape");

    await expect(page.getByText("Recording available")).toBeVisible();
    await page.goto("/read/ruth/3");
    await streamed(page);
    await expect(page.getByText("No recording for this chapter yet")).toBeVisible();
  });
});
