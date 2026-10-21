import { describe, expect, it } from "vitest";
import { adminNavItem, listenerScreen, readerTitle } from "./routes";

describe("listenerScreen", () => {
  it.each([
    ["/", "home", "/"],
    ["/read/john/1", "read", "/read"],
    ["/memorize", "choice", "/read"],
    ["/memorize/steps", "steps", "/memorize/steps"],
    ["/memorize/range", "range", "/memorize/steps"],
    ["/memorize/flashcards", "cards", "/memorize/flashcards"],
    ["/nowhere", "other", null],
  ])("%s is the %s screen with %s highlighted", (path, id, nav) => {
    expect(listenerScreen(path)).toMatchObject({ id, nav });
  });

  it("highlights the screen the range page will return to", () => {
    expect(listenerScreen("/memorize/range", "flashcards").nav).toBe("/memorize/flashcards");
    expect(listenerScreen("/memorize/range", "read").nav).toBe("/read");
    expect(listenerScreen("/memorize/range", "steps").nav).toBe("/memorize/steps");
  });

  it("ignores a trailing slash", () => {
    expect(listenerScreen("/memorize/")).toMatchObject({ id: "choice" });
  });
});

describe("readerTitle", () => {
  it("turns a book slug and chapter into a reference", () => {
    expect(readerTitle("/read/1-john/3")).toBe("1 John 3");
  });

  it("uses the real book name", () => {
    expect(readerTitle("/read/song-of-solomon/2")).toBe("Song of Solomon 2");
  });

  it("defaults to John 1", () => {
    expect(readerTitle("/read")).toBe("John 1");
  });
});

describe("adminNavItem", () => {
  it("matches the dashboard only on /admin itself", () => {
    expect(adminNavItem("/admin")?.label).toBe("Dashboard");
    expect(adminNavItem("/admin/upload")?.label).toBe("Upload music");
  });

  it("matches nested pages to their section", () => {
    expect(adminNavItem("/admin/library/abc")?.label).toBe("Track library");
  });
});
