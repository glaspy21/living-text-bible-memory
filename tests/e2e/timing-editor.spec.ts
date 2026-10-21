import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN_EMAIL } from "../../playwright.config";
import { addToneDraft, addToneRecording } from "./audio-fixture";
import { TestDb } from "./db";
import { streamed } from "./helpers";
import { signInAs } from "./session";

// Shares recordings in the test database, so run once, in order.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "admin is desktop-only");

// nothing else in the tests uses Malachi (the draft) or Zechariah
const ZECHARIAH = 38;
const db = new TestDb();

let draftId = "";
let publishedId = "";

test.beforeAll(async ({ browser, baseURL }) => {
  await db.removeRecordingsInBooks([39, ZECHARIAH]); // leftovers of an aborted run
  draftId = await addToneDraft(browser, baseURL, "malachi");
  await addToneRecording(browser, baseURL, db, { bookId: ZECHARIAH, chapter: 1 });
  publishedId = (await db.findRecordingIds([ZECHARIAH]))[ZECHARIAH];
});

test.afterAll(async () => {
  await db.removeRecording(draftId);
  await db.cleanup();
});

async function open(page: Page, id: string) {
  await page.goto(`/admin/timing?recording=${id}`);
  await streamed(page);
  await expect(page.getByTestId("timing-editor")).toBeVisible();
  await page.waitForFunction(() => document.querySelector("canvas") !== null);
}

const field = (page: Page, name: string) => page.getByRole("textbox", { name, exact: true });

async function commit(page: Page, name: string, value: string) {
  const input = field(page, name);
  await input.fill(value);
  await input.press("Enter");
}

async function waveformX(page: Page, ms: number, durationMs = 12000) {
  const box = (await page.getByTestId("timing-waveform").boundingBox())!;
  return { x: box.x + (ms / durationMs) * box.width, y: box.y + box.height / 2, box };
}

