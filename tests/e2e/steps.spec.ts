import { expect, test, type Page } from "@playwright/test";
import { streamed } from "./helpers";
import { addToneRecording } from "./audio-fixture";
import { TestDb } from "./db";

const PASSAGE = "?p=john+1%3A3-6"; // verses 3, 4, 5, 6
const row = (page: Page, n: number) => page.getByRole("main").locator(`[data-verse="${n}"]`);
const vis = (page: Page, n: number) => row(page, n).getAttribute("data-vis");
const stepButton = (page: Page, label: string) =>
  page.getByRole("navigation", { name: "Memorization steps" }).getByRole("button", { name: label });
const toggle = (page: Page) => page.getByRole("button", { name: "Show several verses" });
const reveal = (page: Page) => page.getByRole("button", { name: /(Reveal|Hide) Scripture/ });
const label = (page: Page) => page.getByTestId("focus-label");

async function openSteps(page: Page, query = PASSAGE) {
  await page.goto(`/memorize/steps${query}`);
  await streamed(page);
  await expect(page.getByRole("main").getByTestId("scripture")).toBeVisible();
  // Interactive once hydrated: the step buttons then change the page.
  await expect(page.getByTestId("scripture")).toHaveCount(1);
}

/** Opacity once any transition has finished. */
async function settledOpacity(page: Page, n: number) {
  await page.waitForTimeout(900);
  return Number(await row(page, n).evaluate((el) => getComputedStyle(el).opacity));
}

