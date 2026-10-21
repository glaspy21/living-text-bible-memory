import { expect, test } from "@playwright/test";
import { E2E_ADMIN_EMAIL } from "../../playwright.config";
import { addToneRecording, toneWav } from "./audio-fixture";
import { TestDb } from "./db";
import { streamed } from "./helpers";
import { signInAs } from "./session";

// These tests share recordings in the test database, so run once, in order.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "admin is desktop-only");

const MICAH = 33; // nothing else in the tests uses Micah or Haggai
const HAGGAI = 37;
const db = new TestDb();

let draftId = "";
let publishedId = "";

test.beforeAll(async ({ browser, baseURL }) => {
  // A draft with no timing, and a published recording (3 verses, 12 seconds, real file).
  const draftKey = `recordings/e2e-lib-${Date.now()}-aaaa/original.mp3`;
  await db.addRecording(draftKey, 10, "DRAFT", { bookId: MICAH, chapter: 1, verseEnd: 3 });
  await addToneRecording(browser, baseURL, db, { bookId: HAGGAI, chapter: 1, genre: "rock" });
  const found = await db.findRecordingIds([MICAH, HAGGAI]);
  draftId = found[MICAH];
  publishedId = found[HAGGAI];
});

test.afterAll(async () => {
  await db.cleanup();
});

