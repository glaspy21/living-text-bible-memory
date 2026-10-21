import { describe, expect, it } from "vitest";
import { loadReaderChapter, loadStudyPassage } from "./reader";
import { ScriptureUnavailableError, type ScriptureProvider } from "./types";

const verses = (text: string) => [{ chapter: 1, verse: 1, text }];

function provider(
  translation: "WEB" | "ESV",
  result: string | ScriptureUnavailableError,
): ScriptureProvider {
  return {
    translation,
    getChapter: async () => {
      if (result instanceof Error) throw result;
      return verses(result);
    },
    getPassage: async () => [],
    verseCount: async () => 1,
  };
}

const providers = (esv: string | ScriptureUnavailableError) => (code: "WEB" | "ESV") =>
  code === "WEB" ? provider("WEB", "web text") : provider("ESV", esv);

describe("loadReaderChapter", () => {
  it("returns the preferred translation when it can supply the chapter", async () => {
    const got = await loadReaderChapter("john", 1, "ESV", providers("esv text"));
    expect(got).toMatchObject({ translation: "ESV", note: null });
    expect(got.verses[0].text).toBe("esv text");
  });

  it("reads the WEB directly when that is the preference", async () => {
    expect(await loadReaderChapter("john", 1, "WEB", providers("unused"))).toMatchObject({
      translation: "WEB",
      note: null,
    });
  });

  it("falls back to the WEB with a note outside the ESV scope", async () => {
    const got = await loadReaderChapter(
      "genesis",
      1,
      "ESV",
      providers(new ScriptureUnavailableError("scope", "out-of-scope")),
    );
    expect(got.translation).toBe("WEB");
    expect(got.note).toContain("isn't available for this chapter yet");
    expect(got.verses[0].text).toBe("web text");
  });

  it("falls back with a different note when the ESV service is down", async () => {
    const got = await loadReaderChapter(
      "john",
      1,
      "ESV",
      providers(new ScriptureUnavailableError("down", "source-error")),
    );
    expect(got.translation).toBe("WEB");
    expect(got.note).toContain("can't be reached");
  });

  it("does not hide an unknown chapter behind the fallback", async () => {
    await expect(
      loadReaderChapter(
        "john",
        99,
        "ESV",
        providers(new ScriptureUnavailableError("nope", "not-found")),
      ),
    ).rejects.toMatchObject({ reason: "not-found" });
  });
});

describe("loadStudyPassage", () => {
  const ref = { book: "john", start: { chapter: 1, verse: 1 }, end: { chapter: 1, verse: 1 } };

  it("keeps the whole passage in one translation, falling back for all of it", async () => {
    const provider = (code: "WEB" | "ESV"): ScriptureProvider => ({
      translation: code,
      getChapter: async () => [],
      getPassage: async () => {
        if (code === "ESV") throw new ScriptureUnavailableError("scope", "out-of-scope");
        return verses("web passage").map((v) => ({ book: "john", ...v }));
      },
      verseCount: async () => 1,
    });
    const got = await loadStudyPassage(ref, "ESV", provider);
    expect(got.translation).toBe("WEB");
    expect(got.note).toContain("isn't available for this passage yet");
    expect(got.verses[0].text).toBe("web passage");
  });

  it("returns the preferred translation when it can supply the passage", async () => {
    const provider = (code: "WEB" | "ESV"): ScriptureProvider => ({
      translation: code,
      getChapter: async () => [],
      getPassage: async () => verses(`${code} passage`).map((v) => ({ book: "john", ...v })),
      verseCount: async () => 1,
    });
    expect(await loadStudyPassage(ref, "ESV", provider)).toMatchObject({
      translation: "ESV",
      note: null,
    });
  });
});