test.describe("memorization steps", () => {
  test("without a passage it asks you to choose verses first", async ({ page }) => {
    await page.goto("/memorize/steps");
    await streamed(page);
    await expect(page.getByRole("link", { name: /Choose verses first/ })).toHaveAttribute(
      "href",
      "/memorize/range",
    );
  });

  test("has exactly four steps, starting on Listen", async ({ page }) => {
    await openSteps(page);
    const nav = page.getByRole("navigation", { name: "Memorization steps" });
    for (const name of ["Listen", "Sing", "Recall", "Chain"]) {
      await expect(stepButton(page, name)).toBeVisible();
    }
    await expect(nav.getByRole("button", { name: /^(Listen|Sing|Recall|Chain)$/ })).toHaveCount(4);
    await expect(stepButton(page, "Listen")).toHaveAttribute("aria-current", "step");
  });

  test("Listen shows one verse and hides the others; the label says which", async ({ page }) => {
    await openSteps(page);
    await expect.poll(() => vis(page, 3)).toBe("focused");
    for (const n of [4, 5, 6]) expect(await vis(page, n)).toBe("gone");
    await expect(label(page)).toHaveText("Verse 3 of 3–6");
    await expect(row(page, 3)).toContainText("All things were made through him");
  });

  test("the toggle shows several verses, fading the rest without changing text size", async ({
    page,
  }) => {
    await openSteps(page);
    const size = () => row(page, 3).evaluate((el) => getComputedStyle(el).fontSize);
    const before = await size();
    await toggle(page).click();
    await expect(label(page)).toHaveText("Focus: verse 3 · click a verse to move focus");
    expect(await vis(page, 4)).toBe("faded");
    const faded = await settledOpacity(page, 4);
    expect(faded).toBeGreaterThan(0.3);
    expect(faded).toBeLessThan(0.4);
    expect(await settledOpacity(page, 3)).toBe(1);
    expect(await size()).toBe(before); // text size never changes
    await toggle(page).click();
    expect(await vis(page, 4)).toBe("gone");
  });

  test("in the single-verse view the focused verse sits at the top, with no scrolling and the steps in view", async ({
    page,
  }) => {
    await openSteps(page, "?p=john+1%3A1-18");
    await toggle(page).click();
    await row(page, 12).click();
    await toggle(page).click();
    await page.waitForTimeout(1200);
    const geometry = await page.evaluate(() => {
      const main = document.querySelector("main")!;
      const verse = document.querySelector("[data-vis=focused]")!.getBoundingClientRect();
      const toggleButton = document.querySelector("[aria-label='Show several verses']")!;
      const steps = document
        .querySelector("nav[aria-label='Memorization steps']")!
        .getBoundingClientRect();
      return {
        scrolls: main.scrollHeight > main.clientHeight + 1,
        gap: verse.top - toggleButton.getBoundingClientRect().bottom,
        stepsVisible: steps.bottom <= window.innerHeight,
        number: document.querySelector("[data-vis=focused]")!.getAttribute("data-verse"),
      };
    });
    expect(geometry.number).toBe("12");
    expect(geometry.scrolls).toBe(false);
    expect(geometry.stepsVisible).toBe(true);
    expect(geometry.gap).toBeLessThan(60); // right beneath the toggle row
    // The verses that are out of view take no room.
    expect(await row(page, 5).evaluate((el) => el.getBoundingClientRect().height)).toBe(0);
  });

  test("the steps stay at the bottom of the screen while long text scrolls above them, fading out", async ({
    page,
  }) => {
    await openSteps(page, "?p=john+1%3A1-18");
    await toggle(page).click();
    await page.waitForTimeout(1200);
    const scripture = page.getByTestId("scripture");
    const moved = await scripture.evaluate((el) => {
      el.scrollTo(0, 400);
      return el.scrollTop > 0;
    });
    expect(moved).toBe(true);
    const edges = await page.evaluate(() => {
      const steps = document.querySelector("nav[aria-label='Memorization steps']")!;
      const text = document.querySelector("[data-testid=scripture]")!;
      return {
        pageScrolls:
          document.querySelector("main")!.scrollHeight >
          document.querySelector("main")!.clientHeight + 1,
        textBottom: text.getBoundingClientRect().bottom,
        stepsTop: steps.getBoundingClientRect().top,
        mask: getComputedStyle(text).maskImage || getComputedStyle(text).webkitMaskImage,
        // No dark panel behind the steps: the block around them is transparent.
        backdrop: getComputedStyle(steps.parentElement!).backgroundColor,
      };
    });
    expect(edges.pageScrolls).toBe(false); // only the text scrolls
    expect(edges.textBottom).toBeLessThanOrEqual(edges.stepsTop);
    expect(edges.mask).toContain("linear-gradient"); // the text fades toward the steps
    expect(edges.backdrop).toBe("rgba(0, 0, 0, 0)");
    await expect(stepButton(page, "Chain")).toBeInViewport();
  });

  test("going from one verse to several keeps the focused verse where it is, with the earlier ones above", async ({
    page,
  }) => {
    await openSteps(page, "?p=john+1%3A1-18");
    await toggle(page).click();
    await row(page, 12).click();
    await toggle(page).click(); // single view on verse 12
    await page.waitForTimeout(1200);
    const topOf = () => row(page, 12).evaluate((el) => el.getBoundingClientRect().top);
    const before = await topOf();
    await toggle(page).click(); // several again
    for (const ms of [100, 300, 700, 1300]) {
      await page.waitForTimeout(ms);
      expect(Math.abs((await topOf()) - before)).toBeLessThan(2);
    }
    // The verses after it have appeared, and the earlier ones are there to scroll up to.
    expect(await vis(page, 13)).toBe("faded");
    const scrollTop = await page.getByTestId("scripture").evaluate((el) => el.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);
    await page.getByTestId("scripture").evaluate((el) => el.scrollTo(0, 0));
    await expect(row(page, 1)).toBeInViewport();
  });

  test("the toggle's icon shows the view: one dot and line for a verse, three for several", async ({
    page,
  }) => {
    await openSteps(page);
    const dots = () => toggle(page).locator("svg circle");
    const lines = () => toggle(page).locator("svg path");
    await expect(dots()).toHaveCount(1);
    await expect(lines()).toHaveCount(1);
    await toggle(page).click();
    await expect(dots()).toHaveCount(3);
    await expect(lines()).toHaveCount(1); // one path drawing the three lines
    await toggle(page).click();
    await expect(dots()).toHaveCount(1);
  });

  test("clicking a verse moves the focus to it", async ({ page }) => {
    await openSteps(page);
    await toggle(page).click();
    await row(page, 5).click();
    await expect.poll(() => vis(page, 5)).toBe("focused");
    expect(await vis(page, 3)).toBe("faded");
    await expect(label(page)).toContainText("verse 5");
  });

  test("Sing starts with several verses in view", async ({ page }) => {
    await openSteps(page);
    await stepButton(page, "Sing").click();
    expect(await vis(page, 4)).toBe("faded");
    await expect(page).toHaveURL(/step=sing/);
  });

  test("Recall hides the text behind dashes until revealed", async ({ page }) => {
    await openSteps(page);
    await stepButton(page, "Recall").click();
    await expect(row(page, 3)).not.toContainText("All things");
    await expect(row(page, 3).locator("div.border-dashed").first()).toBeVisible();
    await reveal(page).click();
    await expect(row(page, 3)).toContainText("All things were made through him");
    await expect(reveal(page)).toHaveAccessibleName("Hide Scripture");
    await reveal(page).click();
    await expect(row(page, 3)).not.toContainText("All things");
  });

  test("Chain always shows the whole passage, hidden until revealed", async ({ page }) => {
    await openSteps(page);
    await stepButton(page, "Chain").click();
    for (const n of [3, 4, 5, 6]) expect(await vis(page, n)).toBe("plain");
    await expect(label(page)).toHaveText("Whole passage");
    await expect(toggle(page)).toBeDisabled();
    await expect(row(page, 6)).not.toContainText("There came a man");
    await reveal(page).click();
    for (const [n, text] of [
      [3, "All things were made"],
      [6, "There came a man"],
    ] as const) {
      await expect(row(page, n)).toContainText(text);
    }
  });

  test("Listen and Sing never hide the text, and have no reveal button", async ({ page }) => {
    await openSteps(page);
    await expect(reveal(page)).toHaveCount(0);
    await stepButton(page, "Sing").click();
    await expect(reveal(page)).toHaveCount(0);
  });

  test("the arrows move between steps and wrap around", async ({ page }) => {
    await openSteps(page);
    await page.getByRole("button", { name: "Previous step" }).click();
    await expect(stepButton(page, "Chain")).toHaveAttribute("aria-current", "step");
    await page.getByRole("button", { name: "Next step" }).click();
    await expect(stepButton(page, "Listen")).toHaveAttribute("aria-current", "step");
    await page.getByRole("button", { name: "Next step" }).click();
    await expect(stepButton(page, "Sing")).toHaveAttribute("aria-current", "step");
  });

  test("the help button explains the step in one line", async ({ page }) => {
    await openSteps(page);
    await page.getByRole("button", { name: "Help" }).click();
    await expect(page.locator("#step-help")).toContainText(
      "Listen. Read along as the music plays.",
    );
    await stepButton(page, "Recall").click();
    await expect(page.locator("#step-help")).toHaveCount(0); // closes when the step changes
    await page.getByRole("button", { name: "Help" }).click();
    await expect(page.locator("#step-help")).toContainText("The text is hidden");
  });

  test("the step is kept in the link, so a reload returns to it", async ({ page }) => {
    await openSteps(page);
    await stepButton(page, "Recall").click();
    await page.reload();
    await streamed(page);
    await expect(stepButton(page, "Recall")).toHaveAttribute("aria-current", "step");
    await openSteps(page, `${PASSAGE}&step=chain`);
    await expect(stepButton(page, "Chain")).toHaveAttribute("aria-current", "step");
  });

  test("Switch to Flashcards carries the passage", async ({ page }) => {
    await openSteps(page);
    await expect(page.getByRole("link", { name: /Switch to Flashcards/ })).toHaveAttribute(
      "href",
      "/memorize/flashcards?p=john+1%3A3-6",
    );
  });

  test("a passage across chapters is shown in full", async ({ page }) => {
    await openSteps(page, "?p=john+1%3A50-2%3A2");
    await expect(page.getByRole("main").locator("[data-verse]")).toHaveCount(4);
  });

  test("never starts audio by itself", async ({ page }) => {
    await openSteps(page);
    await stepButton(page, "Sing").click();
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  });
});

