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
    await expect(
      page.getByRole("dialog", { name: "Choose a book, chapter and verse" }),
    ).toBeVisible({
      timeout: 1000,
    });
  }).toPass();
  return page.getByRole("dialog", { name: "Choose a book, chapter and verse" });
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

  const headerButton = (page: Page) => page.locator("header button[aria-haspopup='dialog']");

  test("a book expands to its chapters; choosing one shows its verses", async ({ page }) => {
    const dialog = await openSelector(page, "/read/genesis/1");
    await dialog.getByRole("button", { name: "New Testament" }).click();
    await book(dialog, "John").click();
    await expect(
      dialog.getByRole("group", { name: "John chapters" }).getByRole("button"),
    ).toHaveCount(21);
    await dialog.getByRole("button", { name: "3", exact: true }).click();

    // The chapter now sits beside the book title in the same list, and its numbers are replaced by
    // the verses, in the same window (no second menu).
    await expect(dialog.getByRole("button", { name: /^John 3$/ })).toBeVisible();
    await expect(dialog.getByRole("group", { name: "John chapters" })).toHaveCount(0);
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await expect(headerButton(page)).toContainText("John 3");
    await expect(page).toHaveURL(/\/read\/genesis\/1$/); // nothing opened yet
    const verses = dialog.getByRole("group", { name: "John 3 verses" });
    await expect(verses.getByRole("link")).toHaveCount(36);

    // A verse goes directly there: the reader opens at it, scrolled into view and marked.
    await verses.getByRole("link", { name: "16", exact: true }).click();
    await expect(page).toHaveURL(/\/read\/john\/3\?v=16$/);
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { name: "John 3", level: 1 })).toBeAttached();
    const verse16 = page.getByRole("main").locator("[data-verse='16']");
    await expect(verse16).toBeInViewport();
    await expect(verse16).toHaveAttribute("data-arrived", "");
    await expect(headerButton(page)).toContainText("John 3");
  });

  test("titles the step you are on, and verse 1 opens the chapter from its start", async ({
    page,
  }) => {
    const dialog = await openSelector(page, "/read/genesis/1");
    await book(dialog, "Ruth").click();
    await expect(dialog.getByRole("heading", { name: "Chapter", level: 3 })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Verse", level: 3 })).toHaveCount(0);

    await dialog.getByRole("button", { name: "2", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "Verse", level: 3 })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Chapter", level: 3 })).toHaveCount(0);
    await expect(dialog.getByRole("link", { name: "Read chapter" })).toHaveCount(0);

    await dialog.getByRole("link", { name: "1", exact: true }).click();
    await expect(page).toHaveURL(/\/read\/ruth\/2\?v=1$/);
    await expect(dialog).toBeHidden();
  });

  test("going back from the verses returns to the chapters, and closing drops the chapter", async ({
    page,
  }) => {
    const dialog = await openSelector(page, "/read/genesis/1");
    await book(dialog, "Ruth").click();
    await dialog.getByRole("button", { name: "3", exact: true }).click();
    await expect(headerButton(page)).toContainText("Ruth 3");

    await dialog.getByRole("button", { name: /Back to Ruth chapters/ }).click();
    await expect(headerButton(page)).toContainText("Genesis 1");
    await expect(dialog.getByRole("group", { name: "Ruth chapters" })).toBeVisible();
    await expect(book(dialog, "Ruth")).toBeVisible(); // the chapter number left the title

    await dialog.getByRole("button", { name: "4", exact: true }).click();
    await expect(headerButton(page)).toContainText("Ruth 4");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(headerButton(page)).toContainText("Genesis 1"); // nothing was opened
  });

  test("the current chapter is marked", async ({ page }) => {
    const dialog = await openSelector(page, "/read/john/3");
    await book(dialog, "John").click();
    await expect(dialog.getByRole("button", { name: "3", exact: true })).toHaveAttribute(
      "aria-current",
      "true",
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
    await dialog.getByRole("button", { name: "23", exact: true }).click();
    await dialog
      .getByRole("group", { name: "Psalms 23 verses" })
      .getByRole("link", { name: "4", exact: true })
      .click();
    await expect(page).toHaveURL(/\/read\/psalms\/23\?v=4$/);
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

test.describe("the header always shows Scripture navigation", () => {
  const header = (page: Page) => page.locator("header button[aria-haspopup='dialog']");

  for (const [path, label] of [
    ["/", "John 1"],
    ["/memorize", "John 1"],
    ["/memorize/flashcards", "John 1"],
    ["/memorize/steps?p=john+1%3A3-6", "John 1:3–6"],
    ["/memorize/flashcards?p=john+1%3A3-6", "John 1:3–6"],
    ["/memorize/range?p=john+1%3A3-6", "John 1:3–6"],
    ["/read/psalms/23", "Psalms 23"],
  ] as const) {
    test(`${path} shows ${label}, never a page name`, async ({ page, isMobile }) => {
      test.skip(isMobile && path === "/", "the phone home screen has no reference button");
      await page.goto(path);
      await streamed(page);
      await expect(header(page)).toContainText(label);
      for (const name of ["Home", "Memorize", "Flashcards", "Verse range"]) {
        await expect(header(page)).not.toHaveText(new RegExp(`^${name}`));
      }
    });
  }

  test("the last chapter read is shown away from the reader", async ({ page, isMobile }) => {
    test.skip(isMobile, "the phone home screen has no reference button");
    await page.goto("/read/ruth/2");
    await streamed(page);
    await page.goto("/");
    await streamed(page);
    await expect(header(page)).toContainText("Ruth 2");
  });
});
