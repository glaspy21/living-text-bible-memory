import { expect, test, type Page } from "@playwright/test";
import { E2E_EDITOR_EMAIL } from "../../playwright.config";
import { toneWav } from "./audio-fixture";
import { TestDb } from "./db";
import { streamed } from "./helpers";
import { signInAs } from "./session";

/**
 * The whole product in one pass, through the real screens: an administrator uploads a recording,
 * times its verses, validates, previews and publishes it; then a listener (no account) plays it
 * and the audio starts, stops and moves on at the verse boundaries that were set.
 */
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "the journey runs once, on desktop");

const db = new TestDb();
const BOOK = "Lamentations"; // nothing else in the tests uses it
let recordingId = "";

test.afterAll(async () => {
  if (recordingId) await db.removeRecording(recordingId);
  await db.cleanup();
});

/** Verse boundaries the administrator sets: 2.5 seconds each, back to back. */
const TIMES: [string, string][] = [
  ["0:00", "0:02.500"],
  ["0:02.500", "0:05"],
  ["0:05", "0:07.500"],
  ["0:07.500", "0:10"],
];
const START_MS = [0, 2500, 5000, 7500];
const END_MS = [2500, 5000, 7500, 10000];

test("an administrator uploads, times, validates, previews and publishes a recording", async ({
  page,
  context,
}) => {
  await signInAs(context, E2E_EDITOR_EMAIL);
  await page.goto("/admin/upload");
  await streamed(page);

  // Upload → Metadata
  await page
    .getByLabel("Audio file")
    .setInputFiles({ name: "lam.wav", mimeType: "audio/wav", buffer: toneWav() });
  await expect(page.getByText(/0:12 · waveform ready/)).toBeVisible();
  await page.getByLabel("Book").selectOption({ label: BOOK });
  await page.getByLabel("Chapter", { exact: true }).fill("1");
  await page.getByLabel("From verse").fill("1");
  await page.getByLabel("To verse").fill("4");
  await page.getByRole("button", { name: /Save draft/ }).click();
  await expect(page).toHaveURL(/\/admin\/timing\?recording=/, { timeout: 30_000 });
  recordingId = new URL(page.url()).searchParams.get("recording")!;
  await streamed(page);

  // Verse timing (typed; the editor autosaves)
  for (const [i, [start, end]] of TIMES.entries()) {
    const s = page.getByRole("textbox", { name: `${i + 1} start`, exact: true });
    await s.fill(start);
    await s.press("Enter");
    const e = page.getByRole("textbox", { name: `${i + 1} end`, exact: true });
    await e.fill(end);
    await e.press("Enter");
  }
  await expect(page.getByTestId("timing-progress")).toHaveText("4 of 4 verses timed");
  await expect(page.getByTestId("timing-save-status")).toContainText(/Saved/);
  await expect(page.getByTestId("validation-summary")).toContainText("Ready");
  await expect
    .poll(async () => (await db.timingRows(recordingId)).map((r) => [r.startMs, r.endMs]))
    .toEqual(START_MS.map((s, i) => [s, END_MS[i]]));

  // Validation → Preview → Publish
  await page.getByTestId("to-publish").click();
  await streamed(page);
  await expect(page.getByTestId("publish-recording")).toContainText("Lamentations 1:1–4");
  await page.getByRole("button", { name: "Play verse 2" }).click();
  await expect(page.getByTestId("preview-row").nth(1)).toHaveAttribute("data-playing", "true");
  await expect(page.getByTestId("preview-row").nth(1)).toHaveAttribute("data-playing", "false", {
    timeout: 8000,
  });
  await page.getByTestId("mark-ready").click();
  await expect(page.getByTestId("publish")).toBeVisible();
  page.once("dialog", (d) => void d.accept());
  await page.getByTestId("publish").click();
  await expect(page.getByTestId("publish-recording")).toContainText("Published");
});

/** Records every audio element the player plays, so the test can read where it really is. */
async function trackAudio(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __audio?: HTMLMediaElement };
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      w.__audio = this;
      return play.call(this);
    };
  });
}
const audioMs = (page: Page) =>
  page.evaluate(() => {
    const el = (window as unknown as { __audio?: HTMLMediaElement }).__audio;
    return el ? Math.round(el.currentTime * 1000) : -1;
  });

