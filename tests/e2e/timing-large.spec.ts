import { expect, test } from "@playwright/test";
import { E2E_EDITOR_EMAIL } from "../../playwright.config";
import { addToneDraft } from "./audio-fixture";
import { TestDb } from "./db";
import { streamed } from "./helpers";
import { signInAs } from "./session";

/**
 * Psalm 119 has 176 verses: the largest chapter, so the largest timing sheet. The editor must
 * stay quick to open, edit and autosave, and its validation and preview lists must cope.
 */
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "admin is desktop-only");

const PSALMS = 19; // nothing else in the tests uses the Psalms
const db = new TestDb();
let id = "";

test.beforeAll(async ({ browser, baseURL }) => {
  await db.removeRecordingsInBooks([PSALMS]); // leftovers of an aborted run
  id = await addToneDraft(browser, baseURL, "psalms", { chapter: 119, verseEnd: 176 });
});

test.afterAll(async () => {
  await db.removeRecording(id);
  await db.cleanup();
});

test("a 176-verse sheet opens quickly, edits and autosaves, validates and previews", async ({
  page,
  context,
}) => {
  await signInAs(context, E2E_EDITOR_EMAIL);
  const api = context.request;

  // Time all 176 verses (12 s of audio, back to back, 60 ms each) through the API.
  const current = await (await api.get(`/api/admin/recordings/${id}/timing`)).json();
  expect(current.rows).toHaveLength(176);
  const saved = await api.put(`/api/admin/recordings/${id}/timing`, {
    data: {
      setId: current.draft.id,
      rows: current.rows.map((r: object, i: number) => ({
        ...r,
        startMs: i * 60,
        endMs: i * 60 + 60,
        ackGap: false,
        ackOverlap: false,
      })),
    },
  });
  expect(saved.status()).toBe(200);

  // Opening: the editor, the waveform and all rows are there within a few seconds.
  const opened = Date.now();
  await page.goto(`/admin/timing?recording=${id}`);
  await streamed(page);
  await expect(page.getByTestId("timing-row")).toHaveCount(176);
  await expect(page.getByTestId("timing-waveform")).toBeVisible();
  await expect(page.getByTestId("timing-progress")).toHaveText("176 of 176 verses timed");
  expect(Date.now() - opened).toBeLessThan(8000);

  // Every verse is contiguous, so validation is clean.
  await expect(page.getByTestId("validation-summary")).toContainText("Ready");

  // An edit near the end autosaves the whole sheet promptly.
  const last = page.getByRole("textbox", { name: "176 end", exact: true });
  await last.scrollIntoViewIfNeeded();
  const edited = Date.now();
  await last.fill("0:10.700");
  await last.press("Enter");
  await expect(page.getByTestId("timing-save-status")).toContainText(/Saved/, { timeout: 5000 });
  expect(Date.now() - edited).toBeLessThan(5000);
  await expect.poll(async () => (await db.timingRows(id))[175].endMs).toBe(10700);

  // Zooming right in and panning keeps the editor responsive (each redraw is per pixel column).
  for (let i = 0; i < 8; i++) await page.getByTestId("zoom-in").click();
  await page.getByTestId("timing-scroll").fill("5000");
  await expect(page.getByTestId("timing-waveform")).toBeVisible();
  const frame = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const t = performance.now();
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - t)));
      }),
  );
  expect(frame).toBeLessThan(500);

  // The preview and publish page lists all of them too.
  await page.goto(`/admin/publish?recording=${id}`);
  await streamed(page);
  await expect(page.getByTestId("preview-row")).toHaveCount(176);
});
