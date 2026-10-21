import { expect, test, type Page } from "@playwright/test";
import { addToneRecording } from "./audio-fixture";
import { TestDb } from "./db";
import { streamed } from "./helpers";

// Shared recordings and real audio: run once, in order, on desktop.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "music selection tests run once, on desktop");

const db = new TestDb();
const JOEL = 29; // nothing else in the tests uses Joel's music

test.beforeAll(async ({ browser, baseURL }) => {
  await db.removeRecordingsInBooks([JOEL]); // leftovers of an aborted run
  // Pop: "Default" (verses 1–3, two seconds each) and "Default 2" (verse 1 only, five seconds).
  await addToneRecording(browser, baseURL, db, { bookId: JOEL, chapter: 1, genre: "pop" });
  await addToneRecording(browser, baseURL, db, {
    bookId: JOEL,
    chapter: 1,
    genre: "pop",
    arrangementNo: 2,
    verses: [{ verse: 1, startMs: 0, endMs: 5000 }],
  });
  // Rock: one version covering all three verses (three seconds each).
  await addToneRecording(browser, baseURL, db, {
    bookId: JOEL,
    chapter: 1,
    genre: "rock",
    verses: [
      { verse: 1, startMs: 0, endMs: 3000 },
      { verse: 2, startMs: 3000, endMs: 6000 },
      { verse: 3, startMs: 6000, endMs: 9000 },
    ],
  });
});

test.afterAll(async () => {
  await db.cleanup();
});

const genreButton = (page: Page) => page.getByRole("button", { name: "Genre" });

async function openJoel(page: Page) {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem("lt.genre.v1");
    } catch {
      /* private mode */
    }
  });
  await page.goto("/read/joel/1");
  await streamed(page);
  await expect(genreButton(page)).toBeEnabled();
}

test.describe("choosing the genre and the version", () => {
  test("the genre menu lists the genres, and the version section appears only when there is more than one", async ({
    page,
  }) => {
    await openJoel(page);
    await genreButton(page).click();
    await expect(page.getByRole("menuitemradio", { name: /^Pop/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.getByRole("menuitemradio", { name: /^Rock/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    // Pop has two versions: both are offered, and "Default" is the one in use.
    const options = page.getByTestId("arrangement-option");
    await expect(options).toHaveText([/^Default/, /^Default 2/]);
    await expect(options.nth(0)).toHaveAttribute("aria-checked", "true");
    await expect(options.nth(1)).toContainText("Music for 1 of 20 verses");

    // Rock has a single version, so there is nothing to choose.
    await page.getByRole("menuitemradio", { name: /^Rock/ }).click();
    await genreButton(page).click();
    await expect(page.getByTestId("arrangement-option")).toHaveCount(0);
  });

  test("choosing Default 2 plays that recording for the verses it covers, and the first one for the rest", async ({
    page,
  }) => {
    await openJoel(page);
    // verse 1 of "Default" is two seconds long
    await expect(page.getByText("0:02")).toBeVisible();
    await genreButton(page).click();
    await page.getByTestId("arrangement-option").nth(1).click();
    // verse 1 now comes from "Default 2" (five seconds); verse 2 still has music, from "Default"
    await expect(page.getByText("0:05")).toBeVisible();
    await page.getByRole("button", { name: "Next verse", exact: true }).click();
    await expect(page.getByText("0:02")).toBeVisible();
    // the choice is shown as checked
    await genreButton(page).click();
    await expect(page.getByTestId("arrangement-option").nth(1)).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("switching genre keeps the verse; going back to Pop starts on its first version again", async ({
    page,
  }) => {
    await openJoel(page);
    await page.getByRole("button", { name: "Next verse", exact: true }).click(); // verse 2
    await genreButton(page).click();
    await page.getByRole("menuitemradio", { name: /^Rock/ }).click();
    await expect(page.getByText("0:03")).toBeVisible(); // rock verse 2 is three seconds
    await genreButton(page).click();
    await page.getByRole("menuitemradio", { name: /^Pop/ }).click();
    await genreButton(page).click();
    await expect(page.getByTestId("arrangement-option").nth(0)).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("a version never starts playing by itself", async ({ page }) => {
    await openJoel(page);
    await genreButton(page).click();
    await page.getByTestId("arrangement-option").nth(1).click();
    await page.waitForTimeout(800);
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
    await expect(page.locator("[data-playing]")).toHaveCount(0);
  });

  test("while playing, changing the version keeps playing the same verse", async ({ page }) => {
    await openJoel(page);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.locator('[data-verse="1"]').first()).toHaveAttribute("data-playing", "true");
    await genreButton(page).click();
    await page.getByTestId("arrangement-option").nth(1).click();
    await expect(page.locator('[data-verse="1"]').first()).toHaveAttribute("data-playing", "true");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
  });

  test("while playing, changing the genre keeps playing the same verse too", async ({ page }) => {
    await openJoel(page);
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.locator('[data-verse="1"]').first()).toHaveAttribute("data-playing", "true");
    await genreButton(page).click();
    await page.getByRole("menuitemradio", { name: /^Rock/ }).click();
    await expect(page.locator('[data-verse="1"]').first()).toHaveAttribute("data-playing", "true");
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Pause", exact: true }).click();
  });

  test("the Steps panel names the version being used", async ({ page }) => {
    await openJoel(page);
    await page.goto("/memorize/steps?p=joel 1:1-3&step=listen");
    await streamed(page);
    await expect(page.getByTestId("panel-genre")).toHaveText("Pop · Default");
    await genreButton(page).click();
    await page.getByTestId("arrangement-option").nth(1).click();
    await expect(page.getByTestId("panel-genre")).toHaveText("Pop · Default 2");
    await genreButton(page).click();
    await page.getByRole("menuitemradio", { name: /^Rock/ }).click();
    await expect(page.getByTestId("panel-genre")).toHaveText("Rock");
  });

  test("a passage with no music says so and still reads", async ({ page }) => {
    await page.goto("/read/joel/2");
    await streamed(page);
    await expect(page.getByTestId("chapter-text").first()).toBeVisible();
    await expect(genreButton(page)).toBeDisabled();
    await page.goto("/memorize/steps?p=joel 2:1-3&step=listen");
    await streamed(page);
    await expect(page.getByTestId("panel-genre")).toHaveText("No recording yet");
  });
});
