import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN_EMAIL } from "../../playwright.config";
import { toneWav } from "./audio-fixture";
import { TestDb } from "./db";
import { streamed } from "./helpers";
import { signInAs } from "./session";

// The wizard saves real recordings under the shared admin account, so run once, in order.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "admin is desktop-only");

const db = new TestDb();
test.afterAll(async () => {
  await db.removeRecordingsCreatedBy(E2E_ADMIN_EMAIL);
  await db.cleanup();
});

const BOOK = "Zephaniah"; // nothing else in the tests uses it

async function openUpload(page: Page, context: import("@playwright/test").BrowserContext) {
  await signInAs(context, E2E_ADMIN_EMAIL);
  await page.goto("/admin/upload");
  await streamed(page);
  await expect(page.getByTestId("upload-wizard")).toBeVisible();
}

const wavFile = () => ({ name: "zeph-pop.wav", mimeType: "audio/wav", buffer: toneWav() });

async function uploadTone(page: Page) {
  await page.getByLabel("Audio file").setInputFiles(wavFile());
  await expect(page.getByTestId("uploaded-name")).toHaveText("zeph-pop.wav");
}

async function fillAndSave(page: Page, over: { to?: string; genre?: string } = {}) {
  await page.getByLabel("Book").selectOption({ label: BOOK });
  await page.getByLabel("Chapter", { exact: true }).fill("1");
  await page.getByLabel("From verse").fill("1");
  await page.getByLabel("To verse").fill(over.to ?? "4");
  if (over.genre) {
    await page.getByLabel("Genre").selectOption("__custom__");
    await page.getByLabel("Custom genre name").fill(over.genre);
  }
  await page.getByRole("button", { name: /Save draft/ }).click();
}

test.describe("the upload wizard", () => {
  test("shows the workflow steps and a drop zone", async ({ page, context }) => {
    await openUpload(page, context);
    const steps = page.getByRole("list", { name: "Steps" });
    for (const label of [
      "Upload",
      "Metadata",
      "Verse timing",
      "Validation",
      "Preview",
      "Publish",
    ]) {
      await expect(steps.getByRole("listitem").filter({ hasText: label })).toBeVisible();
    }
    await expect(page.getByText("Drop an audio file")).toBeVisible();
    await expect(steps.locator("[aria-current=step]")).toHaveText(/Upload/);
  });

  test("refuses a file that isn't an MP3 or WAV", async ({ page, context }) => {
    await openUpload(page, context);
    await page.getByLabel("Audio file").setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello"),
    });
    await expect(page.getByTestId("upload-wizard").getByRole("alert")).toHaveText(
      "Only MP3 and WAV files can be uploaded.",
    );
    await expect(page.getByTestId("uploaded-name")).toHaveCount(0);
  });

  test("refuses a renamed fake: the server checks what the file really is", async ({
    page,
    context,
  }) => {
    await openUpload(page, context);
    await page.getByLabel("Audio file").setInputFiles({
      name: "song.mp3",
      mimeType: "audio/mpeg",
      buffer: Buffer.from("<!doctype html><script>alert(1)</script>"),
    });
    await expect(page.getByTestId("upload-wizard").getByRole("alert")).toContainText(
      "not a real MP3",
    );
  });

  test("uploads a WAV, reads its length and waveform, and asks what it sings", async ({
    page,
    context,
  }) => {
    await openUpload(page, context);
    await uploadTone(page);
    await expect(page.getByText(/0:12 · waveform ready/)).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Steps" }).locator("[aria-current=step]"),
    ).toHaveText(/Metadata/);
    await expect(page.getByText("never overwrite an existing recording")).toBeVisible();
  });

  test("saves a draft with a custom genre in Title Case and opens the timing step", async ({
    page,
    context,
  }) => {
    await openUpload(page, context);
    await uploadTone(page);
    await fillAndSave(page, { genre: "folk acoustic" });
    await expect(page).toHaveURL(/\/admin\/timing\?recording=/, { timeout: 30_000 });
    const saved = page.getByTestId("saved-recording");
    await expect(saved).toContainText("Zephaniah 1:1–4");
    await expect(saved).toContainText("Folk Acoustic");
    await expect(saved).toContainText("0:12");
    await expect(saved).toContainText("Draft");
  });

  test("a second recording of the same passage and genre becomes Default 2, never a replacement", async ({
    page,
    context,
  }) => {
    await openUpload(page, context);
    await uploadTone(page);
    await fillAndSave(page, { genre: "folk acoustic" });
    await expect(page.getByTestId("saved-recording")).toContainText("Default 2");
  });

  test("the waveform is stored for the timing editor, for admins only", async ({
    page,
    context,
    playwright,
    baseURL,
  }) => {
    await openUpload(page, context);
    await uploadTone(page);
    await fillAndSave(page);
    await expect(page).toHaveURL(/recording=/, { timeout: 30_000 });
    const id = new URL(page.url()).searchParams.get("recording")!;

    const peaks = await context.request.get(`/api/admin/recordings/${id}/peaks`);
    expect(peaks.status()).toBe(200);
    const values = await peaks.json();
    expect(values.length).toBeGreaterThan(100);
    expect(values.every((v: number) => v >= 0 && v <= 1)).toBe(true);

    const stranger = await playwright.request.newContext({ baseURL });
    expect((await stranger.get(`/api/admin/recordings/${id}/peaks`)).status()).toBe(401);
    await stranger.dispose();
  });

  test("shows problems with the passage before saving", async ({ page, context }) => {
    await openUpload(page, context);
    await uploadTone(page);
    await fillAndSave(page, { to: "99" });
    await expect(page.getByTestId("upload-wizard").getByRole("alert")).toContainText(
      "has verses 1–",
    );
    await expect(page).toHaveURL(/\/admin\/upload/);
  });

  test("the new recording is a draft: listeners cannot play it", async ({
    page,
    context,
    playwright,
    baseURL,
  }) => {
    await openUpload(page, context);
    await uploadTone(page);
    await fillAndSave(page);
    await expect(page).toHaveURL(/recording=/, { timeout: 30_000 });
    const assetId = await db.assetIdOfNewestRecordingBy(E2E_ADMIN_EMAIL);

    const listener = await playwright.request.newContext({ baseURL });
    expect((await listener.get(`/api/audio/${assetId}`)).status()).toBe(404);
    await listener.dispose();
    expect((await context.request.get(`/api/audio/${assetId}`)).status()).toBe(200);
  });
});

test.describe("the recording routes", () => {
  const body = {
    key: "recordings/abc12345-def/original.wav",
    translation: "WEB",
    book: "zephaniah",
    chapter: 1,
    verseStart: 1,
    endChapter: 1,
    verseEnd: 2,
    genre: { kind: "builtin", slug: "pop" },
  };

  test("signed-out visitors get 401, other accounts get 403", async ({
    playwright,
    baseURL,
    context,
  }) => {
    const stranger = await playwright.request.newContext({ baseURL });
    expect((await stranger.post("/api/admin/recordings", { data: body })).status()).toBe(401);
    await stranger.dispose();

    await signInAs(context, "listener@example.test");
    expect((await context.request.post("/api/admin/recordings", { data: body })).status()).toBe(
      403,
    );
  });

  test("a malformed request is a 400, and a file that was never uploaded is a 404", async ({
    context,
  }) => {
    await signInAs(context, E2E_ADMIN_EMAIL);
    const api = context.request;
    expect((await api.post("/api/admin/recordings", { data: { nonsense: true } })).status()).toBe(
      400,
    );
    expect((await api.post("/api/admin/recordings", { data: body })).status()).toBe(404);
  });
});
