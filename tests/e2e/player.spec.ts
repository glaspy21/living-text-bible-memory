import { expect, test, type Page } from "@playwright/test";
import { addToneRecording } from "./audio-fixture";
import { TestDb } from "./db";

// One shared recording and real audio, so these run once, in order, on desktop.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "playback tests run once, on desktop");

const db = new TestDb();
test.afterAll(() => db.cleanup());

const OBADIAH = 31; // one-chapter book nothing else in the tests touches
test.beforeAll(async ({ browser, baseURL }) => {
  // Verses 1–3 of Obadiah are two seconds each; verses 4–21 have no music.
  await addToneRecording(browser, baseURL, db, { bookId: OBADIAH, chapter: 1 });
});

const playButton = (page: Page) => page.getByRole("button", { name: "Play", exact: true });
const pauseButton = (page: Page) => page.getByRole("button", { name: "Pause", exact: true });
const verse = (page: Page, n: number) => page.locator(`[data-verse="${n}"]`);
const endModeButton = (page: Page) => page.getByRole("button", { name: /^When the verse ends:/ });

async function openObadiah(page: Page) {
  await page.goto("/read/obadiah/1");
  // The player knows about the music once it has looked it up.
  await expect(page.getByRole("button", { name: "Genre" })).toBeEnabled();
  await expect(page.getByRole("main").getByTestId("chapter-text")).toHaveAttribute(
    "data-interactive",
    "true",
  );
}

async function chooseEndMode(page: Page, label: string) {
  await endModeButton(page).click();
  await page.getByRole("menuitemradio", { name: label }).click();
}

test.describe("the player", () => {
  test("a chapter with no music says so and its controls are off", async ({ page }) => {
    await page.goto("/read/genesis/1");
    await expect(page.getByText("No recording yet")).toBeVisible();
    await expect(playButton(page)).toBeDisabled();
    await expect(page.getByRole("button", { name: "Genre" })).toBeDisabled();
  });

  test("music is found for a passage, and nothing plays by itself", async ({ page }) => {
    await openObadiah(page);
    await expect(playButton(page)).toBeEnabled();
    await expect(page.getByText("0:02")).toBeVisible(); // the first verse is two seconds long
    await verse(page, 2).click(); // selecting verses never starts audio
    await page.waitForTimeout(1200);
    await expect(playButton(page)).toBeVisible();
    await expect(page.locator("[data-playing]")).toHaveCount(0);
  });

  test("Next Verse is the reader's default: it plays on through the verses, then stops", async ({
    page,
  }) => {
    await openObadiah(page);
    await expect(endModeButton(page)).toHaveAccessibleName("When the verse ends: Next Verse");
    await playButton(page).click();
    await expect(verse(page, 1)).toHaveAttribute("data-playing", "true");
    await expect(verse(page, 2)).toHaveAttribute("data-playing", "true", { timeout: 6000 });
    await expect(verse(page, 3)).toHaveAttribute("data-playing", "true", { timeout: 6000 });
    // The last verse with music is the last thing played; verses 4–21 have none.
    await expect(playButton(page)).toBeVisible({ timeout: 6000 });
    await expect(page.locator("[data-playing]")).toHaveCount(0);
  });

  test("Stop After Verse pauses at the end of the verse and does not move on", async ({ page }) => {
    await openObadiah(page);
    await chooseEndMode(page, "Stop After Verse");
    await playButton(page).click();
    await expect(verse(page, 1)).toHaveAttribute("data-playing", "true");
    await expect(playButton(page)).toBeVisible({ timeout: 6000 });
    await page.waitForTimeout(800);
    await expect(playButton(page)).toBeVisible(); // still stopped
    await expect(verse(page, 2)).not.toHaveAttribute("data-playing", "true");
  });

  test("Loop Verse keeps repeating the verse", async ({ page }) => {
    await openObadiah(page);
    await chooseEndMode(page, "Loop Verse");
    await playButton(page).click();
    await expect(pauseButton(page)).toBeVisible();
    await page.waitForTimeout(5000); // well past the verse's two seconds
    await expect(pauseButton(page)).toBeVisible();
    await expect(verse(page, 1)).toHaveAttribute("data-playing", "true");
    await expect(verse(page, 2)).not.toHaveAttribute("data-playing", "true");
  });

  test("skip moves between verses with music while playing", async ({ page }) => {
    await openObadiah(page);
    await chooseEndMode(page, "Loop Verse");
    await playButton(page).click();
    await expect(verse(page, 1)).toHaveAttribute("data-playing", "true");
    await page.getByRole("button", { name: "Next verse" }).click();
    await expect(verse(page, 2)).toHaveAttribute("data-playing", "true");
    await page.getByRole("button", { name: "Next verse" }).click();
    await expect(verse(page, 3)).toHaveAttribute("data-playing", "true");
    await page.getByRole("button", { name: "Previous verse" }).click();
    await expect(verse(page, 2)).toHaveAttribute("data-playing", "true");
  });

  test("pausing stops the sound and the highlight", async ({ page }) => {
    await openObadiah(page);
    await chooseEndMode(page, "Loop Verse");
    await playButton(page).click();
    await expect(pauseButton(page)).toBeVisible();
    await pauseButton(page).click();
    await expect(playButton(page)).toBeVisible();
    await expect(page.locator("[data-playing]")).toHaveCount(0);
  });
});

test.describe("menus", () => {
  test("the end-mode menu has exactly the three modes, with the active one checked", async ({
    page,
  }) => {
    await openObadiah(page);
    await endModeButton(page).click();
    const items = page.getByRole("menuitemradio");
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toHaveText(/Loop Verse/);
    await expect(items.nth(1)).toHaveText(/Stop After Verse/);
    await expect(items.nth(2)).toHaveText(/Next Verse/);
    await expect(page.getByRole("menuitemradio", { name: "Next Verse" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await page.keyboard.press("Escape");
    await expect(items).toHaveCount(0);
  });

  test("the chosen end mode shows on the button and is remembered", async ({ page }) => {
    await openObadiah(page);
    await chooseEndMode(page, "Stop After Verse");
    await expect(endModeButton(page)).toHaveAccessibleName("When the verse ends: Stop After Verse");
    await page.reload();
    await expect(page.getByRole("button", { name: "Genre" })).toBeEnabled();
    await expect(endModeButton(page)).toHaveAccessibleName("When the verse ends: Stop After Verse");
  });

  test("the genre menu lists the genre, noting that only some verses have music", async ({
    page,
  }) => {
    await openObadiah(page);
    await page.getByRole("button", { name: "Genre" }).click();
    const pop = page.getByRole("menuitemradio", { name: /Pop/ });
    await expect(pop).toHaveAttribute("aria-checked", "true");
    await expect(pop).toContainText("Music for 3 of 21 verses");
  });
});
