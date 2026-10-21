import { expect, test, type Page } from "@playwright/test";
import { streamed } from "./helpers";

/** Open a chapter and wait until the page has hydrated (that is when it is noted as opened). */
async function read(page: Page, path: string) {
  await page.goto(path);
  await streamed(page);
  await expect(page.getByRole("main").getByTestId("chapter-text")).toHaveAttribute(
    "data-interactive",
    "true",
  );
}

const home = (page: Page) => page.getByRole("region", { name: "Recently Studied" });

test.describe("recently studied", () => {
  test("a first visit shows an empty list and a Continue bar that starts at John 1", async ({
    page,
  }) => {
    await page.goto("/");
    await streamed(page);
    await expect(page.getByText("Chapters you read will show up here.")).toBeVisible();
    const cont = page.getByRole("link", { name: /^Continue/ });
    await expect(cont).toHaveAttribute("href", "/read/john/1");
    await expect(cont).toContainText("Start with John 1");
  });

  test("chapters you open are listed newest first, and Continue returns to the last one", async ({
    page,
  }) => {
    await read(page, "/read/john/1");
    await read(page, "/read/psalms/23");
    await page.goto("/");
    await streamed(page);

    const rows = home(page).getByRole("link");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Psalms 23");
    await expect(rows.nth(0)).toContainText("Today");
    await expect(rows.nth(1)).toContainText("John 1");

    const cont = page.getByRole("link", { name: /^Continue/ });
    await expect(cont).toHaveAttribute("href", "/read/psalms/23");
    await expect(cont).toContainText("Psalms 23");
  });

  test("reopening a chapter moves it to the top instead of repeating it", async ({ page }) => {
    await read(page, "/read/john/1");
    await read(page, "/read/psalms/23");
    await read(page, "/read/john/1");
    await page.goto("/");
    await streamed(page);
    const rows = home(page).getByRole("link");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("John 1");
  });

  test("the sidebar lists them too and a row opens the chapter", async ({ page, isMobile }) => {
    test.skip(isMobile, "the sidebar is hidden on phones");
    await read(page, "/read/john/3");
    await page.goto("/");
    await streamed(page);
    const side = page.locator("aside.shell-side");
    await expect(side.getByRole("link", { name: /John 3/ })).toBeVisible();
    await side.getByRole("link", { name: /John 3/ }).click();
    await expect(page).toHaveURL(/\/read\/john\/3$/);
  });

  test("a damaged saved list is ignored rather than breaking the page", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("lt.recent.v1", "{not json"));
    await page.goto("/");
    await streamed(page);
    await expect(page.getByText("Chapters you read will show up here.")).toBeVisible();
    await page.addInitScript(() =>
      localStorage.setItem(
        "lt.recent.v1",
        JSON.stringify([{ book: "nonsense", chapter: 1, openedAt: 1 }]),
      ),
    );
    await page.reload();
    await streamed(page);
    await expect(page.getByText("Chapters you read will show up here.")).toBeVisible();
  });
});

test.describe("scroll reveal", () => {
  const seed = (page: Page) =>
    page.addInitScript(() => {
      const books = ["genesis", "exodus", "psalms", "john", "acts", "romans", "isaiah", "mark"];
      const list = Array.from({ length: 13 }, (_, i) => ({
        book: books[i % books.length],
        chapter: i + 1,
        openedAt: Date.now() - i * 60_000,
      }));
      localStorage.setItem("lt.recent.v1", JSON.stringify(list));
    });

  const opacities = (page: Page) =>
    page
      .getByTestId("reveal-rows")
      .locator("> a")
      .evaluateAll((rows) => rows.map((row) => Number((row as HTMLElement).style.opacity)));

  test("rows fade in as they scroll up from the bottom edge", async ({ page, isMobile }) => {
    test.skip(isMobile, "measured on the desktop layout");
    await page.setViewportSize({ width: 1440, height: 900 });
    await seed(page);
    await page.goto("/");
    await streamed(page);
    await expect(page.getByTestId("reveal-rows").locator("> a")).toHaveCount(13);

    await expect.poll(async () => (await opacities(page))[12]).toBe(0); // far below: hidden
    const before = await opacities(page);
    expect(before[0]).toBe(1); // already well inside the page
    expect(before.some((o) => o > 0 && o < 1)).toBe(true); // one is part-way

    await page.locator("main.shell-main").evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
    await expect.poll(async () => (await opacities(page))[12]).toBe(1);
  });

  test("reduced motion shows every row at once", async ({ page, isMobile }) => {
    test.skip(isMobile, "measured on the desktop layout");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await seed(page);
    await page.goto("/");
    await streamed(page);
    await expect(page.getByTestId("reveal-rows").locator("> a")).toHaveCount(13);
    await expect.poll(async () => (await opacities(page)).every((o) => o === 1)).toBe(true);
  });
});
