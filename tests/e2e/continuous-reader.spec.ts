import { expect, test, type Page } from "@playwright/test";
import { streamed } from "./helpers";

/** Open a chapter and wait until taps will work (the page has hydrated). */
async function openReader(page: Page, path: string) {
  await page.goto(path);
  await streamed(page);
  await expect(page.getByRole("main").getByTestId("chapter-text").first()).toHaveAttribute(
    "data-interactive",
    "true",
  );
}

const main = (page: Page) => page.getByRole("main");
const headerRef = (page: Page) => page.locator("header button[aria-haspopup='dialog']");
const verse = (page: Page, chapter: number, n: number) =>
  page.locator(`[data-chapter="${chapter}"] [data-verse="${n}"]`);

/** Scroll the reader to its very end, which should bring the next chapter in. */
const scrollToEnd = (page: Page) => main(page).evaluate((el) => el.scrollTo(0, el.scrollHeight));

/** Scroll so the chapter's first verse is the first one whole at the top of the screen. */
async function scrollChapterIntoReading(page: Page, chapter: number, book?: string) {
  await page
    .locator(`${book ? `[data-book="${book}"]` : ""}[data-chapter="${chapter}"] [data-verse="1"]`)
    .evaluate((row) => {
      const scroller = row.closest("main")!;
      const top = row.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      scroller.scrollTo(0, scroller.scrollTop + top);
    });
}

