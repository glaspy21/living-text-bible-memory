import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN_EMAIL } from "../../playwright.config";
import { TestDb } from "./db";
import { signInAs } from "./session";

// One shared recording and real audio, so these run once, in order, on desktop.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "playback tests run once, on desktop");

const db = new TestDb();
test.afterAll(() => db.cleanup());

const OBADIAH = 31; // one-chapter book nothing else in the tests touches
const SAMPLE_RATE = 8000;
const SECONDS = 12;

/** A 12-second 440 Hz tone as a WAV file: real audio the browser can play. */
function toneWav(): Buffer {
  const samples = SAMPLE_RATE * SECONDS;
  const data = Buffer.alloc(44 + samples * 2);
  data.write("RIFF", 0);
  data.writeUInt32LE(36 + samples * 2, 4);
  data.write("WAVE", 8);
  data.write("fmt ", 12);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20); // PCM
  data.writeUInt16LE(1, 22); // mono
  data.writeUInt32LE(SAMPLE_RATE, 24);
  data.writeUInt32LE(SAMPLE_RATE * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    data.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * 440 * i) / SAMPLE_RATE) * 8000),
      44 + i * 2,
    );
  }
  return data;
}

test.beforeAll(async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL });
  await signInAs(context, E2E_ADMIN_EMAIL);
  const api = context.request;
  const wav = toneWav();
  const requested = await api.post("/api/admin/uploads", {
    data: { mime: "audio/wav", bytes: wav.length },
  });
  const { key, upload } = await requested.json();
  await api.put(upload.url, { data: wav, headers: upload.headers });
  await api.post("/api/admin/uploads/complete", { data: { key, bytes: wav.length } });
  // Verses 1–3 of Obadiah are two seconds each; verses 4–21 have no music.
  await db.addPlayableRecording({
    storageKey: key,
    mime: "audio/wav",
    bytes: wav.length,
    durationMs: SECONDS * 1000,
    bookId: OBADIAH,
    chapter: 1,
    verses: [
      { verse: 1, startMs: 0, endMs: 2000 },
      { verse: 2, startMs: 2000, endMs: 4000 },
      { verse: 3, startMs: 4000, endMs: 6000 },
    ],
  });
  await context.close();
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
