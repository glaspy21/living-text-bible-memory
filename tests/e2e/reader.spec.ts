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

test.describe("reading a chapter", () => {
  test("shows the whole chapter with verse numbers, in the WEB, with its notice", async ({
    page,
  }) => {
    await page.goto("/read/john/1");
    await streamed(page);
    await expect(page.getByRole("heading", { name: "John 1", level: 1 })).toBeAttached();
    await expect(page.locator("[data-verse]")).toHaveCount(51);
    await expect(page.locator('[data-verse="1"]')).toContainText(
      "In the beginning was the Word, and the Word was with God, and the Word was God.",
    );
    await expect(page.getByTestId("scripture-attribution")).toContainText("public domain");
  });

  test("a verse number is shown beside its text", async ({ page }) => {
    await page.goto("/read/john/1");
    await streamed(page);
    await expect(page.locator('[data-verse="14"]')).toContainText("14");
    await expect(page.locator('[data-verse="14"]')).toContainText("The Word became flesh");
  });

  test("the book name in the URL may use a slug with a number", async ({ page }) => {
    await page.goto("/read/1-john/3");
    await streamed(page);
    await expect(page.locator('[data-verse="16"]')).toContainText("By this we know love");
    await expect(page.getByRole("heading", { name: "1 John 3", level: 1 })).toBeAttached();
  });

  test("unknown books and chapters are a 404 page", async ({ page }) => {
    for (const path of ["/read/nonsense/1", "/read/john/99", "/read/john/0", "/read/john/abc"]) {
      await page.goto(path);
      await streamed(page);
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

    await streamed(page);
    await expect(page.getByRole("main").getByTestId("chapter-text").first()).toHaveAttribute(
      "data-interactive",
      "true",
    );
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

  test("tapping the one selected verse again switches it off and Memorize returns to the chapter", async ({
    page,
  }) => {
    await openReader(page, "/read/john/2");
    await page.locator('[data-verse="5"]').click();
    await expect(page.locator('[data-verse="5"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("link", { name: /^Memorize John 2:5$/ })).toBeVisible();
    await page.locator('[data-verse="5"]').click();
    await expect(page.locator('[data-verse="5"]')).toHaveAttribute("aria-pressed", "false");
    await expect(page).not.toHaveURL(/[?&]p=/);
    await expect(page.getByRole("link", { name: /^Memorize John 2:1–25$/ })).toBeVisible();
    // And it can be chosen again.
    await page.locator('[data-verse="5"]').click();
    await expect(page.locator('[data-verse="5"]')).toHaveAttribute("aria-pressed", "true");
  });

  test("a range can run from the end of one book into the next", async ({ page }) => {
    await openReader(page, "/read/luke/24");
    await page.locator('[data-book="luke"] [data-verse="50"]').click();
    await expect(page.getByRole("link", { name: /^Memorize Luke 24:50$/ })).toBeVisible();
    // Reading on past Luke's last verse brings John 1 in below.
    await page.getByRole("main").evaluate((el) => el.scrollTo(0, el.scrollHeight));
    const john3 = page.locator('[data-book="john"][data-chapter="1"] [data-verse="3"]');
    await expect(john3).toBeAttached();
    await john3.scrollIntoViewIfNeeded();
    await john3.click();
    await expect(
      page.getByRole("link", { name: /^Memorize Luke 24:50–John 1:3$/ }),
    ).toHaveAttribute("href", "/memorize?p=luke+24%3A50-john+1%3A3");
    await expect(page).toHaveURL(/p=luke\+24%3A50-john\+1%3A3/);
    // Verses of both books are marked; the end of Luke and the start of John are inside it.
    await expect(page.locator('[data-book="luke"] [data-verse="53"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      page.locator('[data-book="john"][data-chapter="1"] [data-verse="2"]'),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.locator('[data-book="john"][data-chapter="1"] [data-verse="4"]'),
    ).toHaveAttribute("aria-pressed", "false");
    // Memorize shows all seven verses, in order.
    await page.goto("/memorize/steps?p=luke+24%3A50-john+1%3A3");
    await streamed(page);
    await expect(page.getByRole("main").locator("[data-verse]")).toHaveCount(7);
  });

  test("the header names only the book and chapter on the Memorize screens, never the verses", async ({
    page,
  }) => {
    const header = page.locator("header button[aria-haspopup='dialog']");
    for (const path of ["/memorize/steps", "/memorize/flashcards", "/memorize/range"]) {
      await page.goto(`${path}?p=luke+23%3A35-38`);
      await streamed(page);
      await expect(header).toHaveText(/^Luke 23\s*▾$/);
    }
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
    await streamed(page);
    await expect(page.getByRole("link", { name: /^Memorize John 2:1–25$/ })).toBeVisible();
  });

  test("ignores a selection from another chapter's URL", async ({ page }) => {
    await page.goto("/read/john/1?p=genesis+1%3A1-3");
    await streamed(page);
    await expect(page.locator('[data-verse="1"]')).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("moving between chapters", () => {
  test("The triangles move through chapters and across books", async ({ page }) => {
    await openReader(page, "/read/john/1");
    await page.getByRole("link", { name: "Next chapter" }).click();
    await expect(page).toHaveURL(/\/read\/john\/2$/);

    await page.goto("/read/john/21");

    await streamed(page);
    await page.getByRole("link", { name: "Next chapter" }).click();
    await expect(page).toHaveURL(/\/read\/acts\/1$/);
    await page.getByRole("link", { name: "Previous chapter" }).click();
    await expect(page).toHaveURL(/\/read\/john\/21$/);
  });

  test("there is no left triangle at Genesis 1 and no right triangle at Revelation 22", async ({
    page,
  }) => {
    await page.goto("/read/genesis/1");
    await streamed(page);
    await expect(page.getByRole("link", { name: "Previous chapter" })).toHaveCount(0);
    await page.goto("/read/revelation/22");
    await streamed(page);
    await expect(page.getByRole("link", { name: "Next chapter" })).toHaveCount(0);
  });
});

test.describe("side panel", () => {
  test("desktop shows the selection and the music note", async ({ page, isMobile }) => {
    test.skip(isMobile, "the right panel is hidden on phones");
    // Genesis 1: no other test adds music here, so the note is stable.
    await openReader(page, "/read/genesis/1");
    await expect(page.getByTestId("selected-passage")).toContainText("Genesis 1:1–31");
    await expect(page.getByText("No recording for this chapter yet")).toBeVisible();
    await page.locator('[data-verse="4"]').click();
    await expect(page.getByTestId("selected-passage")).toContainText("Genesis 1:4");
    await expect(page.getByRole("link", { name: "Edit range" })).toHaveAttribute(
      "href",
      "/memorize/range?p=genesis+1%3A4&from=read",
    );
  });

  test("Edit range opens the range picker on the verses already chosen", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the right panel is hidden on phones");
    await openReader(page, "/read/john/1");
    await page.locator('[data-verse="3"]').click();
    await page.locator('[data-verse="5"]').click();
    await page.getByRole("link", { name: "Edit range" }).click();
    await expect(page.getByTestId("range-summary")).toHaveText("John 1:3 – 5");
    await expect(page.getByTestId("range-picker")).toHaveAttribute("data-interactive", "true");
    const verse = (n: number) =>
      page.getByRole("group", { name: "John 1 verses" }).getByRole("button", {
        name: `Verse ${n}`,
        exact: true,
      });
    await expect(verse(3)).toHaveAttribute("data-mark", "endpoint");
    await expect(verse(4)).toHaveAttribute("data-mark", "inside");
    await expect(verse(5)).toHaveAttribute("data-mark", "endpoint");
    await expect(verse(6)).toHaveAttribute("data-mark", "none");
    // Set Range goes back to the reader with the range still chosen.
    await page.getByRole("link", { name: "Set Range" }).click();
    await expect(page).toHaveURL(/\/read\/john\/1\?p=john\+1%3A3-5&v=3&jump=1$/);
  });

  test("Edit range shows the range chosen this time, not one from an earlier visit", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the right panel is hidden on phones");
    await openReader(page, "/read/john/1");
    await page.locator('[data-verse="3"]').click();
    await page.locator('[data-verse="12"]').click();
    await page.getByRole("link", { name: "Edit range" }).click();
    await expect(page.getByTestId("range-summary")).toHaveText("John 1:3 – 12");
    await page.getByRole("link", { name: "Set Range" }).click();
    await expect(page).toHaveURL(/\/read\/john\/1\?p=/);
    await page.locator('[data-verse="20"]').click();
    await page.locator('[data-verse="25"]').click();
    await page.getByRole("link", { name: "Edit range" }).click();
    await expect(page.getByTestId("range-summary")).toHaveText("John 1:20 – 25");
  });

  test("Set Range brings the first verse of the range to the top of the reader", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the right panel is hidden on phones");
    await openReader(page, "/read/john/1");
    await page.locator('[data-verse="3"]').click();
    await page.locator('[data-verse="12"]').click();
    await page.getByRole("link", { name: "Edit range" }).click();
    await expect(page.getByTestId("range-picker")).toHaveAttribute("data-interactive", "true");
    // Change the range, then go back.
    await page
      .getByRole("group", { name: "John 1 verses" })
      .getByRole("button", { name: "Verse 30", exact: true })
      .click();
    await page
      .getByRole("group", { name: "John 1 verses" })
      .getByRole("button", { name: "Verse 32", exact: true })
      .click();
    await page.getByRole("link", { name: "Set Range" }).click();
    await expect(page).toHaveURL(/\/read\/john\/1\?p=john\+1%3A30-32&v=30&jump=1$/);
    // Immediately: no scrolling to get there (a smooth scroll this far takes longer than this).
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const row = document.querySelector("[data-verse='30']")!.getBoundingClientRect();
            return (
              Math.abs(row.top - document.querySelector("main")!.getBoundingClientRect().top) < 2
            );
          }),
        { timeout: 400, intervals: [50] },
      )
      .toBe(true);
    await expect(page.getByTestId("selected-passage")).toHaveText("John 1:30–32");
  });

  test("phones still get a Memorize button", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone layout");
    await page.goto("/read/john/1");
    await streamed(page);
    await expect(page.getByRole("link", { name: /^Memorize John 1:1–51$/ })).toBeVisible();
  });
});