test.describe("continuous scrolling", () => {
  test("scrolling to the end brings the next chapter in below, with its heading", async ({
    page,
  }) => {
    await openReader(page, "/read/john/1");
    await expect(page.locator("[data-chapter]")).toHaveCount(1);
    await scrollToEnd(page);
    await expect(page.getByTestId("chapter-heading").filter({ hasText: "John 2" })).toBeAttached();
    await expect(verse(page, 2, 1)).toContainText("The third day");
    // …and it keeps going: John 3 follows John 2.
    await scrollToEnd(page);
    await expect(page.getByTestId("chapter-heading").filter({ hasText: "John 3" })).toBeAttached();
    await expect(page.locator("[data-chapter]")).toHaveCount(3);
  });

  test("scrolling up from a later chapter brings the earlier ones in without a jump", async ({
    page,
  }) => {
    await openReader(page, "/read/john/3");
    // Nothing is added above until the reader goes up.
    await expect(page.locator("[data-chapter]")).toHaveCount(1);
    const top = () =>
      page.locator('[data-chapter="3"]').evaluate((e) => e.getBoundingClientRect().top);
    const before = await top();
    await page.mouse.move(400, 400);
    await page.mouse.wheel(0, -200);
    await expect(page.locator('[data-book="john"][data-chapter="2"]')).toBeAttached();
    await expect(page.getByTestId("chapter-heading").filter({ hasText: "John 2" })).toBeAttached();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("John 3");
    await page.waitForTimeout(300);
    expect(Math.abs((await top()) - before)).toBeLessThan(2);
    await expect(page).toHaveURL(/\/read\/john\/3$/);
    // And on up to John 1, once John 2 has been read back to its top.
    await main(page).evaluate((el) => el.scrollTo(0, 0));
    await page.mouse.wheel(0, -50);
    await expect(page.locator('[data-book="john"][data-chapter="1"]')).toBeAttached();
  });

  test("the address and header follow the reader up into an earlier chapter", async ({ page }) => {
    await openReader(page, "/read/john/2");
    await page.mouse.move(400, 400);
    await page.mouse.wheel(0, -200);
    await expect(page.locator('[data-book="john"][data-chapter="1"]')).toBeAttached();
    await scrollChapterIntoReading(page, 1);
    await expect(page).toHaveURL(/\/read\/john\/1$/);
    await expect(headerRef(page)).toContainText("John 1");
    // Back to the opened chapter, and the address returns.
    await scrollChapterIntoReading(page, 2);
    await expect(page).toHaveURL(/\/read\/john\/2$/);
  });

  test("Genesis 1 has nothing above it, and Revelation 22 nothing below", async ({ page }) => {
    await openReader(page, "/read/genesis/1");
    await page.mouse.move(400, 400);
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(300);
    await expect(page.locator("[data-chapter]")).toHaveCount(1);
    await openReader(page, "/read/revelation/22");
    await scrollToEnd(page);
    await page.waitForTimeout(300);
    await expect(page.locator("[data-chapter]")).toHaveCount(1);
    await expect(page.getByTestId("more-loading")).toHaveCount(0);
  });

  test("the address, header and whole-chapter passage follow the chapter being read", async ({
    page,
    isMobile,
  }) => {
    await openReader(page, "/read/john/1");
    await scrollToEnd(page);
    await expect(page.locator('[data-chapter="2"]')).toBeAttached();
    await scrollChapterIntoReading(page, 2);

    await expect(page).toHaveURL(/\/read\/john\/2$/);
    await expect(headerRef(page)).toContainText("John 2");
    if (!isMobile) {
      await expect(page.getByTestId("selected-passage")).toContainText("John 2:1–25");
    }

    // Scrolling back up returns to chapter 1.
    await scrollChapterIntoReading(page, 1);
    await expect(page).toHaveURL(/\/read\/john\/1$/);
    await expect(headerRef(page)).toContainText("John 1");
  });

  test("chapters scrolled on to are remembered as recently studied", async ({ page }) => {
    await openReader(page, "/read/john/1");
    await scrollToEnd(page);
    await expect(page.locator('[data-chapter="2"]')).toBeAttached();
    await scrollChapterIntoReading(page, 2);
    await expect(page).toHaveURL(/\/read\/john\/2$/);
    await page.goto("/");
    await streamed(page);
    await expect(page.getByRole("link", { name: /^Continue/ })).toHaveAttribute(
      "href",
      "/read/john/2",
    );
  });

  test("the end of a book runs on into the first chapter of the next", async ({ page }) => {
    await openReader(page, "/read/obadiah/1");
    await scrollToEnd(page);
    await expect(page.getByTestId("chapter-heading").filter({ hasText: "Jonah 1" })).toBeAttached();
    await expect(page.locator('[data-book="jonah"][data-chapter="1"]')).toBeAttached();
    await scrollChapterIntoReading(page, 1, "jonah");
    await expect(page).toHaveURL(/\/read\/jonah\/1$/);
    await expect(headerRef(page)).toContainText("Jonah 1");
  });

  test("the start of a book runs back into the last chapter of the one before", async ({
    page,
  }) => {
    await openReader(page, "/read/jonah/1");
    await page.mouse.move(400, 400);
    await page.mouse.wheel(0, -200);
    await expect(page.locator('[data-book="obadiah"][data-chapter="1"]')).toBeAttached();
    await expect(
      page.getByTestId("chapter-heading").filter({ hasText: "Obadiah 1" }),
    ).toBeAttached();
  });

  test("tapping verses in another book selects there, and never across books", async ({ page }) => {
    await openReader(page, "/read/obadiah/1");
    await scrollToEnd(page);
    await expect(page.locator('[data-book="jonah"][data-chapter="1"]')).toBeAttached();
    await page.locator('[data-book="obadiah"] [data-verse="2"]').click();
    await page.locator('[data-book="jonah"] [data-verse="3"]').click();
    // A tap in a different book starts a new selection rather than joining the first.
    await expect(page).toHaveURL(/p=jonah/);
    await expect(page.locator('[data-book="obadiah"] [data-verse="2"]')).not.toHaveAttribute(
      "data-edge",
      "true",
    );
    await expect(page.locator('[data-book="jonah"] [data-verse="3"]')).toHaveAttribute(
      "data-edge",
      "true",
    );
  });

  test("a chapter that cannot be loaded says so and can be retried", async ({ page }) => {
    await openReader(page, "/read/john/1");
    let calls = 0;
    await page.route("**/api/scripture/chapter**", (route) =>
      ++calls === 1 ? route.fulfill({ status: 502, body: "{}" }) : route.continue(),
    );
    await scrollToEnd(page);
    await expect(page.locator("p[role=alert]")).toContainText("could not be loaded");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.locator('[data-chapter="2"]')).toBeAttached();
  });

  test("a verse chosen from the header menu is not confused by the chapters below", async ({
    page,
  }) => {
    await openReader(page, "/read/john/3?v=16");
  });
});