test.describe("a listener hears it, verse-accurately", () => {
  test.beforeEach(async ({ page }) => {
    await trackAudio(page);
    await page.addInitScript(() => localStorage.removeItem("lt.endmode.v1"));
    await page.goto("/read/lamentations/1");
    await streamed(page);
    await expect(page.getByRole("button", { name: "Genre" })).toBeEnabled();
  });

  test("Stop After Verse stops at the end of the verse that was set", async ({ page }) => {
    await page.getByRole("button", { name: /^When the verse ends:/ }).click();
    await page.getByRole("menuitemradio", { name: "Stop After Verse" }).click();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.locator('[data-verse="1"]').first()).toHaveAttribute("data-playing", "true");
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible({
      timeout: 6000,
    });
    const stoppedAt = await audioMs(page);
    expect(stoppedAt).toBeGreaterThanOrEqual(END_MS[0] - 60);
    expect(stoppedAt).toBeLessThanOrEqual(END_MS[0] + 250);
  });

  test("skipping while playing lands on the start of each verse", async ({ page }) => {
    await page.getByRole("button", { name: /^When the verse ends:/ }).click();
    await page.getByRole("menuitemradio", { name: "Loop Verse" }).click();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.locator('[data-verse="1"]').first()).toHaveAttribute("data-playing", "true");
    for (const n of [2, 3, 4]) {
      await page.getByRole("button", { name: "Next verse", exact: true }).click();
      await expect(page.locator(`[data-verse="${n}"]`).first()).toHaveAttribute(
        "data-playing",
        "true",
      );
      await page.waitForTimeout(250);
      const at = await audioMs(page);
      expect(at).toBeGreaterThanOrEqual(START_MS[n - 1] - 60);
      expect(at).toBeLessThanOrEqual(START_MS[n - 1] + 700);
    }
    // and back
    await page.getByRole("button", { name: "Previous verse", exact: true }).click();
    await expect(page.locator('[data-verse="3"]').first()).toHaveAttribute("data-playing", "true");
    await page.waitForTimeout(250);
    const back = await audioMs(page);
    expect(back).toBeGreaterThanOrEqual(START_MS[2] - 60);
    expect(back).toBeLessThanOrEqual(START_MS[2] + 700);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
  });

  test("Loop Verse comes back to the start of the verse", async ({ page }) => {
    await page.getByRole("button", { name: /^When the verse ends:/ }).click();
    await page.getByRole("menuitemradio", { name: "Loop Verse" }).click();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.locator('[data-verse="1"]').first()).toHaveAttribute("data-playing", "true");
    // watch the position pass the verse end (2.5 s) and come back below it
    await page.waitForFunction(
      () => {
        const el = (window as unknown as { __audio?: HTMLMediaElement }).__audio;
        const w = window as unknown as { __peak?: number; __wrapped?: boolean };
        if (!el) return false;
        const ms = el.currentTime * 1000;
        w.__peak = Math.max(w.__peak ?? 0, ms);
        if ((w.__peak ?? 0) > 2300 && ms < 600) w.__wrapped = true;
        return w.__wrapped === true;
      },
      undefined,
      { timeout: 10_000, polling: 30 },
    );
    expect(await audioMs(page)).toBeLessThan(2500);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
  });

  test("Next Verse plays on through the verses with music and stops after the last", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /^When the verse ends:/ }).click();
    await page.getByRole("menuitemradio", { name: "Next Verse" }).click();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    for (const n of [1, 2, 3, 4]) {
      await expect(page.locator(`[data-verse="${n}"]`).first()).toHaveAttribute(
        "data-playing",
        "true",
        { timeout: 6000 },
      );
    }
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible({
      timeout: 6000,
    });
    // verses 5–22 have no music: the music ends with verse 4, at its end
    const at = await audioMs(page);
    expect(at).toBeGreaterThanOrEqual(END_MS[3] - 60);
    expect(at).toBeLessThanOrEqual(END_MS[3] + 250);
  });

  test("a verse past the music has none, and the published timing survives a reload", async ({
    page,
  }) => {
    await page.reload();
    await streamed(page);
    await expect(page.getByRole("button", { name: "Genre" })).toBeEnabled();
    await page.getByRole("button", { name: "Genre" }).click();
    await expect(page.getByRole("menuitemradio", { name: /^Pop/ })).toContainText(
      "Music for 4 of 22 verses",
    );
  });
});
