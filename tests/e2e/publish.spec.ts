import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { E2E_EDITOR_EMAIL } from "../../playwright.config";
import { addToneDraft } from "./audio-fixture";
import { TestDb } from "./db";
import { streamed } from "./helpers";
import { signInAs } from "./session";

// Shares recordings in the test database, so run once, in order.
test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "admin is desktop-only");

const JONAH = 32; // nothing else in the tests uses Jonah's music
const db = new TestDb();
let id = "";

test.beforeAll(async ({ browser, baseURL }) => {
  await db.removeRecordingsInBooks([JONAH]); // leftovers of an aborted run
  id = await addToneDraft(browser, baseURL, "jonah");
});

test.afterAll(async () => {
  await db.removeRecording(id);
  await db.cleanup();
});

async function openPublish(page: Page) {
  await page.goto(`/admin/publish?recording=${id}`);
  await streamed(page);
  await expect(page.getByTestId("publish-panel")).toBeVisible();
}

async function setTiming(api: APIRequestContext, rows: [number, number][]) {
  const current = await (await api.get(`/api/admin/recordings/${id}/timing`)).json();
  const response = await api.put(`/api/admin/recordings/${id}/timing`, {
    data: {
      setId: current.draft.id,
      rows: current.rows.map((r: object, i: number) => ({
        ...r,
        startMs: rows[i][0],
        endMs: rows[i][1],
        ackGap: false,
        ackOverlap: false,
      })),
    },
  });
  expect(response.status()).toBe(200);
}

const playbackHas = async (api: APIRequestContext) => {
  const body = await (await api.get("/api/playback?p=jonah 1:1-3")).json();
  return (body.recordings as { id: string }[]).some((r) => r.id === id);
};