test.describe("track library", () => {
  test("lists recordings with passage, genre and status, and filters by status", async ({
    page,
    context,
  }) => {
    await signInAs(context, E2E_ADMIN_EMAIL);
    await page.goto("/admin/library");
    await streamed(page);

    const draftRow = page.getByTestId("library-row").filter({ hasText: "Micah 1:1–3" });
    await expect(draftRow).toContainText("Pop");
    await expect(draftRow).toContainText("Draft");
    const publishedRow = page.getByTestId("library-row").filter({ hasText: "Haggai 1:1–3" });
    await expect(publishedRow).toContainText("Rock");
    await expect(publishedRow).toContainText("Published");
    await expect(publishedRow).toContainText("3 of 3 verses");
    await expect(publishedRow).toContainText("0:12");

    await page.getByRole("link", { name: "Published" }).click();
    await expect(page).toHaveURL(/status=published/);
    await expect(page.getByRole("link", { name: "Published" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByTestId("library-row").filter({ hasText: "Haggai 1:1–3" })).toBeVisible();
    await expect(page.getByTestId("library-row").filter({ hasText: "Micah 1:1–3" })).toHaveCount(0);

    await page.getByRole("link", { name: "Drafts" }).click();
    await expect(page.getByTestId("library-row").filter({ hasText: "Micah 1:1–3" })).toBeVisible();
    await expect(page.getByTestId("library-row").filter({ hasText: "Haggai 1:1–3" })).toHaveCount(
      0,
    );

    await page.getByRole("link", { name: "Ready for review" }).click();
    await expect(page.getByTestId("library-row").filter({ hasText: "Micah 1:1–3" })).toHaveCount(0);
  });

  test("an unknown filter shows everything", async ({ page, context }) => {
    await signInAs(context, E2E_ADMIN_EMAIL);
    await page.goto("/admin/library?status=nonsense");
    await streamed(page);
    await expect(page.getByRole("link", { name: "All" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByTestId("library-row").filter({ hasText: "Haggai 1:1–3" })).toBeVisible();
  });

  test("the Timing button opens the recording in the timing editor", async ({ page, context }) => {
    await signInAs(context, E2E_ADMIN_EMAIL);
    await page.goto("/admin/library");
    await streamed(page);
    await page
      .getByTestId("library-row")
      .filter({ hasText: "Micah 1:1–3" })
      .getByRole("link", { name: "Timing" })
      .click();
    await expect(page).toHaveURL(new RegExp(`recording=${draftId}`));
    await expect(page.getByTestId("saved-recording")).toContainText("Micah 1:1–3");
  });
});

test.describe("dashboard", () => {
  test("shows counts and what needs attention", async ({ page, context }) => {
    await signInAs(context, E2E_ADMIN_EMAIL);
    await page.goto("/admin");
    await streamed(page);

    const stats = page.getByTestId("stat");
    await expect(stats).toHaveCount(4);
    for (const label of ["Published", "Ready for review", "Drafts", "Passages with music"]) {
      await expect(stats.filter({ hasText: label })).toBeVisible();
    }
    const row = page.getByTestId("attention-row").filter({ hasText: "Micah 1:1–3" });
    await expect(row).toContainText("Verse timing not started");
    await row.getByRole("link", { name: "Open editor" }).click();
    await expect(page).toHaveURL(new RegExp(`recording=${draftId}`));

    // The fully timed, published recording needs nothing.
    await page.goto("/admin");
    await streamed(page);
    await expect(page.getByTestId("attention-row").filter({ hasText: "Haggai 1:1–3" })).toHaveCount(
      0,
    );
  });
});

test.describe("replacing audio", () => {
  test("a published recording keeps playing its old audio until the new draft is published", async ({
    page,
    context,
    playwright,
  }) => {
    const oldAssetId = await db.currentAssetId(publishedId);
    await signInAs(context, E2E_ADMIN_EMAIL);
    await page.goto("/admin/library");
    await streamed(page);

    page.once("dialog", (dialog) => {
      expect(dialog.message()).toContain("Listeners keep hearing the current audio");
      void dialog.accept();
    });
    const row = page.getByTestId("library-row").filter({ hasText: "Haggai 1:1–3" });
    const wav = toneWav();
    await row
      .getByLabel("Choose replacement audio")
      .setInputFiles({ name: "new-take.wav", mimeType: "audio/wav", buffer: wav });

    await expect(page).toHaveURL(new RegExp(`/admin/timing\\?recording=${publishedId}`));
    const newAssetId = await db.currentAssetId(publishedId);
    expect(newAssetId).not.toBe(oldAssetId);

    // Listeners still get the old audio; the new audio is private to admins.
    const baseURL = test.info().project.use.baseURL;
    const listener = await playwright.request.newContext({ baseURL });
    expect((await listener.get(`/api/audio/${oldAssetId}`)).status()).toBe(200);
    expect((await listener.get(`/api/audio/${newAssetId}`)).status()).toBe(404);
    const playback = await (
      await listener.get(`/api/playback?p=${encodeURIComponent("haggai 1:1-3")}`)
    ).json();
    expect(JSON.stringify(playback)).toContain(oldAssetId);
    expect(JSON.stringify(playback)).not.toContain(newAssetId);
    await listener.dispose();
    expect((await context.request.get(`/api/audio/${newAssetId}`)).status()).toBe(200);

    // The library now flags the new draft.
    await page.goto("/admin/library");
    await streamed(page);
    const after = page.getByTestId("library-row").filter({ hasText: "Haggai 1:1–3" });
    await expect(after).toContainText("Published");
    await expect(after).toContainText("New draft waiting");
  });

  test("a file that is not audio is refused and nothing changes", async ({ page, context }) => {
    const before = await db.currentAssetId(publishedId);
    await signInAs(context, E2E_ADMIN_EMAIL);
    await page.goto("/admin/library");
    await streamed(page);
    page.once("dialog", (dialog) => void dialog.accept());
    const row = page.getByTestId("library-row").filter({ hasText: "Haggai 1:1–3" });
    await row.getByLabel("Choose replacement audio").setInputFiles({
      name: "fake.mp3",
      mimeType: "audio/mpeg",
      buffer: Buffer.from("<!doctype html><p>not audio</p>"),
    });
    await expect(row.getByRole("alert")).toBeVisible();
    expect(await db.currentAssetId(publishedId)).toBe(before);
  });
});

test.describe("who may replace audio", () => {
  test("signed-out visitors and non-admins are refused", async ({ request, context }) => {
    const body = { key: "recordings/x-aaaa/original.wav" };
    expect(
      (await request.post(`/api/admin/recordings/${publishedId}/audio`, { data: body })).status(),
    ).toBe(401);
    await signInAs(context, "someone-else@example.test");
    expect(
      (
        await context.request.post(`/api/admin/recordings/${publishedId}/audio`, { data: body })
      ).status(),
    ).toBe(403);
  });
});