test.describe("choosing a range", () => {
  test("every verse of the range is tinted; only the first and last get the gold edge", async ({
    page,
  }) => {
    await openReader(page, "/read/john/1");
    await verse(page, 1, 3).click();
    // Waiting for the second tap: just the one verse, with its edge.
    await expect(verse(page, 1, 3)).toHaveAttribute("data-edge", "true");
    await verse(page, 1, 6).click();

    for (const n of [3, 4, 5, 6]) {
      await expect(verse(page, 1, n)).toHaveAttribute("aria-pressed", "true");
    }
    await expect(verse(page, 1, 3)).toHaveAttribute("data-edge", "true");
    await expect(verse(page, 1, 6)).toHaveAttribute("data-edge", "true");
    await expect(verse(page, 1, 4)).not.toHaveAttribute("data-edge", "true");
    await expect(verse(page, 1, 5)).not.toHaveAttribute("data-edge", "true");
    await expect(verse(page, 1, 2)).toHaveAttribute("aria-pressed", "false");
    await expect(verse(page, 1, 7)).toHaveAttribute("aria-pressed", "false");

    // The same tint on all four; the gold edge (a left shadow) on the two ends only.
    const look = (n: number) =>
      verse(page, 1, n).evaluate((el) => {
        const style = getComputedStyle(el);
        return { background: style.backgroundColor, shadow: style.boxShadow };
      });
    // (The tint fades in over a moment, so wait for it to settle.)
    await expect
      .poll(async () => {
        const [a, b, c, d] = await Promise.all([3, 4, 5, 6].map(look));
        return new Set([a.background, b.background, c.background, d.background]).size;
      })
      .toBe(1);
    const [a, b, c, d, outside] = await Promise.all([3, 4, 5, 6, 8].map(look));
    expect(a.background).not.toBe(outside.background);
    expect(a.shadow).not.toBe("none");
    expect(d.shadow).not.toBe("none");
    expect(b.shadow).toBe("none");
    expect(c.shadow).toBe("none");
  });

  test("a range can run from one chapter into the next one scrolled to", async ({
    page,
    isMobile,
  }) => {
    await openReader(page, "/read/john/1");
    await verse(page, 1, 50).click();
    await scrollToEnd(page);
    await expect(verse(page, 2, 3)).toBeAttached();
    await verse(page, 2, 3).click();

    await expect(page).toHaveURL(/p=john\+1%3A50-2%3A3/);
    await expect(verse(page, 1, 51)).toHaveAttribute("aria-pressed", "true");
    await expect(verse(page, 1, 51)).not.toHaveAttribute("data-edge", "true");
    await expect(verse(page, 2, 1)).toHaveAttribute("aria-pressed", "true");
    await expect(verse(page, 2, 1)).not.toHaveAttribute("data-edge", "true");
    await expect(verse(page, 1, 50)).toHaveAttribute("data-edge", "true");
    await expect(verse(page, 2, 3)).toHaveAttribute("data-edge", "true");
    await expect(verse(page, 2, 4)).toHaveAttribute("aria-pressed", "false");
    if (!isMobile) {
      await expect(page.getByTestId("selected-passage")).toContainText("John 1:50–2:3");
    }
  });
});

test.describe("the chapter route", () => {
  test("returns a chapter's verses and refuses what does not exist", async ({ request }) => {
    const ok = await request.get("/api/scripture/chapter?book=john&chapter=2");
    expect(ok.status()).toBe(200);
    const body = await ok.json();
    expect(body.translation).toBe("WEB");
    expect(body.verses).toHaveLength(25);
    expect(ok.headers()["cache-control"]).toContain("no-store");

    for (const query of [
      "book=nowhere&chapter=1",
      "book=john&chapter=22",
      "book=john&chapter=x",
      "book=john",
    ]) {
      expect((await request.get(`/api/scripture/chapter?${query}`)).status()).toBe(400);
    }
  });

  test("the header changes as soon as a verse of the earlier chapter is the first one whole at the top", async ({
    page,
  }) => {
    await openReader(page, "/read/john/2");
    await page.mouse.move(400, 400);
    await page.mouse.wheel(0, -200);
    await expect(page.locator('[data-book="john"][data-chapter="1"]')).toBeAttached();
    // Put John 1's last verse at the very top: its chapter is now the one in the header.
    await page.locator('[data-chapter="1"] [data-verse="51"]').evaluate((row) => {
      const scroller = row.closest("main")!;
      const top = row.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      scroller.scrollTo(0, scroller.scrollTop + top);
    });
    await expect(headerRef(page)).toContainText("John 1");
    // Partly scrolled off the top, verse 51 is still the top verse, so the header holds.
    await page.locator('[data-chapter="1"] [data-verse="51"]').evaluate((row) => {
      row.closest("main")!.scrollBy(0, 10);
    });
    await page.waitForTimeout(300);
    await expect(headerRef(page)).toContainText("John 1");
    // One verse of John 2 back in as the top verse, and it changes straight back.
    await page.locator('[data-chapter="2"] [data-verse="1"]').evaluate((row) => {
      const scroller = row.closest("main")!;
      const top = row.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      scroller.scrollTo(0, scroller.scrollTop + top);
    });
    await expect(headerRef(page)).toContainText("John 2");
  });
});