test.describe("validation, preview and publish", () => {
  test("a draft with blank timing lists what is missing and cannot be marked ready", async ({
    page,
    context,
  }) => {
    await signInAs(context, E2E_EDITOR_EMAIL);
    await openPublish(page);
    await expect(page.getByTestId("publish-recording")).toContainText("Draft");
    await expect(page.getByTestId("validation-errors")).toContainText("Verse 1 has no start time.");
    await expect(page.getByTestId("validation-summary")).toContainText("to fix");
    await expect(page.getByTestId("mark-ready")).toBeDisabled();
    await expect(page.getByTestId("publish")).toHaveCount(0);
  });

  test("gaps must be acknowledged, one by one or all at once, in the timing editor", async ({
    page,
    context,
  }) => {
    await signInAs(context, E2E_EDITOR_EMAIL);
    await setTiming(context.request, [
      [0, 3000],
      [3500, 6500], // gap of 0.50 s after verse 1
      [6000, 9000], // overlap of 0.50 s with verse 2
    ]);
    await page.goto(`/admin/timing?recording=${id}`);
    await streamed(page);
    const warnings = page.getByTestId("validation-warnings");
    await expect(warnings).toContainText("0.50 s of silence between verse 1 and verse 2.");
    await expect(warnings).toContainText("Verse 2 and verse 3 overlap by 0.50 s.");
    await expect(page.getByTestId("validation-summary")).toContainText("2 to review");

    // the Publish page agrees and blocks
    await openPublish(page);
    await expect(page.getByTestId("mark-ready")).toBeDisabled();

    await page.goto(`/admin/timing?recording=${id}`);
    await streamed(page);
    await page.getByRole("checkbox", { name: /silence between verse 1/ }).check();
    await expect(page.getByTestId("validation-summary")).toContainText("1 to review");
    await page.getByTestId("ack-all-overlaps").click();
    await expect(page.getByTestId("validation-summary")).toContainText("Ready");
    await expect.poll(async () => (await db.timingRows(id))[0]).toBeTruthy();

    // moving a boundary next to an acknowledged gap asks again
    const startOfTwo = page.getByRole("textbox", { name: "2 start", exact: true });
    await startOfTwo.fill("0:03.600");
    await startOfTwo.press("Enter");
    await expect(page.getByTestId("validation-summary")).toContainText("1 to review");
  });

  test("a time outside or reversed is an error that cannot be acknowledged", async ({
    page,
    context,
  }) => {
    await signInAs(context, E2E_EDITOR_EMAIL);
    await setTiming(context.request, [
      [0, 3000],
      [5000, 4000],
      [6000, 9000],
    ]);
    await page.goto(`/admin/timing?recording=${id}`);
    await streamed(page);
    await expect(page.getByTestId("validation-errors")).toContainText(
      "Verse 2 ends at or before it starts.",
    );
    // the server refuses too, whatever the browser says
    const response = await context.request.post(`/api/admin/recordings/${id}/status`, {
      data: { action: "ready" },
    });
    expect(response.status()).toBe(422);
    expect((await response.json()).validation.errors[0].kind).toBe("end-not-after-start");
  });

  test("Mark ready, Back to draft, Ready again, then Publish makes the music available to listeners", async ({
    page,
    context,
    baseURL,
    playwright,
  }) => {
    await signInAs(context, E2E_EDITOR_EMAIL);
    await setTiming(context.request, [
      [0, 3000],
      [3000, 6000],
      [6000, 9000],
    ]);
    await openPublish(page);
    await expect(page.getByTestId("validation-summary")).toContainText("Ready");
    expect(await playbackHas(context.request)).toBe(false);

    await page.getByTestId("mark-ready").click();
    await expect(page.getByTestId("publish-message")).toHaveText("Marked ready for review.");
    await expect(page.getByTestId("publish-recording")).toContainText("Ready");
    expect(await db.recordingStatus(id)).toBe("READY");

    await page.getByTestId("back-to-draft").click();
    await expect(page.getByTestId("publish-recording")).toContainText("Draft");
    await page.getByTestId("mark-ready").click();
    await expect(page.getByTestId("publish")).toBeVisible();

    page.once("dialog", (d) => void d.accept());
    await page.getByTestId("publish").click();
    await expect(page.getByTestId("publish-message")).toHaveText(
      "Published. Listeners now hear this timing.",
    );
    await expect(page.getByTestId("publish-recording")).toContainText("Published");
    expect(await db.recordingStatus(id)).toBe("PUBLISHED");
    expect(await playbackHas(context.request)).toBe(true);
    // a stranger (no session) can see it too: published music is public
    const stranger = await playwright.request.newContext({ baseURL });
    expect(await playbackHas(stranger)).toBe(true);
    await stranger.dispose();
  });

  test("Preview plays one verse and stops at its end", async ({ page, context }) => {
    await signInAs(context, E2E_EDITOR_EMAIL);
    await openPublish(page);
    const row = page.getByTestId("preview-row").nth(0);
    await row.getByRole("button", { name: "Play verse 1" }).click();
    await expect(row).toHaveAttribute("data-playing", "true");
    await expect(row).toHaveAttribute("data-playing", "false", { timeout: 8000 });
  });

  test("Play all goes through the verses in order and then stops", async ({ page, context }) => {
    await signInAs(context, E2E_EDITOR_EMAIL);
    await openPublish(page);
    await page.getByTestId("preview-all").click();
    await expect(page.getByTestId("preview-row").nth(1)).toHaveAttribute("data-playing", "true", {
      timeout: 6000,
    });
    await expect(page.getByTestId("preview-all")).toBeVisible({ timeout: 12000 });
  });

  test("a published recording: editing starts a new draft; publishing it replaces the live timing", async ({
    page,
    context,
  }) => {
    await signInAs(context, E2E_EDITOR_EMAIL);
    await openPublish(page);
    await expect(page.getByTestId("publish-help")).toContainText("This timing is live");
    await expect(page.getByTestId("publish")).toHaveCount(0);

    await page.getByTestId("edit-timing").click();
    await streamed(page);
    await page.getByRole("button", { name: "Start a new draft version" }).click();
    const endOfThree = page.getByRole("textbox", { name: "3 end", exact: true });
    await expect(endOfThree).toBeEnabled();
    await endOfThree.fill("0:10");
    await endOfThree.press("Enter");
    await expect.poll(async () => (await db.timingRows(id))[2].endMs).toBe(10000);

    // live timing is untouched while the draft is waiting
    const live = await (await context.request.get("/api/playback?p=jonah 1:1-3")).json();
    const mine = live.recordings.find((r: { id: string }) => r.id === id);
    expect(mine.verses.find((v: { verse: number }) => v.verse === 3).endMs).toBe(9000);

    await page.getByTestId("to-publish").click();
    await streamed(page);
    await expect(page.getByTestId("publish-recording")).toContainText("Published");
    await expect(page.getByTestId("publish-help")).toContainText("Draft version 2 is waiting");
    page.once("dialog", (d) => void d.accept());
    await page.getByTestId("publish").click();
    await expect(page.getByTestId("publish-message")).toContainText("Published");
    await expect(page.getByTestId("publish-help")).toContainText("This timing is live");

    const after = await (await context.request.get("/api/playback?p=jonah 1:1-3")).json();
    const now = after.recordings.find((r: { id: string }) => r.id === id);
    expect(now.verses.find((v: { verse: number }) => v.verse === 3).endMs).toBe(10000);
  });

  test("the library and the pick list reflect the status", async ({ page, context }) => {
    await signInAs(context, E2E_EDITOR_EMAIL);
    await page.goto("/admin/library?status=published");
    await streamed(page);
    await expect(page.getByTestId("library-row").filter({ hasText: "Jonah 1:1–3" })).toContainText(
      "Published",
    );
    await page.goto("/admin/publish");
    await streamed(page);
    await expect(page.getByTestId("publish-pick")).toBeVisible();
  });

  test("the status route needs an admin", async ({ playwright, baseURL, context }) => {
    const stranger = await playwright.request.newContext({ baseURL });
    expect(
      (
        await stranger.post(`/api/admin/recordings/${id}/status`, { data: { action: "publish" } })
      ).status(),
    ).toBe(401);
    await stranger.dispose();
    await signInAs(context, "listener@example.test");
    expect(
      (
        await context.request.post(`/api/admin/recordings/${id}/status`, {
          data: { action: "publish" },
        })
      ).status(),
    ).toBe(403);
    await signInAs(context, E2E_EDITOR_EMAIL);
    expect(
      (
        await context.request.post(`/api/admin/recordings/${id}/status`, {
          data: { action: "nope" },
        })
      ).status(),
    ).toBe(400);
  });
});
