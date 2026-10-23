import { expect, test, type Page } from "@playwright/test";
import { streamed } from "./helpers";

async function openRange(page: Page, query = "") {
  await page.goto(`/memorize/range${query}`);
  await streamed(page);
  await expect(page.getByRole("main").getByTestId("range-picker")).toHaveAttribute(
    "data-interactive",
    "true",
  );
  // While the page streams in, a hidden copy of the content exists; wait for the swap to finish.
  await expect(page.getByTestId("range-picker")).toHaveCount(1);
}

// Every chapter of the book is in the list, so name the chapter's group.
const verse = (page: Page, n: number, group = "John 1 verses") =>
  page.getByRole("group", { name: group }).getByRole("button", { name: `Verse ${n}`, exact: true });
const picker = (page: Page) => page.getByTestId("range-picker");
const summary = (page: Page) => page.getByTestId("range-summary");

test.describe("verse range selector", () => {
  test("shows the passage from the link, with its verses marked", async ({ page }) => {
    await openRange(page, "?p=john+1%3A3-7");
    await expect(picker(page).getByRole("button", { name: "John 1", exact: true })).toBeVisible();
    await expect(
      page.getByRole("group", { name: "John 1 verses" }).getByRole("button"),
    ).toHaveCount(51);
    await expect(verse(page, 3)).toHaveAttribute("data-mark", "endpoint");
    await expect(verse(page, 5)).toHaveAttribute("data-mark", "inside");
    await expect(verse(page, 7)).toHaveAttribute("data-mark", "endpoint");
    await expect(verse(page, 8)).toHaveAttribute("data-mark", "none");
    await expect(summary(page)).toHaveText("John 1:3 – 7");
  });

  test("starts at John 1:1 with no link, and clamps verses that don't exist", async ({ page }) => {
    await openRange(page);
    await expect(summary(page)).toHaveText("John 1:1");
    await openRange(page, "?p=john+2%3A1-99");
    await expect(summary(page)).toHaveText("John 2:1 – 25");
  });

  test("tap a start verse, then an end verse", async ({ page }) => {
    await openRange(page, "?p=john+1%3A1");
    await verse(page, 10).click();
    await verse(page, 14).click();
    await expect(summary(page)).toHaveText("John 1:10 – 14");
    await expect(page).toHaveURL(/p=john\+1%3A10-14/);
  });

  test("tapping again after a range starts a new one", async ({ page }) => {
    await openRange(page, "?p=john+1%3A3-7");
    await verse(page, 5).click();
    await expect(summary(page)).toHaveText("John 1:5");
    await verse(page, 20).click();
    await expect(summary(page)).toHaveText("John 1:5 – 20");
  });

  test("scrolling down the list reaches the next chapter, and a range can cross into it", async ({
    page,
  }) => {
    await openRange(page, "?p=john+1%3A1");
    await expect(page.getByRole("group", { name: "Luke 24 verses" })).toBeAttached(); // settled
    await verse(page, 50).click();
    // Scroll on to chapter 2; the dropdown follows what is at the top.
    await page.getByTestId("range-scroller").evaluate((box) => {
      box.scrollTop =
        box.querySelector<HTMLElement>('[data-book="john"][data-chapter="2"]')!.offsetTop + 20;
    });
    await expect(picker(page).getByRole("button", { name: "John 2", exact: true })).toBeVisible();
    await verse(page, 5, "John 2 verses").click();

    await expect(summary(page)).toHaveText("John 1:50 – 2:5");
    await expect(page).toHaveURL(/p=john\+1%3A50-2%3A5/);
    // Chapter 2's verses 1–4 are inside the range, 5 is the end.
    await expect(verse(page, 3, "John 2 verses")).toHaveAttribute("data-mark", "inside");
    await expect(verse(page, 5, "John 2 verses")).toHaveAttribute("data-mark", "endpoint");
    await expect(verse(page, 6, "John 2 verses")).toHaveAttribute("data-mark", "none");
    await expect(verse(page, 51)).toHaveAttribute("data-mark", "inside");
  });

  test("the chapter arrows jump to the next chapter in the list", async ({ page }) => {
    await openRange(page, "?p=john+1%3A1");
    await page.getByRole("button", { name: "Next chapter" }).click();
    await expect(picker(page).getByRole("button", { name: "John 2", exact: true })).toBeVisible();
    await expect(verse(page, 1, "John 2 verses")).toBeInViewport();
    await verse(page, 1, "John 2 verses").click();
    await verse(page, 36, "John 3 verses").click();
    await expect(summary(page)).toHaveText("John 2:1 – 3:36");
  });

  test("scrolling on past the last chapter of a book runs into the next book", async ({ page }) => {
    await openRange(page, "?p=john+21%3A20");
    await page.getByTestId("range-scroller").evaluate((box) => {
      box.scrollTop = box.scrollHeight;
    });
    await expect(page.getByRole("group", { name: "Acts 1 verses" })).toBeAttached();
    await verse(page, 20, "John 21 verses").click();
    await verse(page, 3, "Acts 1 verses").click();
    await expect(summary(page)).toHaveText("John 21:20 – Acts 1:3");
    await expect(page).toHaveURL(/p=john\+21%3A20-acts\+1%3A3/);
  });

  test("scrolling up past the first chapter of a book runs back into the book before", async ({
    page,
  }) => {
    await openRange(page, "?p=john+1%3A1");
    await expect(page.getByRole("group", { name: "Luke 24 verses" })).toBeAttached();
    // The verses the person came to see stay where they were.
    await expect(verse(page, 1, "John 1 verses")).toBeInViewport();
    await page.getByTestId("range-scroller").evaluate((box) => {
      box.scrollTop = 0;
    });
    await expect(picker(page).getByRole("button", { name: "Luke 1", exact: true })).toBeVisible();
  });

  test("the chapter dropdown moves the grid without losing the selection", async ({ page }) => {
    await openRange(page, "?p=john+1%3A3-7");
    await picker(page).getByRole("button", { name: "John 1", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Choose a book and chapter" });
    await dialog.getByRole("button", { name: /^John/ }).click();
    await dialog.getByRole("button", { name: "4", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(picker(page).getByRole("button", { name: "John 4", exact: true })).toBeVisible();
    await expect(summary(page)).toHaveText("John 1:3 – 7");
    await expect(verse(page, 3, "John 4 verses")).toHaveAttribute("data-mark", "none");
    await expect(verse(page, 3)).toHaveAttribute("data-mark", "endpoint"); // chapter 1 keeps it
  });

  test("browsing to another book keeps the selection, and a range can run into it", async ({
    page,
  }) => {
    await openRange(page, "?p=luke+24%3A1");
    await verse(page, 50, "Luke 24 verses").click();
    await picker(page).getByRole("button", { name: "Luke 24", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Choose a book and chapter" });
    await dialog.getByRole("button", { name: /^John/ }).click();
    await dialog.getByRole("button", { name: "1", exact: true }).click();
    await expect(picker(page).getByRole("button", { name: "John 1", exact: true })).toBeVisible();
    await verse(page, 3, "John 1 verses").click();
    await expect(summary(page)).toHaveText("Luke 24:50 – John 1:3");
    await expect(page).toHaveURL(/p=luke\+24%3A50-john\+1%3A3/);
    await expect(page.getByRole("link", { name: "Set Range" })).toHaveAttribute(
      "href",
      "/memorize?p=luke+24%3A50-john+1%3A3",
    );
  });

  test("the chapter arrows run on across books and stop at the ends of the Bible", async ({
    page,
  }) => {
    await openRange(page, "?p=ruth+1%3A1");
    await page.getByRole("button", { name: "Next chapter" }).click();
    for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Next chapter" }).click();
    await expect(
      picker(page).getByRole("button", { name: "1 Samuel 1", exact: true }),
    ).toBeVisible();
    await openRange(page, "?p=genesis+1%3A1");
    await expect(page.getByRole("button", { name: "Previous chapter" })).toBeDisabled();
  });

  test("opened from Steps, it goes back to that step with the new range", async ({ page }) => {
    await openRange(page, "?p=john+1%3A3-7&from=steps&step=recall");
    await verse(page, 5).click();
    await verse(page, 9).click();
    await expect(page.getByRole("link", { name: "Set Range" })).toHaveAttribute(
      "href",
      "/memorize/steps?p=john+1%3A5-9&step=recall",
    );
  });

  test("opened from the reader, it goes back to the reader with the new range", async ({
    page,
  }) => {
    await openRange(page, "?p=john+1%3A3-7&from=read");
    await expect(page.getByRole("link", { name: "Set Range" })).toHaveAttribute(
      "href",
      "/read/john/1?p=john+1%3A3-7&v=3&jump=1",
    );
  });

  test("opened from Flashcards, it goes back to the flashcards", async ({ page }) => {
    await openRange(page, "?p=john+1%3A3-7&from=flashcards");
    await expect(page.getByRole("link", { name: "Set Range" })).toHaveAttribute(
      "href",
      "/memorize/flashcards?p=john+1%3A3-7",
    );
  });

  test("without a screen to return to, it carries the passage to Memorize", async ({ page }) => {
    await openRange(page, "?p=john+1%3A3-7");
    await expect(page.getByRole("link", { name: "Set Range" })).toHaveAttribute(
      "href",
      "/memorize?p=john+1%3A3-7",
    );
  });

  test("the player bar is not shown, and Set Range is in view, even after coming from Steps", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Edit range is in the right panel, which phones don't have");
    await page.goto("/memorize/steps?p=john+1%3A3-6");
    await streamed(page);
    await expect(page.getByRole("contentinfo", { name: "Player" })).toBeVisible();
    await page.getByRole("link", { name: "Edit range" }).click();
    await expect(page.getByTestId("range-picker")).toHaveAttribute("data-interactive", "true");
    await expect(page.getByRole("contentinfo", { name: "Player" })).toBeHidden();
    await expect(page.getByRole("link", { name: "Set Range" })).toBeInViewport();
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
