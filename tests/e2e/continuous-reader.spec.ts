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

/** Put a chapter's heading (or the section's top) where the reader is "looking": about a third down. */
async function scrollChapterIntoReading(page: Page, chapter: number) {
  await page.locator(`[data-chapter="${chapter}"]`).evaluate((section) => {
    const scroller = section.closest("main")!;
    const top = section.getBoundingClientRect().top;
    scroller.scrollTo(0, scroller.scrollTop + top - window.innerHeight * 0.38);
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

  test("it stops at the end of a book and offers the next one", async ({ page }) => {
    await openReader(page, "/read/obadiah/1");
    await expect(page.locator("[data-chapter]")).toHaveCount(1);
    await expect(page.getByTestId("more-loading")).toHaveCount(0);
    await scrollToEnd(page);
    const next = page.getByRole("link", { name: /Continue to Jonah 1/ });
    await expect(next).toHaveAttribute("href", "/read/jonah/1");
    await expect(page.locator("[data-chapter]")).toHaveCount(1);
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
    await expect(verse(page, 3, 16)).toHaveAttribute("data-arrived", "");
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
});