test.describe("timing editor", () => {
  test("shows every verse with its blank times, a waveform and the save state", async ({
    page,
    context,
  }) => {
    await signInAs(context, E2E_ADMIN_EMAIL);
    await open(page, draftId);
    await expect(page.getByTestId("timing-row")).toHaveCount(3);
    await expect(page.getByTestId("timing-progress")).toHaveText("0 of 3 verses timed");
    await expect(field(page, "1 start")).toHaveValue("");
    await expect(page.getByTestId("timing-save-status")).toContainText("saved");
    await expect(page.getByTestId("timing-waveform")).toBeVisible();
    await expect(page.getByTestId("timing-playhead")).toHaveText("0:00.000");
  });

  test("numeric entry autosaves, survives a reload and rejects bad times", async ({
    page,
    context,
  }) => {
    await signInAs(context, E2E_ADMIN_EMAIL);
    await open(page, draftId);
    await commit(page, "1 start", "0:01.250");
    await commit(page, "1 end", "3.5");
    await expect(page.getByTestId("timing-progress")).toHaveText("1 of 3 verses timed");
    await expect(field(page, "1 end")).toHaveValue("0:03.500");
    await expect(page.getByTestId("timing-save-status")).toContainText(/Saved/);
    await expect
      .poll(async () => (await db.timingRows(draftId))[0])
      .toMatchObject({ startMs: 1250, endMs: 3500, state: "DRAFT" });

    await commit(page, "2 start", "abc");
    await expect(field(page, "2 start")).toHaveAttribute("aria-invalid", "true");
    await expect(field(page, "2 start")).toHaveValue("");
    await commit(page, "2 start", "0:59");
    await expect(field(page, "2 start")).toHaveAttribute("aria-invalid", "true");
    expect((await db.timingRows(draftId))[1].startMs).toBeNull();

    await page.reload();
    await streamed(page);
    await expect(field(page, "1 start")).toHaveValue("0:01.250");
    await expect(field(page, "1 end")).toHaveValue("0:03.500");
  });

  test("the arrow keys nudge a time by 10 ms (100 ms with Shift)", async ({ page, context }) => {
    await signInAs(context, E2E_ADMIN_EMAIL);
    await open(page, draftId);
    const input = field(page, "1 start");
    await input.focus();
    await input.press("ArrowUp");
    await expect(input).toHaveValue("0:01.260");
    await input.press("Shift+ArrowDown");
    await expect(input).toHaveValue("0:01.160");
  });

  test("clicking the waveform moves the playhead and Mark sets the next boundary", async ({
    page,
    context,
  }) => {
    await signInAs(context, E2E_ADMIN_EMAIL);
    await open(page, draftId);
    await commit(page, "1 start", "");
    await commit(page, "1 end", "");
    const at = await waveformX(page, 6000);
    await page.mouse.click(at.x, at.y);
    const playhead = await page.getByTestId("timing-playhead").innerText();
    expect(playhead).toMatch(/^0:0[56]\./);
    // nothing is started, so the first mark starts verse 1
    await page.getByTestId("timing-mark").click();
    await expect(field(page, "1 start")).toHaveValue(playhead);
    await expect(field(page, "1 end")).toHaveValue("");
    // verse 1 is open, so the next mark ends it
    await page.getByTestId("timing-mark").click();
    await expect(field(page, "1 end")).toHaveValue(playhead);
    // and the one after starts verse 2
    await page.getByTestId("timing-mark").click();
    await expect(field(page, "2 start")).toHaveValue(playhead);
  });

  test("dragging a handle moves that boundary", async ({ page, context }) => {
    await signInAs(context, E2E_ADMIN_EMAIL);
    await open(page, draftId);
    await commit(page, "3 start", "0:08");
    await commit(page, "3 end", "0:10");
    const from = await waveformX(page, 10000);
    const to = await waveformX(page, 11000);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await page.mouse.up();
    const ms = await field(page, "3 end").inputValue();
    const seconds = Number(ms.split(":")[1]);
    expect(seconds).toBeGreaterThan(10.7);
    expect(seconds).toBeLessThan(11.3);
    await expect.poll(async () => (await db.timingRows(draftId))[2].endMs).toBeGreaterThan(10700);
  });

  test("zooming in lets you scroll along the recording; Fit shows it all", async ({
    page,
    context,
  }) => {
    await signInAs(context, E2E_ADMIN_EMAIL);
    await open(page, draftId);
    const scroll = page.getByTestId("timing-scroll");
    await expect(scroll).toBeDisabled();
    await page.getByTestId("zoom-in").click();
    await page.getByTestId("zoom-in").click();
    await expect(scroll).toBeEnabled();
    await scroll.fill("3000");
    await page.getByTestId("zoom-fit").click();
    await expect(scroll).toBeDisabled();
  });

  test("Preview plays a verse and stops where it ends", async ({ page, context }) => {
    await signInAs(context, E2E_ADMIN_EMAIL);
    await open(page, draftId);
    await commit(page, "1 start", "0:00.500");
    await commit(page, "1 end", "0:01.500");
    await page.getByRole("button", { name: "Preview 1" }).click();
    await expect(page.getByTestId("timing-play")).toHaveAttribute("aria-label", "Pause");
    await expect(page.getByTestId("timing-play")).toHaveAttribute("aria-label", "Play", {
      timeout: 6000,
    });
    const head = await page.getByTestId("timing-playhead").innerText();
    const seconds = Number(head.split(":")[1]);
    expect(seconds).toBeGreaterThanOrEqual(1.4);
    expect(seconds).toBeLessThan(2.3);
  });

  test("earlier sessions can be returned to", async ({ page, context }) => {
    await signInAs(context, E2E_ADMIN_EMAIL);
    await open(page, draftId);
    await page.getByTestId("sessions-open").click();
    await expect(page.getByTestId("sessions-list").getByRole("listitem").first()).toBeVisible();
    // Age the stored sessions so the next change becomes its own session.
    await commit(page, "1 end", "0:02");
    await expect.poll(async () => (await db.timingRows(draftId))[0].endMs).toBe(2000);
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "Return to this" }).last().click();
    await page.waitForLoadState("load");
    await streamed(page);
    // the session is one coherent earlier state; the editor reloads with it
    await expect(page.getByTestId("timing-editor")).toBeVisible();
  });

  test("a published recording is read-only until a new draft version is started", async ({
    page,
    context,
  }) => {
    await signInAs(context, E2E_ADMIN_EMAIL);
    await open(page, publishedId);
    await expect(page.getByTestId("published-notice")).toBeVisible();
    await expect(field(page, "1 start")).toBeDisabled();
    await expect(field(page, "1 start")).toHaveValue("0:00.000");

    await page.getByRole("button", { name: "Start a new draft version" }).click();
    await expect(page.getByTestId("published-notice")).toHaveCount(0);
    await expect(page.getByTestId("draft-notice")).toContainText("Draft version 2");
    await commit(page, "1 end", "0:01.111");
    await expect
      .poll(async () => (await db.timingRows(publishedId))[0])
      .toMatchObject({ endMs: 1111, state: "DRAFT", version: 2 });
  });

  test("the timing routes need an admin", async ({ playwright, baseURL, context }) => {
    const stranger = await playwright.request.newContext({ baseURL });
    for (const url of [
      `/api/admin/recordings/${draftId}/timing`,
      `/api/admin/recordings/${draftId}/timing/sessions`,
    ]) {
      expect((await stranger.get(url)).status()).toBe(401);
    }
    expect(
      (await stranger.put(`/api/admin/recordings/${draftId}/timing`, { data: {} })).status(),
    ).toBe(401);
    await stranger.dispose();
    await signInAs(context, "listener@example.test");
    expect((await context.request.get(`/api/admin/recordings/${draftId}/timing`)).status()).toBe(
      403,
    );
  });

  test("the timing page without a recording points to the library", async ({ page, context }) => {
    await signInAs(context, E2E_ADMIN_EMAIL);
    await page.goto("/admin/timing");
    await streamed(page);
    await expect(page.getByTestId("timing-pick")).toContainText("track library");
  });
});
