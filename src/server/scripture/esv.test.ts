import { describe, expect, it, vi } from "vitest";
import { EsvProvider } from "./esv";
import { ScriptureUnavailableError } from "./types";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function provider(fetchImpl: typeof fetch, now?: () => number) {
  return new EsvProvider({ apiKey: "test-key", fetchImpl, now });
}

describe("EsvProvider", () => {
  it("asks the API for plain verse text with the key in a header, never the URL", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ passages: ["[1] One. [2] Two."] }));
    const verses = await provider(fetchImpl as unknown as typeof fetch).getChapter("john", 1);

    expect(verses).toEqual([
      { chapter: 1, verse: 1, text: "One." },
      { chapter: 1, verse: 2, text: "Two." },
    ]);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.searchParams.get("q")).toBe("John 1");
    expect(url.searchParams.get("include-headings")).toBe("false");
    expect(url.searchParams.get("include-footnotes")).toBe("false");
    expect(url.toString()).not.toContain("test-key");
    expect((init.headers as Record<string, string>).Authorization).toBe("Token test-key");
  });

  it("refuses anything outside John 1–2 without calling the API", async () => {
    const fetchImpl = vi.fn();
    const esv = provider(fetchImpl as unknown as typeof fetch);
    for (const [book, chapter] of [
      ["john", 3],
      ["genesis", 1],
      ["1-john", 1],
    ] as const) {
      await expect(esv.getChapter(book, chapter)).rejects.toMatchObject({ reason: "out-of-scope" });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("refuses a passage that runs past the scope", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ passages: ["[1] One."] }));
    await expect(
      provider(fetchImpl as unknown as typeof fetch).getPassage({
        book: "john",
        start: { chapter: 2, verse: 1 },
        end: { chapter: 3, verse: 2 },
      }),
    ).rejects.toMatchObject({ reason: "out-of-scope" });
  });

  it("serves repeat reads from memory until the cache expires", async () => {
    let now = 0;
    const fetchImpl = vi.fn(async () => jsonResponse({ passages: ["[1] One."] }));
    const esv = provider(fetchImpl as unknown as typeof fetch, () => now);
    await esv.getChapter("john", 1);
    await esv.getChapter("john", 1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    now = 60 * 60 * 1000 + 1;
    await esv.getChapter("john", 1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("reports a failing service without leaking the key", async () => {
    const down = provider((async () => jsonResponse({ detail: "secret" }, 403)) as typeof fetch);
    const error = await down.getChapter("john", 1).catch((e) => e);
    expect(error).toBeInstanceOf(ScriptureUnavailableError);
    expect(error.reason).toBe("source-error");
    expect(error.message).toContain("403");
    expect(error.message).not.toContain("test-key");

    const offline = provider((async () => {
      throw new Error("network");
    }) as typeof fetch);
    await expect(offline.getChapter("john", 1)).rejects.toMatchObject({ reason: "source-error" });
  });

  it("treats an empty answer as an error rather than empty Scripture", async () => {
    const empty = provider((async () => jsonResponse({ passages: [""] })) as typeof fetch);
    await expect(empty.getChapter("john", 1)).rejects.toMatchObject({ reason: "source-error" });
  });
});