test.describe("the side panel", () => {
  test.skip(({ isMobile }) => isMobile, "the right panel is hidden on phones");

  test("names the step and explains it", async ({ page }) => {
    await openSteps(page);
    await expect(page.getByRole("heading", { name: "Listen", level: 2 })).toBeVisible();
    await expect(
      page.getByRole("complementary").getByText("Read along as the music plays."),
    ).toBeVisible();
  });

  test("shows the passage, the practice end mode (Loop Verse) and the genre", async ({ page }) => {
    await openSteps(page);
    await expect(page.getByTestId("panel-passage")).toHaveText("John 1:3–6");
    await expect(page.getByText("When the verse ends")).toBeVisible();
    await expect(page.getByRole("complementary").getByText("Loop Verse")).toBeVisible();
    await expect(page.getByRole("complementary").getByText("No recording yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Edit range" })).toHaveAttribute(
      "href",
      "/memorize/range?p=john+1%3A3-6",
    );
  });
});

test.describe("memorize choice and Continue", () => {
  test("the choice page carries the passage to both methods", async ({ page }) => {
    await page.goto(`/memorize${PASSAGE}`);
    await streamed(page);
    await expect(page.getByRole("main").getByTestId("choice-passage")).toHaveText("John 1:3–6");
    await expect(page.getByRole("link", { name: /Memorization Steps/ })).toHaveAttribute(
      "href",
      "/memorize/steps?p=john+1%3A3-6",
    );
    await expect(page.getByRole("link", { name: /Flashcards/ }).first()).toBeVisible();
  });

  test("without a passage the choice page sends you to choose verses", async ({ page }) => {
    await page.goto("/memorize");
    await streamed(page);
    await expect(page.getByRole("link", { name: /Memorization Steps/ })).toHaveAttribute(
      "href",
      "/memorize/range",
    );
  });

  test("Continue on Home returns to the step you were on", async ({ page }) => {
    await openSteps(page);
    await stepButton(page, "Recall").click();
    await expect(page).toHaveURL(/step=recall/);
    await page.goto("/");
    await streamed(page);
    const cont = page.getByRole("link", { name: /^Continue/ });
    await expect(cont).toContainText("John 1:3–6 · last: Recall");
    await expect(cont).toHaveAttribute("href", "/memorize/steps?p=john+1%3A3-6&step=recall");
  });
});

