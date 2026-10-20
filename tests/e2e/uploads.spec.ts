import { expect, test, type APIRequestContext } from "@playwright/test";
import { E2E_ADMIN_EMAIL } from "../../playwright.config";
import { TestDb } from "./db";
import { signInAs } from "./session";

test.skip(({ isMobile }) => isMobile, "API tests run once, on desktop");

const db = new TestDb();

/** A small file that starts like a real MP3 (an ID3 tag) so it passes the content check. */
function fakeMp3(length = 4000): Buffer {
  const data = Buffer.alloc(length);
  data.write("ID3", 0);
  for (let i = 10; i < length; i++) data[i] = i % 251;
  return data;
}

async function requestUpload(api: APIRequestContext, mime: string, bytes: number) {
  return api.post("/api/admin/uploads", { data: { mime, bytes } });
}

/** Run the browser's two steps: ask for a target, send the file to it. */
async function uploadFile(api: APIRequestContext, data: Buffer, mime = "audio/mpeg") {
  const requested = await requestUpload(api, mime, data.length);
  expect(requested.status()).toBe(200);
  const { key, upload } = await requested.json();
  const sent = await api.put(upload.url, { data, headers: upload.headers });
  return { key, upload, sent };
}

test.afterAll(() => db.cleanup());

test.describe("who may upload", () => {
  test("signed-out visitors get 401 on every upload route", async ({ request }) => {
    expect((await requestUpload(request, "audio/mpeg", 10)).status()).toBe(401);
    const put = await request.put("/api/admin/uploads/local?token=x", { data: "x" });
    expect(put.status()).toBe(401);
    const complete = await request.post("/api/admin/uploads/complete", {
      data: { key: "k", bytes: 1 },
    });
    expect(complete.status()).toBe(401);
  });

  test("a signed-in account that isn't an admin gets 403", async ({ context }) => {
    await signInAs(context, "listener@example.test");
    expect((await requestUpload(context.request, "audio/mpeg", 10)).status()).toBe(403);
  });
});

test.describe("uploading a recording", () => {
  test("a real MP3 goes through request, upload and verification", async ({ context }) => {
    await signInAs(context, E2E_ADMIN_EMAIL);
    const api = context.request;
    const data = fakeMp3();
    const { key, sent } = await uploadFile(api, data);
    expect(sent.status()).toBe(204);

    const done = await api.post("/api/admin/uploads/complete", {
      data: { key, bytes: data.length },
    });
    expect(done.status()).toBe(200);
    expect(await done.json()).toEqual({ key, kind: "mp3", bytes: data.length });
  });

  test("an upload link works once and cannot overwrite the original", async ({ context }) => {
    await signInAs(context, E2E_ADMIN_EMAIL);
    const api = context.request;
    const data = fakeMp3();
    const { upload } = await uploadFile(api, data);
    const again = await api.put(upload.url, { data, headers: upload.headers });
    expect(again.status()).toBe(409);
  });

  test("a file that isn't audio is rejected and removed, whatever it claims to be", async ({
    context,
  }) => {
    await signInAs(context, E2E_ADMIN_EMAIL);
    const api = context.request;
    const html = Buffer.from("<!doctype html><script>alert(1)</script>");
    const { key, sent } = await uploadFile(api, html);
    expect(sent.status()).toBe(204);

    const body = { key, bytes: html.length };
    expect((await api.post("/api/admin/uploads/complete", { data: body })).status()).toBe(422);
    // Removed from storage: checking again finds nothing.
    expect((await api.post("/api/admin/uploads/complete", { data: body })).status()).toBe(404);
  });

  test("bad requests are refused before any link is issued", async ({ context }) => {
    await signInAs(context, E2E_ADMIN_EMAIL);
    const api = context.request;
    expect((await requestUpload(api, "video/mp4", 100)).status()).toBe(400);
    expect((await requestUpload(api, "audio/mpeg", 0)).status()).toBe(400);
    expect((await requestUpload(api, "audio/mpeg", 301 * 1024 * 1024)).status()).toBe(400);
    expect((await api.post("/api/admin/uploads", { data: { nonsense: true } })).status()).toBe(400);
  });

  test("a forged or mismatched upload link is refused", async ({ context }) => {
    await signInAs(context, E2E_ADMIN_EMAIL);
    const api = context.request;
    const forged = await api.put("/api/admin/uploads/local?token=forged.token", {
      data: fakeMp3(),
      headers: { "Content-Type": "audio/mpeg" },
    });
    expect(forged.status()).toBe(403);

    const { upload } = await (await requestUpload(api, "audio/mpeg", 4000)).json();
    const wrongType = await api.put(upload.url, {
      data: fakeMp3(),
      headers: { "Content-Type": "audio/wav" },
    });
    expect(wrongType.status()).toBe(415);
    const wrongSize = await api.put(upload.url, { data: fakeMp3(10), headers: upload.headers });
    expect(wrongSize.status()).toBe(422);
  });
});

test.describe("playing a recording", () => {
  /** An uploaded file attached to a recording with the given status. */
  async function recordingWithAudio(api: APIRequestContext, status: "DRAFT" | "PUBLISHED") {
    const data = fakeMp3(5000);
    const { key } = await uploadFile(api, data);
    const assetId = await db.addRecording(key, data.length, status);
    return { assetId, data };
  }

  test("published audio is public and supports Range requests (seeking)", async ({
    playwright,
    context,
  }) => {
    await signInAs(context, E2E_ADMIN_EMAIL);
    const { assetId, data } = await recordingWithAudio(context.request, "PUBLISHED");

    // A listener: no cookies at all.
    const baseURL = test.info().project.use.baseURL;
    const listener = await playwright.request.newContext({ baseURL });
    const whole = await listener.get(`/api/audio/${assetId}`);
    expect(whole.status()).toBe(200);
    expect(whole.headers()["accept-ranges"]).toBe("bytes");
    expect(whole.headers()["content-type"]).toBe("audio/mpeg");
    expect(await whole.body()).toEqual(data);

    const part = await listener.get(`/api/audio/${assetId}`, {
      headers: { Range: "bytes=1000-1999" },
    });
    expect(part.status()).toBe(206);
    expect(part.headers()["content-range"]).toBe("bytes 1000-1999/5000");
    expect(await part.body()).toEqual(data.subarray(1000, 2000));

    const past = await listener.get(`/api/audio/${assetId}`, { headers: { Range: "bytes=9000-" } });
    expect(past.status()).toBe(416);
    await listener.dispose();
  });

  test("draft audio is hidden from listeners but open to admins", async ({
    playwright,
    context,
  }) => {
    await signInAs(context, E2E_ADMIN_EMAIL);
    const { assetId } = await recordingWithAudio(context.request, "DRAFT");

    const baseURL = test.info().project.use.baseURL;
    const listener = await playwright.request.newContext({ baseURL });
    expect((await listener.get(`/api/audio/${assetId}`)).status()).toBe(404);
    await listener.dispose();

    const asAdmin = await context.request.get(`/api/audio/${assetId}`);
    expect(asAdmin.status()).toBe(200);
    expect(asAdmin.headers()["cache-control"]).toContain("no-store");
  });

  test("an unknown recording is a 404", async ({ request }) => {
    expect((await request.get("/api/audio/does-not-exist")).status()).toBe(404);
  });
});
