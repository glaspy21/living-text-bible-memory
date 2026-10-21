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
const arrows = (page: Page) => page.getByRole("group", { name: "Move between verses" });
const prev = (page: Page) => arrows(page).getByRole("button", { name: "Previous verse" });
const next = (page: Page) => arrows(page).getByRole("button", { name: "Next verse" });

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
  test("without a passage it goes to choosing verses, which returns here", async ({ page }) => {
    await page.goto("/memorize/steps");
    await expect(page).toHaveURL(/\/memorize\/range\?from=steps/);
    await streamed(page);
    await expect(page.getByRole("main").getByTestId("range-picker")).toBeVisible();
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
    await expect(row(page, 3)).toContainText("All things were made through him");
  });

  test("the toggle shows several verses, fading the rest without changing text size", async ({
    page,
  }) => {
    await openSteps(page);
    const size = () => row(page, 3).evaluate((el) => getComputedStyle(el).fontSize);
    const before = await size();
    await toggle(page).click();
    expect(await vis(page, 4)).toBe("faded");
    const faded = await settledOpacity(page, 4);
    expect(faded).toBeGreaterThan(0.3);
    expect(faded).toBeLessThan(0.4);
    expect(await settledOpacity(page, 3)).toBe(1);
    expect(await size()).toBe(before); // text size never changes
    await toggle(page).click();
    await expect.poll(() => vis(page, 4)).toBe("gone"); // after the others have faded
  });

  test("in the single-verse view the focused verse sits at the top, with no scrolling and the steps in view", async ({
    page,
  }) => {
    await openSteps(page, "?p=john+1%3A1-18");
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
    expect(geometry.number).toBe("1");
    expect(geometry.scrolls).toBe(false);
    expect(geometry.stepsVisible).toBe(true);
    expect(geometry.gap).toBeLessThan(60); // right beneath the toggle row
    // The verses that are out of view take no room.
    expect(await row(page, 5).evaluate((el) => el.getBoundingClientRect().height)).toBe(0);
  });

  test("to one verse: the others fade first with the verse still, then it glides to the top", async ({
    page,
  }) => {
    await openSteps(page, "?p=john+1%3A1-18");
    await toggle(page).click();
    await page.waitForTimeout(1200);
    await row(page, 5).click();
    await page.waitForTimeout(300);
    const topOf = () => row(page, 5).evaluate((el) => el.getBoundingClientRect().top);
    const before = await topOf();
    expect(before).toBeGreaterThan(200); // verses 1–4 are above it
    await toggle(page).click(); // to one verse
    // First the others fade, while verse 5 does not move at all.
    await page.waitForTimeout(60);
    expect(Math.abs((await topOf()) - before)).toBeLessThan(2);
    expect(await row(page, 4).evaluate((el) => Number(getComputedStyle(el).opacity))).toBeLessThan(
      0.34,
    );
    // The others have gone by now, and the verse waits alone for a moment before it moves.
    await page.waitForTimeout(400);
    expect(Math.abs((await topOf()) - before)).toBeLessThan(2);
    await page.waitForTimeout(150);
    expect(Math.abs((await topOf()) - before)).toBeLessThan(2);
    // Then it glides up (it is somewhere in between), and ends right beneath the toggle row.
    await page.waitForTimeout(370);
    const middle = await topOf();
    expect(middle).toBeLessThan(before - 5);
    await page.waitForTimeout(900);
    const end = await row(page, 5).evaluate((el) => el.getBoundingClientRect().top);
    const toggleBottom = await toggle(page).evaluate((el) => el.getBoundingClientRect().bottom);
    expect(end - toggleBottom).toBeLessThan(60);
    expect(await vis(page, 6)).toBe("gone");
    // Opening to several again keeps it completely still.
    const settled = await topOf();
    await toggle(page).click();
    for (const ms of [30, 100, 200, 400, 800, 1500]) {
      await page.waitForTimeout(ms);
      expect(Math.abs((await topOf()) - settled)).toBeLessThan(3);
    }
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

  test("going back to one verse does not move a verse that is already at the top", async ({
    page,
  }) => {
    await openSteps(page, "?p=john+1%3A1-18");
    await toggle(page).click();
    await row(page, 12).click();
    await toggle(page).click(); // one verse, 12, at the top
    await page.waitForTimeout(1200);
    const topOf = () => row(page, 12).evaluate((el) => el.getBoundingClientRect().top);
    const before = await topOf();
    await toggle(page).click(); // several
    await page.waitForTimeout(1800);
    await toggle(page).click(); // and back to one
    for (const ms of [50, 150, 300, 600, 1200]) {
      await page.waitForTimeout(ms);
      // (A jump used to be 30px or more; a few pixels is frame timing under load.)
      expect(Math.abs((await topOf()) - before)).toBeLessThan(6);
    }
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
  });

  test("the arrows move the focus to the next and previous verse", async ({ page }) => {
    await openSteps(page);
    await expect(prev(page)).toBeDisabled();
    await next(page).click();
    await expect.poll(() => vis(page, 4)).toBe("focused");
    await prev(page).click();
    await expect.poll(() => vis(page, 3)).toBe("focused");
  });

  test("Sing starts with several verses in view", async ({ page }) => {
    await openSteps(page);
    await stepButton(page, "Sing").click();
    expect(await vis(page, 4)).toBe("faded");
    await expect(page).toHaveURL(/step=sing/);
  });

  test("Recall hides the text behind dashes and reveals it by word or by verse", async ({
    page,
  }) => {
    await openSteps(page);
    await stepButton(page, "Recall").click();
    const button = (name: string) => page.getByRole("button", { name, exact: true });
    await expect(row(page, 3)).not.toContainText("All things");
    await expect(row(page, 3).locator("span.border-dashed").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Scripture/ })).toHaveCount(0);
    await expect(button("Hide word")).toBeDisabled();
    await expect(button("Hide verse")).toBeDisabled();

    await button("Reveal word").click();
    await expect(row(page, 3)).toContainText("All");
    await expect(row(page, 3)).not.toContainText("All things");
    await button("Reveal word").click();
    await expect(row(page, 3)).toContainText("All things");
    await expect(row(page, 3)).not.toContainText("were");
    await button("Hide word").click();
    await expect(row(page, 3)).not.toContainText("All things");

    // Reveal verse shows the current verse; pressing it again goes on to the next, to the end.
    await button("Reveal verse").click();
    await expect(row(page, 3)).toContainText("All things were made through him");
    await button("Reveal verse").click();
    await expect.poll(() => vis(page, 4)).toBe("focused");
    await expect(row(page, 4)).toContainText("In him was life");
    // Reveal word carries on word by word, even from the end of one verse into the next.
    await button("Reveal verse").click();
    await button("Reveal verse").click();
    await expect.poll(() => vis(page, 6)).toBe("focused");
    await expect(button("Reveal word")).toBeDisabled();
    await expect(button("Reveal verse")).toBeDisabled();
    // Hide verse goes back the same way.
    await button("Hide verse").click();
    await expect(row(page, 6)).not.toContainText("There came a man");
    await button("Hide verse").click();
    await expect.poll(() => vis(page, 5)).toBe("focused");
    await expect(row(page, 5)).not.toContainText("The light shines");
  });

  test("Reveal word runs on from the last word of a verse to the first of the next", async ({
    page,
  }) => {
    await openSteps(page);
    await stepButton(page, "Recall").click();
    const button = (name: string) => page.getByRole("button", { name, exact: true });
    await button("Reveal verse").click();
    await button("Reveal word").click();
    await expect.poll(() => vis(page, 4)).toBe("focused");
    await expect(row(page, 4)).toContainText("In");
    await expect(row(page, 4)).not.toContainText("In him");
    await button("Hide word").click(); // hides "In" again
    await expect(row(page, 4)).not.toContainText("In");
    await button("Hide word").click(); // back into verse 3: its last word goes
    await expect.poll(() => vis(page, 3)).toBe("focused");
    await expect(row(page, 3)).toContainText("nothing was made that has been");
    await expect(row(page, 3)).not.toContainText("has been made.");
  });

  test("Recall always shows one verse at a time, and the view toggle is disabled", async ({
    page,
  }) => {
    await openSteps(page);
    await toggle(page).click(); // several verses in Listen
    expect(await vis(page, 4)).toBe("faded");
    await stepButton(page, "Recall").click();
    await expect.poll(() => vis(page, 4)).toBe("gone");
    expect(await vis(page, 3)).toBe("focused");
    await expect(toggle(page)).toBeDisabled();
    await stepButton(page, "Listen").click();
    await expect(toggle(page)).toBeEnabled();
    await expect.poll(() => vis(page, 4)).toBe("faded"); // the choice made in Listen is kept
  });

  test("Chain always shows the whole passage, hidden until revealed with the same buttons", async ({
    page,
  }) => {
    await openSteps(page);
    await stepButton(page, "Chain").click();
    for (const n of [3, 4, 5, 6]) expect(await vis(page, n)).toBe("plain");
    await expect(next(page)).toBeDisabled();
    await expect(toggle(page)).toBeDisabled();
    const button = (name: string) => page.getByRole("button", { name, exact: true });
    await expect(row(page, 6)).not.toContainText("There came a man");
    await expect(button("Hide word")).toBeDisabled();

    // Chain works through the passage from the first verse, however Recall left the focus.
    await button("Reveal word").click();
    await expect(row(page, 3)).toContainText("All");
    await expect(row(page, 3)).not.toContainText("All things");
    await button("Reveal verse").click();
    await expect(row(page, 3)).toContainText("All things were made through him");
    await expect(row(page, 4)).not.toContainText("In him");
    await button("Reveal verse").click();
    await expect(row(page, 4)).toContainText("In him was life");
    await button("Reveal verse").click();
    await button("Reveal verse").click();
    for (const [n, text] of [
      [5, "The light shines"],
      [6, "There came a man"],
    ] as const) {
      await expect(row(page, n)).toContainText(text);
    }
    await expect(button("Reveal verse")).toBeDisabled();
    // Hiding goes back from the end.
    await button("Hide verse").click();
    await expect(row(page, 6)).not.toContainText("There came a man");
    await expect(row(page, 5)).toContainText("The light shines");
    await button("Hide word").click();
    await expect(row(page, 5)).not.toContainText("overcome it.");
  });

  test("Listen and Sing never hide the text, and have no reveal buttons", async ({ page }) => {
    await openSteps(page);
    await expect(reveal(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reveal word" })).toHaveCount(0);
    await stepButton(page, "Sing").click();
    await expect(reveal(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reveal word" })).toHaveCount(0);
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
      "/memorize/range?p=john+1%3A3-6&from=steps&step=listen",
    );
  });
});

test.describe("memorize choice and Continue", () => {
  test("the choice page carries the passage to both methods", async ({ page }) => {
    await page.goto(`/memorize${PASSAGE}`);
    await streamed(page);
    await expect(page.getByRole("main").getByTestId("choice-passage")).toHaveText("John 1:3–6");
    await expect(
      page.getByRole("main").getByRole("link", { name: /Memorization Steps/ }),
    ).toHaveAttribute("href", "/memorize/steps?p=john+1%3A3-6");
    await expect(page.getByRole("link", { name: /Flashcards/ }).first()).toBeVisible();
  });

  test("without a passage the choice page sends you to choose verses", async ({ page }) => {
    await page.goto("/memorize");
    await streamed(page);
    await expect(
      page.getByRole("main").getByRole("link", { name: /Memorization Steps/ }),
    ).toHaveAttribute("href", "/memorize/range?from=steps");
  });

  test("the sidebar's Memorization Steps goes straight to choosing verses, then to Steps", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the sidebar is a desktop layout");
    await page.goto("/");
    await streamed(page);
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Memorize", exact: true })).toHaveCount(0);
    await nav.getByRole("link", { name: "Memorization Steps", exact: true }).click();
    await expect(page).toHaveURL(/\/memorize\/range\?from=steps/);
    await expect(page.getByRole("heading", { name: "Choose a Memorization Method" })).toHaveCount(
      0,
    );
    await expect(
      nav.getByRole("link", { name: "Memorization Steps", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("link", { name: "Select range" })).toHaveAttribute(
      "href",
      /^\/memorize\/steps\?p=/,
    );
  });

  test("the sidebar's Flashcards goes straight to choosing verses, then to the cards", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "the sidebar is a desktop layout");
    await page.goto("/");
    await streamed(page);
    const nav = page.getByRole("navigation", { name: "Main" });
    await nav.getByRole("link", { name: "Flashcards", exact: true }).click();
    await expect(page).toHaveURL(/\/memorize\/range\?from=flashcards/);
    await expect(nav.getByRole("link", { name: "Flashcards", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByRole("link", { name: "Select range" })).toHaveAttribute(
      "href",
      /^\/memorize\/flashcards\?p=/,
    );
  });

  test("Memorize in the reader is what leads to the method choice", async ({ page, isMobile }) => {
    test.skip(isMobile, "the right panel is a desktop layout");
    await page.goto("/read/john/1");
    await streamed(page);
    await page.getByRole("complementary").getByRole("link", { name: "Memorize" }).click();
    await expect(page.getByRole("heading", { name: "Choose a Memorization Method" })).toBeVisible();
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
    await page
      .getByRole("contentinfo", { name: "Player" })
      .getByRole("button", { name: "Previous verse" })
      .click();
    await expect.poll(() => vis(page, 2)).toBe("focused");
    await expect(row(page, 2)).toHaveAttribute("aria-current", "true");
  });
});