test.describe("with music", () => {
  test.skip(({ isMobile }) => isMobile, "playback tests run once, on desktop");
  test.describe.configure({ mode: "serial" });
  const db = new TestDb();
  const NAHUM = 34; // nothing else in the tests uses it
  test.beforeAll(async ({ browser, baseURL }) => {
    await addToneRecording(browser, baseURL, db, { bookId: NAHUM, chapter: 1 });
  });
  test.afterAll(() => db.cleanup());

  const openNahum = async (page: Page) => {
    await openSteps(page, "?p=nahum+1%3A1-3");
    await expect(page.getByRole("button", { name: "Genre" })).toBeEnabled();
  };

  test("the genre shows in the panel and Play sings the focused verse on a loop", async ({
    page,
  }) => {
    await openNahum(page);
    await expect(page.getByRole("complementary").getByText("Pop")).toBeVisible();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await page.waitForTimeout(4500); // longer than the verse: it loops
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    expect(await vis(page, 1)).toBe("focused");
  });

  test("choosing a verse moves the music to it, and skipping moves the focus", async ({ page }) => {
    await openNahum(page);
    await page.getByRole("button", { name: "Show several verses" }).click();
    await row(page, 3).click();
    await expect.poll(() => vis(page, 3)).toBe("focused");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Previous verse" }).click();
    await expect.poll(() => vis(page, 2)).toBe("focused");
    await expect(row(page, 2)).toHaveAttribute("aria-current", "true");
  });
});
